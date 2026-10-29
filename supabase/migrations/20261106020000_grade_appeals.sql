-- f85 Grade appeal and remark desk.
-- Additive only: creates one new table, one new permission and the RPCs the
-- appeal desk uses. Nothing existing is dropped, renamed or renumbered, and no
-- data is deleted. Browser roles get SELECT only: every write below re-checks
-- the caller's identity, role and authorization on the server.
begin;

insert into public.permissions(key, grp, label, description, sort)
values ('grades.review_appeals', 'Academics', 'Review grade appeals',
        'Read student grade appeals and confirm or adjust the recorded score. Staff only.', 95)
on conflict (key) do nothing;

insert into public.role_permissions(role, permission)
values ('School Admin', 'grades.review_appeals'), ('Teacher', 'grades.review_appeals')
on conflict do nothing;

create or replace function public.can_review_grade_appeals()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('grades.review_appeals') and exists (
    select 1 from public.profiles where id = auth.uid() and status = 'Active' and role <> 'Student'
  );
$$;
revoke all on function public.can_review_grade_appeals() from public;
grant execute on function public.can_review_grade_appeals() to authenticated;

create table if not exists public.grade_appeals (
  id uuid primary key,
  student_id uuid not null references public.profiles(id),
  student_name text not null,
  work_kind text not null check (work_kind in ('assignment', 'quiz')),
  assignment_id uuid references public.assignments(id),
  quiz_attempt_id uuid references public.quiz_attempts(id),
  work_title text not null,
  original_score numeric not null check (original_score >= 0),
  max_score numeric not null check (max_score > 0),
  reason text not null check (length(btrim(reason)) between 1 and 4000),
  status text not null default 'submitted' check (status in ('submitted', 'adjusted', 'upheld')),
  adjusted_score numeric check (adjusted_score is null or adjusted_score >= 0),
  decision_note text check (decision_note is null or length(btrim(decision_note)) between 1 and 2000),
  decided_by uuid references public.profiles(id),
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_appeals_one_work check (
    (work_kind = 'assignment' and assignment_id is not null and quiz_attempt_id is null)
    or (work_kind = 'quiz' and quiz_attempt_id is not null and assignment_id is null)
  )
);

create index if not exists grade_appeals_owner_created on public.grade_appeals(student_id, created_at desc);
create index if not exists grade_appeals_status_created on public.grade_appeals(status, created_at desc);
create unique index if not exists grade_appeals_open_assignment
  on public.grade_appeals(student_id, assignment_id) where work_kind = 'assignment' and status = 'submitted';
create unique index if not exists grade_appeals_open_quiz
  on public.grade_appeals(student_id, quiz_attempt_id) where work_kind = 'quiz' and status = 'submitted';

alter table public.grade_appeals enable row level security;

drop policy if exists grade_appeals_read on public.grade_appeals;
create policy grade_appeals_read on public.grade_appeals for select to authenticated using (
  public.can_review_grade_appeals()
  or (student_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and status = 'Active'
  ))
);

revoke all on public.grade_appeals from anon, authenticated;
grant select on public.grade_appeals to authenticated;

-- Marks the caller can ask the school to reconsider. Reads only the caller's own rows.
create or replace function public.list_appealable_work()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(item order by item->>'recorded_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'kind', 'assignment',
      'ref_id', a.id,
      'title', a.title,
      'score', s.marks,
      'max_score', a.max_marks,
      'recorded_at', coalesce(to_jsonb(s)->>'submitted_at', a.due_date::text),
      'appeal_status', (select ga.status from public.grade_appeals ga
        where ga.student_id = auth.uid() and ga.assignment_id = a.id
        order by ga.created_at desc limit 1)
    ) as item
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.student_id = auth.uid() and s.marks is not null and a.max_marks > 0
    union all
    select jsonb_build_object(
      'kind', 'quiz',
      'ref_id', at.id,
      'title', q.title,
      'score', at.score,
      'max_score', at.max_score,
      'recorded_at', coalesce(at.submitted_at, at.started_at)::text,
      'appeal_status', (select ga.status from public.grade_appeals ga
        where ga.student_id = auth.uid() and ga.quiz_attempt_id = at.id
        order by ga.created_at desc limit 1)
    )
    from public.quiz_attempts at
    join public.quizzes q on q.id = at.quiz_id
    where at.student_id = auth.uid() and at.status <> 'in_progress'
      and at.score is not null and coalesce(at.max_score, 0) > 0
  ) rows;
$$;
revoke all on function public.list_appealable_work() from public;
grant execute on function public.list_appealable_work() to authenticated;

create or replace function public.create_grade_appeal(p_id uuid, p_kind text, p_ref uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  actor public.profiles%rowtype;
  existing public.grade_appeals%rowtype;
  v_title text;
  v_score numeric;
  v_max numeric;
begin
  select * into actor from public.profiles
    where id = auth.uid() and status = 'Active' and role = 'Student';
  if not found then raise exception 'An active student account is required'; end if;

  -- Serialize per-student creation so retries and rate limits stay consistent.
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text, 0));

  select * into existing from public.grade_appeals where id = p_id;
  if found then
    if existing.student_id <> actor.id then raise exception 'Appeal ID unavailable'; end if;
    return existing.id;
  end if;

  if p_reason is null or length(btrim(p_reason)) not between 1 and 4000 then
    raise exception 'Explain your reason in 1–4000 characters';
  end if;
  if p_kind is null or p_kind not in ('assignment', 'quiz') then
    raise exception 'Choose the marked work you want reviewed';
  end if;
  if (select count(*) from public.grade_appeals
      where student_id = actor.id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have reached the daily limit of 5 appeals. Please wait before submitting more';
  end if;

  if p_kind = 'assignment' then
    select a.title, s.marks, a.max_marks into v_title, v_score, v_max
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.assignment_id = p_ref and s.student_id = actor.id;
    if v_title is null then raise exception 'That marked assignment was not found on your record'; end if;
    if v_score is null then raise exception 'This assignment has not been marked yet'; end if;
    if exists (select 1 from public.grade_appeals
        where student_id = actor.id and assignment_id = p_ref and status = 'submitted') then
      raise exception 'You already have an open appeal for this assignment';
    end if;
    insert into public.grade_appeals(
      id, student_id, student_name, work_kind, assignment_id, work_title,
      original_score, max_score, reason)
    values (
      p_id, actor.id,
      coalesce(nullif(btrim(to_jsonb(actor)->>'name'), ''), nullif(btrim(actor.full_name), ''), 'Account holder'),
      'assignment', p_ref, v_title, v_score, v_max, btrim(p_reason));
  else
    select q.title, at.score, at.max_score into v_title, v_score, v_max
      from public.quiz_attempts at
      join public.quizzes q on q.id = at.quiz_id
      where at.id = p_ref and at.student_id = actor.id and at.status <> 'in_progress';
    if v_title is null then raise exception 'That marked quiz attempt was not found on your record'; end if;
    if v_score is null then raise exception 'This quiz has not been marked yet'; end if;
    if v_max is null or v_max <= 0 then raise exception 'This quiz has no markable score'; end if;
    if exists (select 1 from public.grade_appeals
        where student_id = actor.id and quiz_attempt_id = p_ref and status = 'submitted') then
      raise exception 'You already have an open appeal for this quiz attempt';
    end if;
    insert into public.grade_appeals(
      id, student_id, student_name, work_kind, quiz_attempt_id, work_title,
      original_score, max_score, reason)
    values (
      p_id, actor.id,
      coalesce(nullif(btrim(to_jsonb(actor)->>'name'), ''), nullif(btrim(actor.full_name), ''), 'Account holder'),
      'quiz', p_ref, v_title, v_score, v_max, btrim(p_reason));
  end if;

  return p_id;
end; $$;
revoke all on function public.create_grade_appeal(uuid, text, uuid, text) from public;
grant execute on function public.create_grade_appeal(uuid, text, uuid, text) to authenticated;

-- Staff decision. 'adjusted' writes the new mark into the real grade record;
-- 'upheld' records the decision without touching the mark.
create or replace function public.decide_grade_appeal(p_appeal uuid, p_decision text, p_score numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  appeal public.grade_appeals%rowtype;
  reviewer public.profiles%rowtype;
  v_quiz_id uuid;
  v_pass_mark numeric;
  v_cohort uuid;
  v_max numeric;
  v_percent numeric;
  v_feedback text;
begin
  if not public.can_review_grade_appeals() then raise exception 'Grade appeal review permission required'; end if;
  select * into reviewer from public.profiles where id = auth.uid() and status = 'Active' and role <> 'Student';
  if not found then raise exception 'An active staff account is required'; end if;

  select * into appeal from public.grade_appeals where id = p_appeal for update;
  if not found then raise exception 'Appeal not found'; end if;
  if appeal.status <> 'submitted' then raise exception 'This appeal has already been decided'; end if;
  if p_decision is null or p_decision not in ('adjusted', 'upheld') then raise exception 'Choose adjust or uphold'; end if;
  if p_note is null or length(btrim(p_note)) not between 3 and 2000 then
    raise exception 'Write a decision note of 3–2000 characters; the student sees it';
  end if;

  if p_decision = 'adjusted' then
    if p_score is null or p_score < 0 or p_score > appeal.max_score then
      raise exception 'The adjusted mark must be between 0 and %', appeal.max_score;
    end if;
    v_max := appeal.max_score;

    if appeal.work_kind = 'assignment' then
      select a.cohort_id into v_cohort from public.assignments a where a.id = appeal.assignment_id;
      if not (
        (select public.has_permission('assignments.manage'))
        or ((select public.has_permission('assignments.own')) and (select public.is_cohort_teacher(v_cohort)))
      ) then
        raise exception 'You are not authorized to change this assignment mark';
      end if;
      select feedback into v_feedback from public.submissions
        where assignment_id = appeal.assignment_id and student_id = appeal.student_id;
      update public.submissions
        set marks = round(p_score, 2),
            status = 'Graded',
            feedback = left(concat_ws(E'\n\n', nullif(btrim(coalesce(v_feedback, '')), ''),
              'Appeal decision: ' || btrim(p_note)), 4000)
        where assignment_id = appeal.assignment_id and student_id = appeal.student_id;
      if not found then raise exception 'The student submission for this assignment no longer exists'; end if;
    else
      select at.quiz_id into v_quiz_id from public.quiz_attempts at where at.id = appeal.quiz_attempt_id;
      if v_quiz_id is null then raise exception 'That quiz attempt no longer exists'; end if;
      if not ((select public.can_manage_quiz(v_quiz_id)) or (select public.has_permission('quizzes.manage_all'))) then
        raise exception 'You are not authorized to change this quiz mark';
      end if;
      select pass_mark into v_pass_mark from public.quizzes where id = v_quiz_id;
      v_percent := case when v_max > 0 then round(p_score / v_max * 100, 2) else 0 end;
      update public.quiz_attempts
        set score = round(p_score, 2),
            percent = v_percent,
            passed = v_percent >= coalesce(v_pass_mark, 50)
        where id = appeal.quiz_attempt_id;
    end if;
  end if;

  update public.grade_appeals set
    status = p_decision,
    adjusted_score = case when p_decision = 'adjusted' then round(p_score, 2) else null end,
    decision_note = btrim(p_note),
    decided_by = reviewer.id,
    decided_by_name = coalesce(nullif(btrim(to_jsonb(reviewer)->>'name'), ''), nullif(btrim(reviewer.full_name), ''), 'Staff'),
    decided_at = now(),
    updated_at = now()
  where id = p_appeal;

  return jsonb_build_object(
    'status', p_decision,
    'adjusted_score', case when p_decision = 'adjusted' then round(p_score, 2) else null end,
    'decided_at', now()
  );
end; $$;
revoke all on function public.decide_grade_appeal(uuid, text, numeric, text) from public;
grant execute on function public.decide_grade_appeal(uuid, text, numeric, text) to authenticated;

comment on table public.grade_appeals is
  'f85: student grade appeals for marked assignments and quiz attempts. Writes only through create_grade_appeal / decide_grade_appeal.';
comment on function public.decide_grade_appeal(uuid, text, numeric, text) is
  'Adjusts submissions.marks for assignment appeals and quiz_attempts.score for quiz appeals. Re-grading a quiz recalculates question-level totals and can overwrite a quiz appeal adjustment.';

commit;