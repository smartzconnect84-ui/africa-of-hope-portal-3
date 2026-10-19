-- Support (donations, volunteers, partners) and applicant study plans.
-- Written by the public site, read by staff in Operations → Support inbox.

create table if not exists public.support_pledges (
  id text primary key,
  kind text not null check (kind in ('donation', 'volunteer', 'partner')),
  name text not null,
  email text not null,
  phone text not null,
  amount numeric not null default 0,
  frequency text,
  method text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id text primary key,
  name text not null,
  email text not null,
  phone text not null,
  program_id text,
  program_title text not null,
  mode text not null check (mode in ('online', 'blended', 'onsite')),
  duration text,
  registration_fee text,
  education_level text,
  intake text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.support_pledges enable row level security;
alter table public.study_plans enable row level security;

-- Anyone (including signed-out visitors) may submit a form, nobody may read it back.
drop policy if exists "support pledges public insert" on public.support_pledges;
create policy "support pledges public insert" on public.support_pledges
  for insert to anon, authenticated with check (true);

drop policy if exists "support pledges staff read" on public.support_pledges;
create policy "support pledges staff read" on public.support_pledges
  for select to authenticated using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  );

drop policy if exists "study plans public insert" on public.study_plans;
create policy "study plans public insert" on public.study_plans
  for insert to anon, authenticated with check (true);

drop policy if exists "study plans staff read" on public.study_plans;
create policy "study plans staff read" on public.study_plans
  for select to authenticated using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  );

-- Staff move an enquiry through new -> contacted -> closed.
drop policy if exists "support pledges staff update" on public.support_pledges;
create policy "support pledges staff update" on public.support_pledges
  for update to authenticated
  using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  )
  with check (true);

drop policy if exists "study plans staff update" on public.study_plans;
create policy "study plans staff update" on public.study_plans
  for update to authenticated
  using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  )
  with check (true);

create index if not exists support_pledges_created_idx on public.support_pledges (created_at desc);
create index if not exists study_plans_created_idx on public.study_plans (created_at desc);

-- RLS alone is not enough: this project's tables do not inherit blanket anon
-- privileges (the same gap broke public reads of system_settings).
grant insert on public.support_pledges to anon, authenticated;
grant select, update on public.support_pledges to authenticated;
grant insert on public.study_plans to anon, authenticated;
grant select, update on public.study_plans to authenticated;

-- Delivery mode(s) and study plan on programme records so admin edits drive the
-- public catalogue (fully online / partially online / on-site).
alter table public.programs add column if not exists delivery_modes text[] default array['online', 'blended']::text[];
alter table public.programs add column if not exists study_plan text;

-- Let signed-out visitors read published programmes (they already could via the
-- public read policy) and keep the anon privilege that policy relies on.
grant select on public.programs to anon, authenticated;
