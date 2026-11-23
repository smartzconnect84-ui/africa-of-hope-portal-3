-- Persist cohort avatar URLs and school-policy acceptance timestamps.
alter table if exists public.cohorts
  add column if not exists avatar_url text;

alter table if exists public.profiles
  add column if not exists school_policy_accepted_at timestamptz;

-- Allow authenticated users to update their own school_policy_accepted_at (RLS).
-- (Existing profile update policies should already cover own-row updates.)