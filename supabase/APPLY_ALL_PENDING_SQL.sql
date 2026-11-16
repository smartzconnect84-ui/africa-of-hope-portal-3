-- ============================================================================
-- AFRICA OF HOPE — one-file SQL to apply the pending feature work.
--
-- HOW TO RUN
--   1. Open https://supabase.com/dashboard/project/gatnzfjpuokopqyksqoy/sql/new
--   2. Copy THIS ENTIRE FILE (it is plain SQL) and paste it into the editor.
--   3. Press Run. Do not paste supabase/RUN_PENDING_SQL.md — that is a Markdown
--      guide, and its "#" headings are what caused "syntax error at or near #".
--
-- This file is the SQL content of these migrations, in order:
--   20261020000000_support_study_plans.sql
--   20261021000000_catalogue_duration_fee_update.sql
--   20261022000000_seed_programmes_catalogue.sql
--
-- It is idempotent: safe to run more than once. The catalogue rewrite is
-- guarded by a marker in public.data_migrations so no programme row is ever
-- converted twice. Nothing here is destructive.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART 0 · preflight — make sure the helper the policies depend on exists.
-- Safe: only created when missing; an existing definition is left untouched.
-- ----------------------------------------------------------------------------
do $preflight$
begin
  if to_regprocedure('public.is_portal_admin()') is null then
    execute $fn$
      create function public.is_portal_admin()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as 'select exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role in (''Super Admin'', ''School Admin'')
              and status = ''Active''
          )';
    $fn$;
    execute 'grant execute on function public.is_portal_admin() to authenticated';
    raise notice 'created public.is_portal_admin()';
  end if;
end
$preflight$;


-- ----------------------------------------------------------------------------
-- PART 1 · support pledges (donations / volunteers / partners) and study plans
-- ----------------------------------------------------------------------------
create table if not exists public.support_pledges (
  id text primary key,
  kind text not null check (kind in ('donation', 'volunteer', 'partner')),
  name text not null,
  email text not null,
  phone text not null,
  amount numeric not null default 0,
  frequency text,
  method text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id text primary key,
  name text not null,
  email text not null,
  phone text not null,
  program_id text,
  program_title text not null,
  mode text not null check (mode in ('online', 'blended', 'onsite')),
  duration text,
  registration_fee text,
  education_level text,
  intake text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.support_pledges enable row level security;
alter table public.study_plans enable row level security;

-- Anyone (including signed-out visitors) may submit a form; nobody reads it back.
drop policy if exists "support pledges public insert" on public.support_pledges;
create policy "support pledges public insert" on public.support_pledges
  for insert to anon, authenticated with check (true);

drop policy if exists "support pledges staff read" on public.support_pledges;
create policy "support pledges staff read" on public.support_pledges
  for select to authenticated using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  );

drop policy if exists "study plans public insert" on public.study_plans;
create policy "study plans public insert" on public.study_plans
  for insert to anon, authenticated with check (true);

drop policy if exists "study plans staff read" on public.study_plans;
create policy "study plans staff read" on public.study_plans
  for select to authenticated using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  );

-- Staff move an enquiry through new -> contacted -> closed.
drop policy if exists "support pledges staff update" on public.support_pledges;
create policy "support pledges staff update" on public.support_pledges
  for update to authenticated
  using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  )
  with check (true);

drop policy if exists "study plans staff update" on public.study_plans;
create policy "study plans staff update" on public.study_plans
  for update to authenticated
  using (
    public.is_portal_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'School Admin', 'Registrar', 'Finance Officer')
    )
  )
  with check (true);

create index if not exists support_pledges_created_idx on public.support_pledges (created_at desc);
create index if not exists study_plans_created_idx on public.study_plans (created_at desc);

-- RLS alone is not enough here: these tables do not inherit blanket anon
-- privileges (the same gap once broke public reads of system_settings).
grant insert on public.support_pledges to anon, authenticated;
grant select, update on public.support_pledges to authenticated;
grant insert on public.study_plans to anon, authenticated;
grant select, update on public.study_plans to authenticated;

-- Delivery mode(s) and study plan on programme records so admin edits drive the
-- public catalogue (fully online / partially online / on-site).
alter table public.programs add column if not exists delivery_modes text[]
  default array['online', 'blended']::text[];
alter table public.programs add column if not exists study_plan text;

grant select on public.programs to anon, authenticated;


-- ----------------------------------------------------------------------------
-- PART 2 · 2026/2027 durations + registration fees on existing programme rows
--
--   former 9-month courses -> 6 months, registration US$45
--   former 6-month courses -> 3 months, registration US$30
--   former 3-month courses -> 1 month,  registration US$10
--   former 1-month courses -> 2 weeks,   registration US$5
--
-- Class schedules follow the study mode chosen by the applicant and are
-- rendered by the frontend (src/lib/programDelivery.ts):
--   fully online     -> 1 hour a day, 3 days a week
--   fully on-site    -> 2 hours daily, 2 days a week
--   partially online -> online lessons + one 2-hour campus day a week
-- ----------------------------------------------------------------------------
create table if not exists public.data_migrations (
  id text primary key,
  applied_at timestamptz not null default now(),
  note text
);

alter table public.data_migrations enable row level security;

-- The live programmes table was created without these catalogue columns, which
-- is why an earlier run reported "not run": the rewrite found no duration_weeks
-- to write to. Create them first so the app and this rewrite agree.
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


-- ----------------------------------------------------------------------------
-- PART 2B · seed the live programmes table with the 2026/2027 catalogue
--
-- The built-in catalogue (src/data/programCatalog2026.ts) is only a fallback: it
-- is what you see while public.programs is empty. With no rows, staff cannot
-- manage programmes, cohorts cannot point at a programme and fees/durations
-- have nothing to apply to. This inserts the same 31 courses and only inserts
-- titles that are not in the table yet, so re-running never duplicates and never
-- overwrites edits. The INSERT is built from the live table definition, so an
-- extra required column can no longer make the seed skip itself silently.
-- ----------------------------------------------------------------------------
-- v4: there is no temp table and no catalogue_seed name anywhere any more.
-- PL/pgSQL parses the SQL inside a block while it compiles the block, so a table
-- created by an earlier statement of the same script (temp or not) can still be
-- reported as "relation catalogue_seed does not exist". The 31 courses are now an
-- inline VALUES list turned into a jsonb array inside the same block, and every
-- insert carries its own values as parameters, so nothing has to survive between
-- statements and this error cannot happen again.
--
-- v6: the live table calls its title column `name`, while the app reads and writes
-- `title`, which raised "42703: column p.title does not exist" on the de-duplication
-- check. The column list and the de-duplication now use whichever column the table
-- really has, and the block first adds `title` (copying `name` into it) so both the
-- app and the seed agree. See 20261023000000_programs_title_alignment.sql.

do $align$
begin
  if to_regclass('public.programs') is null then
    raise exception 'public.programs does not exist. Create the programmes table first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programs' and column_name = 'title'
  ) then
    alter table public.programs add column title text;
    raise notice 'added public.programs.title';
  end if;

  begin
    execute $u$update public.programs
                  set title = name
                where name is not null
                  and (title is null or btrim(title) = '')$u$;
  exception when undefined_column then null;
  end;

  create or replace function public.programs_sync_title_name()
  returns trigger language plpgsql as $fn$
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

do $seed$
declare
  seed_catalogue jsonb;
  seed_row record;
  row_failed boolean;
  col record;
  expr text;
  col_list text := '';
  val_list text := '';
  inserted integer := 0;
  seed_note text;
  title_col text;
  seen_where text;
  req text := 'Be a high school student or above. Pay 50% of the registration package to reserve your seat and own a smartphone or laptop. Classes follow your study plan: fully online is 1 hour a day, 3 days a week; fully on-site is 2 hours daily, 2 days a week; partially online combines online lessons with one 2-hour campus practical day a week.';
begin
  if exists (select 1 from public.programs) then
    raise notice 'public.programs already has rows - seeding only missing catalogue titles';
  end if;

    seed_catalogue := (
    select jsonb_agg(jsonb_build_object(
             'slug', s.slug,
             'title', s.title,
             'category', s.category,
             'weeks', s.weeks,
             'fee', s.fee,
             'certification', s.certification,
             'description', s.description,
             'modes', array_to_string(s.modes, ','))
           order by s.slug)
      from (values
    -- Six-month courses - registration US$45
    ('nine-media', 'Media & Communication Studies', 'Six-Month Courses', 26, 45, 'Diploma in Media & Communication Studies', 'News writing, reporting, presentation and media ethics with studio and field practice.', array['blended','onsite']),
    ('nine-teacher', 'Teacher''s Education', 'Six-Month Courses', 26, 45, 'Diploma in Teacher Education', 'Lesson planning, classroom management and child-centred teaching with teaching practice.', array['onsite','blended']),
    ('nine-audio', 'Audio Ads Production', 'Six-Month Courses', 26, 45, 'Diploma in Audio Ads Production', 'Voice-over, scripting, jingles and radio commercials produced in a real studio workflow.', array['blended','onsite']),
    ('nine-secre', 'Secretarial Science', 'Six-Month Courses', 26, 45, 'Diploma in Secretarial Science', 'Office administration, shorthand speed, records, front-desk etiquette and computer applications.', array['onsite','blended']),
    ('nine-admin', 'School Administration', 'Six-Month Courses', 26, 45, 'Diploma in School Administration', 'School records, admissions, staff supervision, discipline systems and parent relations.', array['online','blended']),
    ('nine-tv', 'Online-TV Production', 'Six-Month Courses', 26, 45, 'Diploma in Online-TV Production', 'Live streaming, camera operation, lighting, switching and publishing for online channels.', array['online','blended']),
    ('nine-multi', 'Professional Multimedia', 'Six-Month Courses', 26, 45, 'Diploma in Professional Multimedia', 'Flagship blend of graphics, video, audio and motion for work-ready multimedia producers.', array['blended','onsite']),
    -- Three-month courses - registration US$30
    ('six-graphics', 'Professional Graphics', 'Three-Month Courses', 13, 30, 'Certificate in Professional Graphics', 'Logos, flyers, branding and print design with portfolio reviews every month.', array['online','blended']),
    ('six-hr', 'HR Management', 'Three-Month Courses', 13, 30, 'Certificate in HR Management', 'Recruitment, staff records, payroll basics, appraisals and workplace relations.', array['online','blended']),
    ('six-podcast', 'General Podcasting', 'Three-Month Courses', 13, 30, 'Certificate in General Podcasting', 'Show formats, recording, editing and publishing podcasts that keep listeners.', array['online']),
    ('six-me', 'Monitoring & Evaluation', 'Three-Month Courses', 13, 30, 'Certificate in Monitoring & Evaluation', 'Indicators, data collection, field tools and donor-ready M&E reports.', array['online','blended']),
    ('six-guidance', 'Guidance & Counseling', 'Three-Month Courses', 13, 30, 'Certificate in Guidance & Counseling', 'Counselling skills, safeguarding, youth mentorship and referral practice.', array['online','onsite']),
    ('six-pm', 'Project Management', 'Three-Month Courses', 13, 30, 'Certificate in Project Management', 'Proposals, work plans, budgets, supervision and closing community projects well.', array['online','blended']),
    ('six-digital', 'Digital Marketing', 'Three-Month Courses', 13, 30, 'Certificate in Digital Marketing', 'Social campaigns, WhatsApp selling, ads, analytics and content calendars.', array['online']),
    ('six-video', 'Video Production', 'Three-Month Courses', 13, 30, 'Certificate in Video Production', 'Shooting, directing, editing and delivery for events, adverts and online shows.', array['blended','onsite']),
    ('six-pr', 'General Public Relations', 'Three-Month Courses', 13, 30, 'Certificate in General Public Relations', 'Press releases, media relations, events and reputation management.', array['online','blended']),
    -- One-month courses - registration US$10
    ('three-computer', 'Introduction to Computer', 'One-Month Courses', 4, 10, 'Certificate in Computer Foundations', 'Typing, files, Word, Excel, internet, email and safe smartphone and laptop use.', array['onsite','blended']),
    ('three-speaking', 'Public Speaking', 'One-Month Courses', 4, 10, 'Certificate in Public Speaking', 'Stage confidence, speech structure, microphone technique and audience engagement.', array['onsite','blended']),
    ('three-social', 'Social Media Management', 'One-Month Courses', 4, 10, 'Certificate in Social Media Management', 'Managing business pages, content planning, growth and customer messages.', array['online']),
    ('three-mgraphics', 'Mobile Graphics', 'One-Month Courses', 4, 10, 'Certificate in Mobile Graphics', 'Professional flyers and adverts designed entirely on a smartphone.', array['online']),
    ('three-mmulti', 'Mobile Multimedia', 'One-Month Courses', 4, 10, 'Certificate in Mobile Multimedia', 'Shoot, edit and publish video, audio and graphics from one phone.', array['online']),
    ('three-care', 'Customer''s Care & Reception', 'One-Month Courses', 4, 10, 'Certificate in Customer Care & Reception', 'Front-desk service, phone handling, complaints and repeat-customer care.', array['onsite','blended']),
    ('three-vpod', 'Video Podcasting', 'One-Month Courses', 4, 10, 'Certificate in Video Podcasting', 'Video talk shows: set, lighting, hosting, editing and YouTube publishing.', array['online','blended']),
    ('three-entre', 'Entrepreneurship & Business', 'One-Month Courses', 4, 10, 'Certificate in Entrepreneurship', 'Business ideas, costing, pricing, records and starting a small enterprise.', array['online','onsite']),
    ('three-lead', 'Leadership & Management', 'One-Month Courses', 4, 10, 'Certificate in Leadership & Management', 'Team leadership, meetings, supervision and community organisation.', array['online','blended']),
    -- Two-week courses - registration US$5
    ('one-mgraphics', 'Mobile Graphics (Fast Track)', 'Two-Week Courses', 2, 5, 'Certificate in Mobile Graphics', 'Two-week fast track: adverts and social designs on your phone.', array['online']),
    ('one-proposal', 'Project Proposal Writing', 'Two-Week Courses', 2, 5, 'Certificate in Proposal Writing', 'Write clear NGO and business proposals with budgets and logframes.', array['online']),
    ('one-event', 'Event Planning', 'Two-Week Courses', 2, 5, 'Certificate in Event Planning', 'Plan, decorate, budget and coordinate weddings, programs and launches.', array['blended','onsite']),
    ('one-speech', 'Speech & Article Writing', 'Two-Week Courses', 2, 5, 'Certificate in Speech & Article Writing', 'Write speeches, articles and press pieces people actually finish.', array['online']),
    ('one-quick', 'QuickBooks', 'Two-Week Courses', 2, 5, 'Certificate in QuickBooks', 'Set up company books, invoices, expenses and simple reports in QuickBooks.', array['online','blended']),
    ('one-book', 'Book Keeping', 'Two-Week Courses', 2, 5, 'Certificate in Book Keeping', 'Daily sales records, ledgers, cash control and month-end balancing.', array['online','blended'])
    ) as s(slug, title, category, weeks, fee, certification, description, modes)
  );

  -- De-duplicate on whichever title column this table really has: `title` on a
  -- fresh table, `name` on the older live one. A hard-coded p.title is what raised
  -- "42703: column p.title does not exist".
  select c.column_name into title_col
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'programs'
     and c.column_name in ('title', 'name', 'program_name', 'course_name')
   order by case c.column_name
              when 'title' then 1
              when 'name' then 2
              when 'program_name' then 3
              else 4
            end
   limit 1;

  if title_col is null then
    seen_where := 'where true';
  else
    seen_where := format(
      'where not exists (select 1 from public.programs p where lower(btrim(coalesce(p.%I, ''''))) = lower(btrim(s.title)))',
      title_col);
  end if;

  -- Build the column list from the live table so an extra required column can
  -- never make the seed skip itself again. Known catalogue columns get the
  -- catalogue value; any other NOT NULL column without a default gets a
  -- neutral value of the right type.
  for col in
    select c.column_name, c.data_type, c.udt_name, c.is_nullable,
           c.column_default, c.is_identity, c.is_generated
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'programs'
     order by c.ordinal_position
  loop
    continue when col.is_identity = 'YES' or col.is_generated = 'ALWAYS';

    expr := null;
    case col.column_name
      when 'id' then
        expr := case
                  when col.udt_name = 'uuid' then 'gen_random_uuid()'
                  when col.data_type in ('text', 'character varying', 'character')
                    then '''cat-'' || s.slug'
                end;
      when 'title' then expr := 's.title';
      -- Older live tables call the same column `name`; both get the title.
      when 'name' then expr := 's.title';
      when 'program_name' then expr := 's.title';
      when 'course_name' then expr := 's.title';
      when 'category' then expr := 's.category';
      when 'duration_weeks' then
        expr := case when col.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision')
                     then 's.weeks' else 's.weeks::text' end;
      when 'tuition' then
        expr := case when col.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision')
                     then 's.fee' else 's.fee::text' end;
      when 'certification' then expr := 's.certification';
      when 'description' then expr := 's.description';
      when 'entry_requirements' then expr := quote_literal(req);
      when 'study_plan' then expr := quote_literal('Fully online, partially online or on-site');
      when 'slug' then expr := 's.slug';
      when 'code' then
        expr := case when col.data_type in ('text', 'character varying', 'character')
                     then 's.slug' end;
      when 'status' then
        expr := case when col.data_type in ('text', 'character varying', 'character')
                     then quote_literal('published') end;
      when 'published' then
        expr := case when col.data_type = 'boolean' then 'true' end;
      when 'is_published' then
        expr := case when col.data_type = 'boolean' then 'true' end;
      when 'active' then
        expr := case when col.data_type = 'boolean' then 'true' end;
      when 'is_active' then
        expr := case when col.data_type = 'boolean' then 'true' end;
      when 'delivery_modes' then
        expr := case when col.udt_name = '_text' then 's.modes'
                     when col.data_type in ('text', 'character varying')
                       then 'array_to_string(s.modes, '','')'
                end;
      when 'delivery_mode' then expr := 's.modes[1]';
      else expr := null;
    end case;

    if expr is null then
      -- A default that leans on auth.uid() evaluates to NULL inside the SQL
      -- editor, which still breaks a NOT NULL column. Give those a real value.
      if col.column_default is not null
         and col.column_default not ilike '%auth.%'
         and col.column_default not ilike '%current_setting%' then
        continue;
      end if;
      if col.is_nullable = 'YES' then
        continue;
      end if;
      expr := case
                when col.udt_name = 'uuid' then 'gen_random_uuid()'
                when col.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision') then '0'
                when col.data_type = 'boolean' then 'false'
                when col.data_type like 'timestamp%' then 'now()'
                when col.data_type = 'date' then 'current_date'
                when col.data_type = 'json' then '''{}''::json'
                when col.data_type = 'jsonb' then '''{}''::jsonb'
                when left(col.udt_name, 1) = '_' then format('''{}''::%I[]', substr(col.udt_name, 2))
                when col.data_type in ('text', 'character varying', 'character')
                  then '''aoh-'' || s.slug'
                else quote_literal('')
              end;
    end if;

    col_list := col_list || case when col_list = '' then '' else ', ' end || quote_ident(col.column_name);
    val_list := val_list || case when val_list = '' then '' else ', ' end || '(' || expr || ')';
  end loop;

  -- Only titles that are not in the table yet, so re-running never duplicates a
  -- course and never overwrites anything staff have edited. Rows go in one at a
  -- time: one unusual column, constraint or trigger can no longer cost you the
  -- whole batch, and the real reason is written into the seed log.
  declare
    total integer := 0;
    seeded integer := 0;
    failed integer := 0;
    first_error text;
    added integer;
  begin
    total := coalesce(jsonb_array_length(seed_catalogue), 0);

    for seed_row in
      select e->>'slug'            as slug,
             e->>'title'            as title,
             e->>'category'        as category,
             (e->>'weeks')::integer as weeks,
             (e->>'fee')::numeric   as fee,
             e->>'certification'   as certification,
             e->>'description'     as description,
             string_to_array(e->>'modes', ',') as modes
        from jsonb_array_elements(coalesce(seed_catalogue, '[]'::jsonb)) e
       order by e->>'slug'
    loop
      added := 0;
      row_failed := false;
      begin
        execute format($sql$
          insert into public.programs (%s)
          select %s
            from (select $1::text as slug, $2::text as title, $3::text as category,
                         $4::integer as weeks, $5::numeric as fee,
                         $6::text as certification, $7::text as description,
                         $8::text[] as modes) s
           %s
          on conflict do nothing
        $sql$, col_list, val_list, seen_where)
        using seed_row.slug, seed_row.title, seed_row.category, seed_row.weeks,
              seed_row.fee, seed_row.certification, seed_row.description, seed_row.modes;
        get diagnostics added = row_count;
        seeded := seeded + added;
      exception when others then
        row_failed := true;
        failed := failed + 1;
        if first_error is null then
          first_error := format('%s: %s', seed_row.slug, sqlerrm);
        end if;
      end;

      -- No row and no error means a constraint or trigger dropped it quietly.
      -- Retry without "on conflict do nothing" so the real reason is raised.
      if added = 0 and not row_failed then
        begin
          execute format($sql$
            insert into public.programs (%s)
            select %s
              from (select $1::text as slug, $2::text as title, $3::text as category,
                           $4::integer as weeks, $5::numeric as fee,
                           $6::text as certification, $7::text as description,
                           $8::text[] as modes) s
             %s
          $sql$, col_list, val_list, seen_where)
          using seed_row.slug, seed_row.title, seed_row.category, seed_row.weeks,
                seed_row.fee, seed_row.certification, seed_row.description, seed_row.modes;
          get diagnostics added = row_count;
          seeded := seeded + added;
        exception when others then
          failed := failed + 1;
          if first_error is null then
            first_error := format('%s: %s', seed_row.slug, sqlerrm);
          end if;
        end;
      end if;
    end loop;

    seed_note := format('seeded %s of %s programmes into public.programs', seeded, total);
    if failed > 0 then
      seed_note := seed_note || format(' - %s rows could not be inserted, first error: %s', failed, left(first_error, 220));
    elsif seeded = 0 then
      seed_note := seed_note || ' - every insert returned 0 rows without an error, so a BEFORE INSERT trigger on public.programs is dropping them (check its definition in Supabase) or every title already exists';
    end if;
  end;

  raise notice '%', seed_note;

  -- Leave the outcome where the verification grid can show it.
  begin
    insert into public.data_migrations (id, note)
    values ('catalogue_2027_seed', left(seed_note, 400))
    on conflict (id) do update set note = excluded.note, applied_at = now();
  exception when others then null;
  end;
exception when others then
  -- Record the abort too, so the verification rows below report it. The SQL
  -- editor does not show NOTICE lines, only the rows a statement returns.
  seed_note := format('catalogue seed block aborted before inserting: %s', sqlerrm);
  raise notice '%', seed_note;
  begin
    insert into public.data_migrations (id, note)
    values ('catalogue_2027_seed', left(seed_note, 400))
    on conflict (id) do update set note = excluded.note, applied_at = now();
  exception when others then null;
  end;
end
$seed$;


-- ----------------------------------------------------------------------------
-- PART 3 · verification — every row should read "ok"
-- ----------------------------------------------------------------------------
select 'seed_script_version' as object,
       case when exists (select 1 from public.programs)
            then 'v6 ok - live programmes present'
            else 'v6 - parse the file fresh; if it still says 0, read programmes_seed_log'
       end as status
union all
select 'programs.title',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'programs' and column_name = 'title'
       ) then 'ok' else 'missing - the app reads title, the table had name' end
union all
select 'rows_without_title',
       (select count(*)::text from public.programs where title is null or btrim(title) = '')
union all
select 'programs_check_constraints',
       coalesce((select string_agg(conname || ': ' || pg_get_constraintdef(oid), ' ;; ')
                   from pg_constraint
                  where conrelid = 'public.programs'::regclass and contype = 'c'),
                'none')
union all
select 'programs_insert_triggers',
       coalesce((select string_agg(t.tgname, ', ')
                   from pg_trigger t
                  where t.tgrelid = 'public.programs'::regclass and not t.tgisinternal),
                'none')
union all
select 'support_pledges' as object,
       case when to_regclass('public.support_pledges') is not null then 'ok' else 'missing' end as status
union all
select 'study_plans',
       case when to_regclass('public.study_plans') is not null then 'ok' else 'missing' end
union all
select 'programs.delivery_modes',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'programs' and column_name = 'delivery_modes'
       ) then 'ok' else 'missing' end
union all
select 'programs.study_plan',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'programs' and column_name = 'study_plan'
       ) then 'ok' else 'missing' end
union all
select 'programs.duration_weeks',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'programs' and column_name = 'duration_weeks'
       ) then 'ok' else 'missing' end
union all
select 'durations_fees_applied',
       case when exists (select 1 from public.data_migrations where id = 'catalogue_2027_durations_fees')
            then 'ok' else 'not run' end
union all
select 'programmes_catalogue',
       coalesce((
         select string_agg(
                  format('%s | %s weeks | US$%s | %s rows',
                         coalesce(s.category, 'no category'),
                         coalesce(s.duration_weeks::text, '-'),
                         coalesce(s.tuition::text, '-'),
                         s.n),
                  ' ;; ' order by s.category)
         from (
           select category, duration_weeks, tuition, count(*) as n
           from public.programs
           group by category, duration_weeks, tuition
         ) s
       ), 'programmes table is empty - re-run PART 2B and read its notice')
union all
select 'programmes_seeded',
       case when (select count(*) from public.programs) > 0
            then format('%s programmes in the live table', (select count(*) from public.programs))
            else '0 programmes - the public site falls back to the built-in 2026 catalogue'
       end
union all
select 'programmes_seed_log',
       coalesce((select note from public.data_migrations where id = 'catalogue_2027_seed'),
                'no seed attempt recorded yet')
union all
select 'programs_required_columns',
       coalesce((
         select string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position)
           from information_schema.columns
          where table_schema = 'public'
            and table_name = 'programs'
            and is_nullable = 'NO'
            and column_default is null
       ), 'none')
union all
select 'is_portal_admin',
       case when to_regprocedure('public.is_portal_admin()') is not null then 'ok' else 'missing' end;
