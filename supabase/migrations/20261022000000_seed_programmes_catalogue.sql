-- ── Africa of Hope · seed the live programmes table with the 2026/2027 catalogue ─
-- The public site and brochures fall back to src/data/programCatalog2026.ts while
-- public.programs has no rows. This seeds the same 31 courses (6-month US$45,
-- 3-month US$30, 1-month US$10, 2-week US$5) and only ever inserts titles that are
-- not in the table yet, so re-running never duplicates and never overwrites edits.
--
-- v2: the block now builds the INSERT from the live table definition instead of a
-- fixed column list. v1 skipped itself silently whenever the live table had an
-- extra required column (which left the grid reading "0 programmes"), so any
-- unknown required column now gets a type-appropriate value and the outcome -
-- including the real error text - is written to public.data_migrations.

-- v3: there is no temp table and no catalogue_seed name anywhere any more.
-- PL/pgSQL parses the SQL inside a block while it compiles the block, so a table
-- created by an earlier statement (temp or not) can still be reported as
-- "relation catalogue_seed does not exist". The 31 courses are an inline VALUES
-- list turned into a jsonb array inside the same block, and each insert carries
-- its own values as parameters, so nothing depends on statement order.

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
  );

  -- Build the INSERT from the live table definition so extra required columns can
  -- never make the seed skip itself.
  -- De-duplicate on whichever title column this table really has: `title` on a
  -- fresh table, `name` on the older live one (which raised
  -- "42703: column p.title does not exist").
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

  if to_regclass('public.data_migrations') is not null then
    begin
      insert into public.data_migrations (id, note)
      values ('catalogue_2027_seed', left(seed_note, 400))
      on conflict (id) do update set note = excluded.note, applied_at = now();
    exception when others then null;
    end;
  end if;
exception when others then
  -- Record the abort too, so the verification rows below can report it. The
  -- Supabase SQL editor does not show NOTICE lines, only returned rows.
  seed_note := format('catalogue seed block aborted before inserting: %s', sqlerrm);
  raise notice '%', seed_note;
  if to_regclass('public.data_migrations') is not null then
    begin
      insert into public.data_migrations (id, note)
      values ('catalogue_2027_seed', left(seed_note, 400))
      on conflict (id) do update set note = excluded.note, applied_at = now();
    exception when others then null;
    end;
  end if;
end
$seed$;


-- ----------------------------------------------------------------------------
-- Result rows. The SQL editor only shows what a statement returns, so these are
-- how the seed reports itself. If the table still looks empty, copy these rows.
-- ----------------------------------------------------------------------------
select 'seed_script_version' as check_result,
       'v5 - inline catalogue, no catalogue_seed temp table' as value
union all
select 'programmes_in_live_table',
       (select count(*)::text from public.programs) || ' rows'
union all
select 'programme_titles',
       coalesce((select string_agg(title, ' | ' order by title) from public.programs), 'none')
union all
select 'programmes_seed_log',
       coalesce((select note from public.data_migrations where id = 'catalogue_2027_seed'),
                'no seed attempt recorded');
