-- Grade Evaluation (renamed from Gradebook) + Aptitude Control (renamed from Entrance test control)
-- Keeps legacy entrance_* tables working while exposing the new platform names.

-- 1) Grade evaluation settings (weights + pass rules for Quizzes / Assignments / Exam-Final)
create table if not exists public.grade_evaluation_settings (
  id int primary key default 1 check (id = 1),
  quizzes_weight numeric not null default 30 check (quizzes_weight between 0 and 100),
  assignments_weight numeric not null default 30 check (assignments_weight between 0 and 100),
  exams_weight numeric not null default 40 check (exams_weight between 0 and 100),
  pass_mark numeric not null default 50 check (pass_mark between 0 and 100),
  distinction_mark numeric not null default 80 check (distinction_mark between 0 and 100),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.grade_evaluation_settings (id) values (1) on conflict (id) do nothing;
alter table public.grade_evaluation_settings enable row level security;
drop policy if exists grade_evaluation_read_all on public.grade_evaluation_settings;
create policy grade_evaluation_read_all on public.grade_evaluation_settings for select using (true);
drop policy if exists grade_evaluation_write_staff on public.grade_evaluation_settings;
create policy grade_evaluation_write_staff on public.grade_evaluation_settings for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant'))
);
drop policy if exists grade_evaluation_insert_staff on public.grade_evaluation_settings;
create policy grade_evaluation_insert_staff on public.grade_evaluation_settings for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant'))
);

-- 2) Grade evaluation assessments: unified Quizzes / Assignments / Exam-Final setup control
create table if not exists public.grade_assessments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quiz','assignment','exam')),
  title text not null check (char_length(title) between 1 and 200),
  cohort_id uuid,
  max_marks numeric not null default 100 check (max_marks > 0),
  weight numeric not null default 0 check (weight between 0 and 100),
  due_date date,
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists grade_assessments_kind_idx on public.grade_assessments(kind, published);
alter table public.grade_assessments enable row level security;
drop policy if exists grade_assessments_read_all on public.grade_assessments;
create policy grade_assessments_read_all on public.grade_assessments for select using (true);
drop policy if exists grade_assessments_write_staff on public.grade_assessments;
create policy grade_assessments_write_staff on public.grade_assessments for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant'))
);

-- Legacy alias: keep `gradebook_*` working if any client still uses it.
-- gradebook_settings view mirrors grade_evaluation_settings under the old name.
create or replace view public.gradebook_settings as
  select id, quizzes_weight, assignments_weight, exams_weight, pass_mark, distinction_mark, published, updated_at
  from public.grade_evaluation_settings;

-- 3) Aptitude Control (renamed from Entrance test control)
-- New canonical table; legacy entrance_settings keeps working via view + trigger sync.
create table if not exists public.aptitude_control_settings (
  id int primary key default 1 check (id = 1),
  require_pass boolean not null default true,
  pass_mark numeric not null default 50 check (pass_mark between 0 and 100),
  time_minutes int not null default 15 check (time_minutes between 1 and 180),
  max_attempts int not null default 3 check (max_attempts between 1 and 20),
  prep_pack_url text not null default '',
  prep_instructions text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.aptitude_control_settings (id)
  select id, require_pass, pass_mark, time_minutes, max_attempts, '', '' from public.entrance_settings
  on conflict (id) do nothing;
alter table public.aptitude_control_settings enable row level security;
drop policy if exists aptitude_settings_read_all on public.aptitude_control_settings;
create policy aptitude_settings_read_all on public.aptitude_control_settings for select using (true);
drop policy if exists aptitude_settings_write_staff on public.aptitude_control_settings;
create policy aptitude_settings_write_staff on public.aptitude_control_settings for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Director of Education'))
);
-- keep legacy entrance_settings in sync when aptitude table is updated
create or replace function public.sync_aptitude_to_entrance() returns trigger language plpgsql as $$
begin
  insert into public.entrance_settings (id, require_pass, pass_mark, time_minutes, max_attempts)
  values (NEW.id, NEW.require_pass, NEW.pass_mark, NEW.time_minutes, NEW.max_attempts)
  on conflict (id) do update set require_pass = excluded.require_pass, pass_mark = excluded.pass_mark,
    time_minutes = excluded.time_minutes, max_attempts = excluded.max_attempts, updated_at = now();
  return NEW;
end $$;
drop trigger if exists aptitude_sync_to_entrance on public.aptitude_control_settings;
create trigger aptitude_sync_to_entrance after insert or update on public.aptitude_control_settings
  for each row execute function public.sync_aptitude_to_entrance();

-- Canonical results view: aptitude_test_results mirrors entrance_test_results
create or replace view public.aptitude_test_results as
  select * from public.entrance_test_results;

-- 4) Entrance preparations managed inside Aptitude Control dashboard
create table if not exists public.aptitude_preparations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.aptitude_preparations enable row level security;
drop policy if exists aptitude_prep_read_all on public.aptitude_preparations;
create policy aptitude_prep_read_all on public.aptitude_preparations for select using (true);
drop policy if exists aptitude_prep_write_staff on public.aptitude_preparations;
create policy aptitude_prep_write_staff on public.aptitude_preparations for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant'))
);
-- seed a starter preparation checklist (only when empty)
insert into public.aptitude_preparations (title, body, sort_order)
select s.title, s.body, s.sort_order from (values
  ('Maths warm-up', 'Percentages, ratios and word problems. Practice 10 questions a day.', 1),
  ('English warm-up', 'Comprehension, spelling and professional customer replies.', 2),
  ('Test-day checklist', 'Bring your reference code, charged phone and arrive 20 minutes early.', 3)
) as s(title, body, sort_order)
where not exists (select 1 from public.aptitude_preparations);
