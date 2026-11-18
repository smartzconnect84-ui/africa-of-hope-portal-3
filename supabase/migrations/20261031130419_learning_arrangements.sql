-- Enrollment-level learning arrangements. Additive and backwards compatible.
alter table public.course_enrollments
  add column if not exists learning_arrangement text not null default 'blended',
  add column if not exists arrangement_config jsonb not null default '{}'::jsonb,
  add column if not exists arrangement_changed_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_enrollments_learning_arrangement_check' and conrelid = 'public.course_enrollments'::regclass) then
    alter table public.course_enrollments add constraint course_enrollments_learning_arrangement_check
      check (learning_arrangement in ('self_paced', 'blended', 'full_onsite'));
  end if;
end $$;

create table if not exists public.enrollment_arrangement_history (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  previous_arrangement text,
  next_arrangement text not null check (next_arrangement in ('self_paced', 'blended', 'full_onsite')),
  changed_by uuid references public.profiles(id) on delete set null default auth.uid(),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists enrollment_arrangement_history_enrollment_idx
  on public.enrollment_arrangement_history(enrollment_id, created_at desc);

alter table public.enrollment_arrangement_history enable row level security;
revoke all on public.enrollment_arrangement_history from anon, authenticated;
grant select on public.enrollment_arrangement_history to authenticated;

drop policy if exists enrollment_arrangement_history_read on public.enrollment_arrangement_history;
create policy enrollment_arrangement_history_read on public.enrollment_arrangement_history
for select to authenticated using (
  exists (select 1 from public.course_enrollments e where e.id = enrollment_id and (
    e.student_id = auth.uid() or public.is_academic_reviewer()
  ))
);

create or replace function public.submit_course_enrollment_with_arrangement(p_cohort_id uuid, p_arrangement text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  result jsonb;
  enrollment public.course_enrollments%rowtype;
  allowed_modes text[];
begin
  if p_arrangement not in ('self_paced', 'blended', 'full_onsite') then
    raise exception 'invalid_learning_arrangement' using errcode = 'P0001';
  end if;
  select p.delivery_modes into allowed_modes
  from public.cohorts c join public.programs p on p.id = c.program_id
  where c.id = p_cohort_id;
  if not (p_arrangement = any(coalesce(allowed_modes, array['blended']::text[]))) then
    raise exception 'learning_arrangement_not_offered' using errcode = 'P0001';
  end if;
  result := public.submit_course_enrollment(p_cohort_id);
  if (result ->> 'enrollment_id') is not null then
    select * into enrollment from public.course_enrollments where id = (result ->> 'enrollment_id')::uuid;
    update public.course_enrollments
      set learning_arrangement = p_arrangement,
          arrangement_changed_at = case when learning_arrangement = p_arrangement then arrangement_changed_at else now() end,
          arrangement_config = jsonb_build_object('attendance_required', p_arrangement <> 'self_paced')
      where id = enrollment.id;
    if enrollment.learning_arrangement is distinct from p_arrangement then
      insert into public.enrollment_arrangement_history(enrollment_id, previous_arrangement, next_arrangement, reason)
      values (enrollment.id, enrollment.learning_arrangement, p_arrangement, 'Student enrollment submission');
    end if;
  end if;
  return result || jsonb_build_object('learning_arrangement', p_arrangement);
end;
$fn$;

grant execute on function public.submit_course_enrollment_with_arrangement(uuid, text) to authenticated;
