-- Additive only. Review and apply manually after roles_permissions_cms.
begin;
create table if not exists public.transparency_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  category text not null check (category in ('Registration papers', 'Audited accounts', 'Annual reports')),
  reporting_year integer not null check (reporting_year between 1900 and 2200),
  summary text not null default '' check (length(summary) <= 2000),
  file_path text not null unique,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (file_path = id::text || '.pdf')
);
alter table public.transparency_reports enable row level security;
create policy transparency_read on public.transparency_reports for select to anon, authenticated
  using (published or public.has_permission('cms.manage'));
create policy transparency_insert on public.transparency_reports for insert to authenticated
  with check (public.has_permission('cms.manage'));
create policy transparency_update on public.transparency_reports for update to authenticated
  using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
-- Supabase installations may grant table-level DML through default privileges.
-- Revoke those before granting the intentionally narrow column permissions.
revoke all on public.transparency_reports from anon, authenticated;
grant select on public.transparency_reports to anon, authenticated;
grant insert on public.transparency_reports to authenticated;
grant update(title, category, reporting_year, summary, published) on public.transparency_reports to authenticated;
create index if not exists transparency_published_year_idx on public.transparency_reports(published, reporting_year desc);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('transparency-reports', 'transparency-reports', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
create policy transparency_file_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'transparency-reports' and (
    public.has_permission('cms.manage') or exists (
      select 1 from public.transparency_reports r where r.file_path = name and r.published
    )
  ));
create policy transparency_file_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'transparency-reports' and public.has_permission('cms.manage')
    and name ~ '^[0-9a-f-]{36}\.pdf$');
-- Only failed/unregistered uploads can be removed; issued report files are immutable.
create policy transparency_orphan_cleanup on storage.objects for delete to authenticated
  using (bucket_id = 'transparency-reports' and public.has_permission('cms.manage')
    and not exists (select 1 from public.transparency_reports r where r.file_path = name));

create or replace function public.guard_transparency_file()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.published and not exists (select 1 from storage.objects where bucket_id = 'transparency-reports' and name = new.file_path) then
    raise exception 'Upload the official PDF before publishing';
  end if;
  return new;
end; $$;
create trigger transparency_file_guard before insert or update on public.transparency_reports
  for each row execute function public.guard_transparency_file();
commit;
