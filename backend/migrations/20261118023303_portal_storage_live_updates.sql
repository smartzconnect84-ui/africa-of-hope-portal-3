-- Buckets the app uploads to. Public buckets serve images directly; private
-- buckets (documents, classwork, training material) are read through signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, '["image/jpeg","image/png","image/webp","image/gif"]'),
  ('program-images', 'program-images', true, 5242880, '["image/jpeg","image/png","image/webp","image/gif"]'),
  ('site-assets', 'site-assets', true, 5242880, '["image/jpeg","image/png","image/webp","image/gif"]'),
  ('blog-covers', 'blog-covers', true, 5242880, '["image/jpeg","image/png","image/webp","image/gif"]'),
  ('documents', 'documents', false, 10485760, '["application/pdf","image/jpeg","image/png","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]'),
  ('classwork-submissions', 'classwork-submissions', false, 26214400, '["application/pdf","image/jpeg","image/png","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]'),
  ('training-materials', 'training-materials', false, 26214400, '["application/pdf","image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"]')
on conflict (id) do nothing;

-- Own folder in the personal buckets: each user writes only under their own id.
drop policy if exists "own files upload" on storage.objects;
create policy "own files upload" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own files read" on storage.objects;
create policy "own files read" on storage.objects for select to authenticated
  using (
    bucket_id in ('avatars', 'documents')
    and ((storage.foldername(name))[1] = auth.uid()::text or owner = auth.uid())
  );

drop policy if exists "own files update" on storage.objects;
create policy "own files update" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'documents') and owner = auth.uid())
  with check (bucket_id in ('avatars', 'documents') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files delete" on storage.objects;
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'documents') and owner = auth.uid());

-- School-wide assets and course material: staff write, signed-in people read.
drop policy if exists "staff uploads shared files" on storage.objects;
create policy "staff uploads shared files" on storage.objects for insert to authenticated
  with check (bucket_id in ('program-images', 'site-assets', 'blog-covers', 'training-materials', 'classwork-submissions') and is_staff());

drop policy if exists "staff updates shared files" on storage.objects;
create policy "staff updates shared files" on storage.objects for update to authenticated
  using (bucket_id in ('program-images', 'site-assets', 'blog-covers', 'training-materials', 'classwork-submissions') and is_staff())
  with check (bucket_id in ('program-images', 'site-assets', 'blog-covers', 'training-materials', 'classwork-submissions') and is_staff());

drop policy if exists "staff deletes shared files" on storage.objects;
create policy "staff deletes shared files" on storage.objects for delete to authenticated
  using (bucket_id in ('program-images', 'site-assets', 'blog-covers', 'training-materials', 'classwork-submissions') and is_staff());

drop policy if exists "shared files read" on storage.objects;
create policy "shared files read" on storage.objects for select to authenticated
  using (bucket_id in ('program-images', 'site-assets', 'blog-covers', 'training-materials', 'classwork-submissions'));

-- Public images are served straight to visitors.
drop policy if exists "public images read" on storage.objects;
create policy "public images read" on storage.objects for select
  using (bucket_id in ('avatars', 'program-images', 'site-assets', 'blog-covers'));

-- Keep the screens that show live activity in sync.
alter publication supabase_realtime add table announcements;
alter publication supabase_realtime add table direct_messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table yearbook_entries;
alter publication supabase_realtime add table profiles;
