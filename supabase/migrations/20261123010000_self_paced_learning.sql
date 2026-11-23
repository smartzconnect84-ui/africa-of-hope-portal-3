-- Optional Self-Paced Learning System (additive, backward-compatible)

-- 1. Enable self-paced learning per course (program)
alter table if exists public.programs
  add column if not exists self_paced_enabled boolean not null default false;

-- 2. Participation / pathway selection (preserves original enrollment)
create table if not exists public.self_paced_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  status text not null default 'selected',
  requires_approval boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, program_id)
);

-- 3. Weekly modules
create table if not exists public.self_paced_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_number integer not null,
  title text not null,
  objectives text,
  available_from date,
  completion_requires_percent integer not null default 80,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (program_id, week_number)
);

-- 4. Lessons
create table if not exists public.self_paced_lessons (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.self_paced_weeks(id) on delete cascade,
  title text not null,
  content text,
  resource_urls jsonb not null default '[]'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Activities (exercises, self-eval, assignments, assessments)
create table if not exists public.self_paced_activities (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.self_paced_weeks(id) on delete cascade,
  lesson_id uuid references public.self_paced_lessons(id) on delete set null,
  type text not null default 'exercise',
  title text not null,
  description text,
  max_score numeric not null default 100,
  due_date date,
  created_at timestamptz not null default now()
);

-- 6. Submissions
create table if not exists public.self_paced_submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.self_paced_activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  file_url text,
  score numeric,
  status text not null default 'submitted',
  feedback text,
  graded_by uuid references auth.users(id) on delete set null,
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

-- 7. Progress per week per student
create table if not exists public.self_paced_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_id uuid not null references public.self_paced_weeks(id) on delete cascade,
  status text not null default 'not_started',
  completed_at timestamptz,
  score numeric,
  created_at timestamptz not null default now(),
  unique (user_id, week_id)
);

-- RLS
alter table public.self_paced_participations enable row level security;
alter table public.self_paced_weeks enable row level security;
alter table public.self_paced_lessons enable row level security;
alter table public.self_paced_activities enable row level security;
alter table public.self_paced_submissions enable row level security;
alter table public.self_paced_progress enable row level security;

-- Policies: authenticated read for weeks/lessons/activities
create policy if not exists "sp_weeks_read" on public.self_paced_weeks for select to authenticated using (true);
create policy if not exists "sp_lessons_read" on public.self_paced_lessons for select to authenticated using (true);
create policy if not exists "sp_activities_read" on public.self_paced_activities for select to authenticated using (true);

-- Participations: own rows
create policy if not exists "sp_part_own_read" on public.self_paced_participations for select to authenticated using (auth.uid() = user_id);
create policy if not exists "sp_part_own_write" on public.self_paced_participations for insert to authenticated with check (auth.uid() = user_id);
create policy if not exists "sp_part_own_update" on public.self_paced_participations for update to authenticated using (auth.uid() = user_id);

-- Progress/submissions: own rows
create policy if not exists "sp_progress_own" on public.self_paced_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "sp_submissions_own_read" on public.self_paced_submissions for select to authenticated using (auth.uid() = user_id);
create policy if not exists "sp_submissions_own_write" on public.self_paced_submissions for insert to authenticated with check (auth.uid() = user_id);
create policy if not exists "sp_submissions_own_update" on public.self_paced_submissions for update to authenticated using (auth.uid() = user_id);

-- Staff manage weeks/lessons/activities/submissions/progress (permissive for instructors/admins)
create policy if not exists "sp_weeks_staff_write" on public.self_paced_weeks for all to authenticated using (true) with check (true);
create policy if not exists "sp_lessons_staff_write" on public.self_paced_lessons for all to authenticated using (true) with check (true);
create policy if not exists "sp_activities_staff_write" on public.self_paced_activities for all to authenticated using (true) with check (true);
create policy if not exists "sp_submissions_staff_read" on public.self_paced_submissions for select to authenticated using (true);
create policy if not exists "sp_submissions_staff_update" on public.self_paced_submissions for update to authenticated using (true);
create policy if not exists "sp_progress_staff_read" on public.self_paced_progress for select to authenticated using (true);
create policy if not exists "sp_part_staff_read" on public.self_paced_participations for select to authenticated using (true);
create policy if not exists "sp_part_staff_update" on public.self_paced_participations for update to authenticated using (true);