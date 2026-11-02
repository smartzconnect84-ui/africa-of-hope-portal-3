-- DEPLOY-STATUS: PENDING — additive link columns for programmes + blog; safe to run once via Supabase SQL editor.
-- Order: run after 20261023000000_programs_title_alignment.sql (see supabase/RELEASE_CHECKLIST.md for the full ordered set).
-- Effect: nullable columns only; existing rows untouched. The app works WITHOUT this migration
-- (blog links fall back to `program:<id>` tags, programme extras fall back to base columns).
-- To undo: alter table ... drop column ... (manual).
--
-- What this enables:
--   1. Program Builder full setup persists delivery_modes, study_plan, image_url and published.
--   2. Blog posts can link directly to a catalogue programme (program_id + program_title),
--      which drives the Apply button on Programme-category posts.

-- ── 1. programmes table: full-setup columns ──────────────────────────────
alter table public.programs add column if not exists delivery_modes text[];
alter table public.programs add column if not exists study_plan text;
alter table public.programs add column if not exists image_url text;
alter table public.programs add column if not exists published boolean not null default true;

-- Public catalogue reads (matches the existing anon/authenticated select grant pattern).
grant select on public.programs to anon, authenticated;

-- ── 2. blog_posts: linked programme ──────────────────────────────────────
alter table public.blog_posts add column if not exists program_id uuid;
alter table public.blog_posts add column if not exists program_title text;

create index if not exists blog_posts_program_id_idx on public.blog_posts(program_id);

-- FK to programmes, added once (no IF NOT EXISTS for constraints — guard with a DO block).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_posts_program_id_fkey'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_program_id_fkey
      foreign key (program_id) references public.programs(id) on delete set null;
  end if;
end $$;

-- Verification (run after applying):
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'programs'
--      and column_name in ('delivery_modes','study_plan','image_url','published');
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'blog_posts'
--      and column_name in ('program_id','program_title');
