-- DEPLOY-12: Opportunity boards backend (vacancies, applications, alumni businesses, admission drafts).
-- Additive only. Run after 20261105000000_certificate_types_audit.sql. Safe to re-run.
-- Public can read open vacancies + approved businesses and submit applications/listings/drafts.
-- Staff with cms.manage get full add/edit/delete/upload control. No existing data touched.
begin;

-- ── Tables ──
create table if not exists public.staff_vacancies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  dept text not null default 'General',
  location text not null default 'Monrovia',
  description text not null default '',
  requirements text not null default '',
  closing_date date,
  is_open boolean not null default true,
  image_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vacancy_applications (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid references public.staff_vacancies(id) on delete set null,
  role_title text not null default '',
  name text not null,
  contact text not null,
  cover_note text not null default '',
  cv_url text,
  status text not null default 'new' check (status in ('new','shortlisted','rejected','hired')),
  created_at timestamptz not null default now()
);

create table if not exists public.alumni_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null default '',
  category text not null default 'Other',
  location text not null default '',
  contact text not null default '',
  description text not null default '',
  logo_url text,
  is_approved boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_drafts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint application_drafts_email_check check (email <> '')
);
create unique index if not exists application_drafts_email_idx on public.application_drafts (lower(btrim(email)));

-- ── RLS ──
alter table public.staff_vacancies enable row level security;
alter table public.vacancy_applications enable row level security;
alter table public.alumni_businesses enable row level security;
alter table public.application_drafts enable row level security;

revoke all on public.staff_vacancies from anon, authenticated;
revoke all on public.vacancy_applications from anon, authenticated;
revoke all on public.alumni_businesses from anon, authenticated;
revoke all on public.application_drafts from anon, authenticated;

grant select on public.staff_vacancies to anon, authenticated;
grant select on public.alumni_businesses to anon, authenticated;
grant insert on public.vacancy_applications to anon, authenticated;
grant select on public.vacancy_applications to authenticated;
grant insert on public.alumni_businesses to anon, authenticated;
grant insert on public.application_drafts to anon, authenticated;
grant select, insert, update, delete on public.staff_vacancies to authenticated;
grant select, insert, update, delete on public.vacancy_applications to authenticated;
grant select, insert, update, delete on public.alumni_businesses to authenticated;
grant select, insert, update, delete on public.application_drafts to authenticated;

-- Public reads: open vacancies + approved businesses only.
drop policy if exists staff_vacancies_public_open on public.staff_vacancies;
create policy staff_vacancies_public_open on public.staff_vacancies
  for select to anon, authenticated using (is_open = true);

drop policy if exists staff_vacancies_staff_all on public.staff_vacancies;
create policy staff_vacancies_staff_all on public.staff_vacancies
  for all to authenticated using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- Anyone (guest included) may apply; only staff may read/update/delete queue.
drop policy if exists vacancy_apps_public_insert on public.vacancy_applications;
create policy vacancy_apps_public_insert on public.vacancy_applications
  for insert to anon, authenticated with check (
    btrim(name) <> '' and btrim(contact) <> '' and btrim(cover_note) <> ''
  );

drop policy if exists vacancy_apps_staff_all on public.vacancy_applications;
create policy vacancy_apps_staff_all on public.vacancy_applications
  for all to authenticated using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- Alumni businesses: public sees approved only; anyone may submit (starts unapproved unless staff).
drop policy if exists alumni_biz_public_approved on public.alumni_businesses;
create policy alumni_biz_public_approved on public.alumni_businesses
  for select to anon, authenticated using (is_approved = true);

drop policy if exists alumni_biz_public_insert on public.alumni_businesses;
create policy alumni_biz_public_insert on public.alumni_businesses
  for insert to anon, authenticated with check (
    btrim(name) <> '' and btrim(contact) <> '' and btrim(description) <> ''
  );

drop policy if exists alumni_biz_staff_all on public.alumni_businesses;
create policy alumni_biz_staff_all on public.alumni_businesses
  for all to authenticated using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- Admission drafts: guests save/resume by email; staff manage all.
drop policy if exists app_drafts_public_upsert on public.application_drafts;
create policy app_drafts_public_upsert on public.application_drafts
  for insert to anon, authenticated with check (btrim(email) <> '');

drop policy if exists app_drafts_public_read on public.application_drafts;
create policy app_drafts_public_read on public.application_drafts
  for select to anon, authenticated using (true);

drop policy if exists app_drafts_public_update on public.application_drafts;
create policy app_drafts_public_update on public.application_drafts
  for update to anon, authenticated using (true) with check (btrim(email) <> '');

drop policy if exists app_drafts_staff_all on public.application_drafts;
create policy app_drafts_staff_all on public.application_drafts
  for all to authenticated using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- Seed open vacancies + approved sample businesses once (keeps public page useful pre-admin).
insert into public.staff_vacancies (title, dept, location, description, requirements, closing_date, is_open)
select * from (values
  ('ICT Tutor (part-time)','Teaching','Monrovia + online','Teach practical computer studies two evenings a week.','Diploma in ICT or related field plus 1 year hands-on experience.','2027-02-15'::date,true),
  ('Nursing Assistant Instructor','Teaching','Main campus','Lead lab demos and supervise internship logbooks.','Licensed practitioner with teaching or mentoring experience.','2027-02-28'::date,true),
  ('Admissions & Records Officer','Support','Monrovia','Handle applications, records and certificate queues.','Strong admin skills; spreadsheet and record-keeping experience.','2027-03-10'::date,true)
) as v(title, dept, location, description, requirements, closing_date, is_open)
where not exists (select 1 from public.staff_vacancies);

insert into public.alumni_businesses (name, owner_name, category, location, contact, description, is_approved)
select * from (values
  ('Hope Tech Repair','Alumni ''24','ICT services','Monrovia','+231 770 111 222','Phone & laptop repair with student discount.',true),
  ('Massa Catering','Alumni ''23','Food','Paynesville','+231 775 333 444','Events catering for graduations and open days.',true),
  ('Bright Stitches','Alumni ''25','Fashion','Congo Town','+231 777 555 666','Uniforms and graduation gowns made to order.',true)
) as b(name, owner_name, category, location, contact, description, is_approved)
where not exists (select 1 from public.alumni_businesses);

commit;
