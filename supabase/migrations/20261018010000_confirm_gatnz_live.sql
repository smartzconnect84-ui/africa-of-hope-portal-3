-- ── Africa of Hope · confirm gatnzfjpuokopqyksqoy as live ─────────────────────
-- Idempotent final provisioning for the CONFIRMED live project:
--   https://gatnzfjpuokopqyksqoy.supabase.co
-- The unused project txprgdnznzxpwpuqlxlq (supabase-blue-ball) is NOT touched
-- here — delete/pause it yourself in the Supabase dashboard after verifying.
--
-- Run with: supabase link --project-ref gatnzfjpuokopqyksqoy && supabase db push
-- Then:    supabase functions deploy send-email admin-users verify-certificate assistant
--
-- Everything below is IF NOT EXISTS / ON CONFLICT safe, so re-running is fine.

-- 1. Buckets the portal expects (BackendStatusCard + health check) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-images', 'program-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

-- 2. Storage policies (drop + recreate so old/project-copied rules converge) ───
-- site-assets: public read (logos, hero images), admins write.
drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects for select
  using (bucket_id = 'site-assets');

drop policy if exists site_assets_admin_all on storage.objects;
create policy site_assets_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'site-assets' and public.is_portal_admin())
  with check (bucket_id = 'site-assets' and public.is_portal_admin());

-- avatars public read (safe to re-assert if an older migration was skipped).
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

-- 3. Realtime — portal live-sync tables ────────────────────────────────────────
-- Adds every portal table to the supabase_realtime publication if missing.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','programs','program_modules','cohorts','cohort_students',
    'attendance','assignments','submissions','fee_transactions','certificates',
    'announcements','system_settings','role_permissions','school_policies',
    'policy_acceptances','blog_posts','email_outbox','notifications',
    'training_materials','class_sessions','teacher_course_plans'
  ] loop
    begin
      if to_regclass('public.' || t) is not null
         and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
         ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    exception when duplicate_object then
      -- already a member; safe to ignore
      null;
    end;
  end loop;
end $$;

-- 4. Marker row so Admin → Backend tab can prove this migration landed ─────────
insert into public.system_settings (id, site_name, updated_at)
values ('00000000-0000-0000-0000-000000000001', 'Africa of Hope', now())
on conflict (id) do update set updated_at = now();
