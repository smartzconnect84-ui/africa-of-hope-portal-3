-- Learning path sequencing, timed classwork submission, progress recompute,
-- attendance enforcement/notifications and course-window closure.
-- Additive and idempotent: this migration extends the existing academic
-- planning schema from 20261014030000_academic_planning_enrollment.sql.
-- Do not run against production without reviewing the current live schema.
--
-- Covers the "Backend" gaps from /code/.plans/learning-path-attendance-contract.md:
--   G2. Students can submit classwork (start_classwork/submit_classwork RPCs);
--       time_limit_minutes is enforced for the late flag.
--   G3. course_enrollments.progress_percent / completion_status are kept in
--       sync with student_learning_progress via a recompute trigger.
--   G4. Attendance standing is computed in my_course_status() and students/
--       teachers are notified on a missed class or a sustained shortfall.
--   G5. The course window (cohorts.end_date) is enforced for student writes
--       and closed automatically by a daily pg_cron job.
--
-- Production check performed before writing this file:
--   * public.submissions already has a UNIQUE (assignment_id, student_id)
--     constraint (submissions_assignment_id_student_id_key) and zero rows,
--     so there is no duplicate-row conflict to work around.
--   * public.submissions_read already lets a student SELECT their own rows;
--     only staff may write directly. This migration keeps that RLS as-is and
--     adds student access exclusively through the two new SECURITY DEFINER
--     RPCs below (same pattern as submit_course_enrollment).
--   * public.attendance.status is CHECK'd to ('Present','Absent','Late').
--   * The notifications -> email bridge (_enqueue_notification_email) emails
--     every notification kind except 'payment_confirmed'/'payment_rejected';
--     the new kinds added here (attendance_missed, attendance_warning,
--     schedule_updated, course_window_closed, classwork_submitted) are fine
--     with that and get the generic 'notification' template.

-- ─────────────────────── submissions: classwork columns ─────────────────

alter table public.submissions
  add column if not exists response_text text not null default '',
  add column if not exists attachment_path text,
  add column if not exists started_at timestamptz,
  add column if not exists is_late boolean not null default false,
  add column if not exists time_spent_seconds integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'submissions_response_text_check' and conrelid = 'public.submissions'::regclass) then
    alter table public.submissions add constraint submissions_response_text_check check (length(response_text) <= 20000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'submissions_time_spent_seconds_check' and conrelid = 'public.submissions'::regclass) then
    alter table public.submissions add constraint submissions_time_spent_seconds_check check (time_spent_seconds is null or time_spent_seconds >= 0);
  end if;
end $$;

-- 'In Progress' is a new in-flight state between no-row and 'Submitted'.
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
  check (status in ('In Progress', 'Submitted', 'Graded', 'Missing'));

-- Production already carries this unique constraint with zero duplicate
-- rows (confirmed before writing this migration). Keep the guard anyway so
-- this file stays safe to run against any other environment: if duplicates
-- exist there, skip the constraint instead of failing the whole migration.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'submissions_assignment_id_student_id_key' and conrelid = 'public.submissions'::regclass) then
    if exists (
      select 1 from public.submissions group by assignment_id, student_id having count(*) > 1
    ) then
      raise notice 'Skipping submissions_assignment_id_student_id_key: duplicate (assignment_id, student_id) rows exist.';
    else
      alter table public.submissions add constraint submissions_assignment_id_student_id_key unique (assignment_id, student_id);
    end if;
  end if;
end $$;

-- ─────────────────────── Private classwork storage ───────────────────────
-- Same 25 MiB / MIME allow-list as training-materials. Path convention:
-- <assignment_id>/<student_id>/<timestamp>-<safe-name>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'classwork-submissions', 'classwork-submissions', false, 26214400,
  array['application/pdf', 'text/plain', 'application/zip', 'application/x-zip-compressed',
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
        'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists classwork_submissions_insert on storage.objects;
drop policy if exists classwork_submissions_select on storage.objects;
create policy classwork_submissions_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'classwork-submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.assignments a
    where a.id::text = (storage.foldername(name))[1] and public.is_cohort_member(a.cohort_id)
  )
);
create policy classwork_submissions_select on storage.objects for select to authenticated using (
  bucket_id = 'classwork-submissions'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or exists (
      select 1 from public.assignments a
      where a.id::text = (storage.foldername(name))[1]
        and (public.is_cohort_teacher(a.cohort_id) or public.has_permission('assignments.manage'))
    )
  )
);

-- ───────────────────── Classwork RPCs (student-facing) ───────────────────

create or replace function public.start_classwork(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_assignment public.assignments%rowtype;
  v_cohort_end date;
  v_unit_status text;
  v_unit_available timestamptz;
  v_sub public.submissions%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select * into v_assignment from public.assignments where id = p_assignment_id;
  if v_assignment.id is null then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;
  if not public.is_cohort_member(v_assignment.cohort_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select end_date into v_cohort_end from public.cohorts where id = v_assignment.cohort_id;
  if v_cohort_end is not null and now()::date > v_cohort_end then
    raise exception 'course_window_closed' using errcode = 'P0001';
  end if;

  if v_assignment.learning_unit_id is not null then
    select status, available_from into v_unit_status, v_unit_available
    from public.learning_units where id = v_assignment.learning_unit_id;
    if v_unit_status is distinct from 'approved' or (v_unit_available is not null and v_unit_available > now()) then
      raise exception 'unit_not_available' using errcode = 'P0001';
    end if;
  end if;

  select * into v_sub from public.submissions
  where assignment_id = p_assignment_id and student_id = auth.uid() for update;

  if v_sub.id is not null then
    if v_sub.status in ('Submitted', 'Graded') then
      raise exception 'classwork_already_submitted' using errcode = 'P0001';
    end if;
    -- Idempotent: a row already in progress keeps its original started_at.
  else
    insert into public.submissions (assignment_id, student_id, status, started_at)
    values (p_assignment_id, auth.uid(), 'In Progress', now())
    returning * into v_sub;
  end if;

  return jsonb_build_object(
    'submission_id', v_sub.id,
    'started_at', v_sub.started_at,
    'deadline_at', case when v_assignment.time_limit_minutes is not null
      then v_sub.started_at + (v_assignment.time_limit_minutes || ' minutes')::interval
      else null end,
    'time_limit_minutes', v_assignment.time_limit_minutes,
    'status', v_sub.status
  );
end;
$fn$;

create or replace function public.submit_classwork(
  p_assignment_id uuid,
  p_response_text text,
  p_attachment_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_assignment public.assignments%rowtype;
  v_sub public.submissions%rowtype;
  v_response text;
  v_is_late boolean;
  v_cohort_teacher uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select * into v_assignment from public.assignments where id = p_assignment_id;
  if v_assignment.id is null then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;

  select * into v_sub from public.submissions
  where assignment_id = p_assignment_id and student_id = auth.uid() for update;
  if v_sub.id is null or v_sub.started_at is null then
    raise exception 'classwork_not_started' using errcode = 'P0001';
  end if;
  if v_sub.status in ('Submitted', 'Graded') then
    raise exception 'classwork_already_submitted' using errcode = 'P0001';
  end if;

  v_response := coalesce(p_response_text, '');
  if length(btrim(v_response)) = 0 and coalesce(btrim(p_attachment_path), '') = '' then
    raise exception 'classwork_empty' using errcode = 'P0001';
  end if;
  if p_attachment_path is not null and p_attachment_path not like (p_assignment_id::text || '/' || auth.uid()::text || '/%') then
    raise exception 'invalid_attachment_path' using errcode = 'P0001';
  end if;

  v_is_late := (
    v_assignment.time_limit_minutes is not null
    and now() > v_sub.started_at + (v_assignment.time_limit_minutes || ' minutes')::interval + interval '2 minutes'
  ) or (v_assignment.due_date is not null and now()::date > v_assignment.due_date);

  update public.submissions
  set status = 'Submitted',
      submitted_at = now(),
      response_text = v_response,
      attachment_path = p_attachment_path,
      time_spent_seconds = greatest(0, extract(epoch from (now() - v_sub.started_at))::integer),
      is_late = v_is_late
  where id = v_sub.id
  returning * into v_sub;

  select teacher_id into v_cohort_teacher from public.cohorts where id = v_assignment.cohort_id;
  if v_cohort_teacher is not null then
    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    values (
      v_cohort_teacher, 'classwork_submitted', 'Classwork submitted',
      coalesce((select full_name from public.profiles where id = auth.uid()), 'A student')
        || ' submitted "' || v_assignment.title || '"' || case when v_is_late then ' (late).' else '.' end,
      'submission', v_sub.id
    );
  end if;

  return jsonb_build_object(
    'submission_id', v_sub.id, 'status', v_sub.status, 'is_late', v_sub.is_late, 'submitted_at', v_sub.submitted_at
  );
end;
$fn$;

-- ───────────────── student_learning_progress validation/recompute ────────

create or replace function public._validate_student_learning_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_unit_status text;
  v_unit_available timestamptz;
  v_cohort_end date;
begin
  if public.has_permission('academic_plans.approve') or public.is_cohort_teacher(new.cohort_id) then
    return new;
  end if;

  select status, available_from into v_unit_status, v_unit_available
  from public.learning_units where id = new.learning_unit_id;
  if v_unit_status is distinct from 'approved' or (v_unit_available is not null and v_unit_available > now()) then
    raise exception 'unit_not_available' using errcode = 'P0001';
  end if;

  select end_date into v_cohort_end from public.cohorts where id = new.cohort_id;
  if v_cohort_end is not null and now()::date > v_cohort_end then
    raise exception 'course_window_closed' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

create or replace function public._recompute_course_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_student uuid := coalesce(new.student_id, old.student_id);
  v_cohort uuid := coalesce(new.cohort_id, old.cohort_id);
  v_total integer;
  v_completed integer;
  v_pct numeric;
  v_status text;
begin
  select count(*) into v_total
  from public.learning_units u where u.cohort_id = v_cohort and u.status = 'approved';

  select count(*) into v_completed
  from public.student_learning_progress p
  join public.learning_units u on u.id = p.learning_unit_id
  where p.student_id = v_student and p.cohort_id = v_cohort and p.status = 'completed' and u.status = 'approved';

  v_pct := case when v_total = 0 then 0 else round(v_completed::numeric / v_total * 100, 2) end;
  v_status := case
    when v_total > 0 and v_completed >= v_total then 'completed_pending_review'
    when v_completed > 0 then 'in_progress'
    else 'not_started'
  end;

  -- Leave a terminal certification/closure outcome alone; this trigger only
  -- ever produces 'not_started' | 'in_progress' | 'completed_pending_review'.
  update public.course_enrollments e
  set progress_percent = v_pct,
      completion_status = case when e.completion_status in ('completed', 'incomplete', 'withdrawn', 'cancelled')
        then e.completion_status else v_status end
  where e.cohort_id = v_cohort and e.student_id = v_student;

  return coalesce(new, old);
end;
$fn$;

drop trigger if exists student_learning_progress_validate on public.student_learning_progress;
create trigger student_learning_progress_validate before insert or update on public.student_learning_progress
  for each row execute function public._validate_student_learning_progress();
drop trigger if exists student_learning_progress_recompute on public.student_learning_progress;
create trigger student_learning_progress_recompute after insert or update or delete on public.student_learning_progress
  for each row execute function public._recompute_course_progress();

create or replace function public.record_learning_progress(p_unit_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cohort uuid;
  v_enrollment public.course_enrollments%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_status not in ('in_progress', 'completed') then
    raise exception 'invalid_progress_status' using errcode = 'P0001';
  end if;

  select cohort_id into v_cohort from public.learning_units where id = p_unit_id;
  if v_cohort is null then raise exception 'learning_unit_not_found' using errcode = 'P0002'; end if;

  insert into public.student_learning_progress (student_id, cohort_id, learning_unit_id, status, progress_percent, completed_at)
  values (auth.uid(), v_cohort, p_unit_id, p_status, case when p_status = 'completed' then 100 else 50 end,
    case when p_status = 'completed' then now() else null end)
  on conflict (student_id, cohort_id, learning_unit_id) do update
    set status = excluded.status, progress_percent = excluded.progress_percent, completed_at = excluded.completed_at;

  select * into v_enrollment from public.course_enrollments where cohort_id = v_cohort and student_id = auth.uid();

  return jsonb_build_object(
    'unit_id', p_unit_id, 'status', p_status,
    'progress_percent', v_enrollment.progress_percent,
    'completion_status', v_enrollment.completion_status
  );
end;
$fn$;

-- ───────────────────────── my_course_status() ────────────────────────────

create or replace function public.my_course_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  result jsonb := '[]'::jsonb;
  e record;
  entry jsonb;
  v_sessions_held integer;
  v_sessions_attended integer;
  v_attendance_percent numeric;
  v_missed jsonb;
  v_units_total integer;
  v_units_completed integer;
  v_next_unit jsonb;
  v_overdue jsonb;
  v_deadlines jsonb;
  v_grade jsonb;
  v_window text;
  v_days_remaining integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  for e in
    select ce.id as enrollment_id, ce.cohort_id, ce.progress_percent, ce.completion_status,
           c.name as cohort_name, c.program_id, c.start_date, c.end_date,
           p.title as program_title, p.required_attendance_percent, p.completion_pass_mark
    from public.course_enrollments ce
    join public.cohorts c on c.id = ce.cohort_id
    join public.programs p on p.id = c.program_id
    where ce.student_id = auth.uid() and ce.status in ('approved', 'active', 'completed')
    order by c.start_date desc
  loop
    v_window := case
      when e.start_date > current_date then 'upcoming'
      when e.end_date < current_date then 'ended'
      else 'active'
    end;
    v_days_remaining := e.end_date - current_date;

    select count(*) into v_sessions_held
    from public.class_sessions s
    where s.cohort_id = e.cohort_id and s.status = 'approved' and s.attendance_required and s.session_date <= current_date;

    select count(*) into v_sessions_attended
    from public.class_sessions s
    where s.cohort_id = e.cohort_id and s.status = 'approved' and s.attendance_required and s.session_date <= current_date
      and exists (
        select 1 from public.attendance a
        where a.student_id = auth.uid() and a.status in ('Present', 'Late')
          and (a.class_session_id = s.id or (a.class_session_id is null and a.cohort_id = s.cohort_id and a.attendance_date = s.session_date))
      );

    v_attendance_percent := case when v_sessions_held = 0 then null
      else round(v_sessions_attended::numeric / v_sessions_held * 100, 2) end;

    select coalesce(jsonb_agg(jsonb_build_object('session_id', m.id, 'title', m.title, 'session_date', m.session_date)), '[]'::jsonb)
    into v_missed
    from (
      select s.id, s.title, s.session_date
      from public.class_sessions s
      where s.cohort_id = e.cohort_id and s.status = 'approved' and s.attendance_required and s.session_date <= current_date
        and not exists (
          select 1 from public.attendance a
          where a.student_id = auth.uid() and a.status in ('Present', 'Late')
            and (a.class_session_id = s.id or (a.class_session_id is null and a.cohort_id = s.cohort_id and a.attendance_date = s.session_date))
        )
      order by s.session_date desc
      limit 10
    ) m;

    select count(*) into v_units_total from public.learning_units u where u.cohort_id = e.cohort_id and u.status = 'approved';
    select count(*) into v_units_completed
    from public.student_learning_progress sp
    join public.learning_units u on u.id = sp.learning_unit_id
    where sp.student_id = auth.uid() and sp.cohort_id = e.cohort_id and sp.status = 'completed' and u.status = 'approved';

    select jsonb_build_object('id', u.id, 'title', u.title, 'unit_type', u.unit_type, 'position', u.position, 'available_from', u.available_from, 'due_at', u.due_at)
    into v_next_unit
    from public.learning_units u
    where u.cohort_id = e.cohort_id and u.status = 'approved'
      and (u.available_from is null or u.available_from <= now())
      and not exists (
        select 1 from public.student_learning_progress sp
        where sp.learning_unit_id = u.id and sp.student_id = auth.uid() and sp.status = 'completed'
      )
    order by u.position asc
    limit 1;

    select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'title', u.title, 'due_at', u.due_at) order by u.due_at asc), '[]'::jsonb)
    into v_overdue
    from public.learning_units u
    where u.cohort_id = e.cohort_id and u.status = 'approved' and u.due_at is not null and u.due_at < now()
      and not exists (
        select 1 from public.student_learning_progress sp
        where sp.learning_unit_id = u.id and sp.student_id = auth.uid() and sp.status = 'completed'
      );

    select coalesce(jsonb_agg(d order by (d ->> 'due_at')::timestamptz asc), '[]'::jsonb) into v_deadlines
    from (
      select jsonb_build_object('kind', 'classwork', 'id', a.id, 'title', a.title, 'due_at', a.due_date::timestamptz) as d
      from public.assignments a
      join public.learning_units u on u.classwork_assignment_id = a.id
      where a.cohort_id = e.cohort_id and u.status = 'approved'
        and a.due_date between current_date and current_date + 14
      union all
      select jsonb_build_object('kind', 'quiz', 'id', q.id, 'title', q.title, 'due_at', u.due_at)
      from public.quizzes q
      join public.learning_units u on u.quiz_id = q.id
      where u.cohort_id = e.cohort_id and u.status = 'approved' and u.due_at between now() and now() + interval '14 days'
      union all
      select jsonb_build_object('kind', 'unit', 'id', u.id, 'title', u.title, 'due_at', u.due_at)
      from public.learning_units u
      where u.cohort_id = e.cohort_id and u.status = 'approved' and u.due_at between now() and now() + interval '14 days'
    ) merged(d);

    select public.course_grade_summary(auth.uid(), e.cohort_id) into v_grade;

    entry := jsonb_build_object(
      'cohort_id', e.cohort_id, 'cohort_name', e.cohort_name, 'program_id', e.program_id, 'program_title', e.program_title,
      'start_date', e.start_date, 'end_date', e.end_date, 'days_remaining', v_days_remaining, 'window', v_window,
      'required_attendance_percent', e.required_attendance_percent, 'completion_pass_mark', e.completion_pass_mark,
      'sessions_held', v_sessions_held, 'sessions_attended', v_sessions_attended,
      'sessions_missed', v_sessions_held - v_sessions_attended, 'attendance_percent', v_attendance_percent,
      'attendance_ok', v_attendance_percent is null or v_attendance_percent >= e.required_attendance_percent,
      'missed', v_missed,
      'units_total', v_units_total, 'units_completed', v_units_completed,
      'progress_percent', e.progress_percent, 'completion_status', e.completion_status,
      'next_unit', v_next_unit, 'overdue_units', v_overdue, 'upcoming_deadlines', v_deadlines, 'grade', v_grade
    );
    result := result || jsonb_build_array(entry);
  end loop;

  return result;
end;
$fn$;

-- ───────────────────────── Attendance notifications ───────────────────────

create or replace function public._notify_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session_title text;
  v_cohort_teacher uuid;
  v_required numeric;
  v_held integer;
  v_attended integer;
  v_pct numeric;
  v_last_warning timestamptz;
begin
  if new.status = 'Absent' and (tg_op = 'INSERT' or old.status is distinct from 'Absent') then
    select title into v_session_title from public.class_sessions where id = new.class_session_id;
    if not exists (
      select 1 from public.notifications
      where recipient_id = new.student_id and kind = 'attendance_missed' and entity_type = 'attendance' and entity_id = new.id
    ) then
      insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
      values (
        new.student_id, 'attendance_missed', 'Missed class',
        'You were marked absent for ' || coalesce(v_session_title, 'a class') || ' on ' || new.attendance_date::text || '.',
        'attendance', new.id
      );
    end if;
  end if;

  select c.teacher_id, p.required_attendance_percent into v_cohort_teacher, v_required
  from public.cohorts c join public.programs p on p.id = c.program_id
  where c.id = new.cohort_id;

  select count(*) into v_held
  from public.class_sessions s
  where s.cohort_id = new.cohort_id and s.status = 'approved' and s.attendance_required and s.session_date <= current_date;

  select count(*) into v_attended
  from public.attendance a
  where a.cohort_id = new.cohort_id and a.student_id = new.student_id and a.status in ('Present', 'Late');

  if v_held >= 3 then
    v_pct := round(v_attended::numeric / v_held * 100, 2);
    if v_pct < v_required then
      select max(created_at) into v_last_warning
      from public.notifications
      where recipient_id = new.student_id and kind = 'attendance_warning' and entity_type = 'cohort' and entity_id = new.cohort_id;

      if v_last_warning is null or v_last_warning < now() - interval '7 days' then
        insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
        values (
          new.student_id, 'attendance_warning', 'Attendance below requirement',
          'Your attendance is ' || v_pct::text || '%, below the required ' || v_required::text || '% for this course.',
          'cohort', new.cohort_id
        );
        if v_cohort_teacher is not null then
          insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
          values (
            v_cohort_teacher, 'attendance_warning', 'Student attendance below requirement',
            'A student''s attendance is ' || v_pct::text || '%, below the required ' || v_required::text || '% for this course.',
            'cohort', new.cohort_id
          );
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists attendance_notify on public.attendance;
create trigger attendance_notify after insert or update of status on public.attendance
  for each row execute function public._notify_attendance();

-- ──────────────── Schedule-change notifications on class_sessions ─────────
-- class_sessions_notify (20261014030000) only fires on status changes, so an
-- already-approved session's date/time/room edit is otherwise silent.

create or replace function public._notify_schedule_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status = 'approved' and old.status = 'approved' and (
    new.session_date is distinct from old.session_date
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.room is distinct from old.room
  ) then
    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    select cs.student_id, 'schedule_updated', 'Class schedule updated',
      'The schedule for "' || new.title || '" changed to ' || new.session_date::text || ' ' || new.starts_at::text || '-' || new.ends_at::text
        || case when coalesce(new.room, '') <> '' then ' in ' || new.room else '' end || '.',
      'class_session', new.id
    from public.cohort_students cs
    where cs.cohort_id = new.cohort_id and cs.active;
  end if;
  return new;
end;
$fn$;

drop trigger if exists class_sessions_notify_schedule on public.class_sessions;
create trigger class_sessions_notify_schedule after update of session_date, starts_at, ends_at, room on public.class_sessions
  for each row execute function public._notify_schedule_updated();

-- ───────────────────── Course window closure (pg_cron) ───────────────────

create or replace function public.close_expired_course_windows()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
  r record;
  v_held integer;
  v_attended integer;
  v_pct numeric;
  v_attendance_ok boolean;
  v_new_status text;
begin
  for r in
    select ce.id, ce.student_id, ce.cohort_id, ce.progress_percent, p.required_attendance_percent
    from public.course_enrollments ce
    join public.cohorts c on c.id = ce.cohort_id
    join public.programs p on p.id = c.program_id
    where c.end_date < current_date
      and ce.status in ('approved', 'active')
      and ce.completion_status not in ('completed', 'incomplete', 'completed_pending_review')
  loop
    select count(*) into v_held
    from public.class_sessions s
    where s.cohort_id = r.cohort_id and s.status = 'approved' and s.attendance_required and s.session_date <= current_date;

    select count(*) into v_attended
    from public.attendance a
    where a.cohort_id = r.cohort_id and a.student_id = r.student_id and a.status in ('Present', 'Late');

    v_pct := case when v_held = 0 then null else round(v_attended::numeric / v_held * 100, 2) end;
    v_attendance_ok := v_pct is null or v_pct >= r.required_attendance_percent;
    v_new_status := case when r.progress_percent >= 100 and v_attendance_ok then 'completed_pending_review' else 'incomplete' end;

    update public.course_enrollments set completion_status = v_new_status where id = r.id;

    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    values (
      r.student_id, 'course_window_closed',
      case when v_new_status = 'completed_pending_review' then 'Course completed - pending review' else 'Course window closed' end,
      case when v_new_status = 'completed_pending_review'
        then 'Your course finished and is pending final review.'
        else 'Your course window ended before all requirements were met.' end,
      'enrollment', r.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.close_expired_course_windows() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'aoh-close-course-windows') then
      perform cron.unschedule('aoh-close-course-windows');
    end if;
    perform cron.schedule('aoh-close-course-windows', '15 0 * * *', $job$select public.close_expired_course_windows();$job$);
  else
    raise notice 'pg_cron not enabled; schedule close_expired_course_windows() externally.';
  end if;
end $$;

-- ──────────────────────────────── Grants ─────────────────────────────────

revoke all on function public.start_classwork(uuid) from public, anon;
revoke all on function public.submit_classwork(uuid, text, text) from public, anon;
revoke all on function public.record_learning_progress(uuid, text) from public, anon;
revoke all on function public.my_course_status() from public, anon;
grant execute on function public.start_classwork(uuid) to authenticated;
grant execute on function public.submit_classwork(uuid, text, text) to authenticated;
grant execute on function public.record_learning_progress(uuid, text) to authenticated;
grant execute on function public.my_course_status() to authenticated;
