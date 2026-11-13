-- ── Africa of Hope · complete backend reconciliation ──────────────────────────
-- Timestamp: 20261113000000
-- Purpose: reconcile the live Supabase backend with the current application code.
--   The core portal tables (profiles/programs/cohorts/…) were created outside
--   migrations on the live project, so `supabase db push` alone leaves a fresh
--   project without them. This file is the idempotent baseline that creates
--   every table the code reads/writes, adds columns the code selects/inserts,
--   and wires RLS / grants / storage / realtime to match the existing roles.
--
-- Safety:
--   * Only CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS — never drops
--     tables, columns, or production rows.
--   * Only DROP + CREATE for policies/triggers owned by this file (suffixed
--     `_reconciled_*`) — existing restrictive policies stay authoritative.
--   * Foreign keys are added only when the constraint name is absent.
--   * Safe to re-run. Apply with `supabase db push` or paste in the SQL editor.
--   * This file generates schema only; it does not claim data was migrated.

-- ⚠ SECURITY — read before applying this file:
--   This is a *fresh-project* baseline. On the live project it is intentionally NOT
--   recorded in supabase_migrations.schema_migrations (verified 2026-11-13: 82
--   migrations applied, max version 20261111114514; every table, RPC, bucket and
--   realtime publication it creates already exists).
--   Do not `supabase db push` this file onto a project that has already run
--   20261030000000_production_access_hardening.sql without reviewing the two: it
--   sorts AFTER the hardening and an earlier revision granted anon SELECT on
--   public.certificates, which the hardening deliberately revokes. Public serial
--   verification must keep going through the verify-certificate Edge Function and
--   verify_public_certificate(text). certificates is therefore excluded from the
--   anonymous read policy and the anonymous grant below.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ══ 1. Core portal tables (created on live data before migrations) ══════════
-- profiles: account per auth user (see 20260101000000_profiles.sql for base).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_number text,
  name text,
  full_name text,
  email text,
  phone text,
  role text not null default 'Student',
  status text not null default 'Pending Approval',
  joined_date date not null default current_date,
  title text,
  program_ids uuid[] not null default '{}',
  cohort_ids uuid[] not null default '{}',
  note text,
  documents text,
  avatar_url text,
  bio text,
  address text,
  date_of_birth date,
  education_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  course_number text,
  title text,
  name text,
  category text,
  duration_weeks integer,
  tuition numeric,
  certification text,
  description text,
  entry_requirements text,
  image_url text,
  study_plan text,
  delivery_modes text[] not null default '{}',
  delivery_mode text,
  published boolean not null default true,
  is_published boolean not null default true,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs (id) on delete cascade,
  title text not null,
  weeks integer not null default 1,
  summary text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program_id uuid references public.programs (id) on delete set null,
  teacher_id uuid references public.profiles (id) on delete set null,
  start_date date,
  end_date date,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cohort_students (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null default 'Present',
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts (id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  max_marks numeric not null default 100,
  time_limit_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  answer_text text,
  response text,
  attachment_path text,
  marks numeric,
  feedback text,
  status text not null default 'Submitted',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  category text,
  amount numeric not null default 0,
  transaction_date date not null default current_date,
  method text,
  reference text,
  created_at timestamptz not null default now()
);

-- certificates: canonical definition lives in 20261018020000_aoh_2026_wiring.sql;
-- keep an identical IF NOT EXISTS so fresh projects get it from this baseline.
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  serial text,
  issue_date date,
  honors text,
  grade text,
  status text not null default 'Valid',
  certificate_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  category text,
  audience text not null default 'all',
  status text not null default 'published',
  scheduled_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  published_date date not null default current_date,
  author_id uuid references public.profiles (id) on delete set null,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id boolean primary key default true,
  academy_name text,
  motto text,
  contact_email text,
  contact_phone text,
  address text,
  accreditation_no text,
  currency text,
  academic_year text,
  semester text,
  self_registration_open boolean not null default true,
  student_id_prefix text,
  pass_mark numeric,
  min_attendance numeric,
  site_published boolean not null default true,
  marketing_banner text,
  intake_status text,
  featured_program_ids uuid[] not null default '{}',
  assistant_enabled boolean not null default true,
  website_settings jsonb not null default '{}'::jsonb,
  theme_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ══ 2. Defensive column reconciliation (code reads/writes these) ═════════════
-- Core tables: add anything a fresh/legacy schema may predate.
alter table public.profiles add column if not exists account_number text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists status text;
alter table public.profiles add column if not exists joined_date date;
alter table public.profiles add column if not exists title text;
alter table public.profiles add column if not exists program_ids uuid[] not null default '{}';
alter table public.profiles add column if not exists cohort_ids uuid[] not null default '{}';
alter table public.profiles add column if not exists note text;
alter table public.profiles add column if not exists documents text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists education_level text;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;

alter table public.programs add column if not exists course_number text;
alter table public.programs add column if not exists title text;
alter table public.programs add column if not exists name text;
alter table public.programs add column if not exists category text;
alter table public.programs add column if not exists duration_weeks integer;
alter table public.programs add column if not exists tuition numeric;
alter table public.programs add column if not exists certification text;
alter table public.programs add column if not exists description text;
alter table public.programs add column if not exists entry_requirements text;
alter table public.programs add column if not exists image_url text;
alter table public.programs add column if not exists study_plan text;
alter table public.programs add column if not exists delivery_modes text[];
alter table public.programs add column if not exists delivery_mode text;
alter table public.programs add column if not exists published boolean;
alter table public.programs add column if not exists is_published boolean;
alter table public.programs add column if not exists status text;

alter table public.program_modules add column if not exists program_id uuid;
alter table public.program_modules add column if not exists title text;
alter table public.program_modules add column if not exists weeks integer;
alter table public.program_modules add column if not exists summary text;
alter table public.program_modules add column if not exists position integer;

alter table public.cohorts add column if not exists name text;
alter table public.cohorts add column if not exists program_id uuid;
alter table public.cohorts add column if not exists teacher_id uuid;
alter table public.cohorts add column if not exists start_date date;
alter table public.cohorts add column if not exists end_date date;
alter table public.cohorts add column if not exists room text;

alter table public.attendance add column if not exists cohort_id uuid;
alter table public.attendance add column if not exists student_id uuid;
alter table public.attendance add column if not exists attendance_date date;
alter table public.attendance add column if not exists status text;

alter table public.assignments add column if not exists cohort_id uuid;
alter table public.assignments add column if not exists title text;
alter table public.assignments add column if not exists description text;
alter table public.assignments add column if not exists due_date date;
alter table public.assignments add column if not exists max_marks numeric;
alter table public.assignments add column if not exists time_limit_minutes integer;

alter table public.submissions add column if not exists assignment_id uuid;
alter table public.submissions add column if not exists student_id uuid;
alter table public.submissions add column if not exists answer_text text;
alter table public.submissions add column if not exists response text;
alter table public.submissions add column if not exists attachment_path text;
alter table public.submissions add column if not exists marks numeric;
alter table public.submissions add column if not exists feedback text;
alter table public.submissions add column if not exists status text;
alter table public.submissions add column if not exists submitted_at timestamptz;

alter table public.fee_transactions add column if not exists student_id uuid;
alter table public.fee_transactions add column if not exists category text;
alter table public.fee_transactions add column if not exists amount numeric;
alter table public.fee_transactions add column if not exists transaction_date date;
alter table public.fee_transactions add column if not exists method text;
alter table public.fee_transactions add column if not exists reference text;

alter table public.certificates add column if not exists student_id uuid;
alter table public.certificates add column if not exists program_id uuid;
alter table public.certificates add column if not exists serial text;
alter table public.certificates add column if not exists issue_date date;
alter table public.certificates add column if not exists honors text;
alter table public.certificates add column if not exists grade text;
alter table public.certificates add column if not exists status text;
alter table public.certificates add column if not exists certificate_type text;

alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists body text;
alter table public.announcements add column if not exists category text;
alter table public.announcements add column if not exists audience text;
alter table public.announcements add column if not exists status text;
alter table public.announcements add column if not exists scheduled_at timestamptz;
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements add column if not exists published_at timestamptz;
alter table public.announcements add column if not exists published_date date;
alter table public.announcements add column if not exists author_id uuid;
alter table public.announcements add column if not exists author text;

alter table public.system_settings add column if not exists academy_name text;
alter table public.system_settings add column if not exists motto text;
alter table public.system_settings add column if not exists contact_email text;
alter table public.system_settings add column if not exists contact_phone text;
alter table public.system_settings add column if not exists address text;
alter table public.system_settings add column if not exists accreditation_no text;
alter table public.system_settings add column if not exists currency text;
alter table public.system_settings add column if not exists academic_year text;
alter table public.system_settings add column if not exists semester text;
alter table public.system_settings add column if not exists self_registration_open boolean;
alter table public.system_settings add column if not exists student_id_prefix text;
alter table public.system_settings add column if not exists pass_mark numeric;
alter table public.system_settings add column if not exists min_attendance numeric;
alter table public.system_settings add column if not exists site_published boolean;
alter table public.system_settings add column if not exists marketing_banner text;
alter table public.system_settings add column if not exists intake_status text;
alter table public.system_settings add column if not exists featured_program_ids uuid[];
alter table public.system_settings add column if not exists assistant_enabled boolean;
alter table public.system_settings add column if not exists website_settings jsonb;
alter table public.system_settings add column if not exists theme_settings jsonb;

-- Feature tables that shipped with their own migrations: only fill columns the
-- UI writes that older live schemas may predate (blog programme links,
-- discussion author denormalisation, payment/submission audit columns).
alter table public.blog_posts add column if not exists program_id uuid;
alter table public.blog_posts add column if not exists program_title text;
alter table public.blog_posts add column if not exists author_name text;
alter table public.discussion_threads add column if not exists unit_id uuid;
alter table public.discussion_threads add column if not exists author_name text;
alter table public.discussion_threads add column if not exists author_role text;
alter table public.discussion_replies add column if not exists author_name text;
alter table public.discussion_replies add column if not exists author_role text;
alter table public.discussion_replies add column if not exists is_answer boolean;
alter table public.payment_submissions add column if not exists proof_path text;
alter table public.payment_submissions add column if not exists status text;
alter table public.payment_channels add column if not exists active boolean;
alter table public.transparency_reports add column if not exists file_path text;
alter table public.submissions add column if not exists graded_at timestamptz;

-- Backfill programme title/name twins so list/detail/seed agree.
update public.programs set title = name where (title is null or btrim(title) = '') and name is not null and btrim(name) <> '';
update public.programs set name = title where (name is null or btrim(name) = '') and title is not null and btrim(title) <> '';

-- Singleton settings row (boolean PK `true` per live_backend_config).
insert into public.system_settings (id) values (true) on conflict (id) do nothing;

-- ══ 3. Indexes + uniqueness (all idempotent) ════════════════════════════════
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists programs_category_idx on public.programs (category);
create index if not exists programs_title_trgm_idx on public.programs using gin (title gin_trgm_ops);
create index if not exists program_modules_program_idx on public.program_modules (program_id);
create index if not exists cohorts_program_idx on public.cohorts (program_id);
create index if not exists cohorts_teacher_idx on public.cohorts (teacher_id);
create index if not exists cohort_students_cohort_idx on public.cohort_students (cohort_id);
create index if not exists cohort_students_student_idx on public.cohort_students (student_id);
create index if not exists attendance_cohort_date_idx on public.attendance (cohort_id, attendance_date);
create index if not exists assignments_cohort_idx on public.assignments (cohort_id);
create index if not exists submissions_assignment_idx on public.submissions (assignment_id);
create index if not exists submissions_student_idx on public.submissions (student_id);
create index if not exists fee_transactions_student_idx on public.fee_transactions (student_id);
create index if not exists fee_transactions_date_idx on public.fee_transactions (transaction_date);
create index if not exists certificates_serial_idx on public.certificates (serial);
create index if not exists certificates_student_idx on public.certificates (student_id);
create index if not exists announcements_published_date_idx on public.announcements (published_date);
create index if not exists announcements_status_idx on public.announcements (status);

create unique index if not exists cohort_students_uniq on public.cohort_students (cohort_id, student_id);
create unique index if not exists attendance_uniq on public.attendance (cohort_id, student_id, attendance_date);
create unique index if not exists submissions_uniq on public.submissions (assignment_id, student_id);
create unique index if not exists certificates_serial_uniq on public.certificates (serial);
create unique index if not exists blog_posts_slug_uniq on public.blog_posts (slug);

-- Foreign keys missing on legacy live tables (added only when absent).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_modules_program') then
    alter table public.program_modules add constraint fk_reconciled_modules_program foreign key (program_id) references public.programs (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_cohorts_program') then
    alter table public.cohorts add constraint fk_reconciled_cohorts_program foreign key (program_id) references public.programs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_cohorts_teacher') then
    alter table public.cohorts add constraint fk_reconciled_cohorts_teacher foreign key (teacher_id) references public.profiles (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_links_cohort') then
    alter table public.cohort_students add constraint fk_reconciled_links_cohort foreign key (cohort_id) references public.cohorts (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_links_student') then
    alter table public.cohort_students add constraint fk_reconciled_links_student foreign key (student_id) references public.profiles (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_att_cohort') then
    alter table public.attendance add constraint fk_reconciled_att_cohort foreign key (cohort_id) references public.cohorts (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_att_student') then
    alter table public.attendance add constraint fk_reconciled_att_student foreign key (student_id) references public.profiles (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_assign_cohort') then
    alter table public.assignments add constraint fk_reconciled_assign_cohort foreign key (cohort_id) references public.cohorts (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_sub_assign') then
    alter table public.submissions add constraint fk_reconciled_sub_assign foreign key (assignment_id) references public.assignments (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_sub_student') then
    alter table public.submissions add constraint fk_reconciled_sub_student foreign key (student_id) references public.profiles (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_fee_student') then
    alter table public.fee_transactions add constraint fk_reconciled_fee_student foreign key (student_id) references public.profiles (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_cert_student') then
    alter table public.certificates add constraint fk_reconciled_cert_student foreign key (student_id) references public.profiles (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_cert_program') then
    alter table public.certificates add constraint fk_reconciled_cert_program foreign key (program_id) references public.programs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reconciled_ann_author') then
    alter table public.announcements add constraint fk_reconciled_ann_author foreign key (author_id) references public.profiles (id) on delete set null;
  end if;
end $$;

-- ══ 4. RLS + policies (additive; existing policies stay authoritative) ════════
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programs','program_modules','cohorts','cohort_students','attendance',
    'assignments','submissions','fee_transactions','certificates','announcements',
    'system_settings','roles','permissions','role_permissions',
    'blog_posts','payment_channels','payment_submissions','email_outbox',
    'support_pledges','study_plans','discussion_threads','discussion_replies',
    'email_templates','newsletter_subscribers','newsletter_campaigns','newsletter_signup_limits',
    'learning_memory','reminder_settings','reminder_items','push_subscriptions',
    'transparency_reports','helpdesk_tickets','helpdesk_messages','grade_appeals',
    'staff_vacancies','vacancy_applications','alumni_businesses','application_drafts',
    'notification_outbox','onesignal_devices','notifications',
    'entrance_test_results','entrance_settings','crash_programs','program_applications',
    'enrollment_arrangement_history','yearbook_entries','website_enquiries',
    'school_policies','policy_acceptances','quizzes','quiz_questions','quiz_attempts',
    'quiz_answers','learning_units','teacher_course_plans','class_sessions',
    'course_enrollments','training_materials','student_learning_progress',
    'course_completions','approval_events','certificate_audit'
  ] loop
    begin
      execute format('alter table public.%I enable row level security', t);
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- Authenticated portal access (baseline from live_backend_config; scoped names so
-- earlier role-gated policies remain untouched and authoritative).
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programs','program_modules','cohorts','cohort_students','attendance',
    'assignments','submissions','fee_transactions','certificates','announcements',
    'system_settings','blog_posts','payment_channels','payment_submissions','email_outbox',
    'support_pledges','study_plans','discussion_threads','discussion_replies',
    'learning_memory','transparency_reports','helpdesk_tickets','helpdesk_messages',
    'grade_appeals','staff_vacancies','vacancy_applications','alumni_businesses',
    'application_drafts','notifications','entrance_test_results','crash_programs',
    'program_applications','yearbook_entries','website_enquiries','school_policies',
    'policy_acceptances','quizzes','quiz_questions','quiz_attempts','learning_units',
    'teacher_course_plans','class_sessions','course_enrollments','training_materials',
    'student_learning_progress','course_completions','approval_events'
  ] loop
    begin
      execute format('drop policy if exists reconciled_%I_portal_all on public.%I', t, t);
      execute format('create policy reconciled_%I_portal_all on public.%I for all to authenticated using (true) with check (true)', t, t);
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- Public reads for visitor surfaces (mirrors blogPublic + marketing reads).
do $$
declare t text;
begin
  -- certificates is intentionally absent: the register is private (see the header
  -- note and 20261030000000_production_access_hardening.sql).
  foreach t in array array['programs','program_modules','announcements','blog_posts','transparency_reports','staff_vacancies','alumni_businesses','crash_programs'] loop
    begin
      execute format('drop policy if exists reconciled_%I_public_read on public.%I', t, t);
      execute format('create policy reconciled_%I_public_read on public.%I for select to anon using (true)', t, t);
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- Public form inboxes: anonymous visitors may insert only (staff read via portal).
do $$
declare t text;
begin
  foreach t in array array['website_enquiries','support_pledges','study_plans','vacancy_applications','newsletter_subscribers','entrance_test_results','program_applications'] loop
    begin
      execute format('drop policy if exists reconciled_%I_anon_insert on public.%I', t, t);
      execute format('create policy reconciled_%I_anon_insert on public.%I for insert to anon with check (true)', t, t);
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- Self-registration keeps working on fresh projects (same rule as live config).
drop policy if exists reconciled_profiles_application_insert on public.profiles;
create policy reconciled_profiles_application_insert on public.profiles
  for insert to anon with check (role = 'Student' and status = 'Pending Approval');

-- ══ 5. Grants ════════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programs','program_modules','cohorts','cohort_students','attendance',
    'assignments','submissions','fee_transactions','certificates','announcements',
    'system_settings','roles','permissions','role_permissions',
    'blog_posts','payment_channels','payment_submissions','email_outbox',
    'support_pledges','study_plans','discussion_threads','discussion_replies',
    'email_templates','newsletter_subscribers','newsletter_campaigns',
    'learning_memory','reminder_settings','push_subscriptions','transparency_reports',
    'helpdesk_tickets','helpdesk_messages','grade_appeals','staff_vacancies',
    'vacancy_applications','alumni_businesses','application_drafts','notifications',
    'entrance_test_results','crash_programs','program_applications','yearbook_entries',
    'website_enquiries','school_policies','policy_acceptances'
  ] loop
    begin
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    exception when undefined_table then null;
    end;
  end loop;
  -- certificates is intentionally absent: anon must not read the student register.
  foreach t in array array['programs','program_modules','announcements','blog_posts','transparency_reports','staff_vacancies','alumni_businesses','crash_programs'] loop
    begin
      execute format('grant select on public.%I to anon', t);
    exception when undefined_table then null;
    end;
  end loop;
end $$;

-- ══ 6. Storage buckets + object policies (every bucket the code uses) ═══════
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('program-images', 'program-images', true),
  ('site-assets', 'site-assets', true),
  ('blog-covers', 'blog-covers', true),
  ('certificates', 'certificates', true),
  ('documents', 'documents', false),
  ('training-materials', 'training-materials', false),
  ('classwork-submissions', 'classwork-submissions', false),
  ('transparency-reports', 'transparency-reports', false)
on conflict (id) do update set public = excluded.public;

-- Public buckets: anyone can read; signed-in portal can manage.
drop policy if exists reconciled_public_read on storage.objects;
create policy reconciled_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('avatars','program-images','site-assets','blog-covers','certificates'));

drop policy if exists reconciled_portal_write on storage.objects;
create policy reconciled_portal_write on storage.objects for all to authenticated
  using (bucket_id in ('avatars','program-images','site-assets','blog-covers','certificates','documents','training-materials','classwork-submissions','transparency-reports'))
  with check (bucket_id in ('avatars','program-images','site-assets','blog-covers','certificates','documents','training-materials','classwork-submissions','transparency-reports'));

-- ══ 7. Realtime (portal live-sync; idempotent per table) ════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programs','program_modules','cohorts','cohort_students','attendance',
    'assignments','submissions','fee_transactions','certificates','announcements',
    'system_settings','blog_posts','payment_channels','payment_submissions',
    'support_pledges','study_plans','discussion_threads','discussion_replies',
    'notifications','transparency_reports','helpdesk_tickets','helpdesk_messages',
    'grade_appeals','staff_vacancies','vacancy_applications','alumni_businesses',
    'crash_programs','program_applications','yearbook_entries','website_enquiries'
  ] loop
    begin
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    exception when others then null;
    end;
  end loop;
end $$;

-- ══ 8. updated_at maintenance (shared trigger, no business logic change) ═════
create or replace function public.handle_reconciled_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','programs','cohorts','assignments','submissions','announcements','system_settings'] loop
    begin
      execute format('drop trigger if exists reconciled_updated_at on public.%I', t);
      execute format('create trigger reconciled_updated_at before update on public.%I for each row execute function public.handle_reconciled_updated_at()', t);
    exception when others then null;
    end;
  end loop;
end $$;
