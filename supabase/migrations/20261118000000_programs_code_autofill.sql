-- ── Africa of Hope · programs.code self-healing ──────────────────────────────
--
-- The live `public.programs` table gained a `code` column (NOT NULL, no default)
-- outside migrations. Any insert that omits `code` — or sends an explicit NULL —
-- fails with:
--   null value in column "code" of relation "programs" violates not-null constraint
-- which is what admins saw when creating a programme.
--
-- This migration makes the failure impossible:
--   1. Adds `code` when the project never had it.
--   2. Backfills every NULL/empty code from the programme title.
--   3. Installs a BEFORE INSERT/UPDATE trigger that auto-generates a code whenever
--      the incoming row leaves it NULL/empty, so dashboard inserts, SQL scripts and
--      older clients all succeed.
--   4. Only then enforces NOT NULL, and adds a unique index for the app's
--      duplicate-code retry logic.
-- Idempotent and additive: no row is deleted.

do $code$
begin
  if to_regclass('public.programs') is null then
    raise notice 'public.programs does not exist - skipping code autofill';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'programs' and column_name = 'code'
  ) then
    alter table public.programs add column code text;
    raise notice 'added public.programs.code';
  end if;

  -- Backfill NULL/empty codes: slug(title or name or 'course') + '-' + id fragment.
  execute $u$update public.programs
    set code = left(
      regexp_replace(lower(coalesce(nullif(btrim(title), ''), nullif(btrim(name), ''), 'course')), '[^a-z0-9]+', '-', 'g'),
      E'^-+|-+$', '', 'g'
    ) || '-' || left(regexp_replace(id::text, '[^a-z0-9]', '', 'gi'), 4)
    where code is null or btrim(code) = ''$u$;

  -- Any row whose slug collapsed to '-' (title with no alphanumerics) gets 'course-xxxx'.
  execute $u$update public.programs
    set code = 'course-' || left(regexp_replace(id::text, '[^a-z0-9]', '', 'gi'), 4)
    where code is null or btrim(code) = '' or btrim(code, '-') = ''$u$;

  create or replace function public.programs_ensure_code()
  returns trigger
  language plpgsql
  as $fn$
  declare
    slug text;
    frag text;
  begin
    if new.code is null or btrim(new.code) = '' then
      slug := regexp_replace(
        lower(coalesce(nullif(btrim(new.title), ''), nullif(btrim(new.name), ''), 'course')),
        '[^a-z0-9]+', '-', 'g'
      );
      slug := regexp_replace(slug, E'^-+|-+$', '', 'g');
      if slug is null or btrim(slug, '-') = '' then
        slug := 'course';
      end if;
      frag := left(regexp_replace(coalesce(new.id::text, gen_random_uuid()::text), '[^a-z0-9]', '', 'gi'), 4);
      new.code := left(slug, 48) || '-' || frag;
    end if;
    return new;
  end
  $fn$;

  drop trigger if exists programs_ensure_code on public.programs;
  create trigger programs_ensure_code
    before insert or update of code, title, name on public.programs
    for each row execute function public.programs_ensure_code();

  -- Enforce NOT NULL only once every row has a value.
  begin
    alter table public.programs alter column code set not null;
  exception when others then
    raise notice 'public.programs.code kept nullable: some rows still lack a code';
  end;

  -- Unique index powers the app's duplicate-code retry (same title twice).
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'programs_code_unique') then
    begin
      create unique index programs_code_unique on public.programs (code);
    exception when unique_violation then
      raise notice 'duplicate program codes remain - unique index skipped';
    end;
  end if;

  raise notice 'public.programs.code autofill ready';
end
$code$;

select 'programs.code' as object,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'programs' and column_name = 'code'
  ) then 'ok' else 'missing' end as status
union all
select 'programs.code_filled',
  case when (select count(*) from public.programs where code is null or btrim(code) = '') = 0
    then 'ok' else 'some programmes still have no code' end
union all
select 'programs_ensure_code_trigger',
  case when exists (
    select 1 from pg_trigger
    where tgrelid = 'public.programs'::regclass and tgname = 'programs_ensure_code' and not tgisinternal
  ) then 'ok' else 'missing' end;
