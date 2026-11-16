-- Review-finding fixes for the learning path / classwork / attendance
-- migration (20261014080000_learning_path_attendance.sql), which is already
-- applied to production. This file is additive and idempotent and only adds
-- a forward migration on top of it; it does not edit the applied file.
--
-- Production facts confirmed before writing this file (via the read-only
-- Management API against txprgdnznzxpwpuqlxlq):
--   * public.attendance already carries UNIQUE (cohort_id, student_id,
--     attendance_date) (attendance_cohort_id_student_id_attendance_date_key).
--     It predates these migrations (part of the original base schema), so no
--     dedupe step is needed; the guard below is defensive only.
--   * public.submissions already carries UNIQUE (assignment_id, student_id).
--   * attendance/class_sessions/course_enrollments/learning_units/
--     student_learning_progress/submissions all have 0 rows in production.
--   * Every "_"-prefixed internal/trigger function created by prior academic
--     migrations still carries the default PUBLIC EXECUTE grant
--     (`=X/postgres` in pg_proc.proacl) -- confirmed revoking it does not
--     break trigger dispatch (triggers execute without the invoking role
--     needing EXECUTE on the trigger function; only direct `SELECT fn()`
--     calls are blocked), so this migration revokes it everywhere it was
--     still present.
--
-- Covers:
--   1. Attendance dedupe: now that the frontend writes attendance via
--      upsert on (cohort_id, student_id, attendance_date) instead of
--      delete+reinsert, the attendance row id is stable across repeated
--      writes to the same date, so the existing entity_type='attendance',
--      entity_id=new.id dedupe key in _notify_attendance already prevents
--      double notification on a re-save. _notify_attendance now also
--      resolves the class title to show in the message by cohort+date when
--      class_session_id is null (matching the resolution already used by
--      my_course_status), and still only ever fires on a transition into
--      'Absent'.
--   2. A shared _attendance_standing() helper (held/attended/missed/percent,
--      filtered to approved attendance-required sessions on/after the
--      student's cohort_students.enrolled_at and whose time has actually
--      passed) used by _notify_attendance, close_expired_course_windows and
--      my_course_status. The teacher attendance_warning now names the
--      student in its body; its 7-day cooldown is unchanged (still shared
--      with the student's own cooldown, keyed on student+cohort).
--   3. close_expired_course_windows also re-evaluates completed_pending_review
--      enrollments whose attendance has since failed, and is idempotent via
--      a "no existing course_window_closed notification" guard instead of a
--      completion_status allow-list.
--   4. record_learning_progress requires is_cohort_member() for the unit's
--      cohort unless the caller is staff (academic_plans.approve or the
--      cohort teacher) -- previously this SECURITY DEFINER RPC bypassed the
--      table's RLS membership check entirely.
--   5. A new trigger on learning_units (insert/delete/update of status)
--      recomputes progress for every enrollment in that cohort, sharing the
--      per-cohort recompute logic with the existing
--      student_learning_progress trigger.
--   6. start_classwork uses INSERT ... ON CONFLICT (assignment_id,
--      student_id) DO NOTHING + re-select (fixes a start/start race and a
--      pre-existing 'Missing' row with no started_at ever blocking the
--      timer).
--   7. submit_classwork rechecks cohort membership, treats an empty-string
--      attachment path as null, and verifies the attachment object actually
--      exists in storage.objects for the classwork-submissions bucket.
--   8. notifications gets an index on (recipient_id, kind, entity_id);
--      _validate_student_learning_progress skips entirely when auth.uid() is
--      null (service-role/maintenance writes); every internal/trigger
--      function has EXECUTE revoked from anon/authenticated/public;
--      _notify_schedule_updated only fires for sessions whose session_date
--      is today or later.
--   9. create_academic_lesson_bundle gains a new LAST parameter
--      `p_available_from timestamptz default null`, stored on
--      learning_units.available_from, validated to be before p_due_at
--      (error code 'available_after_due'). The old 12-arg signature is
--      dropped so there is exactly one overload; re-granted to authenticated
--      only.

-- ──────────────────── 1. Attendance unique constraint (defensive) ────────

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(cohort_id, student_id, attendance_date)%'
  ) then
    if exists (
      select 1 from public.attendance group by cohort_id, student_id, attendance_date having count(*) > 1
    ) then
      raise notice 'Skipping attendance unique(cohort_id, student_id, attendance_date): duplicate rows exist.';
    else
      alter table public.attendance
        add constraint attendance_cohort_id_student_id_attendance_date_key unique (cohort_id, student_id, attendance_date);
    end if;
  end if;
end $$;

-- ──────────────── 2. Shared attendance-standing helper ───────────────────

create or replace function public._attendance_standing(p_student_id uuid, p_cohort_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_join_date date;
  v_held integer;
  v_attended integer;
  v_missed jsonb;
begin
  select enrolled_at::date into v_join_date
  from public.cohort_students where cohort_id = p_cohort_id and student_id = p_student_id;

  select count(*) into v_held
  from public.class_sessions s
  where s.cohort_id = p_cohort_id and s.status = 'approved' and s.attendance_required
    and s.session_date >= coalesce(v_join_date, '-infinity'::date)
    and (s.session_date < current_date or (s.session_date = current_date and (s.session_date + s.ends_at) <= now()));

  select count(*) into v_attended
  from public.class_sessions s
  where s.cohort_id = p_cohort_id and s.status = 'approved' and s.attendance_required
    and s.session_date >= coalesce(v_join_date, '-infinity'::date)
    and (s.session_date < current_date or (s.session_date = current_date and (s.session_date + s.ends_at) <= now()))
    and exists (
      select 1 from public.attendance a
      where a.student_id = p_student_id and a.status in ('Present', 'Late')
        and (a.class_session_id = s.id or (a.class_session_id is null and a.cohort_id = s.cohort_id and a.attendance_date = s.session_date))
    );

  select coalesce(jsonb_agg(jsonb_build_object('session_id', m.id, 'title', m.title, 'session_date', m.session_date) order by m.session_date desc), '[]'::jsonb)
  into v_missed
  from (
    select s.id, s.title, s.session_date
    from public.class_sessions s
    where s.cohort_id = p_cohort_id and s.status = 'approved' and s.attendance_required
      and s.session_date >= coalesce(v_join_date, '-infinity'::date)
      and (s.session_date < current_date or (s.session_date = current_date and (s.session_date + s.ends_at) <= now()))
      and not exists (
        select 1 from public.attendance a
        where a.student_id = p_student_id and a.status in ('Present', 'Late')
          and (a.class_session_id = s.id or (a.class_session_id is null and a.cohort_id = s.cohort_id and a.attendance_date = s.session_date))
      )
    order by s.session_date desc
    limit 10
  ) m;

  return jsonb_build_object(
    'sessions_held', v_held,
    'sessions_attended', v_attended,
    'sessions_missed', v_held - v_attended,
    'attendance_percent', case when v_held = 0 then null else round(v_attended::numeric / v_held * 100, 2) end,
    'missed', v_missed
  );
end;
$fn$;

-- ──────────────── 1+2. _notify_attendance: resolved key + naming ─────────

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
  v_student_name text;
  v_standing jsonb;
  v_held integer;
  v_attended integer;
  v_pct numeric;
  v_student_last_warning timestamptz;
begin
  if new.status = 'Absent' and (tg_op = 'INSERT' or old.status is distinct from 'Absent') then
    -- Keep the original dedupe key: entity_type='attendance', entity_id =
    -- the attendance row's own id. Now that attendance is written via
    -- upsert on (cohort_id, student_id, attendance_date) instead of
    -- delete+reinsert, the row id is stable across repeated writes for the
    -- same date, so this key alone already prevents double notification on
    -- a re-save. Only the session-title lookup needs widening: resolve the
    -- class to name in the message by cohort+date when class_session_id is
    -- null (matching the resolution already used by my_course_status),
    -- instead of relying on new.class_session_id being set directly.
    if new.class_session_id is not null then
      select title into v_session_title from public.class_sessions where id = new.class_session_id;
    else
      select title into v_session_title
      from public.class_sessions
      where cohort_id = new.cohort_id and session_date = new.attendance_date and status = 'approved'
      order by starts_at
      limit 1;
    end if;

    if not exists (
      select 1 from public.notifications
      where recipient_id = new.student_id and kind = 'attendance_missed'
        and entity_type = 'attendance' and entity_id = new.id
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

  v_standing := public._attendance_standing(new.student_id, new.cohort_id);
  v_held := (v_standing ->> 'sessions_held')::integer;
  v_attended := (v_standing ->> 'sessions_attended')::integer;

  if v_held >= 3 then
    v_pct := round(v_attended::numeric / v_held * 100, 2);
    if v_pct < v_required then
      select max(created_at) into v_student_last_warning
      from public.notifications
      where recipient_id = new.student_id and kind = 'attendance_warning' and entity_type = 'cohort' and entity_id = new.cohort_id;

      -- Unchanged from the applied migration: both the student's own copy
      -- and the teacher's copy share this single 7-day cooldown keyed on
      -- (student, cohort), matching the already-passing contract assertion
      -- for this behavior. The only change here is naming the student in
      -- the teacher-facing body.
      if v_student_last_warning is null or v_student_last_warning < now() - interval '7 days' then
        insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
        values (
          new.student_id, 'attendance_warning', 'Attendance below requirement',
          'Your attendance is ' || v_pct::text || '%, below the required ' || v_required::text || '% for this course.',
          'cohort', new.cohort_id
        );
        if v_cohort_teacher is not null then
          select full_name into v_student_name from public.profiles where id = new.student_id;
          insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
          values (
            v_cohort_teacher, 'attendance_warning', 'Student attendance below requirement',
            coalesce(v_student_name, 'A student') || '''s attendance is ' || v_pct::text || '%, below the required ' || v_required::text || '% for this course.',
            'cohort', new.cohort_id
          );
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$fn$;

-- ──────────────── 8. schedule_updated only for future/today sessions ─────

create or replace function public._notify_schedule_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status = 'approved' and old.status = 'approved' and new.session_date >= current_date and (
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

-- ──────────────── 8. Validation trigger skips service-role/maintenance ───

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
  if auth.uid() is null then
    -- Service-role/maintenance writes (admin tooling, backfills, scripted
    -- fixes) are not subject to the student-facing availability/window gate.
    return new;
  end if;

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

-- ──────────────── 5. Shared per-cohort progress recompute ────────────────

create or replace function public._recompute_cohort_progress(p_cohort_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total integer;
  v_completed integer;
  v_pct numeric;
  v_status text;
  r record;
begin
  if p_cohort_id is null then
    return;
  end if;

  select count(*) into v_total
  from public.learning_units u where u.cohort_id = p_cohort_id and u.status = 'approved';

  for r in select id, student_id from public.course_enrollments where cohort_id = p_cohort_id loop
    select count(*) into v_completed
    from public.student_learning_progress p
    join public.learning_units u on u.id = p.learning_unit_id
    where p.student_id = r.student_id and p.cohort_id = p_cohort_id and p.status = 'completed' and u.status = 'approved';

    v_pct := case when v_total = 0 then 0 else round(v_completed::numeric / v_total * 100, 2) end;
    v_status := case
      when v_total > 0 and v_completed >= v_total then 'completed_pending_review'
      when v_completed > 0 then 'in_progress'
      else 'not_started'
    end;

    -- Leave a terminal certification/closure outcome alone; this helper only
    -- ever produces 'not_started' | 'in_progress' | 'completed_pending_review'.
    update public.course_enrollments e
    set progress_percent = v_pct,
        completion_status = case when e.completion_status in ('completed', 'incomplete', 'withdrawn', 'cancelled')
          then e.completion_status else v_status end
    where e.id = r.id;
  end loop;
end;
$fn$;

create or replace function public._recompute_course_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cohort uuid := coalesce(new.cohort_id, old.cohort_id);
begin
  perform public._recompute_cohort_progress(v_cohort);
  return coalesce(new, old);
end;
$fn$;

create or replace function public._recompute_progress_on_unit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cohort uuid := coalesce(new.cohort_id, old.cohort_id);
begin
  perform public._recompute_cohort_progress(v_cohort);
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists learning_units_recompute_progress on public.learning_units;
create trigger learning_units_recompute_progress after insert or delete or update of status on public.learning_units
  for each row execute function public._recompute_progress_on_unit_change();

-- ──────────────── 4. record_learning_progress requires cohort membership ─

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

  -- This SECURITY DEFINER RPC bypasses the student_learning_progress RLS
  -- membership check entirely, so enforce it explicitly here. Staff
  -- (reviewers/cohort teachers) are left unrestricted, matching the existing
  -- staff bypass in _validate_student_learning_progress.
  if not (public.has_permission('academic_plans.approve') or public.is_cohort_teacher(v_cohort))
     and not public.is_cohort_member(v_cohort) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

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

-- ──────────────── 2. my_course_status uses the shared standing helper ────

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
  v_standing jsonb;
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

    v_standing := public._attendance_standing(auth.uid(), e.cohort_id);

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
      'sessions_held', v_standing -> 'sessions_held', 'sessions_attended', v_standing -> 'sessions_attended',
      'sessions_missed', v_standing -> 'sessions_missed', 'attendance_percent', v_standing -> 'attendance_percent',
      'attendance_ok', (v_standing ->> 'attendance_percent') is null or (v_standing ->> 'attendance_percent')::numeric >= e.required_attendance_percent,
      'missed', v_standing -> 'missed',
      'units_total', v_units_total, 'units_completed', v_units_completed,
      'progress_percent', e.progress_percent, 'completion_status', e.completion_status,
      'next_unit', v_next_unit, 'overdue_units', v_overdue, 'upcoming_deadlines', v_deadlines, 'grade', v_grade
    );
    result := result || jsonb_build_array(entry);
  end loop;

  return result;
end;
$fn$;

-- ──────────────── 3. close_expired_course_windows: idempotent + re-check ──

create or replace function public.close_expired_course_windows()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
  r record;
  v_standing jsonb;
  v_pct numeric;
  v_attendance_ok boolean;
  v_new_status text;
begin
  for r in
    select ce.id, ce.student_id, ce.cohort_id, ce.progress_percent, ce.completion_status, p.required_attendance_percent
    from public.course_enrollments ce
    join public.cohorts c on c.id = ce.cohort_id
    join public.programs p on p.id = c.program_id
    where c.end_date < current_date
      and ce.status in ('approved', 'active')
      -- 'completed' and 'incomplete' are terminal outcomes of this function;
      -- 'completed_pending_review' is deliberately NOT excluded here so an
      -- enrollment that hit 100% progress before the window closed still
      -- gets its attendance re-checked once the window actually ends.
      and ce.completion_status not in ('completed', 'incomplete')
      -- Idempotency: once this enrollment has been notified that its window
      -- closed, never re-evaluate or re-notify it again, regardless of its
      -- completion_status.
      and not exists (
        select 1 from public.notifications n
        where n.recipient_id = ce.student_id and n.kind = 'course_window_closed'
          and n.entity_type = 'enrollment' and n.entity_id = ce.id
      )
  loop
    v_standing := public._attendance_standing(r.student_id, r.cohort_id);
    v_pct := (v_standing ->> 'attendance_percent')::numeric;
    v_attendance_ok := v_pct is null or v_pct >= r.required_attendance_percent;
    v_new_status := case
      when (r.completion_status = 'completed_pending_review' or r.progress_percent >= 100) and v_attendance_ok
        then 'completed_pending_review'
      else 'incomplete'
    end;

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

-- ──────────────── 6. start_classwork: insert-or-nothing + re-select ──────

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

  -- INSERT ... ON CONFLICT DO NOTHING + re-select avoids a race between a
  -- SELECT-then-INSERT when a student double-clicks "Start" (two concurrent
  -- calls); the loser of the race simply re-selects the winner's row below
  -- and both calls return the same submission/started_at.
  insert into public.submissions (assignment_id, student_id, status, started_at)
  values (p_assignment_id, auth.uid(), 'In Progress', now())
  on conflict (assignment_id, student_id) do nothing;

  select * into v_sub from public.submissions
  where assignment_id = p_assignment_id and student_id = auth.uid() for update;

  if v_sub.status in ('Submitted', 'Graded') then
    raise exception 'classwork_already_submitted' using errcode = 'P0001';
  elsif v_sub.status = 'Missing' or v_sub.started_at is null then
    -- A pre-existing placeholder row (status defaults to 'Missing' with no
    -- started_at, e.g. seeded ahead of time by a gradebook flow) must not
    -- permanently block the timer from ever starting; start it now instead.
    update public.submissions set status = 'In Progress', started_at = now()
    where id = v_sub.id
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

-- ──────────────── 7. submit_classwork: membership + attachment checks ────

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
  v_attachment text;
  v_is_late boolean;
  v_cohort_teacher uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select * into v_assignment from public.assignments where id = p_assignment_id;
  if v_assignment.id is null then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;
  -- Re-check cohort membership at submit time too, in case the student was
  -- removed from the cohort between starting and submitting the classwork.
  if not public.is_cohort_member(v_assignment.cohort_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select * into v_sub from public.submissions
  where assignment_id = p_assignment_id and student_id = auth.uid() for update;
  if v_sub.id is null or v_sub.started_at is null then
    raise exception 'classwork_not_started' using errcode = 'P0001';
  end if;
  if v_sub.status in ('Submitted', 'Graded') then
    raise exception 'classwork_already_submitted' using errcode = 'P0001';
  end if;

  v_response := coalesce(p_response_text, '');
  v_attachment := nullif(btrim(coalesce(p_attachment_path, '')), '');

  if v_attachment is not null then
    if v_attachment not like (p_assignment_id::text || '/' || auth.uid()::text || '/%') then
      raise exception 'invalid_attachment_path' using errcode = 'P0001';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'classwork-submissions' and name = v_attachment) then
      raise exception 'attachment_not_found' using errcode = 'P0001';
    end if;
  end if;

  if length(btrim(v_response)) = 0 and v_attachment is null then
    raise exception 'classwork_empty' using errcode = 'P0001';
  end if;

  v_is_late := (
    v_assignment.time_limit_minutes is not null
    and now() > v_sub.started_at + (v_assignment.time_limit_minutes || ' minutes')::interval + interval '2 minutes'
  ) or (v_assignment.due_date is not null and now()::date > v_assignment.due_date);

  update public.submissions
  set status = 'Submitted',
      submitted_at = now(),
      response_text = v_response,
      attachment_path = v_attachment,
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

-- ──────────────── 9. create_academic_lesson_bundle: p_available_from ──────

drop function if exists public.create_academic_lesson_bundle(uuid, uuid, uuid, text, text, text, integer, timestamptz, integer, numeric, integer, numeric);

create or replace function public.create_academic_lesson_bundle(
  p_program_id uuid,
  p_cohort_id uuid,
  p_course_plan_id uuid,
  p_title text,
  p_summary text,
  p_unit_type text,
  p_position integer,
  p_due_at timestamptz,
  p_classwork_minutes integer,
  p_classwork_weight numeric,
  p_quiz_minutes integer,
  p_quiz_weight numeric,
  p_available_from timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  unit public.learning_units%rowtype;
  v_assignment_id uuid;
  v_quiz_id uuid;
begin
  if auth.uid() is null
     or not public.has_permission('lessons.manage')
     or not public.is_cohort_teacher(p_cohort_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cohorts where id = p_cohort_id and program_id = p_program_id) then
    raise exception 'cohort_program_mismatch' using errcode = 'P0001';
  end if;
  if p_course_plan_id is not null and not exists (
    select 1 from public.teacher_course_plans
    where id = p_course_plan_id and cohort_id = p_cohort_id and teacher_id = auth.uid()
  ) then
    raise exception 'course_plan_scope_mismatch' using errcode = 'P0001';
  end if;
  if p_unit_type not in ('chapter', 'module', 'topic')
     or p_position < 1
     or p_classwork_minutes not between 1 and 1440
     or p_quiz_minutes not between 1 and 600
     or p_classwork_weight <= 0 or p_classwork_weight > 100
     or p_quiz_weight <= 0 or p_quiz_weight > 100 then
    raise exception 'invalid_lesson_assessment_settings' using errcode = 'P0001';
  end if;
  if p_available_from is not null and p_due_at is not null and p_available_from >= p_due_at then
    raise exception 'available_after_due' using errcode = 'P0001';
  end if;

  insert into public.learning_units (
    program_id, cohort_id, course_plan_id, title, summary, unit_type,
    position, available_from, due_at, status, created_by
  ) values (
    p_program_id, p_cohort_id, p_course_plan_id, btrim(p_title), coalesce(p_summary, ''), p_unit_type,
    p_position, p_available_from, p_due_at, 'draft', auth.uid()
  ) returning * into unit;

  insert into public.assignments (
    cohort_id, title, description, due_date, max_marks, learning_unit_id,
    time_limit_minutes, grade_weight
  ) values (
    p_cohort_id, btrim(p_title) || ' classwork', 'Classwork for ' || btrim(p_title),
    p_due_at::date, 100, unit.id, p_classwork_minutes, p_classwork_weight
  ) returning id into v_assignment_id;

  insert into public.quizzes (
    program_id, cohort_id, created_by, title, description, status,
    time_limit_minutes, max_attempts, pass_mark, learning_unit_id, grade_weight
  ) values (
    p_program_id, p_cohort_id, auth.uid(), btrim(p_title) || ' quiz',
    'Timed quiz for ' || btrim(p_title) || '. Add questions in Quiz Builder before publication.',
    'draft', p_quiz_minutes, 1, 50, unit.id, p_quiz_weight
  ) returning id into v_quiz_id;

  update public.learning_units
  set quiz_id = v_quiz_id, classwork_assignment_id = v_assignment_id
  where id = unit.id
  returning * into unit;

  return to_jsonb(unit);
end;
$fn$;

-- ──────────────────────────────── 8. Index ────────────────────────────────

create index if not exists notifications_recipient_kind_entity_idx on public.notifications(recipient_id, kind, entity_id);

-- ──────────────────────── 8. Grants / revokes ─────────────────────────────

-- New/changed public-facing RPCs: authenticated only.
revoke all on function public.record_learning_progress(uuid, text) from public, anon, authenticated;
revoke all on function public.my_course_status() from public, anon, authenticated;
revoke all on function public.start_classwork(uuid) from public, anon, authenticated;
revoke all on function public.submit_classwork(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_learning_progress(uuid, text) to authenticated;
grant execute on function public.my_course_status() to authenticated;
grant execute on function public.start_classwork(uuid) to authenticated;
grant execute on function public.submit_classwork(uuid, text, text) to authenticated;

revoke all on function public.create_academic_lesson_bundle(uuid, uuid, uuid, text, text, text, integer, timestamptz, integer, numeric, integer, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.create_academic_lesson_bundle(uuid, uuid, uuid, text, text, text, integer, timestamptz, integer, numeric, integer, numeric, timestamptz) to authenticated;

-- close_expired_course_windows stays server/cron-only (no client role at all).
revoke all on function public.close_expired_course_windows() from public, anon, authenticated;

-- Internal/trigger functions: never directly callable by anon/authenticated.
-- Trigger dispatch does not require the invoking role to hold EXECUTE on the
-- trigger function (verified against a disposable temp-table trigger before
-- writing this migration), so this only removes the ability to call them
-- directly via SQL -- it does not affect any existing trigger.
revoke all on function public._attendance_standing(uuid, uuid) from public, anon, authenticated;
revoke all on function public._recompute_cohort_progress(uuid) from public, anon, authenticated;
revoke all on function public._notify_attendance() from public, anon, authenticated;
revoke all on function public._notify_schedule_updated() from public, anon, authenticated;
revoke all on function public._validate_student_learning_progress() from public, anon, authenticated;
revoke all on function public._recompute_course_progress() from public, anon, authenticated;
revoke all on function public._recompute_progress_on_unit_change() from public, anon, authenticated;
revoke all on function public._notify_academic_status() from public, anon, authenticated;
revoke all on function public._record_approval_event() from public, anon, authenticated;
revoke all on function public._touch_academic_row() from public, anon, authenticated;
revoke all on function public._validate_class_session() from public, anon, authenticated;
revoke all on function public._validate_learning_unit_approval() from public, anon, authenticated;
revoke all on function public._validate_learning_unit_component() from public, anon, authenticated;
revoke all on function public._approved_enrollment_to_roster() from public, anon, authenticated;
revoke all on function public._normalize_training_material_status() from public, anon, authenticated;
revoke all on function public._quizzes_touch() from public, anon, authenticated;
revoke all on function public._blog_payments_touch() from public, anon, authenticated;
revoke all on function public._quiz_questions_totals() from public, anon, authenticated;
revoke all on function public._quiz_questions_validate() from public, anon, authenticated;
revoke all on function public._enqueue_notification_email() from public, anon, authenticated;
