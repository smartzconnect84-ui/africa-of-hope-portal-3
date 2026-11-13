-- Back-office staff roles: create real accounts and assign their modules.
--
-- Why this exists:
--   * `public.roles` was only seeded with Super Admin, School Admin, Teacher,
--     Registrar, Finance Officer, Student (and Admission Officer later). Because
--     `profiles.role` references `roles(name)`, creating a Finance/PR/Data Entry/
--     Executive Assistant/Research/Customer Care/Director of Education account
--     failed when the profile row was written.
--   * `public.role_permissions` had no rows for the six back-office roles, so
--     even an existing account had no portal modules (has_permission() = false).
--   * Older entrance-test policies used the role names 'Customer Care' and
--     'Public Relation Officer', which no profile can hold, locking those staff
--     out of the entrance-test modules.
--
-- Safe to re-run: every insert is idempotent and existing custom grants are kept.

begin;

-- 1. Every staff role must exist as a row: profiles.role is a foreign key to it.
insert into public.roles (name, label, description, sort) values
  ('Super Admin', 'Super Admin', 'Full control of the academy portal and every permission.', 10),
  ('School Admin', 'School Admin', 'Day-to-day academic and operational administration.', 20),
  ('Teacher', 'Teacher', 'Teaches cohorts: attendance, assignments and quizzes.', 30),
  ('Registrar', 'Registrar', 'Admissions, programmes, cohorts and certificates.', 40),
  ('Admission Officer', 'Admission Officer', 'Screens applications and admits students.', 45),
  ('Finance Officer', 'Finance Officer', 'Fee collection, payment confirmation and the finance ledger.', 50),
  ('Student', 'Student', 'Enrolled learner.', 60),
  ('Public Relations Officer', 'Public Relations Officer', 'Owns the public website, news, blog and announcements.', 70),
  ('Data Entry Officer', 'Data Entry Officer', 'Enters applicant, student, cohort, attendance and certificate records.', 80),
  ('Executive Assistant', 'Executive Assistant', 'Supports leadership with communications, files and coordination.', 90),
  ('Research Officer', 'Research Officer', 'Builds learning content, programme research and blog stories.', 100),
  ('Customer Care Officer', 'Customer Care Officer', 'Front desk for enquiries, helpdesk and applicant follow-up.', 110),
  ('Director of Education', 'Director of Education', 'Owns academic standards, approvals, programmes and certificates.', 120)
on conflict (name) do update
  set label = excluded.label,
      description = excluded.description,
      sort = excluded.sort;

-- 2. Module grants for the roles that previously had none.
--    Mirrors DEFAULT_ROLE_PERMISSIONS in src/lib/permissions.ts.
insert into public.role_permissions (role, permission)
select v.role, v.permission
  from (values
    -- Finance Officer: confirmations module was missing from the DB seed.
    ('Finance Officer', 'payments.confirm'),

    ('Public Relations Officer', 'people.view'),
    ('Public Relations Officer', 'announcements.manage'),
    ('Public Relations Officer', 'cms.manage'),
    ('Public Relations Officer', 'blog.manage'),
    ('Public Relations Officer', 'helpdesk.manage'),
    ('Public Relations Officer', 'assistant.use'),
    ('Public Relations Officer', 'assistant.admin_help'),

    ('Data Entry Officer', 'people.view'),
    ('Data Entry Officer', 'students.manage'),
    ('Data Entry Officer', 'cohorts.manage'),
    ('Data Entry Officer', 'attendance.manage'),
    ('Data Entry Officer', 'fees.view'),
    ('Data Entry Officer', 'certificates.manage'),
    ('Data Entry Officer', 'announcements.manage'),
    ('Data Entry Officer', 'assistant.use'),

    ('Executive Assistant', 'people.view'),
    ('Executive Assistant', 'students.manage'),
    ('Executive Assistant', 'academic_plans.approve'),
    ('Executive Assistant', 'announcements.manage'),
    ('Executive Assistant', 'helpdesk.manage'),
    ('Executive Assistant', 'cms.manage'),
    ('Executive Assistant', 'assistant.use'),
    ('Executive Assistant', 'assistant.admin_help'),

    ('Research Officer', 'people.view'),
    ('Research Officer', 'programs.manage'),
    ('Research Officer', 'materials.manage'),
    ('Research Officer', 'materials.approve'),
    ('Research Officer', 'quizzes.view_results'),
    ('Research Officer', 'announcements.manage'),
    ('Research Officer', 'blog.manage'),
    ('Research Officer', 'assistant.use'),
    ('Research Officer', 'assistant.admin_help'),

    ('Customer Care Officer', 'people.view'),
    ('Customer Care Officer', 'students.manage'),
    ('Customer Care Officer', 'fees.view'),
    ('Customer Care Officer', 'announcements.manage'),
    ('Customer Care Officer', 'helpdesk.manage'),
    ('Customer Care Officer', 'assistant.use'),

    ('Director of Education', 'people.view'),
    ('Director of Education', 'students.manage'),
    ('Director of Education', 'programs.manage'),
    ('Director of Education', 'cohorts.manage'),
    ('Director of Education', 'academic_plans.approve'),
    ('Director of Education', 'materials.approve'),
    ('Director of Education', 'attendance.manage'),
    ('Director of Education', 'assignments.manage'),
    ('Director of Education', 'grades.review_appeals'),
    ('Director of Education', 'quizzes.manage_all'),
    ('Director of Education', 'quizzes.view_results'),
    ('Director of Education', 'fees.view'),
    ('Director of Education', 'certificates.manage'),
    ('Director of Education', 'announcements.manage'),
    ('Director of Education', 'helpdesk.manage'),
    ('Director of Education', 'blog.manage'),
    ('Director of Education', 'assistant.use'),
    ('Director of Education', 'assistant.admin_help')
  ) as v(role, permission)
 where exists (select 1 from public.permissions p where p.key = v.permission)
on conflict do nothing;

-- 3. Repair policies written with role names no profile can hold.
--    Rewrites the literals in place so every existing check is preserved.
do $$
declare
  pol record;
  fixed_using text;
  fixed_check text;
  stmt text;
begin
  for pol in
    select schemaname, tablename, policyname, permissive, roles, cmd as policy_cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (
         coalesce(qual, '') ~ '''(Customer Care|Public Relation Officer)'''
         or coalesce(with_check, '') ~ '''(Customer Care|Public Relation Officer)'''
       )
  loop
    begin
      fixed_using := replace(
        replace(pol.qual, '''Customer Care''', '''Customer Care Officer'''),
        '''Public Relation Officer''', '''Public Relations Officer''');
      fixed_check := replace(
        replace(coalesce(pol.with_check, ''), '''Customer Care''', '''Customer Care Officer'''),
        '''Public Relation Officer''', '''Public Relations Officer''');

      execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
      stmt := format(
        'create policy %I on %I.%I as %s for %s to %s',
        pol.policyname, pol.schemaname, pol.tablename,
        case when pol.permissive = 'RESTRICTIVE' then 'restrictive' else 'permissive' end,
        case upper(pol.policy_cmd)
          when 'SELECT' then 'select' when 'INSERT' then 'insert'
          when 'UPDATE' then 'update' when 'DELETE' then 'delete' else 'all'
        end,
        array_to_string(pol.roles, ', ')
      );
      if coalesce(fixed_using, '') <> '' then
        stmt := stmt || format(' using (%s)', fixed_using);
      end if;
      if coalesce(fixed_check, '') <> '' then
        stmt := stmt || format(' with check (%s)', fixed_check);
      end if;
      execute stmt;
      raise notice 'Rewrote policy %.% with the corrected role names', pol.tablename, pol.policyname;
    exception when others then
      raise notice 'Skipped policy %.% (%): %', pol.tablename, pol.policyname, pol.policy_cmd, sqlerrm;
    end;
  end loop;
end $$;

-- 4. Verification: every staff role must now exist and have modules.
do $$
declare
  missing_roles text;
  missing_modules text;
begin
  select string_agg(r.name, ', ')
    into missing_roles
    from (values
      ('Super Admin'), ('School Admin'), ('Teacher'), ('Registrar'), ('Admission Officer'),
      ('Finance Officer'), ('Public Relations Officer'), ('Data Entry Officer'),
      ('Executive Assistant'), ('Research Officer'), ('Customer Care Officer'), ('Director of Education')
    ) as r(name)
   where not exists (select 1 from public.roles ro where ro.name = r.name);

  select string_agg(r.name, ', ')
    into missing_modules
    from (values
      ('Public Relations Officer'), ('Data Entry Officer'), ('Executive Assistant'),
      ('Research Officer'), ('Customer Care Officer'), ('Director of Education')
    ) as r(name)
   where not exists (select 1 from public.role_permissions rp where rp.role = r.name);

  if missing_roles is not null then
    raise exception 'Staff roles still missing from public.roles: %', missing_roles;
  end if;
  if missing_modules is not null then
    raise exception 'Staff roles without any module grant: %', missing_modules;
  end if;
  raise notice 'All 12 staff roles exist and the back-office roles have module grants.';
end $$;

commit;
