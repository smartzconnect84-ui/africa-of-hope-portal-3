-- DEPLOY-12: Opportunity boards backend (vacancies, applications, alumni businesses, admission drafts).
-- Additive only. Run after 20261105000000_certificate_types_audit.sql. Safe to re-run.
-- Public can read open vacancies + approved businesses and submit applications/listings.
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
grant insert (vacancy_id, role_title, name, contact, cover_note, cv_url) on public.vacancy_applications to anon;
grant select on public.vacancy_applications to authenticated;
grant insert (name, owner_name, category, location, contact, description, logo_url) on public.alumni_businesses to anon;
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

-- Anyone may apply to an open role; only staff may read/update/delete the queue.
drop policy if exists vacancy_apps_public_insert on public.vacancy_applications;
create policy vacancy_apps_public_insert on public.vacancy_applications
  for insert to anon, authenticated with check (
    length(btrim(name)) between 2 and 120
    and length(btrim(role_title)) between 1 and 160
    and length(btrim(contact)) between 3 and 180
    and length(btrim(cover_note)) between 1 and 5000
    and status = 'new'
    and cv_url is null
    and (
      vacancy_id is null
      or exists (
        select 1
        from public.staff_vacancies v
        where v.id = vacancy_id and v.is_open = true
      )
    )
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
    length(btrim(name)) between 2 and 120
    and length(btrim(owner_name)) <= 120
    and length(btrim(category)) between 1 and 80
    and length(btrim(location)) <= 160
    and length(btrim(contact)) between 3 and 180
    and length(btrim(description)) between 10 and 2000
    and is_approved = false
    and created_by is null
  );

drop policy if exists alumni_biz_staff_all on public.alumni_businesses;
create policy alumni_biz_staff_all on public.alumni_businesses
  for all to authenticated using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- Admission drafts contain applicant PII; only CMS-authorized staff may manage them.
drop policy if exists app_drafts_public_upsert on public.application_drafts;
drop policy if exists app_drafts_public_read on public.application_drafts;
drop policy if exists app_drafts_public_update on public.application_drafts;
drop policy if exists app_drafts_staff_all on public.application_drafts;
create policy app_drafts_staff_all on public.application_drafts
  for all to authenticated using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));



commit;
