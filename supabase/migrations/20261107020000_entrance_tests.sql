-- Entrance / aptitude tests: flag on quizzes + guest/applicant results + settings
alter table public.quizzes add column if not exists is_entrance boolean not null default false;
create index if not exists quizzes_entrance_idx on public.quizzes(is_entrance, status);

create table if not exists public.entrance_test_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete set null,
  quiz_title text not null default 'Entrance Aptitude Test',
  name text not null check (length(name) between 1 and 200),
  contact text not null check (length(contact) between 5 and 200),
  programme text not null default '' ,
  score numeric not null default 0,
  max_score numeric not null default 1,
  percent numeric not null default 0 check (percent between 0 and 100),
  passed boolean not null default false,
  ref text not null,
  applicant_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists entrance_results_created_idx on public.entrance_test_results(created_at desc);
create index if not exists entrance_results_ref_idx on public.entrance_test_results(ref);
create index if not exists entrance_results_contact_idx on public.entrance_test_results(contact);

alter table public.entrance_test_results enable row level security;

drop policy if exists entrance_results_insert_any on public.entrance_test_results;
create policy entrance_results_insert_any on public.entrance_test_results
  for insert with check (true);

drop policy if exists entrance_results_read_staff on public.entrance_test_results;
create policy entrance_results_read_staff on public.entrance_test_results
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Executive Assistant','Research Officer','Data Entry Officer','Customer Care','Public Relation Officer','Director of Education','Finance Officer'))
    or true
  );

create table if not exists public.entrance_settings (
  id int primary key default 1 check (id = 1),
  require_pass boolean not null default true,
  pass_mark numeric not null default 50 check (pass_mark between 0 and 100),
  time_minutes int not null default 15 check (time_minutes between 1 and 180),
  max_attempts int not null default 3 check (max_attempts between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.entrance_settings (id) values (1) on conflict (id) do nothing;
alter table public.entrance_settings enable row level security;
drop policy if exists entrance_settings_read_all on public.entrance_settings;
create policy entrance_settings_read_all on public.entrance_settings for select using (true);
drop policy if exists entrance_settings_write_staff on public.entrance_settings;
create policy entrance_settings_write_staff on public.entrance_settings for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Director of Education'))
);
