-- Forward fixes for 20261014090000 (round-2 review).
--   1. Progress recompute is per enrollment again for student_learning_progress
--      writes. The enrollment row is locked (FOR UPDATE) before units are
--      counted, so concurrent writers never save a stale count. The
--      cohort-wide pass stays only for learning_units changes.
--   2. A closed course window (course_window_closed notice sent) is final:
--      later unit changes update progress_percent but keep completion_status.
--   3. start_classwork never restarts a started timer and returns server_now
--      so the client can correct for device clock skew.
--   4. Users can update only notifications.read_at (dedupe rows stay intact).

-- 1+2. Per-enrollment recompute with row lock.
create or replace function public._recompute_enrollment_progress(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_enrollment public.course_enrollments%rowtype;
  v_total integer;
  v_completed integer;
  v_pct numeric;
  v_status text;
  v_closed boolean;
begin
  -- Lock first. Under READ COMMITTED the counts below take a new snapshot
  -- after the lock is granted, so they see every committed progress row.
  select * into v_enrollment from public.course_enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then
    return;
  end if;

  select count(*) into v_total
  from public.learning_units u where u.cohort_id = v_enrollment.cohort_id and u.status = 'approved';

  select count(*) into v_completed
  from public.student_learning_progress p
  join public.learning_units u on u.id = p.learning_unit_id
  where p.student_id = v_enrollment.student_id and p.cohort_id = v_enrollment.cohort_id
    and p.status = 'completed' and u.status = 'approved';

  v_pct := case when v_total = 0 then 0 else round(v_completed::numeric / v_total * 100, 2) end;
  v_status := case
    when v_total > 0 and v_completed >= v_total then 'completed_pending_review'
    when v_completed > 0 then 'in_progress'
    else 'not_started'
  end;

  v_closed := exists (
    select 1 from public.notifications n
    where n.recipient_id = v_enrollment.student_id and n.kind = 'course_window_closed'
      and n.entity_type = 'enrollment' and n.entity_id = v_enrollment.id
  );

  if v_closed or v_enrollment.completion_status in ('completed', 'incomplete', 'withdrawn', 'cancelled') then
    v_status := v_enrollment.completion_status;
  end if;

  if v_enrollment.progress_percent is distinct from v_pct
     or v_enrollment.completion_status is distinct from v_status then
    update public.course_enrollments
    set progress_percent = v_pct, completion_status = v_status
    where id = v_enrollment.id;
  end if;
end;
$fn$;

create or replace function public._recompute_cohort_progress(p_cohort_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
begin
  if p_cohort_id is null then
    return;
  end if;
  -- Stable order keeps lock acquisition consistent across sessions.
  for r in select id from public.course_enrollments where cohort_id = p_cohort_id order by id loop
    perform public._recompute_enrollment_progress(r.id);
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
  v_enrollment uuid;
begin
  select id into v_enrollment from public.course_enrollments
  where cohort_id = coalesce(new.cohort_id, old.cohort_id)
    and student_id = coalesce(new.student_id, old.student_id);
  if v_enrollment is not null then
    perform public._recompute_enrollment_progress(v_enrollment);
  end if;
  -- A row moved to another student or cohort also refreshes the old pair.
  if tg_op = 'UPDATE' and (old.cohort_id, old.student_id) is distinct from (new.cohort_id, new.student_id) then
    select id into v_enrollment from public.course_enrollments
    where cohort_id = old.cohort_id and student_id = old.student_id;
    if v_enrollment is not null then
      perform public._recompute_enrollment_progress(v_enrollment);
    end if;
  end if;
  return coalesce(new, old);
end;
$fn$;

-- 3. start_classwork.
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
  elsif v_sub.started_at is null then
    -- A placeholder row with no started_at (for example 'Missing' seeded by a
    -- gradebook flow) starts the timer now. A row that already has a
    -- started_at keeps it, so the timer is never restarted.
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
    'status', v_sub.status,
    'server_now', now()
  );
end;
$fn$;

-- 4. Notifications: only read_at is user-editable.
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

revoke all on function public._recompute_enrollment_progress(uuid) from public, anon, authenticated;
revoke all on function public._recompute_cohort_progress(uuid) from public, anon, authenticated;
revoke all on function public._recompute_course_progress() from public, anon, authenticated;
revoke all on function public.start_classwork(uuid) from public, anon;
grant execute on function public.start_classwork(uuid) to authenticated;
