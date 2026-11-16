-- 2026/2027 duration + registration-fee update (owner instruction).
--
--   former 9-month courses -> 6 months, registration US$45
--   former 6-month courses -> 3 months, registration US$30
--   former 3-month courses -> 1 month,  registration US$10
--   former 1-month courses -> 2 weeks,   registration US$5
--
-- Class schedules follow the study mode chosen by the applicant and are
-- rendered by the frontend (src/lib/programDelivery.ts):
--   fully online   -> 1 hour a day, 3 days a week
--   fully on-site  -> 2 hours daily, 2 days a week
--   partially online -> online lessons + one 2-hour campus day a week
--
-- Safe to run more than once: a marker row in public.data_migrations makes the
-- catalogue rewrite a no-op after the first successful run, and every update
-- matches an OLD value pair (39w/US$45, 26w/US$30, 13w/US$10, 4w/US$5) that no
-- converted row can have again.
--
-- v2: the live public.programs table was created without duration_weeks, so the
-- first version of this migration silently did nothing. The catalogue columns
-- are now created if they are absent before the rewrite runs.
begin;

create table if not exists public.data_migrations (
  id text primary key,
  applied_at timestamptz not null default now(),
  note text
);

alter table public.data_migrations enable row level security;

alter table public.programs add column if not exists category text;
alter table public.programs add column if not exists duration_weeks integer;
alter table public.programs add column if not exists tuition numeric;
alter table public.programs add column if not exists certification text;
alter table public.programs add column if not exists description text;
alter table public.programs add column if not exists entry_requirements text;

do $catalogue$
declare
  already_applied boolean;
  n_nine integer := 0;
  n_six integer := 0;
  n_three integer := 0;
  n_one integer := 0;
begin
  select exists (select 1 from public.data_migrations where id = 'catalogue_2027_durations_fees')
    into already_applied;
  if already_applied then
    raise notice 'catalogue_2027_durations_fees already applied - skipping';
    return;
  end if;

  -- Snapshot the legacy values so every row is rewritten at most once.
  create temp table legacy_programme_rows on commit drop as
  select id, category, duration_weeks, tuition from public.programs;

  -- Former 9-month courses (39 weeks / US$45) -> 6 months, US$45
  update public.programs p
     set duration_weeks = 26,
         tuition = 45,
         category = 'Six-Month Courses'
    from legacy_programme_rows l
   where p.id = l.id
     and (
       l.duration_weeks = 39
       or (coalesce(l.category, '') ~* '(^|[^a-z])(nine|9)[ -]?month'
           and coalesce(l.duration_weeks, 0) <> 26)
     );
  get diagnostics n_nine = row_count;

  -- Former 6-month courses (26 weeks / US$30) -> 3 months, US$30
  update public.programs p
     set duration_weeks = 13,
         tuition = 30,
         category = 'Three-Month Courses'
    from legacy_programme_rows l
   where p.id = l.id
     and (
       (l.duration_weeks = 26 and coalesce(l.tuition, -1) <> 45)
       or (coalesce(l.category, '') ~* '(^|[^a-z])(six|6)[ -]?month'
           and coalesce(l.duration_weeks, 0) not in (13, 26))
     );
  get diagnostics n_six = row_count;

  -- Former 3-month courses (13 weeks / US$10) -> 1 month, US$10
  update public.programs p
     set duration_weeks = 4,
         tuition = 10,
         category = 'One-Month Courses'
    from legacy_programme_rows l
   where p.id = l.id
     and (
       (l.duration_weeks = 13 and coalesce(l.tuition, -1) <> 30)
       or (coalesce(l.category, '') ~* '(^|[^a-z])(three|3)[ -]?month'
           and coalesce(l.duration_weeks, 0) not in (4, 13))
     );
  get diagnostics n_three = row_count;

  -- Former 1-month courses (4 weeks / US$5) -> 2 weeks, US$5
  update public.programs p
     set duration_weeks = 2,
         tuition = 5,
         category = 'Two-Week Courses'
    from legacy_programme_rows l
   where p.id = l.id
     and (
       (l.duration_weeks = 4 and coalesce(l.tuition, -1) <> 10)
       or (coalesce(l.category, '') ~* '(^|[^a-z])(one|1)[ -]?month'
           and coalesce(l.duration_weeks, 0) not in (2, 4))
     );
  get diagnostics n_one = row_count;

  insert into public.data_migrations (id, note)
  values (
    'catalogue_2027_durations_fees',
    format(
      'Durations 6m/3m/1m/2w with fees US$45/US$30/US$10/US$5. Converted rows: 9m->6m %s, 6m->3m %s, 3m->1m %s, 1m->2w %s',
      n_nine, n_six, n_three, n_one
    )
  )
  on conflict (id) do nothing;

  raise notice 'catalogue rewrite done: 9m->6m %, 6m->3m %, 3m->1m %, 1m->2w %',
    n_nine, n_six, n_three, n_one;
end
$catalogue$;

commit;
