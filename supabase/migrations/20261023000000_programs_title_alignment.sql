-- ── Africa of Hope · align the programmes table with the app's `title` column ────
--
-- The live public.programs table was created with `name` as its programme title
-- column, while every frontend query reads and writes `title`:
--   src/data/liveData.ts           → select("*") then p.title            → empty titles
--   src/context/AppContext.tsx     → select("title") / insert({title})   → 42703 errors
--   supabase/functions/assistant   → select("title, category, ...")      → 42703 errors
--
-- That mismatch is what made the catalogue seed fail with
--   42703: column p.title does not exist
-- and why the public site kept falling back to the built-in 2026 catalogue.
--
-- This migration adds `title`, copies any existing `name` values into it, and keeps
-- the two columns in step on every future insert or update, so nothing cares which
-- one it writes. Idempotent and additive: no row is deleted or overwritten.

do $align$
begin
  if to_regclass('public.programs') is null then
    raise notice 'public.programs does not exist - nothing to align yet';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programs' and column_name = 'title'
  ) then
    alter table public.programs add column title text;
    raise notice 'added public.programs.title';
  end if;

  -- Fill title from the legacy name column where name is the populated one.
  begin
    execute $u$update public.programs
                  set title = name
                where name is not null
                  and (title is null or btrim(title) = '')$u$;
  exception when undefined_column then null;
  end;

  -- Keep both directions in step. Each assignment sits in its own handler so the
  -- function still works on a table that has only one of the two columns.
  create or replace function public.programs_sync_title_name()
  returns trigger
  language plpgsql
  as $fn$
  begin
    begin
      if new.title is null or btrim(new.title) = '' then
        new.title := new.name;
      end if;
    exception when others then null;
    end;

    begin
      if new.name is null or btrim(new.name) = '' then
        new.name := new.title;
      end if;
    exception when others then null;
    end;

    return new;
  end
  $fn$;

  drop trigger if exists programs_sync_title_name on public.programs;
  create trigger programs_sync_title_name
    before insert or update on public.programs
    for each row execute function public.programs_sync_title_name();

  raise notice 'public.programs: title and name kept in sync';
end
$align$;

-- Verification: every row should read ok.
select 'programs.title' as object,
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'programs' and column_name = 'title'
       ) then 'ok' else 'missing' end as status
union all
select 'programs.title_filled',
       case when (select count(*) from public.programs where title is null or btrim(title) = '') = 0
            then 'ok' else 'some programmes still have no title' end
union all
select 'programs_sync_trigger',
       case when exists (
         select 1 from pg_trigger
          where tgrelid = 'public.programs'::regclass
            and tgname = 'programs_sync_title_name'
            and not tgisinternal
       ) then 'ok' else 'missing' end;
