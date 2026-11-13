-- [SUPERSEDED — DO NOT RUN]
-- This file does NOT match the Supabase CLI pattern ^[0-9]{14}_ and is never applied by `db push`.
-- It is an older draft of 20260102000000_live_backend_config.sql (the authoritative version).
-- Kept in place because supabase/PRODUCTION_AUDIT.md references this filename.
-- See supabase/DEPLOYMENT_GAP_ANALYSIS.md §7.2.

-- RETIRED unversioned setup script.
-- This file formerly reset an administrator password and trusted signup metadata.
-- Do not replay historical setup on an existing project. Review the versioned
-- migration history and supabase/PRODUCTION_AUDIT.md instead.
do $$ begin
  raise exception 'Retired legacy setup script. No changes applied. Use reviewed versioned migrations.';
end $$;
