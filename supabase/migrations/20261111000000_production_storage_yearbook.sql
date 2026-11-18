-- Restrict role-gated storage policies to authenticated sessions.
ALTER POLICY blog_covers_manage_all ON storage.objects TO authenticated;
ALTER POLICY certificates_manage_all ON storage.objects TO authenticated;
ALTER POLICY documents_admin_read ON storage.objects TO authenticated;
ALTER POLICY documents_admin_write ON storage.objects TO authenticated;
ALTER POLICY program_images_manage_all ON storage.objects TO authenticated;
ALTER POLICY site_assets_manage_all ON storage.objects TO authenticated;

-- Certificate documents are generated in-app; no stored certificate objects
-- exist. Keep this bucket private so future uploads cannot become public by
-- default. Public certificate verification uses the restricted register API.
UPDATE storage.buckets SET public = false WHERE id = 'certificates';
DROP POLICY IF EXISTS certificates_public_read ON storage.objects;

-- Allow staff with CMS permission to review and manage all submissions.
DROP POLICY IF EXISTS "yearbook staff manage" ON public.yearbook_entries;
CREATE POLICY "yearbook staff manage"
  ON public.yearbook_entries
  FOR ALL
  TO authenticated
  USING (public.has_permission('cms.manage'))
  WITH CHECK (public.has_permission('cms.manage'));

-- Keep public submissions available, but validate their shape and never allow
-- an unauthenticated submission to approve itself.
DROP POLICY IF EXISTS "yearbook public submit" ON public.yearbook_entries;
CREATE POLICY "yearbook public submit"
  ON public.yearbook_entries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(btrim(graduate_name)) BETWEEN 2 AND 100
    AND length(btrim(cohort)) BETWEEN 1 AND 40
    AND length(programme) <= 120
    AND length(note) <= 500
    AND is_approved = false
  );

-- Public clients only receive approved yearbook entries through RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'yearbook_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.yearbook_entries;
  END IF;
END;
$$;
