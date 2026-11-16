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

Live backend: Supabase project gatnzfjpuokopqyksqoy (afrohopeschool_database) —
72 RLS tables, realtime on 43, 9 storage buckets, 8 edge functions, 2 cron jobs.
Frontend wires: programs, applications, enquiries, pledges, vacancies,
yearbook, transparency, newsletter (edge), certificate verification (edge),
student portal (profile, notifications realtime, announcements realtime,
enrollments, assignments, quizzes, payment submissions with proof upload,
helpdesk, avatar upload), staff/admin console (announcements, vacancies,
payments review, helpdesk, yearbook moderation, people, enquiries,
applications, certificates). See AUDIT.md.
Repository still contains no SQL migrations; the live database is the source
of truth until a migrations export is added.

## Pages and routes

- /: public homepage with manually controlled hero slider, optional slideshow playback, mobile navigation, approach, community and admissions service notice.
- HeroSlider in src/App.jsx accepts onApply and optional onLogin callbacks. Portal controls render only when a login callback is provided.
- Applications and student sign-in are not connected; the public page explicitly states this and collects no personal information.

## Environment

Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (anon key only; no
secret keys in the frontend). A local .env exists for development and is
git-ignored.

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