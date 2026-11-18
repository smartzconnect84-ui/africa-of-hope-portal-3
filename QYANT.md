# africa-of-hope-portal-3

## What we are building

Imported from smartzconnect84-ui/africa-of-hope-portal-3.
The supplied snapshot contained documentation only. A standalone Africa of Hope public homepage has been added; historical application source has not been recovered.

## Stack

React 18, Vite 5, JavaScript and plain CSS, @supabase/supabase-js 2.
Entry points: index.html and src/main.jsx (public homepage renders through the same SPA and stays at #/).
Commands: npm run dev, npm run build, npm run preview.
Hash routing (#/programs, #/login, #/signup, #/verify, #/vacancies, #/yearbook,
#/transparency, #/contact, #/support, #/newsletter, #/portal, #/admin,
#/admin/login).

## Data model

The portal's own database (Autobase, SQLite) is now the source of truth:
backend/migrations/*.sql creates 72 tables with access policies, storage
buckets and live updates.

- portal_schema.sql — every table the app reads or writes (profiles, roles,
  permissions, programmes and modules, cohorts and cohort_students,
  timetables, assignments and submissions, quizzes, attendance, learning
  progress, fees and payments, certificates, announcements, blog, enquiries,
  vacancies, yearbook, alumni businesses, transparency, helpdesk, grade
  appeals, direct messages, notifications, newsletter, push, system settings).
- portal_access_policies.sql — is_staff() / is_admin() helpers plus policies
  for all 72 tables: public read for published site content, own-row access
  for personal records, staff for everything else.
- portal_storage_live_updates.sql — avatars, program-images, site-assets,
  blog-covers (public), documents, classwork-submissions, training-materials
  (private, signed links); realtime on announcements, direct_messages,
  notifications, yearbook_entries and profiles.
- portal_roles_permissions_seed.sql — the six roles and the 43-grant
  permission matrix.

src/integrations/supabase/client.ts is now a bridge: the app keeps calling
supabase.from(...) / supabase.auth, and those calls run against the project
backend via src/integrations/autobase/client.ts. Sign-in is the platform's
(better-auth): email + password, reset by email, Google/Microsoft available.

Not yet ported: the ~30 SQL routines the academic, quiz, payment-ledger,
certificate, helpdesk, grade-appeal and newsletter modules called with
supabase.rpc(), and the 8 edge functions (send-email, newsletter,
admin-users, onesignal-send, verify-certificate, assistant,
send-deadline-reminders). Those calls now return a clear "not available
yet" message instead of failing silently.

## Pages and routes

- /: public homepage with manually controlled hero slider, optional slideshow playback, mobile navigation, approach, community and admissions service notice.
- HeroSlider in src/App.jsx accepts onApply and optional onLogin callbacks. Portal controls render only when a login callback is provided.
- Applications and student sign-in are not connected; the public page explicitly states this and collects no personal information.

## Environment

Provisioned by the platform, no manual setup: VITE_AUTOBASE_URL and
VITE_AUTOBASE_PUBLISHABLE_KEY (publishable key only; no secret keys in the
frontend).

## Decisions

- Preserve the React/Vite stack and use the Vite CLI directly for development.
- Use forest green, ivory and brass with editorial serif headings and photographic hero slides.
- Keep this recovery static-first and lightweight, without adding a server or heavy animation dependencies.
- Do not fabricate historical recovery, Supabase functionality or authentication.
- Previous chat references to source files, migrations and successful tests are not supported by the supplied file snapshot.
- Disk inspection, Git history, dependency installation, production build and browser verification remain unconfirmed until tool or platform results are available.

## Change log

- Wired the restored homepage to the live Supabase backend: added
  @supabase/supabase-js, password sign-in/sign-up with email confirmation
  note, separate staff sign-in, hash-routed public pages (programs,
  vacancies, yearbook, transparency, contact, support, newsletter,
  certificate verification), student portal with realtime notifications
  and announcements plus avatar/proof uploads, and a role-gated admin
  console. Added AUDIT.md (repo-vs-Supabase reconciliation), .env.example
  placeholder, .gitignore. Verified in browser against the live project,
  including a temporary QA account that was deleted after the run.

- Replaced compiled-snapshot serving with Vite's React source entry, explicitly imported the global stylesheet, and declared React runtime dependencies; the recovery snapshot remains untouched. Build and visual verification are pending.

- Memory file added to an existing project; pending reconstruction.
- Reconstructed memory from the available documentation snapshot and added a standalone React/Vite public homepage and build manifest.
- Added the project's own database: 72-table schema, access policies, storage
  buckets, live updates and the roles/permissions seed written as migrations;
  src/integrations/supabase/client.ts turned into a bridge onto the new
  backend so every screen, helper and hook keeps its existing data calls;
  sign-in, sign-up, password reset and sign-out mapped onto the platform auth
  client; registration details carried to the first profile row; boolean
  columns read from the database normalised in src/data/liveData.ts.
