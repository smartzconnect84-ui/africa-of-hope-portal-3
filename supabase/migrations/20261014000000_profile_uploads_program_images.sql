-- ── Africa of Hope · profile editing, uploads and programme images ──────────────
-- Adds editable profile fields, a profile photo bucket, owner-scoped personal
-- document storage and a programme image column + bucket. Fully idempotent.

-- 1. Columns --------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists address text,
  add column if not exists date_of_birth date;

alter table public.programs
  add column if not exists image_url text;

-- 2. Helper: is the signed-in user portal staff? ----------------------------------
create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('Super Admin', 'School Admin')
      and status = 'Active'
  );
$$;

grant execute on function public.is_portal_admin() to authenticated;

-- 3. Self-registration: keep applicant details, never trust a client-sent role ---
-- user_metadata is writable by anyone calling auth.signUp, so it can no longer
-- grant a role. Only app_metadata (service-role only) may set role/status.
-- The admin-users edge function and the super-admin seed already write the
-- final role/status to public.profiles explicitly after creating the account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  program_list uuid[] := '{}';
begin
  begin
    select coalesce(array_agg(value::uuid), '{}')
      into program_list
      from jsonb_array_elements_text(coalesce(meta -> 'program_ids', '[]'::jsonb));
  exception when others then
    program_list := '{}';
  end;

  insert into public.profiles (id, name, full_name, email, phone, role, status, program_ids, note, documents)
  values (
    new.id,
    coalesce(meta ->> 'full_name', split_part(coalesce(new.email, 'member'), '@', 1)),
    meta ->> 'full_name',
    new.email,
    coalesce(meta ->> 'phone', ''),
    coalesce(app_meta ->> 'role', 'Student'),
    coalesce(app_meta ->> 'status', 'Pending Approval'),
    program_list,
    meta ->> 'note',
    meta ->> 'documents'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Storage buckets --------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-images', 'program-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5. Storage policies ---------------------------------------------------------------
-- avatars: public read, each user writes only inside "<their uid>/"
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_owner_write on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;
drop policy if exists avatars_owner_all on storage.objects;
create policy avatars_owner_all on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- program-images: public read, admins manage
drop policy if exists program_images_public_read on storage.objects;
create policy program_images_public_read on storage.objects for select
  using (bucket_id = 'program-images');

drop policy if exists program_images_admin_all on storage.objects;
create policy program_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'program-images' and public.is_portal_admin())
  with check (bucket_id = 'program-images' and public.is_portal_admin());

-- documents: owner manages "profiles/<their uid>/...", admins manage everything.
-- Replaces the earlier policy that let every signed-in user read every file.
drop policy if exists documents_staff_all on storage.objects;

drop policy if exists documents_owner_all on storage.objects;
create policy documents_owner_all on storage.objects for all to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists documents_admin_all on storage.objects;
create policy documents_admin_all on storage.objects for all to authenticated
  using (bucket_id in ('documents', 'certificates') and public.is_portal_admin())
  with check (bucket_id in ('documents', 'certificates') and public.is_portal_admin());

-- Make sure the older buckets exist too, then give documents the same limits the
-- portal applies in the browser.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('certificates', 'certificates', true)
on conflict (id) do nothing;
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'documents';

-- 6. Profiles and programmes: stop self-promotion -------------------------------------
-- The earlier "*_portal_all" policies let any signed-in user edit any profile,
-- including role/status. is_portal_admin() trusts those columns, so they must be
-- protected. Everyone signed in can still read profiles (directories, rosters).
drop policy if exists profiles_portal_all on public.profiles;

drop policy if exists profiles_portal_read on public.profiles;
create policy profiles_portal_read on public.profiles for select to authenticated
  using (true);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'Student' and status = 'Pending Approval');

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

-- Role and status may change only through an active admin (or server-side code).
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Triggers, SQL editor and service-role calls are trusted.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_portal_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role is distinct from 'Student' or new.status is distinct from 'Pending Approval' then
      raise exception 'Only administrators can assign roles or approve accounts';
    end if;
  elsif new.role is distinct from old.role or new.status is distinct from old.status then
    raise exception 'Only administrators can change roles or account status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Programmes: everyone reads, only admins write.
drop policy if exists programs_portal_all on public.programs;

drop policy if exists programs_portal_read on public.programs;
create policy programs_portal_read on public.programs for select to authenticated
  using (true);

drop policy if exists programs_admin_all on public.programs;
create policy programs_admin_all on public.programs for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

-- 7. Public website settings ---------------------------------------------------------
-- The public site reads system_settings (academy details and website CMS content)
-- before anyone signs in. The read policy existed, but the anon role had no table
-- privilege, which caused "permission denied for table system_settings".
grant select on public.system_settings to anon;
grant select on public.programs, public.announcements, public.certificates to anon;

-- Only active admins may change settings and website content.
drop policy if exists system_settings_portal_all on public.system_settings;

drop policy if exists system_settings_portal_read on public.system_settings;
create policy system_settings_portal_read on public.system_settings for select to authenticated
  using (true);

drop policy if exists system_settings_admin_all on public.system_settings;
create policy system_settings_admin_all on public.system_settings for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

