-- Public site videos + email delivery visibility
--
-- 1. `site-videos` is a public storage bucket for hero background videos that
--    staff upload from Website Settings → Hero slides. The bucket itself is
--    created through the Storage API (public, 50 MB, mp4/webm/quicktime); this
--    migration adds the policies the app needs: anyone may read a published
--    video, while CMS staff and portal admins may upload or replace one.
-- 2. The Email delivery screen is shown to `email.manage` holders, but the
--    outbox policy only allowed `settings.manage`, so those staff saw an empty
--    panel. Both permissions can now read the outbox (read-only: retries and
--    sends go through the `send-email` function or the `retry_failed_emails`
--    RPC, which check permissions server-side).

create policy site_videos_public_read on storage.objects
  for select
  using (bucket_id = 'site-videos');

create policy site_videos_manage_all on storage.objects
  for all
  using (bucket_id = 'site-videos' and (select has_permission('cms.manage')))
  with check (bucket_id = 'site-videos' and (select has_permission('cms.manage')));

create policy site_videos_admin_all on storage.objects
  for all
  using (bucket_id = 'site-videos' and is_portal_admin())
  with check (bucket_id = 'site-videos' and is_portal_admin());

create policy email_outbox_read_email_manage on public.email_outbox
  for select
  using ((select has_permission('email.manage')));
