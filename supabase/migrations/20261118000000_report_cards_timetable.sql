-- Term report cards + cohort timetable planner
-- f18: teacher comments per student per term/cohort
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
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant','Super Admin'))
);

-- f19: weekly class timetable slots per cohort
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
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Teacher','Director of Education','Executive Assistant','Super Admin'))
);
