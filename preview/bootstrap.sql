-- Preview-only bootstrap schema for a fresh local Supabase database.
--
-- The repository migrations ALTER and reference base tables that were created
-- directly in the hosted project and never committed (see
-- supabase/tests/README.md). This file recreates the minimum shape of those
-- tables, inferred from src/data/liveData.ts, src/context/AppContext.tsx and the
-- later migrations, so supabase/migrations/2*.sql can be applied in order.
-- Columns that later migrations add themselves are intentionally left out.
-- Never run this against the hosted project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  full_name text,
  phone text,
  role text not null default 'Student',
  status text not null default 'Pending Approval',
  joined_date date not null default current_date,
  title text,
  note text,
  documents text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  title text,
  category text,
  duration_weeks integer,
  tuition numeric,
  certification text,
  description text,
  entry_requirements text,
  delivery_modes text[] not null default '{}',
  study_plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null default '',
  weeks integer not null default 1,
  summary text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program_id uuid references public.programs (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  start_date date,
  end_date date,
  room text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.cohort_students (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cohort_id, student_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null default 'Present' check (status in ('Present', 'Absent', 'Late')),
  created_at timestamptz not null default now(),
  unique (cohort_id, student_id, attendance_date)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts (id) on delete cascade,
  title text not null default '',
  due_date date,
  max_marks numeric not null default 100,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz,
  marks numeric,
  feedback text not null default '',
  status text not null default 'Missing',
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.fee_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete cascade,
  category text not null default 'Tuition',
  amount numeric not null default 0,
  transaction_date date not null default current_date,
  method text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  serial text,
  issue_date date,
  honors text,
  grade text,
  status text not null default 'Valid',
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  category text not null default 'Academic',
  published_date date not null default current_date,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  academy_name text,
  motto text,
  contact_email text,
  contact_phone text,
  address text,
  accreditation_no text,
  currency text,
  academic_year text,
  semester text,
  self_registration_open boolean,
  student_id_prefix text,
  pass_mark numeric,
  min_attendance numeric,
  site_published boolean,
  marketing_banner text,
  intake_status text,
  featured_program_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Trigger helper that exists in the hosted project but not in any migration
-- (used by 20261018000000_school_policies.sql).
create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
