-- [DEPLOY:APPLIED-HISTORICAL] announcements.published_date — historical CMS column, likely already applied on live data.
-- Do NOT re-run blindly: check first, then either SKIP as applied or run once if the column is missing.
--   Check: select column_name from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='published_date';
--   If a row is returned → already applied → DO NOT RE-RUN. If empty → safe to run the statement below once.
-- Not part of the ordered PENDING set in supabase/DEPLOY_TAGS_PENDING.md (see "already-applied / historical" section).
alter table public.announcements add column if not exists published_date date not null default current_date;