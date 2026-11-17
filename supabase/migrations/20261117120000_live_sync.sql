-- Applied to the live database on 2026-11-17. Safe to re-run: every statement is idempotent.

-- 1) Direct messages
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint direct_messages_no_self check (sender_id <> receiver_id)
);
create index if not exists direct_messages_pair_idx on public.direct_messages (sender_id, receiver_id, created_at desc);
alter table public.direct_messages enable row level security;
drop policy if exists "Members read own chats" on public.direct_messages;
create policy "Members read own chats" on public.direct_messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "Members send chats" on public.direct_messages;
create policy "Members send chats" on public.direct_messages for insert with check (auth.uid() = sender_id);
drop policy if exists "Receivers mark seen" on public.direct_messages;
create policy "Receivers mark seen" on public.direct_messages for update using (auth.uid() = receiver_id or auth.uid() = sender_id);

-- 2) Grade evaluation + aptitude control
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
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant')));
drop policy if exists grade_evaluation_insert_staff on public.grade_evaluation_settings;
create policy grade_evaluation_insert_staff on public.grade_evaluation_settings for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant')));

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
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant')));

create or replace view public.gradebook_settings as
  select id, quizzes_weight, assignments_weight, exams_weight, pass_mark, distinction_mark, published, updated_at
  from public.grade_evaluation_settings;
alter view public.gradebook_settings set (security_invoker = true);

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
insert into public.aptitude_control_settings (id) select id from public.entrance_settings on conflict (id) do nothing;
insert into public.aptitude_control_settings (id) values (1) on conflict (id) do nothing;
alter table public.aptitude_control_settings enable row level security;
drop policy if exists aptitude_settings_read_all on public.aptitude_control_settings;
create policy aptitude_settings_read_all on public.aptitude_control_settings for select using (true);
drop policy if exists aptitude_settings_write_staff on public.aptitude_control_settings;
create policy aptitude_settings_write_staff on public.aptitude_control_settings for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Director of Education')));

create or replace function public.sync_aptitude_to_entrance() returns trigger language plpgsql set search_path = public as $$
begin
  update public.entrance_settings set updated_at = now() where id = new.id;
  return new;
end $$;
drop trigger if exists aptitude_sync_to_entrance on public.aptitude_control_settings;
create trigger aptitude_sync_to_entrance after insert or update on public.aptitude_control_settings
  for each row execute function public.sync_aptitude_to_entrance();

create or replace view public.aptitude_test_results as select * from public.entrance_test_results;
alter view public.aptitude_test_results set (security_invoker = true);

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
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant')));
insert into public.aptitude_preparations (title, body, sort_order)
select s.title, s.body, s.sort_order from (values
  ('Maths warm-up', 'Percentages, ratios and word problems. Practice 10 questions a day.', 1),
  ('English warm-up', 'Comprehension, spelling and professional customer replies.', 2),
  ('Test-day checklist', 'Bring your reference code, charged phone and arrive 20 minutes early.', 3)
) as s(title, body, sort_order)
where not exists (select 1 from public.aptitude_preparations);

-- 3) Report cards + timetable
create table if not exists public.term_report_comments (
  id uuid primary key default gen_random_uuid(),
  cohort_id text not null,
  student_id text not null,
  term text not null default 'Term 1',
  comment text not null default '',
  updated_at timestamptz not null default now(),
  unique (cohort_id, student_id, term)
);
alter table public.term_report_comments enable row level security;
drop policy if exists term_report_comments_read_all on public.term_report_comments;
create policy term_report_comments_read_all on public.term_report_comments for select using (true);
drop policy if exists term_report_comments_write_staff on public.term_report_comments;
create policy term_report_comments_write_staff on public.term_report_comments for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant','Super Admin'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant','Super Admin')));

create table if not exists public.cohort_timetable_slots (
  id uuid primary key default gen_random_uuid(),
  cohort_id text not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  title text not null default '' check (char_length(title) between 1 and 200),
  teacher_id text not null default '',
  room text not null default '',
  starts_at text not null default '08:00',
  ends_at text not null default '09:00',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists cohort_timetable_cohort_day_idx on public.cohort_timetable_slots(cohort_id, day_of_week, starts_at);
alter table public.cohort_timetable_slots enable row level security;
drop policy if exists cohort_timetable_read_all on public.cohort_timetable_slots;
create policy cohort_timetable_read_all on public.cohort_timetable_slots for select using (true);
drop policy if exists cohort_timetable_write_staff on public.cohort_timetable_slots;
create policy cohort_timetable_write_staff on public.cohort_timetable_slots for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant','Super Admin'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant','Super Admin')));

-- 4) Realtime
do $$ begin
  begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cohort_timetable_slots; exception when duplicate_object then null; end;
end $$;
