-- Quizzes (builder, timer, auto-grading) and Hope Assistant (AI chatbot).
-- Idempotent: safe to re-run. Must run AFTER
-- 20261014010000_roles_permissions_cms.sql, which creates
-- public.has_permission(perm text), public.is_cohort_teacher(cohort uuid)
-- and the roles/permissions/role_permissions tables.
--
-- Security model: students never read quiz_questions directly (no student
-- policy exists on that table at all) and quiz_attempts has no insert/
-- update/delete policy for authenticated users -- every write goes through
-- the SECURITY DEFINER RPCs below, which run as the function owner and
-- therefore bypass RLS. The RPCs never return the `correct` or
-- `explanation` columns before an attempt is submitted.

-- ───────────────────────── Permission catalogue ─────────────────────────
-- Learning permission keys. Role defaults mirror the plan; Super Admin is
-- never inserted (has_permission() grants it everything implicitly).

insert into public.permissions (key, grp, label, description, sort) values
  ('quizzes.take', 'Quizzes', 'Take quizzes', 'See and attempt published quizzes for own cohorts/programmes', 60),
  ('quizzes.manage', 'Quizzes', 'Manage quizzes', 'Create/edit/publish quizzes for cohorts you teach or quizzes you created', 61),
  ('quizzes.manage_all', 'Quizzes', 'Manage all quizzes', 'Manage any quiz regardless of scope', 62),
  ('quizzes.view_results', 'Quizzes', 'View quiz results', 'See attempts/scores for quizzes you can manage', 63),
  ('assistant.use', 'AI assistant', 'Use Hope Assistant', 'Use the assistant with own data when signed in', 90),
  ('assistant.admin_help', 'AI assistant', 'Assistant admin help', 'Screen guide and aggregate stats in the assistant', 91)
on conflict (key) do update set
  grp = excluded.grp, label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.role_permissions (role, permission) values
  ('Student', 'quizzes.take'),
  ('Teacher', 'quizzes.manage'),
  ('Teacher', 'quizzes.view_results'),
  ('School Admin', 'quizzes.manage'),
  ('School Admin', 'quizzes.manage_all'),
  ('School Admin', 'quizzes.view_results'),
  ('Registrar', 'quizzes.view_results'),
  ('Student', 'assistant.use'),
  ('Teacher', 'assistant.use'),
  ('School Admin', 'assistant.use'),
  ('Registrar', 'assistant.use'),
  ('Finance Officer', 'assistant.use'),
  ('Teacher', 'assistant.admin_help'),
  ('School Admin', 'assistant.admin_help'),
  ('Registrar', 'assistant.admin_help'),
  ('Finance Officer', 'assistant.admin_help')
on conflict do nothing;

-- ───────────────────────────── Quiz tables ──────────────────────────────

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  description text not null default '',
  program_id uuid references public.programs(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  time_limit_minutes int check (time_limit_minutes between 1 and 600),
  max_attempts int not null default 1 check (max_attempts between 1 and 20),
  pass_mark numeric not null default 50 check (pass_mark between 0 and 100),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  show_answers text not null default 'after_submit' check (show_answers in ('after_submit', 'after_close', 'never')),
  opens_at timestamptz,
  closes_at timestamptz,
  question_count int not null default 0,
  total_points numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_scope check (program_id is not null or cohort_id is not null),
  constraint quizzes_window check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null default 0,
  type text not null check (type in ('single', 'multi', 'true_false', 'short')),
  prompt text not null check (length(prompt) between 1 and 4000),
  options jsonb not null default '[]',
  correct jsonb not null,
  points numeric not null default 1 check (points > 0 and points <= 100),
  explanation text not null default ''
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_no int not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  question_order uuid[] not null,
  option_order jsonb not null default '{}',
  answers jsonb not null default '{}',
  results jsonb,
  score numeric,
  max_score numeric,
  percent numeric,
  passed boolean,
  unique (quiz_id, student_id, attempt_no)
);

create index if not exists quiz_attempts_student_idx on public.quiz_attempts(student_id, quiz_id);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, position);
create index if not exists quizzes_program_idx on public.quizzes(program_id);
create index if not exists quizzes_cohort_idx on public.quizzes(cohort_id);

-- ─────────────────────────── Quiz triggers ──────────────────────────────

create or replace function public._quiz_questions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  opt_count int;
  ids text[];
begin
  if new.type not in ('single', 'multi', 'true_false', 'short') then
    raise exception 'invalid_type' using errcode = 'P0001';
  end if;

  if new.type in ('single', 'multi') then
    opt_count := jsonb_array_length(new.options);
    if opt_count < 2 or opt_count > 10 then
      raise exception 'options_count' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from jsonb_array_elements(new.options) o
      where (o ->> 'id') is null or length(o ->> 'id') = 0
        or (o ->> 'text') is null or length(o ->> 'text') = 0 or length(o ->> 'text') > 500
    ) then
      raise exception 'invalid_option' using errcode = 'P0001';
    end if;
    select array_agg(o ->> 'id') into ids from jsonb_array_elements(new.options) o;
    if array_length(ids, 1) <> (select count(distinct x) from unnest(ids) x) then
      raise exception 'duplicate_option_id' using errcode = 'P0001';
    end if;
  elsif new.options is distinct from '[]'::jsonb then
    raise exception 'options_not_allowed' using errcode = 'P0001';
  end if;

  if new.type = 'single' then
    if jsonb_array_length(new.correct) <> 1
      or not exists (select 1 from jsonb_array_elements(new.options) o where (o ->> 'id') = (new.correct ->> 0))
    then
      raise exception 'invalid_correct' using errcode = 'P0001';
    end if;
  elsif new.type = 'multi' then
    if jsonb_array_length(new.correct) < 1 then
      raise exception 'invalid_correct' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(new.correct) c
      where not exists (select 1 from jsonb_array_elements(new.options) o where (o ->> 'id') = c.value)
    ) then
      raise exception 'invalid_correct' using errcode = 'P0001';
    end if;
  elsif new.type = 'true_false' then
    if jsonb_array_length(new.correct) <> 1 or jsonb_typeof(new.correct -> 0) <> 'boolean' then
      raise exception 'invalid_correct' using errcode = 'P0001';
    end if;
  elsif new.type = 'short' then
    if jsonb_array_length(new.correct) < 1 or jsonb_array_length(new.correct) > 20 then
      raise exception 'invalid_correct' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(new.correct) c
      where length(btrim(c.value)) = 0 or length(c.value) > 500
    ) then
      raise exception 'invalid_correct' using errcode = 'P0001';
    end if;
  end if;

  if new.points <= 0 or new.points > 100 then
    raise exception 'invalid_points' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

drop trigger if exists quiz_questions_validate on public.quiz_questions;
create trigger quiz_questions_validate
  before insert or update on public.quiz_questions
  for each row execute function public._quiz_questions_validate();

create or replace function public._quiz_questions_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  qid uuid;
begin
  qid := coalesce(new.quiz_id, old.quiz_id);
  update public.quizzes set
    question_count = (select count(*) from public.quiz_questions where quiz_id = qid),
    total_points = (select coalesce(sum(points), 0) from public.quiz_questions where quiz_id = qid),
    updated_at = now()
  where id = qid;
  return null;
end;
$fn$;

drop trigger if exists quiz_questions_totals on public.quiz_questions;
create trigger quiz_questions_totals
  after insert or update or delete on public.quiz_questions
  for each row execute function public._quiz_questions_totals();

create or replace function public._quizzes_touch()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists quizzes_touch on public.quizzes;
create trigger quizzes_touch
  before update on public.quizzes
  for each row execute function public._quizzes_touch();

-- ─────────────────────────── Helper functions ───────────────────────────

create or replace function public.quiz_visible_to_me(q uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.quizzes qz
    where qz.id = q
      and qz.status = 'published'
      and (
        (qz.cohort_id is not null and exists (
          select 1 from public.cohort_students cs
          where cs.cohort_id = qz.cohort_id and cs.student_id = auth.uid()
        ))
        or (qz.program_id is not null and exists (
          select 1 from public.profiles p where p.id = auth.uid() and qz.program_id = any(p.program_ids)
        ))
        or (qz.program_id is not null and exists (
          select 1 from public.cohort_students cs
          join public.cohorts c on c.id = cs.cohort_id
          where cs.student_id = auth.uid() and c.program_id = qz.program_id
        ))
      )
  );
$fn$;

create or replace function public.can_manage_quiz(q uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.quizzes qz
    where qz.id = q
      and (
        public.has_permission('quizzes.manage_all')
        or (
          public.has_permission('quizzes.manage')
          and (
            qz.created_by = auth.uid()
            or (qz.cohort_id is not null and public.is_cohort_teacher(qz.cohort_id))
            or (qz.program_id is not null and exists (
              select 1 from public.cohorts c where c.program_id = qz.program_id and c.teacher_id = auth.uid()
            ))
          )
        )
      )
  );
$fn$;

create or replace function public.can_manage_quiz_scope(p_program uuid, p_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    public.has_permission('quizzes.manage_all')
    or (
      public.has_permission('quizzes.manage')
      and (
        (p_cohort is not null and public.is_cohort_teacher(p_cohort))
        or (p_program is not null and exists (
          select 1 from public.cohorts c where c.program_id = p_program and c.teacher_id = auth.uid()
        ))
      )
    );
$fn$;

create or replace function public.can_view_quiz_results(q uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.quizzes qz
    where qz.id = q
      and public.has_permission('quizzes.view_results')
      and (
        public.has_permission('quizzes.manage_all')
        or qz.created_by = auth.uid()
        or (qz.cohort_id is not null and public.is_cohort_teacher(qz.cohort_id))
        or (qz.program_id is not null and exists (
          select 1 from public.cohorts c where c.program_id = qz.program_id and c.teacher_id = auth.uid()
        ))
      )
  );
$fn$;

grant execute on function public.quiz_visible_to_me(uuid) to authenticated;
grant execute on function public.can_manage_quiz(uuid) to authenticated;
grant execute on function public.can_manage_quiz_scope(uuid, uuid) to authenticated;
grant execute on function public.can_view_quiz_results(uuid) to authenticated;

-- ──────────────────────────────── RLS ───────────────────────────────────

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

revoke all on public.quizzes from anon;
revoke all on public.quiz_questions from anon;
revoke all on public.quiz_attempts from anon;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select on public.quiz_attempts to authenticated;

drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select to authenticated using (
  public.can_manage_quiz(id)
  or public.can_view_quiz_results(id)
  or ((select public.has_permission('quizzes.take')) and public.quiz_visible_to_me(id))
);

drop policy if exists quizzes_insert on public.quizzes;
create policy quizzes_insert on public.quizzes for insert to authenticated with check (
  (select public.has_permission('quizzes.manage'))
  and public.can_manage_quiz_scope(program_id, cohort_id)
);

drop policy if exists quizzes_update on public.quizzes;
create policy quizzes_update on public.quizzes for update to authenticated
  using (public.can_manage_quiz(id))
  with check (public.can_manage_quiz_scope(program_id, cohort_id));

drop policy if exists quizzes_delete on public.quizzes;
create policy quizzes_delete on public.quizzes for delete to authenticated using (
  public.can_manage_quiz(id)
);

drop policy if exists quiz_questions_all on public.quiz_questions;
create policy quiz_questions_all on public.quiz_questions for all to authenticated
  using (public.can_manage_quiz(quiz_id))
  with check (public.can_manage_quiz(quiz_id));

drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated using (
  student_id = auth.uid()
  or public.can_manage_quiz(quiz_id)
  or ((select public.has_permission('quizzes.view_results')) and public.can_view_quiz_results(quiz_id))
);

-- ──────────────────────────── Grading core ──────────────────────────────
-- Internal only: never callable by anon/authenticated directly. Computes
-- score/results from the frozen question_order; when p_new_status is given
-- it finalizes an in_progress attempt (idempotent -- a second call is a
-- no-op). When p_new_status is null and p_force is true it re-grades an
-- already-submitted attempt (used by regrade_quiz), preserving any
-- teacher point overrides recorded in `results`.

create or replace function public._grade_quiz_attempt(
  p_attempt_id uuid,
  p_new_status text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  att record;
  qz record;
  q record;
  total numeric := 0;
  earned numeric := 0;
  v_results jsonb := '{}'::jsonb;
  ans jsonb;
  right_picked int;
  wrong_picked int;
  num_right int;
  pts numeric;
  is_correct boolean;
  override_pts numeric;
  had_override boolean;
  norm_ans text;
  matched boolean;
  accepted text;
  pct numeric;
begin
  select * into att from public.quiz_attempts where id = p_attempt_id for update;
  if att.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_new_status is not null then
    if att.status <> 'in_progress' then
      return jsonb_build_object(
        'score', att.score, 'max_score', att.max_score, 'percent', att.percent,
        'passed', att.passed, 'status', att.status, 'submitted_at', att.submitted_at
      );
    end if;
  else
    if not p_force or att.status = 'in_progress' then
      raise exception 'not_submitted' using errcode = 'P0001';
    end if;
  end if;

  select * into qz from public.quizzes where id = att.quiz_id;

  for q in select * from public.quiz_questions where id = any(att.question_order) loop
    total := total + q.points;
    ans := att.answers -> q.id::text;
    had_override := p_force and att.results is not null
      and (att.results -> q.id::text ->> 'override') = 'true';
    if had_override then
      override_pts := (att.results -> q.id::text ->> 'points')::numeric;
    else
      override_pts := null;
    end if;

    if override_pts is not null then
      pts := override_pts;
      is_correct := pts >= q.points;
    elsif ans is null then
      pts := 0;
      is_correct := false;
    elsif q.type = 'single' then
      is_correct := jsonb_typeof(ans) = 'string' and (q.correct ->> 0) = (ans #>> '{}');
      pts := case when is_correct then q.points else 0 end;
    elsif q.type = 'true_false' then
      is_correct := jsonb_typeof(ans) = 'boolean' and (q.correct -> 0) = ans;
      pts := case when is_correct then q.points else 0 end;
    elsif q.type = 'multi' then
      num_right := jsonb_array_length(q.correct);
      if jsonb_typeof(ans) = 'array' then
        select count(*) into right_picked from jsonb_array_elements_text(ans) a
          where a.value in (select jsonb_array_elements_text(q.correct));
        select count(*) into wrong_picked from jsonb_array_elements_text(ans) a
          where a.value not in (select jsonb_array_elements_text(q.correct));
      else
        right_picked := 0;
        wrong_picked := 0;
      end if;
      pts := round(q.points * greatest(0, (right_picked - wrong_picked))::numeric / greatest(num_right, 1), 4);
      is_correct := pts >= q.points;
    elsif q.type = 'short' then
      norm_ans := lower(btrim(regexp_replace(coalesce(ans #>> '{}', ''), '\s+', ' ', 'g')));
      matched := false;
      for accepted in select jsonb_array_elements_text(q.correct) loop
        if norm_ans <> '' and lower(btrim(regexp_replace(accepted, '\s+', ' ', 'g'))) = norm_ans then
          matched := true;
        end if;
      end loop;
      is_correct := matched;
      pts := case when matched then q.points else 0 end;
    else
      pts := 0;
      is_correct := false;
    end if;

    pts := round(pts, 2);
    v_results := v_results || jsonb_build_object(
      q.id::text, jsonb_build_object('correct', is_correct, 'points', pts, 'override', override_pts is not null)
    );
    earned := earned + pts;
  end loop;

  pct := case when total > 0 then round(earned / total * 100, 2) else 0 end;

  update public.quiz_attempts set
    results = v_results,
    score = round(earned, 2),
    max_score = total,
    percent = pct,
    passed = pct >= qz.pass_mark,
    status = coalesce(p_new_status, status),
    submitted_at = case when p_new_status is not null then coalesce(submitted_at, now()) else submitted_at end
  where id = p_attempt_id;

  return jsonb_build_object(
    'score', round(earned, 2), 'max_score', total, 'percent', pct,
    'passed', pct >= qz.pass_mark, 'status', coalesce(p_new_status, att.status),
    'submitted_at', coalesce(att.submitted_at, now())
  );
end;
$fn$;

revoke all on function public._grade_quiz_attempt(uuid, text, boolean) from public, anon, authenticated;

-- Builds the student-safe payload for an attempt (no `correct`/`explanation`).

create or replace function public._attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  att record;
  qz record;
  questions jsonb := '[]'::jsonb;
  qid uuid;
  q record;
  opts jsonb;
  order_ids jsonb;
begin
  select * into att from public.quiz_attempts where id = p_attempt_id;
  if att.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into qz from public.quizzes where id = att.quiz_id;

  foreach qid in array att.question_order loop
    select * into q from public.quiz_questions where id = qid;
    order_ids := att.option_order -> qid::text;
    if order_ids is not null then
      select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'text', o ->> 'text'))
        into opts
        from jsonb_array_elements(order_ids) oid
        join jsonb_array_elements(q.options) o on (o ->> 'id') = (oid ->> 'id');
    else
      opts := '[]'::jsonb;
    end if;
    questions := questions || jsonb_build_array(jsonb_build_object(
      'id', q.id, 'type', q.type, 'prompt', q.prompt, 'points', q.points,
      'options', coalesce(opts, '[]'::jsonb)
    ));
  end loop;

  return jsonb_build_object(
    'attempt_id', att.id,
    'attempt_no', att.attempt_no,
    'status', att.status,
    'deadline_at', att.deadline_at,
    'server_now', now(),
    'quiz', jsonb_build_object(
      'id', qz.id, 'title', qz.title, 'description', qz.description,
      'time_limit_minutes', qz.time_limit_minutes, 'total_points', qz.total_points,
      'max_attempts', qz.max_attempts, 'pass_mark', qz.pass_mark
    ),
    'questions', questions,
    'answers', att.answers
  );
end;
$fn$;

revoke all on function public._attempt_payload(uuid) from public, anon, authenticated;

-- ──────────────────────────── Quiz RPCs ─────────────────────────────────

create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  qz record;
  existing record;
  attempts_used int;
  new_id uuid;
  new_no int;
  qorder uuid[];
  oorder jsonb := '{}'::jsonb;
  q record;
  opt_ids jsonb;
  deadline timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not public.has_permission('quizzes.take') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not public.quiz_visible_to_me(p_quiz_id) then
    raise exception 'not_visible' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_quiz_id::text || ':' || auth.uid()::text)::bigint);

  select * into qz from public.quizzes where id = p_quiz_id;
  if qz.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (qz.opens_at is not null and now() < qz.opens_at) or (qz.closes_at is not null and now() >= qz.closes_at) then
    raise exception 'quiz_closed' using errcode = 'P0001';
  end if;

  select * into existing from public.quiz_attempts
    where quiz_id = p_quiz_id and student_id = auth.uid() and status = 'in_progress'
    order by attempt_no desc limit 1
    for update;

  if existing.id is not null and existing.deadline_at is not null
    and now() > existing.deadline_at + interval '10 seconds'
  then
    perform public._grade_quiz_attempt(existing.id, 'auto_submitted');
    existing.id := null;
  end if;

  if existing.id is not null then
    new_id := existing.id;
  else
    select coalesce(max(attempt_no), 0) into attempts_used
      from public.quiz_attempts where quiz_id = p_quiz_id and student_id = auth.uid();
    if attempts_used >= qz.max_attempts then
      raise exception 'attempts_exhausted' using errcode = 'P0001';
    end if;

    select array_agg(id order by (case when qz.shuffle_questions then random() else 0 end), position)
      into qorder
      from public.quiz_questions where quiz_id = p_quiz_id;
    if qorder is null or array_length(qorder, 1) = 0 then
      raise exception 'no_questions' using errcode = 'P0001';
    end if;

    for q in select * from public.quiz_questions where quiz_id = p_quiz_id loop
      if jsonb_array_length(q.options) > 0 then
        if qz.shuffle_options then
          select jsonb_agg(elem order by random()) into opt_ids from jsonb_array_elements(q.options) elem;
        else
          opt_ids := q.options;
        end if;
        oorder := oorder || jsonb_build_object(
          q.id::text, (select jsonb_agg(e -> 'id') from jsonb_array_elements(opt_ids) e)
        );
      end if;
    end loop;

    new_no := attempts_used + 1;
    deadline := case
      when qz.time_limit_minutes is not null then
        least(now() + (qz.time_limit_minutes || ' minutes')::interval,
              coalesce(qz.closes_at, now() + (qz.time_limit_minutes || ' minutes')::interval))
      else qz.closes_at
    end;

    insert into public.quiz_attempts (
      quiz_id, student_id, attempt_no, status, started_at, deadline_at, question_order, option_order, answers
    ) values (
      p_quiz_id, auth.uid(), new_no, 'in_progress', now(), deadline, qorder, oorder, '{}'::jsonb
    ) returning id into new_id;
  end if;

  return public._attempt_payload(new_id);
end;
$fn$;

grant execute on function public.start_quiz_attempt(uuid) to authenticated;

create or replace function public.save_quiz_answer(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  att record;
  q record;
  valid boolean := false;
  grace interval := interval '10 seconds';
begin
  select * into att from public.quiz_attempts where id = p_attempt_id for update;
  if att.id is null or att.student_id <> auth.uid() then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if att.status <> 'in_progress' then
    raise exception 'attempt_closed' using errcode = 'P0001';
  end if;
  if not (p_question_id = any(att.question_order)) then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;

  if att.deadline_at is not null and now() > att.deadline_at + grace then
    perform public._grade_quiz_attempt(p_attempt_id, 'auto_submitted');
    return jsonb_build_object('status', 'time_up');
  end if;

  select * into q from public.quiz_questions where id = p_question_id;

  if q.type = 'single' then
    valid := jsonb_typeof(p_answer) = 'string' and exists (
      select 1 from jsonb_array_elements(q.options) o where (o ->> 'id') = (p_answer #>> '{}')
    );
  elsif q.type = 'multi' then
    valid := jsonb_typeof(p_answer) = 'array' and not exists (
      select 1 from jsonb_array_elements_text(p_answer) a
      where not exists (select 1 from jsonb_array_elements(q.options) o where (o ->> 'id') = a.value)
    );
  elsif q.type = 'true_false' then
    valid := jsonb_typeof(p_answer) = 'boolean';
  elsif q.type = 'short' then
    valid := jsonb_typeof(p_answer) = 'string' and length(p_answer #>> '{}') <= 500;
  end if;

  if not valid then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;

  update public.quiz_attempts
    set answers = answers || jsonb_build_object(p_question_id::text, p_answer)
    where id = p_attempt_id;

  return jsonb_build_object('saved_at', now(), 'server_now', now());
end;
$fn$;

grant execute on function public.save_quiz_answer(uuid, uuid, jsonb) to authenticated;

create or replace function public.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  att record;
  merged jsonb;
  k text;
  v jsonb;
  grace interval := interval '10 seconds';
  late boolean;
  result jsonb;
begin
  select * into att from public.quiz_attempts where id = p_attempt_id for update;
  if att.id is null or att.student_id <> auth.uid() then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if att.status <> 'in_progress' then
    return jsonb_build_object(
      'score', att.score, 'max_score', att.max_score, 'percent', att.percent, 'passed', att.passed,
      'status', att.status, 'submitted_at', att.submitted_at, 'review_available', true
    );
  end if;

  late := att.deadline_at is not null and now() > att.deadline_at + grace;

  if not late and p_answers is not null then
    merged := att.answers;
    for k, v in select * from jsonb_each(p_answers) loop
      begin
        if k::uuid = any(att.question_order) then
          merged := merged || jsonb_build_object(k, v);
        end if;
      exception when others then
        null;
      end;
    end loop;
    update public.quiz_attempts set answers = merged where id = p_attempt_id;
  end if;

  select public._grade_quiz_attempt(p_attempt_id, case when late then 'auto_submitted' else 'submitted' end)
    into result;
  return result || jsonb_build_object('review_available', true);
end;
$fn$;

grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

create or replace function public.get_quiz_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  att record;
  qz record;
  can_view boolean;
  allowed boolean := false;
  questions jsonb := '[]'::jsonb;
  qid uuid;
  q record;
  opts jsonb;
  order_ids jsonb;
  student_ans jsonb;
  res jsonb;
begin
  select * into att from public.quiz_attempts where id = p_attempt_id;
  if att.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into qz from public.quizzes where id = att.quiz_id;

  can_view := public.can_view_quiz_results(qz.id) or public.can_manage_quiz(qz.id);

  if att.student_id = auth.uid() then
    if att.status = 'in_progress' then
      raise exception 'not_submitted' using errcode = 'P0001';
    end if;
    if qz.show_answers = 'after_submit' then
      allowed := true;
    elsif qz.show_answers = 'after_close' then
      allowed := qz.closes_at is not null and now() >= qz.closes_at;
    end if;
  elsif can_view then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'review_unavailable' using errcode = 'P0001';
  end if;

  foreach qid in array att.question_order loop
    select * into q from public.quiz_questions where id = qid;
    order_ids := att.option_order -> qid::text;
    if order_ids is not null then
      select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'text', o ->> 'text'))
        into opts
        from jsonb_array_elements(order_ids) oid
        join jsonb_array_elements(q.options) o on (o ->> 'id') = (oid ->> 'id');
    else
      opts := '[]'::jsonb;
    end if;
    student_ans := att.answers -> q.id::text;
    res := coalesce(att.results -> q.id::text, '{}'::jsonb);
    questions := questions || jsonb_build_array(jsonb_build_object(
      'id', q.id, 'type', q.type, 'prompt', q.prompt, 'points', q.points,
      'options', coalesce(opts, '[]'::jsonb), 'correct', q.correct, 'explanation', q.explanation,
      'answer', student_ans, 'awarded', res -> 'points', 'is_correct', res -> 'correct'
    ));
  end loop;

  return jsonb_build_object(
    'attempt_id', att.id, 'score', att.score, 'max_score', att.max_score, 'percent', att.percent,
    'passed', att.passed, 'status', att.status, 'submitted_at', att.submitted_at, 'questions', questions
  );
end;
$fn$;

grant execute on function public.get_quiz_review(uuid) to authenticated;

create or replace function public.finalize_expired_quiz_attempts(p_quiz_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int := 0;
  r record;
begin
  for r in
    select a.id from public.quiz_attempts a
    where a.status = 'in_progress'
      and a.deadline_at is not null
      and now() > a.deadline_at + interval '10 seconds'
      and (p_quiz_id is null or a.quiz_id = p_quiz_id)
      and (
        a.student_id = auth.uid()
        or public.can_manage_quiz(a.quiz_id)
        or public.can_view_quiz_results(a.quiz_id)
      )
  loop
    perform public._grade_quiz_attempt(r.id, 'auto_submitted');
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

grant execute on function public.finalize_expired_quiz_attempts(uuid) to authenticated;

create or replace function public.adjust_quiz_answer_points(p_attempt_id uuid, p_question_id uuid, p_points numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  att record;
  q record;
  qz record;
  clamped numeric;
  new_results jsonb;
  earned numeric := 0;
  pct numeric;
  key text;
  val jsonb;
begin
  select * into att from public.quiz_attempts where id = p_attempt_id for update;
  if att.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.can_manage_quiz(att.quiz_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if att.status = 'in_progress' then
    raise exception 'not_submitted' using errcode = 'P0001';
  end if;
  if not (p_question_id = any(att.question_order)) then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;

  select * into q from public.quiz_questions where id = p_question_id;
  clamped := greatest(0, least(p_points, q.points));

  new_results := coalesce(att.results, '{}'::jsonb) || jsonb_build_object(
    p_question_id::text, jsonb_build_object('correct', clamped >= q.points, 'points', round(clamped, 2), 'override', true)
  );

  for key, val in select * from jsonb_each(new_results) loop
    earned := earned + coalesce((val ->> 'points')::numeric, 0);
  end loop;

  select * into qz from public.quizzes where id = att.quiz_id;
  pct := case when att.max_score > 0 then round(earned / att.max_score * 100, 2) else 0 end;

  update public.quiz_attempts set
    results = new_results, score = round(earned, 2), percent = pct, passed = pct >= qz.pass_mark
  where id = p_attempt_id;

  return jsonb_build_object('score', round(earned, 2), 'percent', pct, 'passed', pct >= qz.pass_mark);
end;
$fn$;

grant execute on function public.adjust_quiz_answer_points(uuid, uuid, numeric) to authenticated;

create or replace function public.regrade_quiz(p_quiz_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int := 0;
  r record;
begin
  if not public.can_manage_quiz(p_quiz_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  for r in select id from public.quiz_attempts where quiz_id = p_quiz_id and status in ('submitted', 'auto_submitted') loop
    perform public._grade_quiz_attempt(r.id, null, true);
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

grant execute on function public.regrade_quiz(uuid) to authenticated;

-- ───────────────────────────── Hope Assistant ───────────────────────────

alter table public.system_settings add column if not exists assistant_enabled boolean not null default true;

create table if not exists public.assistant_usage (
  bucket text not null,
  window_start timestamptz not null,
  requests int not null default 0,
  tokens int not null default 0,
  primary key (bucket, window_start)
);

alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon, authenticated;
grant select, insert, update, delete on public.assistant_usage to service_role;

create or replace function public.assistant_consume(p_bucket text, p_window_seconds int, p_max_requests int)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  current_count int;
begin
  delete from public.assistant_usage where window_start < now() - interval '2 days';

  insert into public.assistant_usage (bucket, window_start, requests, tokens)
  values (p_bucket, w, 1, 0)
  on conflict (bucket, window_start) do update set requests = assistant_usage.requests + 1
  returning requests into current_count;

  return current_count <= p_max_requests;
end;
$fn$;

revoke all on function public.assistant_consume(text, int, int) from public, anon, authenticated;
grant execute on function public.assistant_consume(text, int, int) to service_role;

create or replace function public.assistant_add_tokens(p_bucket text, p_window_seconds int, p_tokens int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
begin
  insert into public.assistant_usage (bucket, window_start, requests, tokens)
  values (p_bucket, w, 0, p_tokens)
  on conflict (bucket, window_start) do update set tokens = assistant_usage.tokens + p_tokens;
end;
$fn$;

revoke all on function public.assistant_add_tokens(text, int, int) from public, anon, authenticated;
grant execute on function public.assistant_add_tokens(text, int, int) to service_role;

create or replace function public.assistant_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  is_scoped boolean;
  result jsonb;
  students_active int;
  students_pending int;
  staff_by_role jsonb;
  programmes_count int;
  cohorts_count int;
  quizzes_published int;
  quiz_avg numeric;
  certs_this_year int;
  fees_month numeric;
  teacher_cohorts uuid[];
begin
  if not public.has_permission('assistant.admin_help') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  is_scoped := not public.has_permission('quizzes.manage_all')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'Teacher');

  if is_scoped then
    select coalesce(array_agg(id), array[]::uuid[]) into teacher_cohorts
      from public.cohorts where teacher_id = auth.uid();
  end if;

  select count(*) filter (where status = 'Active' and role = 'Student') into students_active from public.profiles;
  select count(*) filter (where status = 'Pending Approval' and role = 'Student') into students_pending from public.profiles;
  select jsonb_object_agg(role, c) into staff_by_role from (
    select role, count(*) c from public.profiles where role <> 'Student' group by role
  ) s;

  select count(*) into programmes_count from public.programs;
  select count(*) into cohorts_count from public.cohorts where not is_scoped or teacher_id = auth.uid();

  select count(*) into quizzes_published from public.quizzes qz
    where qz.status = 'published'
      and (not is_scoped or qz.cohort_id = any(teacher_cohorts) or qz.created_by = auth.uid());

  select round(avg(a.percent), 1) into quiz_avg from public.quiz_attempts a
    join public.quizzes qz on qz.id = a.quiz_id
    where a.status in ('submitted', 'auto_submitted') and a.submitted_at > now() - interval '30 days'
      and (not is_scoped or qz.cohort_id = any(teacher_cohorts) or qz.created_by = auth.uid());

  select count(*) into certs_this_year from public.certificates
    where extract(year from issue_date) = extract(year from now());

  result := jsonb_build_object(
    'students', jsonb_build_object('active', coalesce(students_active, 0), 'pending', coalesce(students_pending, 0)),
    'staff_by_role', coalesce(staff_by_role, '{}'::jsonb),
    'programmes', coalesce(programmes_count, 0),
    'cohorts', coalesce(cohorts_count, 0),
    'quizzes_published', coalesce(quizzes_published, 0),
    'quiz_avg_percent_30d', quiz_avg,
    'certificates_this_year', coalesce(certs_this_year, 0)
  );

  if public.has_permission('fees.view') then
    select coalesce(sum(amount), 0) into fees_month from public.fee_transactions
      where date_trunc('month', transaction_date) = date_trunc('month', now());
    result := result || jsonb_build_object('fees_this_month', fees_month);
  end if;

  return result;
end;
$fn$;

grant execute on function public.assistant_admin_stats() to authenticated;
