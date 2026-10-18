-- Africa of Hope · storage buckets only.
-- Safe to paste into the Supabase SQL editor. Does not touch system_settings
-- (a previous script failed there and rolled the bucket inserts back).

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('program-images', 'program-images', true),
  ('documents', 'documents', false),
  ('site-assets', 'site-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public read so logos, photos and programme images load without a login.
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists program_images_public_read on storage.objects;
create policy program_images_public_read on storage.objects for select
  using (bucket_id = 'program-images');

drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects for select
  using (bucket_id = 'site-assets');

-- Signed-in owners can upload their own avatar and documents.
drop policy if exists avatars_owner_all on storage.objects;
create policy avatars_owner_all on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

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

-- Staff writes. Skipped, not failed, if the admin helper is not installed yet.
do $$
begin
  if to_regprocedure('public.is_portal_admin()') is null then
    return;
  end if;

  execute 'drop policy if exists program_images_admin_all on storage.objects';
  execute $p$
    create policy program_images_admin_all on storage.objects for all to authenticated
      using (bucket_id = 'program-images' and public.is_portal_admin())
      with check (bucket_id = 'program-images' and public.is_portal_admin())
  $p$;

  execute 'drop policy if exists site_assets_admin_all on storage.objects';
  execute $p$
    create policy site_assets_admin_all on storage.objects for all to authenticated
      using (bucket_id = 'site-assets' and public.is_portal_admin())
      with check (bucket_id = 'site-assets' and public.is_portal_admin())
  $p$;

  execute 'drop policy if exists documents_admin_all on storage.objects';
  execute $p$
    create policy documents_admin_all on storage.objects for all to authenticated
      using (bucket_id = 'documents' and public.is_portal_admin())
      with check (bucket_id = 'documents' and public.is_portal_admin())
  $p$;
exception when others then
  raise notice 'admin storage policies skipped: %', sqlerrm;
end $$;
