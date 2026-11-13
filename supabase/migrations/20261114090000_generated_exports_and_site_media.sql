-- ============================================================================
-- Generated exports registry + public site media storage + realtime
-- ----------------------------------------------------------------------------
-- Adds the one production gap left by the reconciliation migrations:
--   * generated_exports  — every file a user generates from backend data
--     (CSV / Google Sheets / Excel / calendar / PDF / Word) so it can be
--     revoked or moved to trash and restored at any time.
--   * site-media bucket  — public images used by the navbar and CMS pages.
--   * realtime           — generated_exports and site content tables.
-- Idempotent: safe to re-run on an existing production database.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tables ----

create table if not exists public.generated_exports (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dataset       text not null,
  file_name     text not null,
  format        text not null check (format in ('csv', 'xlsx', 'xls', 'ics', 'pdf', 'docx')),
  row_count     integer not null default 0 check (row_count >= 0),
  status        text not null default 'active' check (status in ('active', 'revoked', 'trashed')),
  storage_path  text,
  notes         text,
  revoked_at    timestamptz,
  revoked_by    uuid references public.profiles(id) on delete set null,
  trashed_at    timestamptz,
  trashed_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.generated_exports is
  'Audit trail of files generated from backend data. status active|revoked|trashed; trashed rows are restorable, revoked rows are permanently void.';

create index if not exists generated_exports_owner_idx
  on public.generated_exports (owner_id, created_at desc);
create index if not exists generated_exports_status_idx
  on public.generated_exports (status, created_at desc);

-- updated_at trigger (function is created by the reconciliation migration;
-- recreate defensively so this file also works on a fresh project).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin predicate used by the RPCs below. Defined here so this migration does
-- not depend on a helper that may not exist on older projects.
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin')
  );
$$;

grant execute on function public.is_admin_user() to authenticated;

drop trigger if exists generated_exports_touch on public.generated_exports;
create trigger generated_exports_touch
  before update on public.generated_exports
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ rls ----

alter table public.generated_exports enable row level security;

drop policy if exists generated_exports_select_own on public.generated_exports;
create policy generated_exports_select_own on public.generated_exports
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin')
    )
  );

drop policy if exists generated_exports_insert_own on public.generated_exports;
create policy generated_exports_insert_own on public.generated_exports
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists generated_exports_update_own on public.generated_exports;
create policy generated_exports_update_own on public.generated_exports
  for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin')
    )
  )
  with check (true);

drop policy if exists generated_exports_delete_admin on public.generated_exports;
create policy generated_exports_delete_admin on public.generated_exports
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin')
    )
  );

-- ------------------------------------------------------------------ rpcs ----

-- Move to trash (reversible).
create or replace function public.trash_generated_export(p_id uuid)
returns public.generated_exports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.generated_exports;
begin
  update public.generated_exports
     set status = 'trashed', trashed_at = now(), trashed_by = auth.uid()
   where id = p_id
     and (owner_id = auth.uid() or public.is_admin_user())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'export not found or not permitted' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- Restore from trash.
create or replace function public.restore_generated_export(p_id uuid)
returns public.generated_exports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.generated_exports;
begin
  update public.generated_exports
     set status = 'active', trashed_at = null, trashed_by = null
   where id = p_id
     and status = 'trashed'
     and (owner_id = auth.uid() or public.is_admin_user())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'export not found, not trashed, or not permitted' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- Revoke permanently: the file link stops being valid and cannot be restored.
create or replace function public.revoke_generated_export(p_id uuid, p_reason text default null)
returns public.generated_exports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.generated_exports;
begin
  update public.generated_exports
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         notes = coalesce(p_reason, notes)
   where id = p_id
     and (owner_id = auth.uid() or public.is_admin_user())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'export not found or not permitted' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- Empty the trash for the current user (or everything for an admin).
create or replace function public.purge_generated_exports()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.generated_exports
   where status in ('trashed', 'revoked')
     and (owner_id = auth.uid() or public.is_admin_user());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.trash_generated_export(uuid) to authenticated;
grant execute on function public.restore_generated_export(uuid) to authenticated;
grant execute on function public.revoke_generated_export(uuid, text) to authenticated;
grant execute on function public.purge_generated_exports() to authenticated;

-- ---------------------------------------------------------------- storage ----

-- Public images for the navbar, hero and CMS pages.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_media_public_read on storage.objects;
create policy site_media_public_read on storage.objects
  for select using (bucket_id = 'site-media');

drop policy if exists site_media_admin_write on storage.objects;
create policy site_media_admin_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin', 'Teacher', 'Instructor')
    )
  );

drop policy if exists site_media_admin_update on storage.objects;
create policy site_media_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'site-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin')
    )
  );

drop policy if exists site_media_admin_delete on storage.objects;
create policy site_media_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Administrator', 'Admin')
    )
  );

-- --------------------------------------------------------------- realtime ----

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.generated_exports;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

commit;
