-- Roles & permissions, full RLS rewrite, site-assets bucket, realtime for
-- role_permissions. Idempotent: safe to re-run.
--
-- The live tables had significant policy drift: every one of the 12 public
-- tables below had 2-4 overlapping OR'd policies, including legacy
-- "*_portal_all" (qual = true) ones. Section 6 drops every existing policy
-- on these tables (by name, discovered live) before recreating a single,
-- permission-based set in section 7. Mirrors src/lib/permissions.ts exactly.
--
-- supabase/migrations/20261014020000_quizzes_assistant.sql runs after this
-- file and depends on public.has_permission(perm text) and
-- public.is_cohort_teacher(cohort uuid) existing already.

-- ───────────────────────── 1. Catalogue tables ─────────────────────────

create table if not exists public.roles (
  name text primary key,
  label text not null,
  description text not null default '',
  sort int not null default 0,
  is_system boolean not null default true
);

insert into public.roles (name, label, description, sort) values
  ('Super Admin', 'Super Admin', 'Full control of the academy portal and every permission.', 10),
  ('School Admin', 'School Admin', 'Day-to-day academic and operational administration.', 20),
  ('Teacher', 'Teacher', 'Teaches cohorts: attendance, assignments and quizzes.', 30),
  ('Registrar', 'Registrar', 'Admissions, programmes, cohorts and certificates.', 40),
  ('Finance Officer', 'Finance Officer', 'Fee collection and the finance ledger.', 50),
  ('Student', 'Student', 'Enrolled learner.', 60)
on conflict (name) do nothing;

create table if not exists public.permissions (
  key text primary key,
  grp text not null,
  label text not null,
  description text not null default '',
  sort int not null default 0
);

insert into public.permissions (key, grp, label, description, sort) values
  ('people.view', 'People', 'View staff & student directory', 'See the Staff & Students screen and every profile in it.', 10),
  ('students.manage', 'People', 'Manage students', 'Approve applicants, suspend/reinstate students, assign programmes and cohorts.', 20),
  ('staff.manage', 'People', 'Manage staff', 'Add staff accounts, change roles, suspend, reset passwords and delete people.', 30),
  ('programs.manage', 'Academics', 'Manage programmes', 'Create and edit programmes and their modules.', 40),
  ('cohorts.manage', 'Academics', 'Manage cohorts', 'Create and edit cohorts, assign teachers and students.', 50),
  ('attendance.manage', 'Academics', 'Manage all attendance', 'Record and edit attendance for every cohort.', 60),
  ('attendance.own', 'Academics', 'Manage own cohort attendance', 'Record and edit attendance for cohorts you teach.', 70),
  ('assignments.manage', 'Academics', 'Manage all assignments', 'Create assignments and grade submissions for every cohort.', 80),
  ('assignments.own', 'Academics', 'Manage own cohort assignments', 'Create assignments and grade submissions for cohorts you teach.', 90),
  ('quizzes.manage', 'Quizzes', 'Manage own quizzes', 'Build, edit and publish quizzes for cohorts you teach or quizzes you created.', 100),
  ('quizzes.manage_all', 'Quizzes', 'Manage all quizzes', 'Manage any quiz, regardless of who created it.', 110),
  ('quizzes.take', 'Quizzes', 'Take quizzes', 'See and attempt published quizzes for your own cohorts/programmes.', 120),
  ('quizzes.view_results', 'Quizzes', 'View quiz results', 'See attempts and scores for quizzes you can manage.', 130),
  ('fees.view', 'Finance', 'View fees', 'See fee transactions and balances for students.', 140),
  ('fees.manage', 'Finance', 'Manage fees', 'Record payments and edit fee transactions.', 150),
  ('certificates.manage', 'Certificates', 'Manage certificates', 'Issue, edit and revoke certificates.', 160),
  ('announcements.manage', 'Comms', 'Post announcements', 'Create and edit bulletin board announcements.', 170),
  ('cms.manage', 'Website', 'Manage website content', 'Edit the public website: homepage, login/register page, logo and footer.', 180),
  ('settings.manage', 'Settings', 'Manage system settings', 'Edit academy details, academic calendar and portal-wide settings.', 190),
  ('assistant.use', 'AI', 'Use Hope Assistant', 'Chat with the Hope Assistant and get answers about your own data.', 200),
  ('assistant.admin_help', 'AI', 'Assistant screen help & stats', 'Get screen guidance and aggregate statistics from the Hope Assistant.', 210)
on conflict (key) do update set
  grp = excluded.grp, label = excluded.label, description = excluded.description, sort = excluded.sort;

create table if not exists public.role_permissions (
  role text not null references public.roles(name) on update cascade on delete cascade,
  permission text not null references public.permissions(key) on update cascade on delete cascade,
  primary key (role, permission)
);

-- Mirrors DEFAULT_ROLE_PERMISSIONS in src/lib/permissions.ts exactly.
-- Super Admin is never inserted: has_permission() grants it everything.
insert into public.role_permissions (role, permission) values
  ('School Admin', 'people.view'),
  ('School Admin', 'students.manage'),
  ('School Admin', 'staff.manage'),
  ('School Admin', 'programs.manage'),
  ('School Admin', 'cohorts.manage'),
  ('School Admin', 'attendance.manage'),
  ('School Admin', 'assignments.manage'),
  ('School Admin', 'quizzes.manage'),
  ('School Admin', 'quizzes.manage_all'),
  ('School Admin', 'quizzes.view_results'),
  ('School Admin', 'fees.view'),
  ('School Admin', 'fees.manage'),
  ('School Admin', 'certificates.manage'),
  ('School Admin', 'announcements.manage'),
  ('School Admin', 'cms.manage'),
  ('School Admin', 'settings.manage'),
  ('School Admin', 'assistant.use'),
  ('School Admin', 'assistant.admin_help'),
  ('Teacher', 'attendance.own'),
  ('Teacher', 'assignments.own'),
  ('Teacher', 'quizzes.manage'),
  ('Teacher', 'quizzes.view_results'),
  ('Teacher', 'announcements.manage'),
  ('Teacher', 'assistant.use'),
  ('Teacher', 'assistant.admin_help'),
  ('Registrar', 'people.view'),
  ('Registrar', 'students.manage'),
  ('Registrar', 'programs.manage'),
  ('Registrar', 'cohorts.manage'),
  ('Registrar', 'quizzes.view_results'),
  ('Registrar', 'fees.view'),
  ('Registrar', 'certificates.manage'),
  ('Registrar', 'announcements.manage'),
  ('Registrar', 'assistant.use'),
  ('Registrar', 'assistant.admin_help'),
  ('Finance Officer', 'people.view'),
  ('Finance Officer', 'fees.view'),
  ('Finance Officer', 'fees.manage'),
  ('Finance Officer', 'announcements.manage'),
  ('Finance Officer', 'assistant.use'),
  ('Finance Officer', 'assistant.admin_help'),
  ('Student', 'quizzes.take'),
  ('Student', 'assistant.use')
on conflict do nothing;

-- ─────────────────────── 2. Profiles role constraint ───────────────────

alter table public.profiles drop constraint if exists profiles_role_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_fkey' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_fkey foreign key (role) references public.roles(name) on update cascade;
  end if;
end $$;

-- ───────────────────────── 3. Helper functions ─────────────────────────

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'Active'
      and (
        p.role = 'Super Admin'
        or exists (
          select 1 from public.role_permissions rp
          where rp.role = p.role and rp.permission = perm
        )
      )
  );
$$;

grant execute on function public.has_permission(text) to authenticated, anon;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Super Admin' and status = 'Active'
  );
$$;

grant execute on function public.is_super_admin() to authenticated, anon;

-- Kept for old callers; no new policy below uses it.
create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('people.view');
$$;

grant execute on function public.is_portal_admin() to authenticated, anon;

create or replace function public.is_cohort_teacher(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cohorts where id = c and teacher_id = auth.uid());
$$;

grant execute on function public.is_cohort_teacher(uuid) to authenticated;

create or replace function public.is_cohort_member(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cohort_students where cohort_id = c and student_id = auth.uid());
$$;

grant execute on function public.is_cohort_member(uuid) to authenticated;

create or replace function public.teaches_student(s uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cohort_students cs
    join public.cohorts c on c.id = cs.cohort_id
    where cs.student_id = s and c.teacher_id = auth.uid()
  );
$$;

grant execute on function public.teaches_student(uuid) to authenticated;

create or replace function public.can_read_profile(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p = auth.uid()
    or public.has_permission('people.view')
    or public.teaches_student(p)
    or exists (
      select 1 from public.profiles target
      where target.id = p and target.status = 'Active' and target.role <> 'Student'
    );
$$;

grant execute on function public.can_read_profile(uuid) to authenticated;

-- ─────────────────── 4. protect_profile_privileges() rewrite ───────────

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role, triggers (e.g. handle_new_user) and the SQL editor run as
  -- a role other than 'authenticated'/'anon' and are always trusted.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'Super Admin' and not public.is_super_admin() then
      raise exception 'Only a Super Admin can create a Super Admin account.';
    end if;

    if not public.has_permission('staff.manage') and not public.has_permission('students.manage') then
      if new.role <> 'Student' or new.status <> 'Pending Approval' then
        raise exception 'New accounts must self-register as a pending student.';
      end if;
    end if;

    return new;
  end if;

  -- tg_op = 'UPDATE'. Nobody may change their own role or status: this
  -- prevents both self-lockout and self-promotion.
  if new.id = auth.uid()
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'You cannot change your own role or status.';
  end if;

  -- Setting role = 'Super Admin', or touching a Super Admin's row, needs
  -- is_super_admin().
  if (old.role = 'Super Admin' or new.role = 'Super Admin') and not public.is_super_admin() then
    raise exception 'Only a Super Admin can change a Super Admin account.';
  end if;

  if new.role is distinct from old.role and not public.has_permission('staff.manage') then
    raise exception 'You do not have permission to change roles.';
  end if;

  if new.status is distinct from old.status then
    if old.role = 'Student' then
      if not public.has_permission('students.manage') then
        raise exception 'You do not have permission to change a student''s status.';
      end if;
    elsif not public.has_permission('staff.manage') then
      raise exception 'You do not have permission to change a staff member''s status.';
    end if;
  end if;

  if (new.program_ids is distinct from old.program_ids or new.cohort_ids is distinct from old.cohort_ids)
     and old.role = 'Student' and not public.has_permission('students.manage') then
    raise exception 'You do not have permission to assign programmes or cohorts.';
  end if;

  return new;
end;
$$;

-- ─────────────────── 5. protect_system_settings() trigger ──────────────

create or replace function public.protect_system_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  if not public.has_permission('settings.manage') then
    if new.academy_name is distinct from old.academy_name
      or new.motto is distinct from old.motto
      or new.contact_email is distinct from old.contact_email
      or new.contact_phone is distinct from old.contact_phone
      or new.address is distinct from old.address
      or new.accreditation_no is distinct from old.accreditation_no
      or new.currency is distinct from old.currency
      or new.academic_year is distinct from old.academic_year
      or new.semester is distinct from old.semester
      or new.self_registration_open is distinct from old.self_registration_open
      or new.student_id_prefix is distinct from old.student_id_prefix
      or new.pass_mark is distinct from old.pass_mark
      or new.min_attendance is distinct from old.min_attendance
      or new.site_published is distinct from old.site_published
      or new.marketing_banner is distinct from old.marketing_banner
      or new.intake_status is distinct from old.intake_status
      or new.featured_program_ids is distinct from old.featured_program_ids
    then
      raise exception 'You do not have permission to change system settings.';
    end if;
  end if;

  if not public.has_permission('cms.manage') and new.website_settings is distinct from old.website_settings then
    raise exception 'You do not have permission to manage website content.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_system_settings_trigger on public.system_settings;
create trigger protect_system_settings_trigger
  before update on public.system_settings
  for each row execute function public.protect_system_settings();

-- ──────────────── 6. Drop every existing policy on the 12 tables ───────

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'programs', 'program_modules', 'cohorts', 'cohort_students',
        'attendance', 'assignments', 'submissions', 'fee_transactions',
        'certificates', 'announcements', 'system_settings'
      ])
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_modules enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_students enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.fee_transactions enable row level security;
alter table public.certificates enable row level security;
alter table public.announcements enable row level security;
alter table public.system_settings enable row level security;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- ───────────────────────── 7. New policies ──────────────────────────────
-- (select has_permission('x')) so Postgres evaluates the check once per
-- query (initPlan), not once per row.

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated using ((select public.can_read_profile(id)));

create policy profiles_insert on public.profiles
  for insert to authenticated with check (
    (id = auth.uid() and role = 'Student' and status = 'Pending Approval')
    or (select public.has_permission('staff.manage'))
    or (select public.has_permission('students.manage'))
  );

create policy profiles_update on public.profiles
  for update to authenticated using (
    id = auth.uid()
    or (select public.has_permission('staff.manage'))
    or ((select public.has_permission('students.manage')) and role = 'Student')
  )
  with check (
    id = auth.uid()
    or (select public.has_permission('staff.manage'))
    or ((select public.has_permission('students.manage')) and role = 'Student')
  );

create policy profiles_delete on public.profiles
  for delete to authenticated using ((select public.has_permission('staff.manage')));

-- programs, program_modules: public read, programs.manage write
create policy programs_read on public.programs for select using (true);
create policy programs_write on public.programs for all
  using ((select public.has_permission('programs.manage')))
  with check ((select public.has_permission('programs.manage')));

create policy program_modules_read on public.program_modules for select using (true);
create policy program_modules_write on public.program_modules for all
  using ((select public.has_permission('programs.manage')))
  with check ((select public.has_permission('programs.manage')));

-- cohorts: authenticated read, cohorts.manage write
create policy cohorts_read on public.cohorts for select to authenticated using (true);
create policy cohorts_write on public.cohorts for all to authenticated
  using ((select public.has_permission('cohorts.manage')))
  with check ((select public.has_permission('cohorts.manage')));

-- cohort_students
create policy cohort_students_read on public.cohort_students for select to authenticated using (
  student_id = auth.uid()
  or (select public.is_cohort_teacher(cohort_id))
  or (select public.has_permission('people.view'))
  or (select public.has_permission('cohorts.manage'))
);

create policy cohort_students_write on public.cohort_students for all to authenticated
  using (
    (select public.has_permission('cohorts.manage')) or (select public.has_permission('students.manage'))
  )
  with check (
    (select public.has_permission('cohorts.manage')) or (select public.has_permission('students.manage'))
  );

-- attendance
create policy attendance_read on public.attendance for select to authenticated using (
  student_id = auth.uid()
  or (select public.is_cohort_teacher(cohort_id))
  or (select public.has_permission('attendance.manage'))
  or (select public.has_permission('people.view'))
);

create policy attendance_write on public.attendance for all to authenticated
  using (
    (select public.has_permission('attendance.manage'))
    or ((select public.has_permission('attendance.own')) and (select public.is_cohort_teacher(cohort_id)))
  )
  with check (
    (select public.has_permission('attendance.manage'))
    or ((select public.has_permission('attendance.own')) and (select public.is_cohort_teacher(cohort_id)))
  );

-- assignments
create policy assignments_read on public.assignments for select to authenticated using (
  (select public.is_cohort_member(cohort_id))
  or (select public.is_cohort_teacher(cohort_id))
  or (select public.has_permission('assignments.manage'))
  or (select public.has_permission('people.view'))
);

create policy assignments_write on public.assignments for all to authenticated
  using (
    (select public.has_permission('assignments.manage'))
    or ((select public.has_permission('assignments.own')) and (select public.is_cohort_teacher(cohort_id)))
  )
  with check (
    (select public.has_permission('assignments.manage'))
    or ((select public.has_permission('assignments.own')) and (select public.is_cohort_teacher(cohort_id)))
  );

-- submissions: same graders as assignments; students read their own
create policy submissions_read on public.submissions for select to authenticated using (
  student_id = auth.uid()
  or (select public.has_permission('assignments.manage'))
  or exists (
    select 1 from public.assignments a
    where a.id = submissions.assignment_id and (select public.is_cohort_teacher(a.cohort_id))
  )
);

create policy submissions_write on public.submissions for all to authenticated
  using (
    (select public.has_permission('assignments.manage'))
    or (
      (select public.has_permission('assignments.own'))
      and exists (
        select 1 from public.assignments a
        where a.id = submissions.assignment_id and (select public.is_cohort_teacher(a.cohort_id))
      )
    )
  )
  with check (
    (select public.has_permission('assignments.manage'))
    or (
      (select public.has_permission('assignments.own'))
      and exists (
        select 1 from public.assignments a
        where a.id = submissions.assignment_id and (select public.is_cohort_teacher(a.cohort_id))
      )
    )
  );

-- fee_transactions
create policy fee_transactions_read on public.fee_transactions for select to authenticated using (
  student_id = auth.uid()
  or (select public.has_permission('fees.view'))
  or (select public.has_permission('fees.manage'))
);

create policy fee_transactions_write on public.fee_transactions for all to authenticated
  using ((select public.has_permission('fees.manage')))
  with check ((select public.has_permission('fees.manage')));

-- certificates: public verification stays public
create policy certificates_read on public.certificates for select using (true);

create policy certificates_write on public.certificates for all to authenticated
  using ((select public.has_permission('certificates.manage')))
  with check ((select public.has_permission('certificates.manage')));

-- announcements
create policy announcements_read on public.announcements for select using (true);

create policy announcements_write on public.announcements for all to authenticated
  using ((select public.has_permission('announcements.manage')))
  with check ((select public.has_permission('announcements.manage')));

-- system_settings: shared row between the settings and CMS permissions,
-- split by column in the trigger above.
create policy system_settings_read on public.system_settings for select using (true);

create policy system_settings_insert on public.system_settings for insert with check (
  (select public.has_permission('settings.manage'))
);

create policy system_settings_update on public.system_settings for update using (
  (select public.has_permission('settings.manage')) or (select public.has_permission('cms.manage'))
)
with check (
  (select public.has_permission('settings.manage')) or (select public.has_permission('cms.manage'))
);

-- roles, permissions, role_permissions: readable by anyone signed in,
-- editable only by Super Admin (the matrix screen is Super-Admin-only).
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);
drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- ───────────────────────────── 8. Storage ───────────────────────────────
-- Drop and recreate policies by name only; never loop over all of
-- storage.objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets', 'site-assets', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects
  for select using (bucket_id = 'site-assets');

drop policy if exists site_assets_manage_all on storage.objects;
create policy site_assets_manage_all on storage.objects
  for all
  using (bucket_id = 'site-assets' and (select public.has_permission('cms.manage')))
  with check (bucket_id = 'site-assets' and (select public.has_permission('cms.manage')));

-- program-images: public read is unchanged; writes need programs.manage.
drop policy if exists program_images_admin_all on storage.objects;
create policy program_images_manage_all on storage.objects
  for all
  using (bucket_id = 'program-images' and (select public.has_permission('programs.manage')))
  with check (bucket_id = 'program-images' and (select public.has_permission('programs.manage')));

-- documents: the owner policy (documents_owner_all) stays untouched.
-- Replace documents_admin_all (which also covered the certificates bucket)
-- with read for people.view and full access for students.manage/staff.manage.
drop policy if exists documents_admin_all on storage.objects;

create policy documents_admin_read on storage.objects
  for select using (
    bucket_id = 'documents' and (
      (select public.has_permission('people.view'))
      or (select public.has_permission('students.manage'))
      or (select public.has_permission('staff.manage'))
    )
  );

create policy documents_admin_write on storage.objects
  for all
  using (
    bucket_id = 'documents' and (
      (select public.has_permission('students.manage')) or (select public.has_permission('staff.manage'))
    )
  )
  with check (
    bucket_id = 'documents' and (
      (select public.has_permission('students.manage')) or (select public.has_permission('staff.manage'))
    )
  );

-- certificates bucket: public read (certificates_public_read) is unchanged;
-- writes need certificates.manage.
drop policy if exists certificates_manage_all on storage.objects;
create policy certificates_manage_all on storage.objects
  for all
  using (bucket_id = 'certificates' and (select public.has_permission('certificates.manage')))
  with check (bucket_id = 'certificates' and (select public.has_permission('certificates.manage')));

-- avatars: unchanged (avatars_owner_all, avatars_public_read).

-- ──────────────────────────── 9. Realtime ───────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'role_permissions'
  ) then
    alter publication supabase_realtime add table public.role_permissions;
  end if;
end $$;
