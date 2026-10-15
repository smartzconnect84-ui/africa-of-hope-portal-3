-- Academic planning, enrolment, delivery and completion extensions.
-- Additive and idempotent: this migration extends the existing programme catalogue,
-- scheduled cohorts and approved cohort_students roster without replacing them.
-- Do not run against production without reviewing the current live schema first.

-- ───────────────────────── Permission catalogue ─────────────────────────

insert into public.permissions (key, grp, label, description, sort) values
  ('courses.enroll', 'Academics', 'Plan own courses', 'Check conflicts and submit course enrolment plans.', 51),
  ('academic_plans.manage', 'Academics', 'Create academic plans', 'Create course plans and official class sessions for assigned cohorts.', 52),
  ('academic_plans.approve', 'Academics', 'Approve academic plans', 'Review course enrolments, plans, lessons and sessions.', 53),
  ('lessons.manage', 'Academics', 'Manage lessons', 'Create chapters, modules and topics for assigned cohorts.', 54),
  ('materials.manage', 'Academics', 'Manage training materials', 'Submit private learning resources for assigned cohorts.', 55),
  ('materials.approve', 'Academics', 'Approve training materials', 'Review learning resources before students can access them.', 56)
on conflict (key) do update set
  grp = excluded.grp, label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.role_permissions (role, permission) values
  ('School Admin', 'academic_plans.approve'),
  ('School Admin', 'materials.approve'),
  ('Registrar', 'academic_plans.approve'),
  ('Registrar', 'materials.approve'),
  ('Teacher', 'lessons.manage'),
  ('Teacher', 'academic_plans.manage'),
  ('Teacher', 'materials.manage'),
  ('Student', 'courses.enroll')
on conflict do nothing;

-- ───────────────────── Existing table extensions ────────────────────────

alter table public.programs
  add column if not exists is_active boolean not null default true,
  add column if not exists completion_pass_mark numeric not null default 50,
  add column if not exists required_attendance_percent numeric not null default 75;

alter table public.cohorts
  add column if not exists capacity integer,
  add column if not exists enrollment_opens_at timestamptz,
  add column if not exists enrollment_closes_at timestamptz,
  add column if not exists enrollment_status text not null default 'open';

alter table public.cohort_students
  add column if not exists enrolled_at timestamptz not null default now(),
  add column if not exists enrollment_source text not null default 'manual',
  add column if not exists active boolean not null default true,
  add column if not exists completed_at timestamptz;

create or replace function public.is_cohort_member(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.cohort_students
    where cohort_id = c and student_id = auth.uid() and active
  );
$fn$;

alter table public.attendance
  add column if not exists class_session_id uuid;

alter table public.assignments
  add column if not exists learning_unit_id uuid,
  add column if not exists time_limit_minutes integer,
  add column if not exists grade_weight numeric not null default 0;

alter table public.quizzes
  add column if not exists learning_unit_id uuid,
  add column if not exists grade_weight numeric not null default 0;

alter table public.announcements
  add column if not exists audience text not null default 'all',
  add column if not exists status text not null default 'published',
  add column if not exists scheduled_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists published_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'programs_completion_pass_mark_check' and conrelid = 'public.programs'::regclass) then
    alter table public.programs add constraint programs_completion_pass_mark_check check (completion_pass_mark between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'programs_required_attendance_check' and conrelid = 'public.programs'::regclass) then
    alter table public.programs add constraint programs_required_attendance_check check (required_attendance_percent between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cohorts_capacity_check' and conrelid = 'public.cohorts'::regclass) then
    alter table public.cohorts add constraint cohorts_capacity_check check (capacity is null or capacity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cohorts_enrollment_status_check' and conrelid = 'public.cohorts'::regclass) then
    alter table public.cohorts add constraint cohorts_enrollment_status_check check (enrollment_status in ('draft', 'open', 'closed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cohorts_enrollment_window_check' and conrelid = 'public.cohorts'::regclass) then
    alter table public.cohorts add constraint cohorts_enrollment_window_check check (enrollment_closes_at is null or enrollment_opens_at is null or enrollment_closes_at > enrollment_opens_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignments_time_limit_minutes_check' and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments add constraint assignments_time_limit_minutes_check check (time_limit_minutes is null or time_limit_minutes between 1 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignments_grade_weight_check' and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments add constraint assignments_grade_weight_check check (grade_weight between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quizzes_grade_weight_check' and conrelid = 'public.quizzes'::regclass) then
    alter table public.quizzes add constraint quizzes_grade_weight_check check (grade_weight between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'announcements_status_check' and conrelid = 'public.announcements'::regclass) then
    alter table public.announcements add constraint announcements_status_check check (status in ('draft', 'scheduled', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'announcements_schedule_window_check' and conrelid = 'public.announcements'::regclass) then
    alter table public.announcements add constraint announcements_schedule_window_check check (expires_at is null or scheduled_at is null or expires_at > scheduled_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'announcements_audience_check' and conrelid = 'public.announcements'::regclass) then
    alter table public.announcements add constraint announcements_audience_check check (audience in ('public', 'all', 'students', 'teachers'));
  end if;
end $$;

-- ───────────────────────── Academic planning tables ─────────────────────

create table if not exists public.learning_units (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  course_plan_id uuid,
  title text not null check (length(btrim(title)) between 1 and 250),
  summary text not null default '',
  unit_type text not null default 'topic' check (unit_type in ('chapter', 'module', 'topic')),
  position integer not null default 0 check (position >= 0),
  available_from timestamptz,
  due_at timestamptz,
  quiz_id uuid,
  classwork_assignment_id uuid,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'revision_requested')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  revision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_units_window_check check (due_at is null or available_from is null or due_at > available_from)
);

create table if not exists public.teacher_course_plans (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 250),
  term_label text not null default '',
  overview text not null default '',
  objectives text[] not null default '{}'::text[],
  training_plan text not null default '',
  plan jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'revision_requested')),
  submitted_at timestamptz,
  approved_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  revision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  learning_unit_id uuid references public.learning_units(id) on delete set null,
  course_plan_id uuid references public.teacher_course_plans(id) on delete set null,
  teacher_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  title text not null check (length(btrim(title)) between 1 and 250),
  session_date date not null,
  starts_at time not null,
  ends_at time not null,
  room text not null default '',
  attendance_required boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'revision_requested', 'cancelled', 'completed')),
  notes text not null default '',
  submitted_at timestamptz,
  approved_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  revision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_window_check check (ends_at > starts_at)
);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected', 'revision_requested', 'cancelled', 'active', 'completed', 'withdrawn')),
  workload jsonb not null default '{}'::jsonb,
  conflict_warnings jsonb not null default '[]'::jsonb,
  workload_warnings jsonb not null default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  progress_percent numeric not null default 0 check (progress_percent between 0 and 100),
  completion_status text not null default 'not_started',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  revision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, student_id)
);

create table if not exists public.training_materials (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  learning_unit_id uuid references public.learning_units(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 250),
  description text not null default '',
  material_type text not null default 'document',
  file_path text,
  external_url text,
  mime_type text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'revision_requested')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  submitted_at timestamptz,
  approved_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  revision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_materials_location_check check (file_path is not null or external_url is not null),
  constraint training_materials_url_check check (external_url is null or external_url ~* '^https://')
);

create table if not exists public.student_learning_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  learning_unit_id uuid not null references public.learning_units(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  progress_percent numeric not null default 0 check (progress_percent between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, cohort_id, learning_unit_id)
);

create table if not exists public.course_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress', 'eligible', 'completed', 'not_completed')),
  course_grade numeric check (course_grade is null or course_grade between 0 and 100),
  attendance_percent numeric check (attendance_percent is null or attendance_percent between 0 and 100),
  completed_at timestamptz,
  issued_by uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (student_id, cohort_id)
);

create table if not exists public.approval_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('enrollment', 'course_plan', 'class_session', 'learning_unit', 'training_material')),
  entity_id uuid not null,
  action text not null check (action in ('draft', 'submitted', 'approved', 'rejected', 'revision_requested', 'cancelled', 'completed', 'active', 'withdrawn')),
  actor_id uuid references public.profiles(id) on delete set null,
  note text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null check (length(btrim(title)) between 1 and 250),
  body text not null default '',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Foreign keys are added after the target tables exist so assignments/quizzes can
-- retain their optional lesson links without circular table creation.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_class_session_fkey' and conrelid = 'public.attendance'::regclass) then
    alter table public.attendance add constraint attendance_class_session_fkey foreign key (class_session_id) references public.class_sessions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignments_learning_unit_fkey' and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments add constraint assignments_learning_unit_fkey foreign key (learning_unit_id) references public.learning_units(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quizzes_learning_unit_fkey' and conrelid = 'public.quizzes'::regclass) then
    alter table public.quizzes add constraint quizzes_learning_unit_fkey foreign key (learning_unit_id) references public.learning_units(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'learning_units_quiz_fkey' and conrelid = 'public.learning_units'::regclass) then
    alter table public.learning_units add constraint learning_units_quiz_fkey foreign key (quiz_id) references public.quizzes(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'learning_units_classwork_assignment_fkey' and conrelid = 'public.learning_units'::regclass) then
    alter table public.learning_units add constraint learning_units_classwork_assignment_fkey foreign key (classwork_assignment_id) references public.assignments(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'learning_units_course_plan_fkey' and conrelid = 'public.learning_units'::regclass) then
    alter table public.learning_units add constraint learning_units_course_plan_fkey foreign key (course_plan_id) references public.teacher_course_plans(id) on delete set null;
  end if;
end $$;

create index if not exists course_enrollments_student_status_idx on public.course_enrollments(student_id, status);
create index if not exists course_enrollments_cohort_status_idx on public.course_enrollments(cohort_id, status);
create index if not exists learning_units_cohort_position_idx on public.learning_units(cohort_id, position);
create index if not exists learning_units_program_position_idx on public.learning_units(program_id, position);
create index if not exists teacher_course_plans_cohort_status_idx on public.teacher_course_plans(cohort_id, status);
create index if not exists class_sessions_cohort_starts_at_idx on public.class_sessions(cohort_id, starts_at);
create index if not exists class_sessions_teacher_starts_at_idx on public.class_sessions(teacher_id, starts_at);
create index if not exists training_materials_cohort_status_idx on public.training_materials(cohort_id, status);
create unique index if not exists training_materials_file_path_key on public.training_materials(file_path) where file_path is not null;
create index if not exists student_learning_progress_student_cohort_idx on public.student_learning_progress(student_id, cohort_id);
create index if not exists course_completions_student_idx on public.course_completions(student_id, status);
create index if not exists approval_events_entity_idx on public.approval_events(entity_type, entity_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;
create index if not exists announcements_visibility_idx on public.announcements(status, scheduled_at, expires_at);

-- ───────────────────────────── Helper functions ─────────────────────────

create or replace function public.is_academic_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.has_permission('academic_plans.approve');
$fn$;

create or replace function public.can_manage_learning_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.learning_units u
    where u.id = p_unit_id
      and (
        public.has_permission('academic_plans.approve')
        or (public.has_permission('lessons.manage') and u.cohort_id is not null and public.is_cohort_teacher(u.cohort_id))
        or u.created_by = auth.uid()
      )
  );
$fn$;

create or replace function public.can_manage_cohort_plan(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.has_permission('academic_plans.approve')
    or (public.has_permission('academic_plans.manage') and public.is_cohort_teacher(p_cohort_id));
$fn$;

create or replace function public.announcement_visible_to_me(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.announcements a
    left join public.profiles p on p.id = auth.uid()
    where a.id = p_announcement_id
      and a.status in ('published', 'scheduled')
      and coalesce(a.scheduled_at, a.published_date::timestamptz, now()) <= now()
      and (a.expires_at is null or a.expires_at > now())
      and (
        a.audience = 'public'
        or (a.audience = 'all' and p.id is not null)
        or (a.audience = 'students' and p.id is not null and p.role = 'Student')
        or (a.audience = 'teachers' and p.id is not null and p.role = 'Teacher')
      )
  );
$fn$;

-- Linked quizzes become visible only with their approved lesson and only to
-- active members of that lesson's cohort. Standalone quizzes keep the existing
-- program/cohort visibility behavior.
create or replace function public.quiz_visible_to_me(q uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.quizzes qz
    where qz.id = q
      and qz.status = 'published'
      and (
        (qz.learning_unit_id is not null and exists (
          select 1
          from public.learning_units u
          join public.cohort_students cs on cs.cohort_id = u.cohort_id
          where u.id = qz.learning_unit_id and u.status = 'approved'
            and cs.student_id = auth.uid() and cs.active
        ))
        or (qz.learning_unit_id is null and qz.cohort_id is not null and exists (
          select 1 from public.cohort_students cs
          where cs.cohort_id = qz.cohort_id and cs.student_id = auth.uid() and cs.active
        ))
        or (qz.learning_unit_id is null and qz.program_id is not null and exists (
          select 1 from public.profiles p where p.id = auth.uid() and qz.program_id = any(p.program_ids)
        ))
        or (qz.learning_unit_id is null and qz.program_id is not null and exists (
          select 1 from public.cohort_students cs
          join public.cohorts c on c.id = cs.cohort_id
          where cs.student_id = auth.uid() and cs.active and c.program_id = qz.program_id
        ))
      )
  );
$fn$;

-- Returns current conflict and workload warnings without making a change. It is
-- intentionally internal; the public preview RPC below calls it for auth.uid().
drop function if exists public._course_enrollment_preview(uuid, uuid);
create or replace function public._course_enrollment_preview(p_student_id uuid, p_cohort_id uuid, p_check_window boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c record;
  roster_count integer := 0;
  active_count integer := 0;
  weekly_hours numeric := 0;
  warnings jsonb := '[]'::jsonb;
  schedule_conflicts jsonb := '[]'::jsonb;
begin
  select c0.*, p.title as program_title into c
  from public.cohorts c0
  join public.programs p on p.id = c0.program_id
  where c0.id = p_cohort_id;

  if c.id is null then
    raise exception 'cohort_not_found' using errcode = 'P0002';
  end if;

  select count(*) into roster_count
  from public.cohort_students cs
  where cs.cohort_id = p_cohort_id and cs.active;

  select count(*) into active_count
  from public.cohort_students cs
  where cs.student_id = p_student_id and cs.active;

  if c.enrollment_status = 'cancelled' then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'course_cancelled', 'blocking', true, 'message', 'This course offering was cancelled.'));
  elsif p_check_window and c.enrollment_status <> 'open' then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'enrollment_closed', 'blocking', true, 'message', 'This course offering is not open for enrolment.'));
  end if;
  if p_check_window and c.enrollment_opens_at is not null and c.enrollment_opens_at > now() then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'enrollment_not_open', 'blocking', true, 'message', 'Enrolment has not opened yet.'));
  end if;
  if p_check_window and c.enrollment_closes_at is not null and c.enrollment_closes_at <= now() then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'enrollment_closed', 'blocking', true, 'message', 'The enrolment deadline has passed.'));
  end if;
  if c.capacity is not null and roster_count >= c.capacity then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'capacity_reached', 'blocking', true, 'message', 'This course offering has reached its capacity.'));
  end if;
  if exists (select 1 from public.cohort_students cs where cs.cohort_id = p_cohort_id and cs.student_id = p_student_id and cs.active) then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code', 'already_enrolled', 'blocking', true, 'message', 'You are already on the approved roster for this course offering.'));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', 'schedule_conflict', 'blocking', true,
    'message', 'An official class session overlaps with an approved course offering.',
    'target_session_id', target_session.id, 'existing_session_id', existing_session.id
  )), '[]'::jsonb) into schedule_conflicts
  from public.class_sessions target_session
  join public.class_sessions existing_session
    on existing_session.id <> target_session.id
   and existing_session.status = 'approved'
   and existing_session.session_date = target_session.session_date
   and target_session.starts_at < existing_session.ends_at
   and target_session.ends_at > existing_session.starts_at
  join public.cohort_students cs on cs.cohort_id = existing_session.cohort_id
    and cs.student_id = p_student_id and cs.active
  where target_session.cohort_id = p_cohort_id
    and target_session.status = 'approved';
  warnings := warnings || schedule_conflicts;

  if active_count >= 3 then
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'high_workload', 'blocking', false,
      'message', format('You are already enrolled in %s active course offerings.', active_count),
      'active_course_count', active_count
    ));
  end if;

  select coalesce(round(sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0), 2), 0)
    into weekly_hours
  from public.class_sessions s
  where s.cohort_id = p_cohort_id
    and s.status = 'approved'
    and s.session_date >= current_date
    and s.session_date < current_date + 7;

  return jsonb_build_object(
    'cohort_id', c.id,
    'program_id', c.program_id,
    'program_title', c.program_title,
    'capacity', c.capacity,
    'approved_roster_count', roster_count,
    'active_course_count', active_count,
    'allowed', not exists (select 1 from jsonb_array_elements(warnings) w where coalesce((w ->> 'blocking')::boolean, false)),
    'conflicts', coalesce((select jsonb_agg(w ->> 'message') from jsonb_array_elements(warnings) w where coalesce((w ->> 'blocking')::boolean, false)), '[]'::jsonb),
    'warnings', coalesce((select jsonb_agg(w ->> 'message') from jsonb_array_elements(warnings) w where not coalesce((w ->> 'blocking')::boolean, false)), '[]'::jsonb),
    'weekly_hours', weekly_hours
  );
end;
$fn$;

create or replace function public.course_grade_summary(p_student_id uuid, p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  can_view boolean;
  result jsonb;
begin
  can_view := p_student_id = auth.uid()
    or (public.is_cohort_teacher(p_cohort_id) and exists (
      select 1 from public.cohort_students
      where cohort_id = p_cohort_id and student_id = p_student_id and active
    ))
    or public.has_permission('academic_plans.approve')
    or public.has_permission('assignments.manage');
  if not can_view then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  with components as (
    select
      'assignment'::text as component_type,
      a.id as component_id,
      a.title,
      a.grade_weight,
      case when s.marks is null or a.max_marks <= 0 then null else round(s.marks / a.max_marks * 100, 2) end as percent
    from public.learning_units u
    join public.assignments a on a.id = u.classwork_assignment_id
    left join public.submissions s on s.assignment_id = a.id and s.student_id = p_student_id
    where u.status = 'approved'
      and (u.cohort_id = p_cohort_id or (u.cohort_id is null and exists (
        select 1 from public.cohorts c where c.id = p_cohort_id and c.program_id = u.program_id
      )))
      and a.cohort_id = p_cohort_id
      and a.grade_weight > 0

    union all

    select
      'quiz'::text as component_type,
      q.id as component_id,
      q.title,
      q.grade_weight,
      max(qa.percent) filter (where qa.status in ('submitted', 'auto_submitted')) as percent
    from public.learning_units u
    join public.quizzes q on q.id = u.quiz_id
    left join public.quiz_attempts qa on qa.quiz_id = q.id and qa.student_id = p_student_id
    where u.status = 'approved'
      and (u.cohort_id = p_cohort_id or (u.cohort_id is null and exists (
        select 1 from public.cohorts c where c.id = p_cohort_id and c.program_id = u.program_id
      )))
      and (q.cohort_id = p_cohort_id or (q.cohort_id is null and q.program_id = (select program_id from public.cohorts where id = p_cohort_id)))
      and q.grade_weight > 0
    group by q.id, q.title, q.grade_weight
  ), summary as (
    select
      coalesce(sum(grade_weight), 0) as total_weight,
      coalesce(sum(grade_weight) filter (where percent is not null), 0) as assessed_weight,
      case when coalesce(sum(grade_weight), 0) = 0 then null
        else round(sum(grade_weight * coalesce(percent, 0)) / sum(grade_weight), 2)
      end as course_grade,
      coalesce(jsonb_agg(jsonb_build_object(
        'type', component_type, 'id', component_id, 'title', title,
        'grade_weight', grade_weight, 'percent', percent
      ) order by component_type, title), '[]'::jsonb) as components
    from components
  )
  select jsonb_build_object(
    'student_id', p_student_id,
    'cohort_id', p_cohort_id,
    'course_grade', course_grade,
    'total_weight', total_weight,
    'assessed_weight', assessed_weight,
    'components', components
  ) into result from summary;

  return result;
end;
$fn$;

-- ─────────────────────── Validation and audit triggers ──────────────────

create or replace function public._touch_academic_row()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- Frontend drafts created before the submit RPC used `pending`; normalize that
-- compatibility value into the canonical submitted workflow state.
create or replace function public._normalize_training_material_status()
returns trigger
language plpgsql
as $fn$
begin
  if new.status = 'pending' then new.status := 'submitted'; end if;
  return new;
end;
$fn$;

create or replace function public._validate_learning_unit_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  assignment_cohort uuid;
  assignment_weight numeric;
  quiz_found uuid;
  quiz_cohort uuid;
  quiz_program uuid;
  quiz_weight numeric;
  quiz_status text;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  if new.cohort_id is null then
    raise exception 'approved_learning_unit_requires_cohort' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.cohorts c where c.id = new.cohort_id and c.program_id = new.program_id
  ) then
    raise exception 'learning_unit_cohort_program_mismatch' using errcode = 'P0001';
  end if;
  if new.quiz_id is null or new.classwork_assignment_id is null then
    raise exception 'approved_learning_unit_requires_quiz_and_classwork' using errcode = 'P0001';
  end if;

  select cohort_id, grade_weight into assignment_cohort, assignment_weight
  from public.assignments where id = new.classwork_assignment_id;
  select id, cohort_id, program_id, grade_weight, status into quiz_found, quiz_cohort, quiz_program, quiz_weight, quiz_status
  from public.quizzes where id = new.quiz_id;

  if assignment_cohort is null or quiz_found is null then
    raise exception 'approved_learning_unit_components_not_found' using errcode = 'P0002';
  end if;
  if assignment_weight <= 0 or quiz_weight <= 0 then
    raise exception 'approved_learning_unit_components_require_grade_weight' using errcode = 'P0001';
  end if;
  if quiz_status <> 'published' then
    raise exception 'approved_learning_unit_requires_published_quiz' using errcode = 'P0001';
  end if;
  if assignment_cohort <> new.cohort_id then
    raise exception 'learning_unit_assignment_cohort_mismatch' using errcode = 'P0001';
  end if;
  if quiz_cohort is not null and quiz_cohort <> new.cohort_id then
    raise exception 'learning_unit_quiz_cohort_mismatch' using errcode = 'P0001';
  end if;
  if quiz_cohort is null and quiz_program <> new.program_id then
    raise exception 'learning_unit_quiz_program_mismatch' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

create or replace function public._validate_learning_unit_component()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  u record;
begin
  if tg_table_name = 'assignments' and new.learning_unit_id is not null then
    select * into u from public.learning_units where id = new.learning_unit_id;
    if u.id is null then raise exception 'learning_unit_not_found' using errcode = 'P0002'; end if;
    if u.cohort_id is not null and new.cohort_id <> u.cohort_id then
      raise exception 'learning_unit_assignment_cohort_mismatch' using errcode = 'P0001';
    end if;
    if u.status = 'approved' and new.grade_weight <= 0 then
      raise exception 'approved_learning_unit_components_require_grade_weight' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'quizzes' and new.learning_unit_id is not null then
    select * into u from public.learning_units where id = new.learning_unit_id;
    if u.id is null then raise exception 'learning_unit_not_found' using errcode = 'P0002'; end if;
    if u.cohort_id is not null and new.cohort_id is not null and new.cohort_id <> u.cohort_id then
      raise exception 'learning_unit_quiz_cohort_mismatch' using errcode = 'P0001';
    end if;
    if new.cohort_id is null and new.program_id <> u.program_id then
      raise exception 'learning_unit_quiz_program_mismatch' using errcode = 'P0001';
    end if;
    if u.status = 'approved' and new.grade_weight <= 0 then
      raise exception 'approved_learning_unit_components_require_grade_weight' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$fn$;

create or replace function public._validate_class_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.profiles p where p.id = new.teacher_id and p.role = 'Teacher' and p.status = 'Active'
  ) then
    raise exception 'active_teacher_required' using errcode = 'P0001';
  end if;
  if new.status in ('cancelled', 'rejected') then
    return new;
  end if;
  if exists (
    select 1 from public.class_sessions s
    where s.id <> coalesce(new.id, gen_random_uuid())
      and s.status = 'approved'
      and s.session_date = new.session_date
      and new.starts_at < s.ends_at and new.ends_at > s.starts_at
      and (s.teacher_id = new.teacher_id or s.cohort_id = new.cohort_id)
  ) then
    raise exception 'class_session_schedule_conflict' using errcode = 'P0001';
  end if;
  if new.learning_unit_id is not null and not exists (
    select 1 from public.learning_units u
    where u.id = new.learning_unit_id and (u.cohort_id is null or u.cohort_id = new.cohort_id)
  ) then
    raise exception 'class_session_learning_unit_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

create or replace function public._record_approval_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  entity_kind text := tg_argv[0];
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.approval_events (entity_type, entity_id, action, actor_id, note, snapshot)
    values (entity_kind, new.id, new.status, auth.uid(), coalesce(new.revision_note, ''), to_jsonb(new));
  end if;
  return new;
end;
$fn$;

create or replace function public._approved_enrollment_to_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    insert into public.cohort_students (cohort_id, student_id, enrolled_at, enrollment_source, active)
    values (new.cohort_id, new.student_id, now(), 'course_enrollment', true)
    on conflict (cohort_id, student_id) do update
      set active = true, enrolled_at = excluded.enrolled_at,
          enrollment_source = excluded.enrollment_source, completed_at = null;
  end if;
  return new;
end;
$fn$;

create or replace function public._notify_academic_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  entity_kind text := tg_argv[0];
  recipient uuid;
begin
  if not (tg_op = 'INSERT' or new.status is distinct from old.status) then
    return new;
  end if;
  if new.status = 'submitted' then
    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    select p.id, 'approval_submission', 'Academic item submitted for review',
      'A ' || replace(entity_kind, '_', ' ') || ' is ready for review.', entity_kind, new.id
    from public.profiles p
    where p.status = 'Active'
      and (p.role = 'Super Admin' or exists (
        select 1 from public.role_permissions rp
        where rp.role = p.role
          and rp.permission = case when entity_kind = 'training_material' then 'materials.approve' else 'academic_plans.approve' end
      ));
  elsif new.status in ('approved', 'rejected', 'revision_requested') then
    recipient := case entity_kind
      when 'enrollment' then nullif(to_jsonb(new) ->> 'student_id', '')::uuid
      when 'course_plan' then nullif(to_jsonb(new) ->> 'teacher_id', '')::uuid
      when 'class_session' then nullif(to_jsonb(new) ->> 'teacher_id', '')::uuid
      else nullif(to_jsonb(new) ->> 'created_by', '')::uuid
    end;
    if recipient is not null then
      insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
      values (
        recipient, 'approval_decision', 'Academic item ' || replace(new.status, '_', ' '),
        coalesce(nullif(new.revision_note, ''), 'Your ' || replace(entity_kind, '_', ' ') || ' was ' || replace(new.status, '_', ' ') || '.'),
        entity_kind, new.id
      );
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists learning_units_touch on public.learning_units;
create trigger learning_units_touch before update on public.learning_units for each row execute function public._touch_academic_row();
drop trigger if exists teacher_course_plans_touch on public.teacher_course_plans;
create trigger teacher_course_plans_touch before update on public.teacher_course_plans for each row execute function public._touch_academic_row();
drop trigger if exists class_sessions_touch on public.class_sessions;
create trigger class_sessions_touch before update on public.class_sessions for each row execute function public._touch_academic_row();
drop trigger if exists course_enrollments_touch on public.course_enrollments;
create trigger course_enrollments_touch before update on public.course_enrollments for each row execute function public._touch_academic_row();
drop trigger if exists training_materials_touch on public.training_materials;
create trigger training_materials_touch before update on public.training_materials for each row execute function public._touch_academic_row();
drop trigger if exists training_materials_normalize_status on public.training_materials;
create trigger training_materials_normalize_status before insert or update of status on public.training_materials for each row execute function public._normalize_training_material_status();
drop trigger if exists student_learning_progress_touch on public.student_learning_progress;
create trigger student_learning_progress_touch before update on public.student_learning_progress for each row execute function public._touch_academic_row();
drop trigger if exists course_completions_touch on public.course_completions;
create trigger course_completions_touch before update on public.course_completions for each row execute function public._touch_academic_row();

drop trigger if exists learning_units_validate_approval on public.learning_units;
create trigger learning_units_validate_approval before insert or update on public.learning_units for each row execute function public._validate_learning_unit_approval();
drop trigger if exists assignments_validate_learning_unit on public.assignments;
create trigger assignments_validate_learning_unit before insert or update on public.assignments for each row execute function public._validate_learning_unit_component();
drop trigger if exists quizzes_validate_learning_unit on public.quizzes;
create trigger quizzes_validate_learning_unit before insert or update on public.quizzes for each row execute function public._validate_learning_unit_component();
drop trigger if exists class_sessions_validate on public.class_sessions;
create trigger class_sessions_validate before insert or update on public.class_sessions for each row execute function public._validate_class_session();

drop trigger if exists course_enrollments_audit on public.course_enrollments;
create trigger course_enrollments_audit after insert or update of status on public.course_enrollments for each row execute function public._record_approval_event('enrollment');
drop trigger if exists teacher_course_plans_audit on public.teacher_course_plans;
create trigger teacher_course_plans_audit after insert or update of status on public.teacher_course_plans for each row execute function public._record_approval_event('course_plan');
drop trigger if exists learning_units_audit on public.learning_units;
create trigger learning_units_audit after insert or update of status on public.learning_units for each row execute function public._record_approval_event('learning_unit');
drop trigger if exists class_sessions_audit on public.class_sessions;
create trigger class_sessions_audit after insert or update of status on public.class_sessions for each row execute function public._record_approval_event('class_session');
drop trigger if exists training_materials_audit on public.training_materials;
create trigger training_materials_audit after insert or update of status on public.training_materials for each row execute function public._record_approval_event('training_material');
drop trigger if exists course_enrollments_roster on public.course_enrollments;
create trigger course_enrollments_roster after insert or update of status on public.course_enrollments for each row execute function public._approved_enrollment_to_roster();
drop trigger if exists course_enrollments_notify on public.course_enrollments;
create trigger course_enrollments_notify after insert or update of status on public.course_enrollments for each row execute function public._notify_academic_status('enrollment');
drop trigger if exists teacher_course_plans_notify on public.teacher_course_plans;
create trigger teacher_course_plans_notify after insert or update of status on public.teacher_course_plans for each row execute function public._notify_academic_status('course_plan');
drop trigger if exists class_sessions_notify on public.class_sessions;
create trigger class_sessions_notify after insert or update of status on public.class_sessions for each row execute function public._notify_academic_status('class_session');
drop trigger if exists learning_units_notify on public.learning_units;
create trigger learning_units_notify after insert or update of status on public.learning_units for each row execute function public._notify_academic_status('learning_unit');
drop trigger if exists training_materials_notify on public.training_materials;
create trigger training_materials_notify after insert or update of status on public.training_materials for each row execute function public._notify_academic_status('training_material');

-- ───────────────────────────── Public RPCs ──────────────────────────────

create or replace function public.preview_course_enrollment(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.has_permission('courses.enroll') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'Student' and status = 'Active') then
    raise exception 'active_student_required' using errcode = 'P0001';
  end if;
  return public._course_enrollment_preview(auth.uid(), p_cohort_id);
end;
$fn$;

create or replace function public.submit_course_enrollment(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  preview jsonb;
  enrollment public.course_enrollments%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.has_permission('courses.enroll') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'Student' and status = 'Active') then
    raise exception 'active_student_required' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('student:' || auth.uid()::text)::bigint);

  select * into enrollment from public.course_enrollments
  where cohort_id = p_cohort_id and student_id = auth.uid() for update;

  if enrollment.id is not null and enrollment.status = 'approved' then
    return jsonb_build_object('allowed', true, 'conflicts', '[]'::jsonb, 'warnings', '[]'::jsonb,
      'weekly_hours', coalesce((enrollment.workload ->> 'weekly_hours')::numeric, 0),
      'enrollment_id', enrollment.id, 'status', enrollment.status, 'already_approved', true);
  end if;
  if enrollment.id is not null and enrollment.status not in ('draft', 'rejected', 'revision_requested') then
    raise exception 'enrollment_not_submittable' using errcode = 'P0001';
  end if;

  preview := public._course_enrollment_preview(auth.uid(), p_cohort_id);
  if not (preview ->> 'allowed')::boolean then
    raise exception 'enrollment_not_allowed' using errcode = 'P0001', detail = preview::text;
  end if;

  if enrollment.id is null then
    insert into public.course_enrollments (cohort_id, student_id, status, workload, conflict_warnings, workload_warnings, submitted_at)
    values (
      p_cohort_id, auth.uid(), 'submitted',
      jsonb_build_object('active_course_count', preview -> 'active_course_count', 'weekly_hours', preview -> 'weekly_hours'),
      preview -> 'conflicts', preview -> 'warnings', now()
    )
    returning * into enrollment;
  else
    update public.course_enrollments
      set status = 'submitted',
          workload = jsonb_build_object('active_course_count', preview -> 'active_course_count', 'weekly_hours', preview -> 'weekly_hours'),
          conflict_warnings = preview -> 'conflicts', workload_warnings = preview -> 'warnings', submitted_at = now(),
          reviewed_at = null, reviewed_by = null, revision_note = ''
      where id = enrollment.id
      returning * into enrollment;
  end if;

  return preview || jsonb_build_object('enrollment_id', enrollment.id, 'status', enrollment.status);
end;
$fn$;

create or replace function public.submit_academic_item(p_entity_type text, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_entity_type = 'course_plan' then
    update public.teacher_course_plans set status = 'submitted', submitted_at = now(), revision_note = null
      where id = p_entity_id and teacher_id = auth.uid() and status in ('draft', 'revision_requested')
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  elsif p_entity_type = 'class_session' then
    update public.class_sessions set status = 'submitted', submitted_at = now(), revision_note = null
      where id = p_entity_id and teacher_id = auth.uid() and status in ('draft', 'revision_requested')
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  elsif p_entity_type = 'learning_unit' then
    update public.learning_units set status = 'submitted', submitted_at = now(), revision_note = null
      where id = p_entity_id and created_by = auth.uid() and status in ('draft', 'revision_requested')
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  elsif p_entity_type = 'training_material' then
    update public.training_materials set status = 'submitted', submitted_at = now(), revision_note = null
      where id = p_entity_id and created_by = auth.uid() and status in ('draft', 'revision_requested')
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  else
    raise exception 'unsupported_entity_type' using errcode = 'P0001';
  end if;
  if result is null then raise exception 'not_found_or_not_submittable' using errcode = 'P0002'; end if;
  return result;
end;
$fn$;

create or replace function public.create_academic_lesson_bundle(
  p_program_id uuid,
  p_cohort_id uuid,
  p_course_plan_id uuid,
  p_title text,
  p_summary text,
  p_unit_type text,
  p_position integer,
  p_due_at timestamptz,
  p_classwork_minutes integer,
  p_classwork_weight numeric,
  p_quiz_minutes integer,
  p_quiz_weight numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  unit public.learning_units%rowtype;
  v_assignment_id uuid;
  v_quiz_id uuid;
begin
  if auth.uid() is null
     or not public.has_permission('lessons.manage')
     or not public.is_cohort_teacher(p_cohort_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cohorts where id = p_cohort_id and program_id = p_program_id) then
    raise exception 'cohort_program_mismatch' using errcode = 'P0001';
  end if;
  if p_course_plan_id is not null and not exists (
    select 1 from public.teacher_course_plans
    where id = p_course_plan_id and cohort_id = p_cohort_id and teacher_id = auth.uid()
  ) then
    raise exception 'course_plan_scope_mismatch' using errcode = 'P0001';
  end if;
  if p_unit_type not in ('chapter', 'module', 'topic')
     or p_position < 1
     or p_classwork_minutes not between 1 and 1440
     or p_quiz_minutes not between 1 and 600
     or p_classwork_weight <= 0 or p_classwork_weight > 100
     or p_quiz_weight <= 0 or p_quiz_weight > 100 then
    raise exception 'invalid_lesson_assessment_settings' using errcode = 'P0001';
  end if;

  insert into public.learning_units (
    program_id, cohort_id, course_plan_id, title, summary, unit_type,
    position, due_at, status, created_by
  ) values (
    p_program_id, p_cohort_id, p_course_plan_id, btrim(p_title), coalesce(p_summary, ''), p_unit_type,
    p_position, p_due_at, 'draft', auth.uid()
  ) returning * into unit;

  insert into public.assignments (
    cohort_id, title, description, due_date, max_marks, learning_unit_id,
    time_limit_minutes, grade_weight
  ) values (
    p_cohort_id, btrim(p_title) || ' classwork', 'Classwork for ' || btrim(p_title),
    p_due_at::date, 100, unit.id, p_classwork_minutes, p_classwork_weight
  ) returning id into v_assignment_id;

  insert into public.quizzes (
    program_id, cohort_id, created_by, title, description, status,
    time_limit_minutes, max_attempts, pass_mark, learning_unit_id, grade_weight
  ) values (
    p_program_id, p_cohort_id, auth.uid(), btrim(p_title) || ' quiz',
    'Timed quiz for ' || btrim(p_title) || '. Add questions in Quiz Builder before publication.',
    'draft', p_quiz_minutes, 1, 50, unit.id, p_quiz_weight
  ) returning id into v_quiz_id;

  update public.learning_units
  set quiz_id = v_quiz_id, classwork_assignment_id = v_assignment_id
  where id = unit.id
  returning * into unit;

  return to_jsonb(unit);
end;
$fn$;

create or replace function public.review_academic_submission(
  p_entity_type text,
  p_entity_id uuid,
  p_decision text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  enrollment public.course_enrollments%rowtype;
  preview jsonb;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_entity_type not in ('enrollment', 'course_plan', 'class_session', 'learning_unit', 'training_material') then
    raise exception 'unsupported_entity_type' using errcode = 'P0001';
  end if;
  if p_decision not in ('approved', 'rejected', 'revision_requested') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision in ('rejected', 'revision_requested') and btrim(coalesce(p_note, '')) = '' then
    raise exception 'decision_note_required' using errcode = 'P0001';
  end if;
  if (p_entity_type = 'training_material' and not public.has_permission('materials.approve'))
     or (p_entity_type <> 'training_material' and not public.has_permission('academic_plans.approve')) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if p_entity_type = 'enrollment' then
    select student_id into enrollment.student_id from public.course_enrollments where id = p_entity_id;
    if enrollment.student_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    -- Match the submit path's lock order to avoid a row/advisory deadlock.
    perform pg_advisory_xact_lock(hashtext('student:' || enrollment.student_id::text)::bigint);
    select * into enrollment from public.course_enrollments where id = p_entity_id for update;
    if enrollment.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if enrollment.status <> 'submitted' then raise exception 'submission_not_pending_review' using errcode = 'P0001'; end if;

    -- Serialise approvals for both the student and cohort so capacity and
    -- cross-course timetable checks cannot race.
    perform 1 from public.cohorts where id = enrollment.cohort_id for update;
    preview := public._course_enrollment_preview(enrollment.student_id, enrollment.cohort_id, false);
    if p_decision = 'approved' and not (preview ->> 'allowed')::boolean then
      raise exception 'enrollment_conflict_detected' using errcode = 'P0001', detail = preview::text;
    end if;

    update public.course_enrollments
      set status = p_decision,
          workload = jsonb_build_object('active_course_count', preview -> 'active_course_count', 'weekly_hours', preview -> 'weekly_hours'),
          conflict_warnings = preview -> 'conflicts', workload_warnings = preview -> 'warnings', reviewed_at = now(),
          approved_at = case when p_decision = 'approved' then now() else null end,
          reviewed_by = auth.uid(), revision_note = btrim(coalesce(p_note, ''))
      where id = enrollment.id
      returning * into enrollment;
    return jsonb_build_object('entity_type', p_entity_type, 'entity_id', enrollment.id, 'status', enrollment.status, 'conflicts', enrollment.conflict_warnings, 'warnings', enrollment.workload_warnings);
  elsif p_entity_type = 'course_plan' then
    update public.teacher_course_plans set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
      approved_at = case when p_decision = 'approved' then now() else null end, revision_note = nullif(btrim(coalesce(p_note, '')), '')
      where id = p_entity_id and status = 'submitted'
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  elsif p_entity_type = 'class_session' then
    perform pg_advisory_xact_lock(hashtext('teacher:' || teacher_id::text)::bigint),
           pg_advisory_xact_lock(hashtext('cohort:' || cohort_id::text)::bigint)
    from public.class_sessions where id = p_entity_id;
    update public.class_sessions set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
      approved_at = case when p_decision = 'approved' then now() else null end, revision_note = nullif(btrim(coalesce(p_note, '')), '')
      where id = p_entity_id and status = 'submitted'
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  elsif p_entity_type = 'learning_unit' then
    update public.learning_units set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(), revision_note = nullif(btrim(coalesce(p_note, '')), '')
      where id = p_entity_id and status = 'submitted'
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  else
    update public.training_materials set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
      approved_at = case when p_decision = 'approved' then now() else null end, revision_note = nullif(btrim(coalesce(p_note, '')), '')
      where id = p_entity_id and status = 'submitted'
      returning jsonb_build_object('entity_type', p_entity_type, 'entity_id', id, 'status', status) into result;
  end if;
  if result is null then raise exception 'not_found_or_not_pending_review' using errcode = 'P0002'; end if;
  return result;
end;
$fn$;

revoke all on function public._course_enrollment_preview(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.course_grade_summary(uuid, uuid) from public, anon;
grant execute on function public.course_grade_summary(uuid, uuid) to authenticated;
revoke all on function public.preview_course_enrollment(uuid) from public, anon;
revoke all on function public.submit_course_enrollment(uuid) from public, anon;
revoke all on function public.submit_academic_item(text, uuid) from public, anon;
revoke all on function public.create_academic_lesson_bundle(uuid, uuid, uuid, text, text, text, integer, timestamptz, integer, numeric, integer, numeric) from public, anon;
revoke all on function public.review_academic_submission(text, uuid, text, text) from public, anon;
grant execute on function public.preview_course_enrollment(uuid) to authenticated;
grant execute on function public.submit_course_enrollment(uuid) to authenticated;
grant execute on function public.submit_academic_item(text, uuid) to authenticated;
grant execute on function public.create_academic_lesson_bundle(uuid, uuid, uuid, text, text, text, integer, timestamptz, integer, numeric, integer, numeric) to authenticated;
grant execute on function public.review_academic_submission(text, uuid, text, text) to authenticated;

drop view if exists public.academic_approval_queue;
create view public.academic_approval_queue
with (security_invoker = true)
as
  select 'enrollment'::text as entity_type, e.id as entity_id, c.name as title,
    coalesce(p.name, p.full_name, p.email, 'Student') as owner_name,
    coalesce(e.submitted_at, e.created_at) as submitted_at, e.status, e.revision_note,
    to_jsonb(e) || jsonb_build_object('cohort_name', c.name, 'student_name', coalesce(p.name, p.full_name, p.email)) as context
  from public.course_enrollments e join public.cohorts c on c.id = e.cohort_id
  left join public.profiles p on p.id = e.student_id
  where e.status = 'submitted'
  union all
  select 'course_plan', cp.id, cp.title, coalesce(p.name, p.full_name, p.email, 'Teacher'),
    coalesce(cp.submitted_at, cp.created_at), cp.status, cp.revision_note, to_jsonb(cp)
  from public.teacher_course_plans cp left join public.profiles p on p.id = cp.teacher_id where cp.status = 'submitted'
  union all
  select 'class_session', s.id, s.title, coalesce(p.name, p.full_name, p.email, 'Teacher'),
    coalesce(s.submitted_at, s.created_at), s.status, s.revision_note, to_jsonb(s)
  from public.class_sessions s left join public.profiles p on p.id = s.teacher_id where s.status = 'submitted'
  union all
  select 'learning_unit', u.id, u.title, coalesce(p.name, p.full_name, p.email, 'Teacher'),
    coalesce(u.submitted_at, u.created_at), u.status, u.revision_note, to_jsonb(u)
  from public.learning_units u left join public.profiles p on p.id = u.created_by where u.status = 'submitted'
  union all
  select 'training_material', m.id, m.title, coalesce(p.name, p.full_name, p.email, 'Teacher'),
    coalesce(m.submitted_at, m.created_at), m.status, m.revision_note, to_jsonb(m)
  from public.training_materials m left join public.profiles p on p.id = m.created_by where m.status = 'submitted';

revoke all on public.academic_approval_queue from public, anon;
grant select on public.academic_approval_queue to authenticated;

-- ──────────────────────────────── RLS ───────────────────────────────────

alter table public.learning_units enable row level security;
alter table public.teacher_course_plans enable row level security;
alter table public.class_sessions enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.training_materials enable row level security;
alter table public.student_learning_progress enable row level security;
alter table public.course_completions enable row level security;
alter table public.approval_events enable row level security;
alter table public.notifications enable row level security;

-- Linked classwork stays hidden and immutable until its lesson is approved.
drop policy if exists assignments_read on public.assignments;
drop policy if exists assignments_write on public.assignments;
create policy assignments_read on public.assignments for select to authenticated using (
  ((learning_unit_id is null or exists (
      select 1 from public.learning_units u where u.id = assignments.learning_unit_id and u.status = 'approved'
    )) and public.is_cohort_member(cohort_id))
  or public.is_cohort_teacher(cohort_id)
  or public.has_permission('assignments.manage')
  or public.has_permission('people.view')
);
create policy assignments_write on public.assignments for all to authenticated
  using (
    (learning_unit_id is null or not exists (
      select 1 from public.learning_units u where u.id = assignments.learning_unit_id and u.status = 'approved'
    )) and (
      public.has_permission('assignments.manage')
      or (public.has_permission('assignments.own') and public.is_cohort_teacher(cohort_id))
    )
  )
  with check (
    public.has_permission('assignments.manage')
    or (public.has_permission('assignments.own') and public.is_cohort_teacher(cohort_id))
  );

-- An approved lesson freezes its reviewed quiz and questions. Teachers can
-- continue editing standalone quizzes and quizzes for unapproved lessons.
drop policy if exists quizzes_update on public.quizzes;
drop policy if exists quizzes_delete on public.quizzes;
drop policy if exists quiz_questions_all on public.quiz_questions;
create policy quizzes_update on public.quizzes for update to authenticated
  using (
    public.can_manage_quiz(id)
    and (learning_unit_id is null or not exists (
      select 1 from public.learning_units u where u.id = quizzes.learning_unit_id and u.status = 'approved'
    ))
  )
  with check (public.can_manage_quiz_scope(program_id, cohort_id));
create policy quizzes_delete on public.quizzes for delete to authenticated using (
  public.can_manage_quiz(id)
  and (learning_unit_id is null or not exists (
    select 1 from public.learning_units u where u.id = quizzes.learning_unit_id and u.status = 'approved'
  ))
);
create policy quiz_questions_all on public.quiz_questions for all to authenticated
  using (
    public.can_manage_quiz(quiz_id)
    and not exists (
      select 1 from public.quizzes q
      join public.learning_units u on u.id = q.learning_unit_id
      where q.id = quiz_questions.quiz_id and u.status = 'approved'
    )
  )
  with check (
    public.can_manage_quiz(quiz_id)
    and not exists (
      select 1 from public.quizzes q
      join public.learning_units u on u.id = q.learning_unit_id
      where q.id = quiz_questions.quiz_id and u.status = 'approved'
    )
  );

revoke all on public.course_enrollments from anon, authenticated;
revoke all on public.learning_units, public.teacher_course_plans, public.class_sessions, public.training_materials,
  public.student_learning_progress, public.course_completions, public.approval_events, public.notifications from anon;
grant select on public.course_enrollments to authenticated;
grant select, insert, update, delete on public.learning_units, public.teacher_course_plans, public.class_sessions,
  public.training_materials, public.student_learning_progress, public.course_completions, public.approval_events,
  public.notifications to authenticated;

drop policy if exists course_enrollments_read on public.course_enrollments;
drop policy if exists learning_units_read on public.learning_units;
drop policy if exists learning_units_write on public.learning_units;
drop policy if exists teacher_course_plans_read on public.teacher_course_plans;
drop policy if exists teacher_course_plans_write on public.teacher_course_plans;
drop policy if exists class_sessions_read on public.class_sessions;
drop policy if exists class_sessions_write on public.class_sessions;
drop policy if exists training_materials_read on public.training_materials;
drop policy if exists training_materials_write on public.training_materials;
drop policy if exists student_learning_progress_read on public.student_learning_progress;
drop policy if exists student_learning_progress_student_write on public.student_learning_progress;
drop policy if exists student_learning_progress_student_update on public.student_learning_progress;
drop policy if exists student_learning_progress_staff_write on public.student_learning_progress;
drop policy if exists course_completions_read on public.course_completions;
drop policy if exists course_completions_write on public.course_completions;
drop policy if exists approval_events_read on public.approval_events;
drop policy if exists notifications_read_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;

create policy course_enrollments_read on public.course_enrollments for select to authenticated using (
  student_id = auth.uid()
  or public.is_academic_reviewer()
  or (status = 'approved' and public.is_cohort_teacher(cohort_id))
);

create policy learning_units_read on public.learning_units for select to authenticated using (
  (status = 'approved' and cohort_id is not null and public.is_cohort_member(cohort_id))
  or public.can_manage_learning_unit(id)
  or public.is_academic_reviewer()
);
create policy learning_units_write on public.learning_units for all to authenticated
  using (status <> 'approved' and (public.can_manage_learning_unit(id) or public.is_academic_reviewer()))
  with check (
    (public.is_academic_reviewer() and status in ('draft', 'submitted', 'rejected', 'revision_requested'))
    or (public.has_permission('lessons.manage') and cohort_id is not null and public.is_cohort_teacher(cohort_id) and status in ('draft', 'submitted', 'rejected', 'revision_requested'))
  );

create policy teacher_course_plans_read on public.teacher_course_plans for select to authenticated using (
  teacher_id = auth.uid() or public.is_academic_reviewer()
);
create policy teacher_course_plans_write on public.teacher_course_plans for all to authenticated
  using (status <> 'approved' and (teacher_id = auth.uid() or public.is_academic_reviewer()))
  with check (
    (public.is_academic_reviewer() and status in ('draft', 'submitted', 'rejected', 'revision_requested'))
    or (teacher_id = auth.uid() and public.can_manage_cohort_plan(cohort_id) and status in ('draft', 'submitted', 'rejected', 'revision_requested'))
  );

create policy class_sessions_read on public.class_sessions for select to authenticated using (
  (status = 'approved' and public.is_cohort_member(cohort_id)) or public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer()
);
create policy class_sessions_write on public.class_sessions for all to authenticated
  using (status <> 'approved' and public.can_manage_cohort_plan(cohort_id))
  with check (
    (public.is_academic_reviewer() and status in ('draft', 'submitted', 'rejected', 'revision_requested', 'cancelled', 'completed'))
    or (public.can_manage_cohort_plan(cohort_id) and status in ('draft', 'submitted', 'rejected', 'revision_requested', 'cancelled', 'completed'))
  );

create policy training_materials_read on public.training_materials for select to authenticated using (
  (status = 'approved' and cohort_id is not null and public.is_cohort_member(cohort_id))
  or created_by = auth.uid()
  or (cohort_id is not null and public.is_cohort_teacher(cohort_id))
  or public.has_permission('materials.approve')
);
create policy training_materials_write on public.training_materials for all to authenticated
  using (status <> 'approved' and (created_by = auth.uid() or (public.has_permission('materials.manage') and cohort_id is not null and public.is_cohort_teacher(cohort_id)) or public.has_permission('materials.approve')))
  with check ((public.has_permission('materials.manage') and cohort_id is not null and public.is_cohort_teacher(cohort_id) and status in ('draft', 'submitted', 'rejected', 'revision_requested')) or public.has_permission('materials.approve'));

create policy student_learning_progress_read on public.student_learning_progress for select to authenticated using (
  student_id = auth.uid() or public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer()
);
create policy student_learning_progress_student_write on public.student_learning_progress for insert to authenticated
  with check (student_id = auth.uid() and public.is_cohort_member(cohort_id) and status in ('not_started', 'in_progress'));
create policy student_learning_progress_student_update on public.student_learning_progress for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and status in ('not_started', 'in_progress'));
create policy student_learning_progress_staff_write on public.student_learning_progress for all to authenticated
  using (public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer())
  with check (public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer());

create policy course_completions_read on public.course_completions for select to authenticated using (
  student_id = auth.uid() or public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer()
);
create policy course_completions_write on public.course_completions for all to authenticated
  using (public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer())
  with check (public.is_cohort_teacher(cohort_id) or public.is_academic_reviewer());

create policy approval_events_read on public.approval_events for select to authenticated using (
  public.is_academic_reviewer()
  or public.has_permission('materials.approve')
  or (entity_type = 'enrollment' and exists (
    select 1 from public.course_enrollments e where e.id = entity_id and e.student_id = auth.uid()
  ))
  or (entity_type = 'learning_unit' and exists (
    select 1 from public.learning_units u where u.id = entity_id and (u.created_by = auth.uid() or public.is_cohort_teacher(u.cohort_id))
  ))
  or (entity_type = 'course_plan' and exists (
    select 1 from public.teacher_course_plans p where p.id = entity_id and p.teacher_id = auth.uid()
  ))
  or (entity_type = 'class_session' and exists (
    select 1 from public.class_sessions s where s.id = entity_id and s.teacher_id = auth.uid()
  ))
  or (entity_type = 'training_material' and exists (
    select 1 from public.training_materials m where m.id = entity_id and m.created_by = auth.uid()
  ))
);

create policy notifications_read_own on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Announcements retain public, published communication but now enforce schedule
-- and audience constraints for anonymous visitors, students, teachers and staff.
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select using (public.announcement_visible_to_me(id));

-- ─────────────────────────── Private materials storage ──────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-materials', 'training-materials', false, 26214400,
  array['application/pdf', 'text/plain', 'application/zip', 'application/x-zip-compressed',
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
        'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_training_material_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.cohorts c
    where c.id::text = p_folder
      and ((public.has_permission('materials.manage') and public.is_cohort_teacher(c.id)) or public.has_permission('materials.approve'))
  );
$fn$;

drop policy if exists training_materials_private_read on storage.objects;
create policy training_materials_private_read on storage.objects for select to authenticated using (
  bucket_id = 'training-materials'
  and exists (
    select 1 from public.training_materials m
    where m.file_path = name
      and (
        (m.status = 'approved' and public.is_cohort_member(m.cohort_id))
        or (public.has_permission('materials.manage') and m.cohort_id is not null and public.is_cohort_teacher(m.cohort_id))
        or public.has_permission('materials.approve')
      )
  )
);

drop policy if exists training_materials_private_write on storage.objects;
drop policy if exists training_materials_private_insert on storage.objects;
drop policy if exists training_materials_private_update on storage.objects;
drop policy if exists training_materials_private_delete on storage.objects;
create policy training_materials_private_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'training-materials' and public.can_manage_training_material_folder((storage.foldername(name))[1]));
create policy training_materials_private_update on storage.objects for update to authenticated
  using (
    bucket_id = 'training-materials'
    and public.can_manage_training_material_folder((storage.foldername(name))[1])
    and (public.has_permission('materials.approve') or not exists (
      select 1 from public.training_materials m where m.file_path = name and m.status = 'approved'
    ))
  )
  with check (bucket_id = 'training-materials' and public.can_manage_training_material_folder((storage.foldername(name))[1]));
create policy training_materials_private_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'training-materials'
    and public.can_manage_training_material_folder((storage.foldername(name))[1])
    and (public.has_permission('materials.approve') or not exists (
      select 1 from public.training_materials m where m.file_path = name and m.status = 'approved'
    ))
  );

-- Realtime is opt-in and idempotent for user-facing updates.
do $$
declare
  t text;
begin
  foreach t in array array['course_enrollments', 'learning_units', 'class_sessions', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
