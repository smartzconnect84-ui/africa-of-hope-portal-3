begin;

create table if not exists public.crash_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null default '',
  description text not null default '',
  duration_weeks integer not null default 2 check (duration_weeks > 0),
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid references public.crash_programs(id) on delete set null,
  blog_post_id uuid references public.blog_posts(id) on delete set null,
  applicant_type text not null check (applicant_type in ('Volunteer', 'Staff', 'Student')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists applicant_type text check (applicant_type in ('Volunteer', 'Staff', 'Student'));
alter table public.blog_posts add column if not exists program_id uuid references public.crash_programs(id) on delete set null;

alter table public.crash_programs enable row level security;
alter table public.program_applications enable row level security;

create policy "Published crash programs are public" on public.crash_programs for select to anon, authenticated using (published = true or (select public.is_admin()));
create policy "Admins manage crash programs" on public.crash_programs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Applicants create own applications" on public.program_applications for insert to authenticated with check ((select auth.uid()) = applicant_id);
create policy "Applicants view own applications" on public.program_applications for select to authenticated using ((select auth.uid()) = applicant_id or (select public.is_admin()));
create policy "Admins manage applications" on public.program_applications for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create index if not exists crash_programs_published_idx on public.crash_programs (published, created_at desc);
create index if not exists program_applications_applicant_idx on public.program_applications (applicant_id, created_at desc);

alter table public.crash_programs replica identity full;
alter table public.program_applications replica identity full;

commit;
