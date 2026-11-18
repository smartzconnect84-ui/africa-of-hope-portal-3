-- Graduation yearbook wall (f171)
create table if not exists public.yearbook_entries (
  id uuid primary key default gen_random_uuid(),
  graduate_name text not null,
  cohort text not null default 'Class of 2026',
  programme text not null default '',
  note text not null default '',
  photo_url text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.yearbook_entries enable row level security;

drop policy if exists "yearbook public read approved" on public.yearbook_entries;
create policy "yearbook public read approved"
  on public.yearbook_entries for select
  using (is_approved = true);

drop policy if exists "yearbook public submit" on public.yearbook_entries;
create policy "yearbook public submit"
  on public.yearbook_entries for insert
  with check (true);
