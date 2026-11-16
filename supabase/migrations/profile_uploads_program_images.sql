alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists address text,
  add column if not exists date_of_birth date;

alter table public.programs
  add column if not exists image_url text;

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

drop policy if exists program_images_public_read on storage.objects;
create policy program_images_public_read on storage.objects for select
  using (bucket_id = 'program-images');

drop policy if exists program_images_admin_all on storage.objects;
create policy program_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'program-images' and public.is_portal_admin())
  with check (bucket_id = 'program-images' and public.is_portal_admin());

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

grant select on public.system_settings to anon;
grant select on public.programs, public.announcements, public.certificates to anon;