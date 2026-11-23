-- Completes the permission catalogue. `src/lib/permissions.ts` defines 47 keys
-- but the live `permissions` table only ever held 33 (plus `chat.use`, seeded by
-- 20261124150000): 14 keys were never inserted, so every module gated on them
-- was hidden for every role except Super Admin, whose access is implicit. The
-- client builds its matrix from these tables (src/data/liveData.ts), so code
-- defaults could not rescue the missing rows.
--
-- Missing: timetable.manage, reports.manage, grades.manage, library.manage,
-- aptitude.manage, email.manage, transparency.manage, policies.manage,
-- discussions.moderate, operations.manage, verification.manage, impact.manage,
-- campus.manage, donations.manage.
--
-- Catalogue rows mirror PERMISSIONS; grants mirror DEFAULT_ROLE_PERMISSIONS in
-- src/lib/permissions.ts. Idempotent: re-running only fills what is absent.

-- ───────────────────────── 1. Catalogue ─────────────────────────

insert into public.permissions (key, grp, label, description, sort) values
  ('timetable.manage', 'Academics', 'Manage timetables', 'Build weekly class timetables with rooms, instructors and times.', 188),
  ('reports.manage', 'Academics', 'Manage report cards', 'Generate term report cards with totals, grades and comments.', 187),
  ('grades.manage', 'Academics', 'Manage grade evaluation', 'Run Grade Evaluation: quizzes, assignments, exams, report cards and publishing.', 96),
  ('library.manage', 'Academics', 'Manage training library', 'Curate the Training Library programmes, vacancies and business offers.', 58),
  ('aptitude.manage', 'Admissions', 'Manage aptitude & entrances', 'Run Aptitude Control: preparations, entrance results and setup.', 186),
  ('email.manage', 'Comms', 'Manage email delivery', 'Review the email outbox and retry failed deliveries.', 192),
  ('transparency.manage', 'Website', 'Manage transparency library', 'Publish audits, reports and accountability documents.', 189),
  ('policies.manage', 'Website', 'Manage policies', 'Edit school policies shown on the public site and portal.', 190),
  ('discussions.moderate', 'Comms', 'Moderate discussions', 'Moderate class discussions and remove unsuitable posts.', 191),
  ('operations.manage', 'Settings', 'Manage operations files', 'Access the Operations Centre files and system jobs.', 193),
  ('verification.manage', 'Certificates', 'Manage verification', 'Run the Verification Hub and confirm certificate serials.', 194),
  ('impact.manage', 'Website', 'Manage impact stories', 'Edit impact stats, student success stories and the public Impact page.', 195),
  ('campus.manage', 'Website', 'Manage campus life', 'Edit campus news, events, jobs, aid, resources and fee plans.', 196),
  ('donations.manage', 'Website', 'Manage donations & vacancies', 'Publish donation campaigns and manage vacancies/business offers.', 197)
on conflict (key) do update set
  grp = excluded.grp, label = excluded.label, description = excluded.description, sort = excluded.sort;

-- ───────────────────────── 2. Role grants ─────────────────────────
-- Joined against public.roles so roles that exist only in the code seed (for
-- example "Instructor", which has no row here) are skipped instead of failing
-- the foreign key. Super Admin stays implicit and is never inserted.

with grants (role, permission) as (
  values
    ('School Admin', 'timetable.manage'),
    ('School Admin', 'reports.manage'),
    ('School Admin', 'grades.manage'),
    ('School Admin', 'library.manage'),
    ('School Admin', 'aptitude.manage'),
    ('School Admin', 'email.manage'),
    ('School Admin', 'transparency.manage'),
    ('School Admin', 'policies.manage'),
    ('School Admin', 'discussions.moderate'),
    ('School Admin', 'operations.manage'),
    ('School Admin', 'verification.manage'),
    ('School Admin', 'impact.manage'),
    ('School Admin', 'campus.manage'),
    ('School Admin', 'donations.manage'),
    ('Teacher', 'timetable.manage'),
    ('Teacher', 'reports.manage'),
    ('Teacher', 'grades.manage'),
    ('Teacher', 'library.manage'),
    ('Teacher', 'discussions.moderate'),
    ('Teacher', 'verification.manage'),
    ('Instructor', 'timetable.manage'),
    ('Instructor', 'reports.manage'),
    ('Instructor', 'grades.manage'),
    ('Instructor', 'library.manage'),
    ('Instructor', 'discussions.moderate'),
    ('Instructor', 'verification.manage'),
    ('Registrar', 'aptitude.manage'),
    ('Registrar', 'grades.manage'),
    ('Registrar', 'library.manage'),
    ('Registrar', 'reports.manage'),
    ('Registrar', 'verification.manage'),
    ('Registrar', 'email.manage'),
    ('Admission Officer', 'aptitude.manage'),
    ('Finance Officer', 'donations.manage'),
    ('Public Relations Officer', 'library.manage'),
    ('Public Relations Officer', 'email.manage'),
    ('Public Relations Officer', 'transparency.manage'),
    ('Public Relations Officer', 'policies.manage'),
    ('Public Relations Officer', 'discussions.moderate'),
    ('Public Relations Officer', 'impact.manage'),
    ('Public Relations Officer', 'campus.manage'),
    ('Public Relations Officer', 'donations.manage'),
    ('Data Entry Officer', 'timetable.manage'),
    ('Data Entry Officer', 'reports.manage'),
    ('Data Entry Officer', 'library.manage'),
    ('Data Entry Officer', 'verification.manage'),
    ('Executive Assistant', 'email.manage'),
    ('Executive Assistant', 'transparency.manage'),
    ('Executive Assistant', 'operations.manage'),
    ('Executive Assistant', 'impact.manage'),
    ('Executive Assistant', 'campus.manage'),
    ('Executive Assistant', 'donations.manage'),
    ('Research Officer', 'reports.manage'),
    ('Research Officer', 'grades.manage'),
    ('Research Officer', 'library.manage'),
    ('Research Officer', 'transparency.manage'),
    ('Research Officer', 'policies.manage'),
    ('Research Officer', 'impact.manage'),
    ('Research Officer', 'campus.manage'),
    ('Customer Care Officer', 'discussions.moderate'),
    ('Customer Care Officer', 'verification.manage'),
    ('Director of Education', 'timetable.manage'),
    ('Director of Education', 'reports.manage'),
    ('Director of Education', 'grades.manage'),
    ('Director of Education', 'library.manage'),
    ('Director of Education', 'aptitude.manage'),
    ('Director of Education', 'verification.manage'),
    ('Director of Education', 'impact.manage'),
    ('Director of Education', 'campus.manage'),
    ('Director of Education', 'donations.manage')
)
insert into public.role_permissions (role, permission)
select g.role, g.permission
from grants g
join public.roles r on r.name = g.role
on conflict (role, permission) do nothing;
