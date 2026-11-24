-- Harden Self-Paced Learning RLS, add publish state and media/document/link resources.

-- Ensure staff helper exists (idempotent; mirrors backend/migrations portal_access_policies).
create or replace function public.is_staff() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'Active'
      and profiles.role in ('Super Admin', 'School Admin', 'Registrar', 'Teacher', 'Admission Officer')
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'Active'
      and profiles.role in ('Super Admin', 'School Admin', 'Registrar')
  )
$$;

-- 1. Publish state on content tables
alter table if exists public.self_paced_weeks
  add column if not exists published boolean not null default true;
alter table if exists public.self_paced_lessons
  add column if not exists published boolean not null default true;
alter table if exists public.self_paced_activities
  add column if not exists published boolean not null default true;

-- 2. Media / document / link resources per week
create table if not exists public.self_paced_resources (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.self_paced_weeks(id) on delete cascade,
  title text not null,
  url text not null,
  resource_type text not null default 'link',
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.self_paced_resources enable row level security;

-- 3. Drop permissive policies from the earlier migration
drop policy if exists "sp_weeks_read" on public.self_paced_weeks;
drop policy if exists "sp_lessons_read" on public.self_paced_lessons;
drop policy if exists "sp_activities_read" on public.self_paced_activities;
drop policy if exists "sp_part_own_read" on public.self_paced_participations;
drop policy if exists "sp_part_own_write" on public.self_paced_participations;
drop policy if exists "sp_part_own_update" on public.self_paced_participations;
drop policy if exists "sp_progress_own" on public.self_paced_progress;
drop policy if exists "sp_submissions_own_read" on public.self_paced_submissions;
drop policy if exists "sp_submissions_own_write" on public.self_paced_submissions;
drop policy if exists "sp_submissions_own_update" on public.self_paced_submissions;
drop policy if exists "sp_weeks_staff_write" on public.self_paced_weeks;
drop policy if exists "sp_lessons_staff_write" on public.self_paced_lessons;
drop policy if exists "sp_activities_staff_write" on public.self_paced_activities;
drop policy if exists "sp_submissions_staff_read" on public.self_paced_submissions;
drop policy if exists "sp_submissions_staff_update" on public.self_paced_submissions;
drop policy if exists "sp_progress_staff_read" on public.self_paced_progress;
drop policy if exists "sp_part_staff_read" on public.self_paced_participations;
drop policy if exists "sp_part_staff_update" on public.self_paced_participations;

-- 4. Tightened policies (staff via public.is_staff())
-- weeks
create policy "sp_weeks_read" on public.self_paced_weeks for select to authenticated using (published = true or public.is_staff());
create policy "sp_weeks_staff_write" on public.self_paced_weeks for insert to authenticated with check (public.is_staff());
create policy "sp_weeks_staff_update" on public.self_paced_weeks for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "sp_weeks_staff_delete" on public.self_paced_weeks for delete to authenticated using (public.is_staff());

-- lessons
create policy "sp_lessons_read" on public.self_paced_lessons for select to authenticated using (published = true or public.is_staff());
create policy "sp_lessons_staff_write" on public.self_paced_lessons for insert to authenticated with check (public.is_staff());
create policy "sp_lessons_staff_update" on public.self_paced_lessons for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "sp_lessons_staff_delete" on public.self_paced_lessons for delete to authenticated using (public.is_staff());

-- activities
create policy "sp_activities_read" on public.self_paced_activities for select to authenticated using (published = true or public.is_staff());
create policy "sp_activities_staff_write" on public.self_paced_activities for insert to authenticated with check (public.is_staff());
create policy "sp_activities_staff_update" on public.self_paced_activities for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "sp_activities_staff_delete" on public.self_paced_activities for delete to authenticated using (public.is_staff());

-- participations: own + staff
create policy "sp_part_own_read" on public.self_paced_participations for select to authenticated using (auth.uid() = user_id or public.is_staff());
create policy "sp_part_own_write" on public.self_paced_participations for insert to authenticated with check (auth.uid() = user_id);
create policy "sp_part_own_update" on public.self_paced_participations for update to authenticated using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());
create policy "sp_part_own_delete" on public.self_paced_participations for delete to authenticated using (auth.uid() = user_id or public.is_staff());

-- progress: own + staff read
create policy "sp_progress_own" on public.self_paced_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sp_progress_staff_read" on public.self_paced_progress for select to authenticated using (public.is_staff());
create policy "sp_progress_staff_update" on public.self_paced_progress for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- submissions: own + staff
create policy "sp_submissions_own_read" on public.self_paced_submissions for select to authenticated using (auth.uid() = user_id or public.is_staff());
create policy "sp_submissions_own_write" on public.self_paced_submissions for insert to authenticated with check (auth.uid() = user_id);
create policy "sp_submissions_own_update" on public.self_paced_submissions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sp_submissions_staff_update" on public.self_paced_submissions for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "sp_submissions_staff_delete" on public.self_paced_submissions for delete to authenticated using (public.is_staff());

-- resources
create policy "sp_resources_read" on public.self_paced_resources for select to authenticated using (published = true or public.is_staff());
create policy "sp_resources_staff_write" on public.self_paced_resources for insert to authenticated with check (public.is_staff());
create policy "sp_resources_staff_update" on public.self_paced_resources for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "sp_resources_staff_delete" on public.self_paced_resources for delete to authenticated using (public.is_staff());