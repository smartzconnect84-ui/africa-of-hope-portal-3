-- Self-paced enrollments do not accrue attendance penalties. Existing cohorts,
-- sessions, and attendance records remain unchanged for blended/full-onsite learners.
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
  v_arrangement text;
begin
  select learning_arrangement into v_arrangement
  from public.course_enrollments
  where cohort_id = p_cohort_id and student_id = p_student_id
  order by requested_at desc limit 1;

  if v_arrangement = 'self_paced' then
    return jsonb_build_object('sessions_held', 0, 'sessions_attended', 0, 'sessions_missed', 0, 'attendance_percent', null, 'missed', '[]'::jsonb);
  end if;

  select enrolled_at::date into v_join_date
  from public.cohort_students where cohort_id = p_cohort_id and student_id = p_student_id;

  select count(*) into v_held from public.class_sessions s
  where s.cohort_id = p_cohort_id and s.status = 'approved' and s.attendance_required
    and s.session_date >= coalesce(v_join_date, '-infinity'::date)
    and (s.session_date < current_date or (s.session_date = current_date and (s.session_date + s.ends_at) <= now()));

  select count(*) into v_attended from public.class_sessions s
  where s.cohort_id = p_cohort_id and s.status = 'approved' and s.attendance_required
    and s.session_date >= coalesce(v_join_date, '-infinity'::date)
    and (s.session_date < current_date or (s.session_date = current_date and (s.session_date + s.ends_at) <= now()))
    and exists (select 1 from public.attendance a where a.student_id = p_student_id and a.status in ('Present', 'Late')
      and (a.class_session_id = s.id or (a.class_session_id is null and a.cohort_id = s.cohort_id and a.attendance_date = s.session_date)));

  select coalesce(jsonb_agg(jsonb_build_object('session_id', m.id, 'title', m.title, 'session_date', m.session_date) order by m.session_date desc), '[]'::jsonb)
  into v_missed from (
    select s.id, s.title, s.session_date from public.class_sessions s
    where s.cohort_id = p_cohort_id and s.status = 'approved' and s.attendance_required
      and s.session_date >= coalesce(v_join_date, '-infinity'::date)
      and (s.session_date < current_date or (s.session_date = current_date and (s.session_date + s.ends_at) <= now()))
      and not exists (select 1 from public.attendance a where a.student_id = p_student_id and a.status in ('Present', 'Late')
        and (a.class_session_id = s.id or (a.class_session_id is null and a.cohort_id = s.cohort_id and a.attendance_date = s.session_date)))
    order by s.session_date desc limit 10
  ) m;

  return jsonb_build_object('sessions_held', v_held, 'sessions_attended', v_attended, 'sessions_missed', v_held - v_attended,
    'attendance_percent', case when v_held = 0 then null else round(v_attended::numeric / v_held * 100, 2) end, 'missed', v_missed);
end;
$fn$;
