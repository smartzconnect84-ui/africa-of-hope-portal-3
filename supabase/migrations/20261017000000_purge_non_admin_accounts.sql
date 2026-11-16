-- RETIRED: this historical migration used to delete all non-owner accounts.
-- Deliberate no-op. Keep the version for migration history compatibility.
-- Production schema upgrades must never purge Auth users or school records.
do $$ begin
  raise notice 'Legacy account purge retired; all existing accounts are preserved.';
end $$;
