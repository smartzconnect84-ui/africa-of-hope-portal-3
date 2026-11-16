-- School policies + acceptances (Africa of Hope)
-- Creates backend storage for the 10 school policies and versioned student/staff acceptance.

create table if not exists public.school_policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'General',
  summary text not null default '',
  body text not null default '',
  version integer not null default 1,
  effective_date date not null default current_date,
  is_published boolean not null default true,
  requires_acceptance boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.school_policies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  accepted_version integer not null default 1,
  accepted_at timestamptz not null default now(),
  unique (policy_id, user_id)
);

alter table public.school_policies enable row level security;
alter table public.policy_acceptances enable row level security;

drop policy if exists school_policies_read on public.school_policies;
create policy school_policies_read on public.school_policies for select using (
  is_published = true
  or (select public.has_permission('settings.manage'))
  or (select public.has_permission('cms.manage'))
);

drop policy if exists school_policies_write on public.school_policies;
create policy school_policies_write on public.school_policies for all to authenticated
  using ((select public.has_permission('settings.manage')) or (select public.has_permission('cms.manage')))
  with check ((select public.has_permission('settings.manage')) or (select public.has_permission('cms.manage')));

drop policy if exists policy_acceptances_read on public.policy_acceptances;
create policy policy_acceptances_read on public.policy_acceptances for select to authenticated using (
  user_id = auth.uid()
  or (select public.has_permission('students.manage'))
  or (select public.has_permission('settings.manage'))
);

drop policy if exists policy_acceptances_write on public.policy_acceptances;
create policy policy_acceptances_write on public.policy_acceptances for all to authenticated
  using (
    user_id = auth.uid()
    or (select public.has_permission('students.manage'))
    or (select public.has_permission('settings.manage'))
  )
  with check (
    user_id = auth.uid()
    or (select public.has_permission('students.manage'))
    or (select public.has_permission('settings.manage'))
  );

drop trigger if exists school_policies_touch on public.school_policies;
create trigger school_policies_touch before update on public.school_policies
  for each row execute function public._touch_updated_at();

-- Seed the 10 school policies (idempotent by slug). Bodies are summaries;
-- the full text lives in src/lib/schoolPolicies.ts as the offline fallback.
insert into public.school_policies (slug, title, category, summary, body, version, is_published, requires_acceptance, sort)
values
  ('admissions-enrolment', 'Admissions & Enrolment Policy', 'Admissions', 'Who may apply, how applications are reviewed, and how enrolment is confirmed.', 'Full policy text is maintained in the portal Policies editor. This row seeds the policy so it is visible on the public site and in the portal before any edit.', 1, true, true, 10),
  ('academic-standards-assessment', 'Academic Standards & Assessment Policy', 'Academics', 'Pass marks, grading, assignments, quizzes and academic integrity.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 20),
  ('attendance-participation', 'Attendance & Participation Policy', 'Academics', 'Minimum 75% attendance, lateness, absence reporting and cohort participation.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 30),
  ('fees-payments-refunds', 'Fees, Payments & Refunds Policy', 'Finance', 'Tuition, instalments, receipts, refunds and financial holds.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 40),
  ('conduct-discipline', 'Code of Conduct & Discipline Policy', 'Conduct', 'Expected behaviour, prohibited conduct and the disciplinary process.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 50),
  ('safeguarding-welfare', 'Safeguarding & Student Welfare Policy', 'Welfare', 'Protection from harm, reporting channels and welfare support.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 60),
  ('examinations-certification', 'Examinations & Certification Policy', 'Academics', 'Exam conduct, pass requirements, honours, verification and re-sits.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 70),
  ('data-privacy', 'Data Privacy & Records Policy', 'Governance', 'What data we keep, why, who sees it, and student rights.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 80),
  ('health-safety', 'Health, Safety & Campus Policy', 'Welfare', 'Campus safety, emergencies, health and facility use.', 'Full policy text is maintained in the portal Policies editor.', 1, true, false, 90),
  ('online-learning-ict', 'Online Learning & ICT Acceptable Use Policy', 'Academics', 'Portal accounts, online classes, training materials and device rules.', 'Full policy text is maintained in the portal Policies editor.', 1, true, true, 100)
on conflict (slug) do nothing;
