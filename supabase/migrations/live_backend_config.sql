-- RETIRED unversioned setup script.
-- This file formerly reset an administrator password and trusted signup metadata.
-- Do not replay historical setup on an existing project. Review the versioned
-- migration history and supabase/PRODUCTION_AUDIT.md instead.
do $$ begin
  raise exception 'Retired legacy setup script. No changes applied. Use reviewed versioned migrations.';
end $$;
