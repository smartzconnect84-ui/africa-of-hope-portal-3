create table if not exists public.website_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  contact text not null check (length(btrim(contact)) between 5 and 120),
  program text not null default 'General enquiry' check (length(program) <= 120),
  message text not null check (length(btrim(message)) between 1 and 2000),
  source text not null default 'whatsapp' check (source in ('contact', 'faq', 'whatsapp')),
  created_at timestamptz not null default now(),
  replied boolean not null default false
);

create index if not exists website_enquiries_created_idx
  on public.website_enquiries (created_at desc);

alter table public.website_enquiries enable row level security;

drop policy if exists website_enquiries_public_insert on public.website_enquiries;
create policy website_enquiries_public_insert on public.website_enquiries
  for insert to anon, authenticated
  with check (
    length(btrim(name)) between 2 and 100
    and length(btrim(contact)) between 5 and 120
    and length(program) <= 120
    and length(btrim(message)) between 1 and 2000
    and source in ('contact', 'faq', 'whatsapp')
    and replied = false
  );

drop policy if exists website_enquiries_staff_all on public.website_enquiries;
create policy website_enquiries_staff_all on public.website_enquiries
  for all to authenticated
  using (
    public.has_permission('students.manage')
    or public.has_permission('fees.manage')
  )
  with check (
    public.has_permission('students.manage')
    or public.has_permission('fees.manage')
  );

grant insert on public.website_enquiries to anon, authenticated;
grant select, update, delete on public.website_enquiries to authenticated;
