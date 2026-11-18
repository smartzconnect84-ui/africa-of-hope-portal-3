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
- Supabase backend reconciled against the live project (`gatnzfjpuokopqyksqoy`,
  78 tables + 3 views, all RLS; 45 realtime tables covering every channel the
  app subscribes to; 9 buckets with 23 storage policies; 8 active edge
  functions). Applied `20261118053234_programs_code_autofill` after fixing its
  invalid `left()` call — `programs_ensure_code` now generates `code` on insert
  (probe row verified, then deleted), and renamed nine duplicate-version
  migration files to the versions recorded in `schema_migrations` so
  `supabase db push` no longer aborts. Added edge-function secrets
  `NEWSLETTER_TOKEN_SECRET`, `PUBLIC_SITE_URL`, `APP_URL`, `EMAIL_CRON_SECRET`
  plus Vault `send_email_dispatch_url` / `email_cron_secret`, which unblocked
  newsletter signup and the pg_cron email dispatcher (queue drained). Still
  owner-supplied: VAPID keys, OneSignal REST key; `admin-users` and
  `onesignal-send` run with `verify_jwt=false` although `config.toml` asks for
  true (handlers re-check roles).

- Added the project's own database: 72-table schema, access policies, storage
  buckets, live updates and the roles/permissions seed written as migrations;
  src/integrations/supabase/client.ts turned into a bridge onto the new
  backend so every screen, helper and hook keeps its existing data calls;
  sign-in, sign-up, password reset and sign-out mapped onto the platform auth
  client; registration details carried to the first profile row; boolean
  columns read from the database normalised in src/data/liveData.ts.

- Backend completion pass (2026-11-18, second pass): redeployed `admin-users`
  from the repo source (version 34) so the live bundle matches the 13:50
  commit, and both `admin-users` and `onesignal-send` now run with
  `verify_jwt=true`, matching `supabase/config.toml` (the `onesignal-send`
  bundle hash is unchanged). Drained the email queue completely by marking the
  two undeliverable `qa-audit+portal@example.com` rows `skipped` (Resend blocks
  example.com, so they retried forever): outbox is now 44 sent / 4 skipped /
  0 queued. Checked parity rather than re-applying: all 29 `.rpc()` names the
  app calls exist live, the unversioned/renamed migrations' objects
  (`grade_appeals` + its four security-definer RPCs, `live_sync`'s grade /
  aptitude / report-card / timetable tables, the reconciliation baseline) are
  present with RLS, 45 tables are in `supabase_realtime`, and all nine buckets
  exist. `run-repo-migration` is a retired 410 stub, not an open endpoint.
  Still owner-supplied: `ONESIGNAL_REST_API_KEY` (push returns 503 until set)
  and the VAPID keypair plus `VITE_VAPID_PUBLIC_KEY` for web push
  (`send-deadline-reminders` degrades to `configured:false` and has no cron
  job yet).

- Edge function deploy pass (2026-11-18): all seven repo functions were
  redeployed, because their live bundles dated from the 2026-11-15 bulk deploy
  while the repo sources changed on 2026-11-16. Live now: `admin-users` v34,
  `assistant` v31, `newsletter` v15, `onesignal-send` v14,
  `send-deadline-reminders` v19, `send-email` v25, `verify-certificate` v37;
  gateway flags match `config.toml` (only `admin-users` and `onesignal-send`
  require a JWT). `run-repo-migration` remains a retired 410 stub. The deploy
  API accepts one file per function, so `assistant`, `newsletter` and
  `send-email` were shipped as single-file bundles with `guide.ts` /
  `_shared/newsletter.ts` inlined; the repo keeps the split source. Verified:
  `verify-certificate` 200, `newsletter` 400 on a bad email, `admin-users` 401
  for a non-user token, `send-deadline-reminders` 401 without the cron secret,
  `assistant` status 200, and the pg_cron dispatcher got 200
  `{configured:true,processed:0}` from `send-email`. Fixed a live bug found
  during the pass: `assistant/index.ts` built `faqsRaw` but read `faqRaw`, so
  `buildPublicContext` threw on every request and the AI answered with no
  programme, contact or FAQ knowledge at all; the reference is corrected in
  the repo and in the deployed v31.

- Messaging / notification / push audit (2026-11-18) with three real fixes.
  (1) Direct messages raised no notification: the browser insert was rejected by
  RLS because `notifications` has no INSERT policy. A security-definer trigger
  `direct_message_notification` now writes the recipient's row server-side
  (probe: one DM produced exactly one notification, then rolled back).
  (2) `notifications` drifted between its two identity columns and two read
  flags: `recipient_id` is NOT NULL while `user_id` is nullable, and readers
  updated either `read` or `read_at`. A `notifications_sync_read_state`
  before-trigger mirrors both pairs and keeps `read`/`read_at` in step; the two
  stale rows were backfilled (6 notifications, unread went 6 → 4).
  (3) Direct-message push was broken twice over: the client sent
  `{userId, data}` while the worker expects `{audience, user_id}`, so a DM was
  treated as an institution-wide broadcast, and the worker required a staff
  caller so student DMs could never push. The client now sends
  `{audience:'user', user_id}`, and the worker accepts `userId` too, allows any
  signed-in member to notify someone they already have a conversation with, and
  writes `recipient_id` (not just `user_id`) on the in-app record it creates.
  Deployed `onesignal-send` v17; `ONESIGNAL_APP_ID` is set from the public app id
  already in `src/lib/onesignal.ts`. Direct messaging itself was sound: 8
  messages, 3 senders/receivers, RLS read/send/seen policies, 45 realtime tables.
  Still blocked: `ONESIGNAL_REST_API_KEY` (the worker returns 503 until it is a
  Supabase secret) and the VAPID keypair for the separate web-push worker.

- Welcome emails are now split by audience and editable in the admin backend.
  New table `welcome_email_templates` (audience `staff` | `student`, subject,
  body, RLS: staff read, Super Admin / School Admin write) holds two distinct
  letters — staff and volunteers vs students and applicants — with `{{name}}`
  and `{{event_line}}` placeholders. `_queue_account_congratulations` picks the
  row by role (Student → student, every other role → staff) and falls back to
  the previous wording only if a template is empty. The editor lives at Admin →
  System Settings → Welcome emails (`src/components/admin/WelcomeEmailTemplates.tsx`).
  Verified by queueing a real profile in a rolled-back transaction: role Super
  Admin produced template `account_approved`, audience `staff`, subject
  "Welcome to AFRICA OF HOPE — your staff account".
