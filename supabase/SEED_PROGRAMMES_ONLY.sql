-- ── Africa of Hope · seed public.programs with the 2026/2027 catalogue ─────────
-- Paste ONLY this file into Supabase → SQL Editor → Run. Nothing else.
--
-- Why this file exists: the seed inside APPLY_ALL_PENDING_SQL.sql runs in the same
-- transaction as every other pending statement, so one unrelated failure aborts the
-- seed too and the table stays at 0 rows. This file contains nothing else, so the
-- only thing that can go wrong is the seed itself — and it reports that error
-- verbatim (no exception handler swallows it).
--
-- It only inserts titles that are not in the table yet, so re-running never
-- duplicates a course and never overwrites what staff edited.

-- ── 0 · make sure the table carries the `title` column the app reads ───────────
-- The live table was created with `name` as its title column, while the app reads
-- and writes `title`. That mismatch is what produced
--   42703: column p.title does not exist
-- so add `title`, copy existing names into it and keep both in step. Idempotent.
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

do $catalogue$
declare
  seed_row record;
  col record;
  expr text;
  col_list text := '';
  val_list text := '';
  added integer := 0;
  title_col text;
  seen_where text;
  req text := 'Be a high school student or above. Pay 50% of the registration package to reserve your seat and own a smartphone or laptop. Classes follow your study plan: fully online is 1 hour a day, 3 days a week; fully on-site is 2 hours daily, 2 days a week; partially online combines online lessons with one 2-hour campus practical day a week.';
begin
  -- Build the INSERT from the live table definition, so an extra required column
  -- can never make the seed skip itself.
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
      -- A default leaning on auth.uid() evaluates to NULL in the SQL editor, which
      -- still breaks a NOT NULL column, so those get a real value instead.
      if col.column_default is not null
         and col.column_default not ilike '%auth.%'
         and col.column_default not ilike '%current_setting%' then
        continue;
      end if;
      if col.is_nullable = 'YES' then
        continue;
      end if;
      expr := case
                when col.data_type = 'USER-DEFINED' then
                  coalesce((select format('%L::%I.%I', e.enumlabel, n.nspname, t.typname)
                              from pg_enum e
                              join pg_type t on t.oid = e.enumtypid
                              join pg_namespace n on n.oid = t.typnamespace
                             where t.typname = col.udt_name
                             order by e.enumsortorder
                             limit 1),
                           quote_literal(''))
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

  if col_list = '' then
    raise exception 'public.programs has no usable columns. Create the programmes table first, then run this file.';
  end if;

  -- Deduplicate on whichever title column this table really has: `title` on a fresh
  -- table, `name` on the older live one. A hard-coded p.title is what raised
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
    raise notice 'deduplicating programmes on column %', title_col;
  end if;

  for seed_row in
    select * from (values
    ('nine-media', 'Media & Communication Studies', 'Six-Month Courses', 26, 45, 'Diploma in Media & Communication Studies', 'News writing, reporting, presentation and media ethics with studio and field practice.', array['blended','onsite']),
    ('nine-teacher', 'Teacher''s Education', 'Six-Month Courses', 26, 45, 'Diploma in Teacher Education', 'Lesson planning, classroom management and child-centred teaching with teaching practice.', array['onsite','blended']),
    ('nine-audio', 'Audio Ads Production', 'Six-Month Courses', 26, 45, 'Diploma in Audio Ads Production', 'Voice-over, scripting, jingles and radio commercials produced in a real studio workflow.', array['blended','onsite']),
    ('nine-secre', 'Secretarial Science', 'Six-Month Courses', 26, 45, 'Diploma in Secretarial Science', 'Office administration, shorthand speed, records, front-desk etiquette and computer applications.', array['onsite','blended']),
    ('nine-admin', 'School Administration', 'Six-Month Courses', 26, 45, 'Diploma in School Administration', 'School records, admissions, staff supervision, discipline systems and parent relations.', array['online','blended']),
    ('nine-tv', 'Online-TV Production', 'Six-Month Courses', 26, 45, 'Diploma in Online-TV Production', 'Live streaming, camera operation, lighting, switching and publishing for online channels.', array['online','blended']),
    ('nine-multi', 'Professional Multimedia', 'Six-Month Courses', 26, 45, 'Diploma in Professional Multimedia', 'Flagship blend of graphics, video, audio and motion for work-ready multimedia producers.', array['blended','onsite']),
    ('six-graphics', 'Professional Graphics', 'Three-Month Courses', 13, 30, 'Certificate in Professional Graphics', 'Logos, flyers, branding and print design with portfolio reviews every month.', array['online','blended']),
    ('six-hr', 'HR Management', 'Three-Month Courses', 13, 30, 'Certificate in Human Resource Management', 'Recruitment, staff records, payroll basics, appraisals and workplace relations.', array['online','blended']),
    ('six-podcast', 'General Podcasting', 'Three-Month Courses', 13, 30, 'Certificate in General Podcasting', 'Show formats, recording, editing and publishing podcasts that keep listeners.', array['online']),
    ('six-me', 'Monitoring & Evaluation', 'Three-Month Courses', 13, 30, 'Certificate in Monitoring & Evaluation', 'Indicators, data collection, field tools and donor-ready M&E reports.', array['online','blended']),
    ('six-guidance', 'Guidance & Counseling', 'Three-Month Courses', 13, 30, 'Certificate in Guidance & Counseling', 'Counselling skills, safeguarding, youth mentorship and referral practice.', array['online','onsite']),
    ('six-pm', 'Project Management', 'Three-Month Courses', 13, 30, 'Certificate in Project Management', 'Proposals, work plans, budgets, supervision and closing community projects well.', array['online','blended']),
    ('six-digital', 'Digital Marketing', 'Three-Month Courses', 13, 30, 'Certificate in Digital Marketing', 'Social campaigns, WhatsApp selling, ads, analytics and content calendars.', array['online']),
    ('six-video', 'Video Production', 'Three-Month Courses', 13, 30, 'Certificate in Video Production', 'Shooting, directing, editing and delivery for events, adverts and online shows.', array['blended','onsite']),
    ('six-pr', 'General Public Relations', 'Three-Month Courses', 13, 30, 'Certificate in General Public Relations', 'Press releases, media relations, events and reputation management.', array['online','blended']),
    ('three-computer', 'Introduction to Computer', 'One-Month Courses', 4, 10, 'Certificate in Computer Foundations', 'Typing, files, Word, Excel, internet, email and safe smartphone and laptop use.', array['onsite','blended']),
    ('three-speaking', 'Public Speaking', 'One-Month Courses', 4, 10, 'Certificate in Public Speaking', 'Stage confidence, speech structure, microphone technique and audience engagement.', array['onsite','blended']),
    ('three-social', 'Social Media Management', 'One-Month Courses', 4, 10, 'Certificate in Social Media Management', 'Managing business pages, content planning, growth and customer messages.', array['online']),
    ('three-mgraphics', 'Mobile Graphics', 'One-Month Courses', 4, 10, 'Certificate in Mobile Graphics', 'Professional flyers and adverts designed entirely on a smartphone.', array['online']),
    ('three-mmulti', 'Mobile Multimedia', 'One-Month Courses', 4, 10, 'Certificate in Mobile Multimedia', 'Shoot, edit and publish video, audio and graphics from one phone.', array['online']),
    ('three-care', 'Customer''s Care & Reception', 'One-Month Courses', 4, 10, 'Certificate in Customer Care & Reception', 'Front-desk service, phone handling, complaints and repeat-customer care.', array['onsite','blended']),
    ('three-vpod', 'Video Podcasting', 'One-Month Courses', 4, 10, 'Certificate in Video Podcasting', 'Video talk shows: set, lighting, hosting, editing and YouTube publishing.', array['online','blended']),
    ('three-entre', 'Entrepreneurship & Business', 'One-Month Courses', 4, 10, 'Certificate in Entrepreneurship', 'Business ideas, costing, pricing, records and starting a small enterprise.', array['online','onsite']),
    ('three-lead', 'Leadership & Management', 'One-Month Courses', 4, 10, 'Certificate in Leadership & Management', 'Team leadership, meetings, supervision and community organisation.', array['online','blended']),
    ('one-mgraphics', 'Mobile Graphics (Fast Track)', 'Two-Week Courses', 2, 5, 'Certificate in Mobile Graphics', 'Two-week fast track: adverts and social designs on your phone.', array['online']),
    ('one-proposal', 'Project Proposal Writing', 'Two-Week Courses', 2, 5, 'Certificate in Proposal Writing', 'Write clear NGO and business proposals with budgets and logframes.', array['online']),
    ('one-event', 'Event Planning', 'Two-Week Courses', 2, 5, 'Certificate in Event Planning', 'Plan, decorate, budget and coordinate weddings, programs and launches.', array['blended','onsite']),
    ('one-speech', 'Speech & Article Writing', 'Two-Week Courses', 2, 5, 'Certificate in Speech & Article Writing', 'Write speeches, articles and press pieces people actually finish.', array['online']),
    ('one-quick', 'QuickBooks', 'Two-Week Courses', 2, 5, 'Certificate in QuickBooks', 'Set up company books, invoices, expenses and simple reports in QuickBooks.', array['online','blended']),
    ('one-book', 'Book Keeping', 'Two-Week Courses', 2, 5, 'Certificate in Book Keeping', 'Daily sales records, ledgers, cash control and month-end balancing.', array['online','blended'])
    ) as s(slug, title, category, weeks, fee, certification, description, modes)
  loop
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
    if added > 0 then
      raise notice 'inserted %', seed_row.title;
    end if;
  end loop;
end
$catalogue$;

-- Verification: programmes_in_live_table should read 31 on a fresh seed and the
-- four categories should be listed. Send these two values back if it does not.
select count(*)::text as programmes_in_live_table,
       coalesce(string_agg(distinct category, ' · '::text order by category), 'none') as categories,
       (select count(*)::text from public.programs where title is null or btrim(title) = '') as rows_without_title,
       count(*) filter (where tuition = 45)::text as six_month_fee_45,
       count(*) filter (where tuition = 5)::text as two_week_fee_5
  from public.programs;
