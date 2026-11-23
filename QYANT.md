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

The Supabase project `gatnzfjpuokopqyksqoy` (Postgres 17, us-east-1) is the
source of truth: 78 tables and 3 views, all with RLS, 45 tables in
`supabase_realtime`, 9 storage buckets, 8 active edge functions and the six
roles with the 43-grant permission matrix. supabase/migrations keeps the schema
history of this project; backend/migrations is the unused managed-backend port.

`profiles` rows are created by the `handle_new_user` trigger on `auth.users`,
which copies `full_name`, `phone`, `program_ids`, `note` and `documents` from
the sign-up metadata and defaults to role Student / status Pending Approval.
`confirmed_account_congratulations` queues the welcome email on confirmation.

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

src/integrations/supabase/client.ts is the single data client: a real
`@supabase/supabase-js` client, so supabase.from(...), supabase.auth,
supabase.rpc(...), supabase.storage and supabase.functions all run against this
project. Sign-in is Supabase Auth: email + password with email confirmation,
password reset by email. src/integrations/autobase/client.ts remains in the
repo but is no longer imported.

## Pages and routes

- /: public homepage with manually controlled hero slider, optional slideshow playback, mobile navigation, approach, community and admissions service notice.
- HeroSlider in src/App.jsx accepts onApply and optional onLogin callbacks. Portal controls render only when a login callback is provided.
- Applications and student sign-in are not connected; the public page explicitly states this and collects no personal information.

## Environment

VITE_SUPABASE_URL=https://gatnzfjpuokopqyksqoy.supabase.co and
VITE_SUPABASE_ANON_KEY (the project's publishable key). Both are public client
values: the publishable/anon key is designed to ship in the browser. The
service-role key is a server-only secret and must never get a VITE_ prefix.
Locally they live in the gitignored .env.local; a Sites bundle must be built
with them because Sites has no build step.

`APY_TOKEN` is the ApyHub API token used by the `extract-pdf-text` Edge
Function. It is server-only: it is declared empty in `.env.example`, set with
`supabase secrets set APY_TOKEN=...`, and never gets a `VITE_` prefix. PDF text
extraction reports itself unconfigured (503) until the secret exists.

The other function credentials are Supabase project secrets set the same way and
never committed: the service credential Supabase injects for workers, the Resend
send key and verified sender, the email and reminder cron secrets, the Groq
assistant key and model, the newsletter signing secret, the VAPID keypair and
subject, the OneSignal app id and REST credential, the internal push dispatch
token, and the public site/app URLs. Each function's source names the ones it
reads.

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

- Apex redirect live (2026-11-23). Created a proxied placeholder A record
  (africaofhopelr.org -> 192.0.2.1) and a Single Redirect rule
  (http.host eq "africaofhopelr.org" -> 301 to
  https://www.africaofhopelr.org + original path, preserve query string) in
  Cloudflare zone c3bdaaece6b1a9d413f462d0b618cfd5 via
  artifacts/cf-apex-redirect.mjs. Verified: dig returns Cloudflare proxied
  IPs and curl -sI https://africaofhopelr.org/portal/ returns 301 with
  location https://www.africaofhopelr.org/portal/. Apex is now served by
  Cloudflare and redirects to www; the Freebuff site continues to serve only
  www.africaofhopelr.org.
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

- OneSignal is live and verified (2026-11-18). `ONESIGNAL_REST_API_KEY` is now a
  project secret, so `onesignal-send` passes its credential gate (it answers 401
  to an unauthenticated call instead of the old 503). Verified against the real
  provider: `GET /apps/{id}` returned 200 for app "AfroHope-School"
  (`1c7444cf-8299-48c3-adf7-0d1b32dbed7b`), matching the App ID the frontend
  uses, so app id and REST key are a valid pair. A real single-recipient push to
  the owner's Supabase user id was accepted by OneSignal but came back
  `{"id":"","errors":["All included players are not subscribed"]}`: no browser
  has opted in yet (`push_subscriptions` 0, `onesignal_devices` 0), and the
  client only links identity via `OS.login(user.id)` once push is enabled.
  Testing that revealed two defects, both fixed and deployed as
  `onesignal-send` v18: (a) any HTTP 200 was recorded as `status='sent'`, so an
  undelivered push looked successful — an empty `id` or a non-empty `errors`
  array is now `failed` with the provider body kept in `provider_response`;
  (b) the worker also inserted an in-app notification for the target user, which
  duplicated the row the `direct_message_notification` trigger had already
  written for the same DM — identical recipient/title/body rows within ten
  minutes are now skipped. The in-app row is written whether or not the device
  is reachable, because the portal list is the authoritative copy.

- Push has still never delivered to a device (2026-11-18, follow-up). Asked to
  retest after enabling: OneSignal reported the app has `total_count: 0`
  players and the owner's external id does not exist at all, so no subscription
  was ever created — "enable" only changed the browser permission. Two client
  defects explain it and are fixed in the frontend (needs a rebuild/redeploy of
  the site to take effect): (a) `oneSignalLogin()` ran only from
  `OneSignalPanel`, i.e. only after a member opened Profile or Reminder
  settings, so a signed-in member who never opened those screens was never
  linked for targeted push — `Shell` in `src/App.tsx` now links identity the
  moment anyone signs in; (b) `oneSignalOptIn()` used optional chaining on the
  SDK's subscription object and then returned `subscribed: true`
  unconditionally, so the card could say "Notifications enabled on this device"
  while OneSignal held no player — it now verifies `id`/`optedIn` (accepting
  either a plain value or a promise) and reports the honest failure instead.
  Unresolved server-side questions: none — `GET /apps/{id}` is 200 and the REST
  key is valid; delivery is blocked purely by the absence of a subscriber.

- Every notification now pushes, server-side (2026-11-18, migration
  `20261118090000_push_all_notifications.sql` + `onesignal-send` v21). Before
  this, only a direct message (sent by the sender's browser) and an admin
  broadcast ever reached a phone: the nine routines that insert
  `public.notifications` (`_notify_direct_message`, `submit_payment`,
  `review_payment`, `submit_classwork`, `_notify_attendance`,
  `_notify_schedule_updated`, `_notify_academic_status`,
  `close_expired_course_windows`, `_recompute_enrollment_progress`) wrote an
  in-app row only. The chain is now: insert on `notifications` →
  `notifications_queue_push` trigger queues a `notification_outbox` row with
  `recipient_id`/`notification_id` (unique, so one notification can never push
  twice) → pg_cron job `aoh-dispatch-push` (every minute) calls
  `_cron_dispatch_push()` → `net.http_post` to `onesignal-send` with an internal
  token from `push_dispatch_token` (RLS on, no policies; unreadable by
  anon/authenticated) → one targeted push per recipient. Nothing depends on a
  browser being open, so a closed tab still receives messages and updates.
- The reminder card no longer dead-ends on VAPID. `pushReminders.enable()` used
  to stop at "Only open-app notifications are available until an administrator
  configures the Web Push public key and sender" because
  `VITE_VAPID_PUBLIC_KEY` is not set; it now opts the device into OneSignal,
  which owns the web-push sender, so no VAPID pair is needed. Self-hosted VAPID
  remains supported if those keys ever exist (`push_subscriptions` untouched).
- `onesignal-send` v21 also closes a double-send: an admin one-to-one send used
  to create a notification whose new trigger row queued a second push; the
  function now marks those queued copies `sent` after its own delivery.
  `verify_jwt` is off (pg_cron cannot mint a user JWT) but the browser path still
  requires a verified session — a service-role call with no user gets 401, and
  the internal token is compared in constant time. Deploying with the tool
  re-enables `verify_jwt`, so it must be flipped off after every deploy.
- Still required for real delivery: an actual OneSignal player on a device. The
  test notification reached the dispatcher (HTTP 200, `dispatched: 1`) and
  OneSignal answered `All included players are not subscribed`, so the pipeline
  is proven up to the device. Press Enable on the Phone push card (or Enable
  reminders after the next frontend build) while signed in on the production
  origin, then the same test will record `sent`.

- Push is instant and retried (2026-11-18, migration
  `20261118093000_push_instant_and_retries.sql` + `onesignal-send` v22). The
  only thing that woke the outbox was the pg_cron job once a minute, so a
  message could arrive up to 60 seconds late; the `notifications` trigger now
  calls `_cron_dispatch_push()` itself (net.http_post is asynchronous, so the
  insert is not held up) and pg_cron stays as the sweep. A send that failed
  used to be written `failed` and never looked at again: claims now go through
  `_claim_push_rows()` (`for update skip locked`, increments `attempts`), the
  function records `last_error` and schedules `next_attempt_at` with backoff
  (1m, 2m, 5m, 15m; five attempts), and rows stuck in `sending` because a
  dispatch died are reclaimed after ten minutes. `notifications.push_suppressed`
  flags rows the browser already pushed (admin composer, direct-message sender)
  so the instant trigger cannot send them twice; failed one-to-one sends from
  the composer are replayed by the queue, broadcasts are not (their audience is
  a filter/segment, not a recipient the queue can address).

- Backend audit (2026-11-18). The `supabase.rpc()` bridge answered "This action
  is not available yet" for every single call while all 105 public routines
  exist in the project and are granted, so helpdesk, quizzes, grade appeals,
  newsletter campaigns, enrolment, attendance, certificate issue/revoke and the
  congratulations queue were dead in the UI. It now forwards to the same client
  the tables use and only reports "not connected" when the backend is
  unconfigured. Verified over REST with the publishable key
  (`verify_public_certificate` → 200/null) and through the public
  `verify-certificate` function (200, `valid:false`).
- `import.meta.env` was read unguarded in `src/integrations/autobase/client.ts`
  and `src/integrations/supabase/client.ts`, so loading the data layer outside
  Vite (the node test runner) threw on import and two test files never ran. Both
  reads are guarded now.
- `npm test` could never pass: `tsconfig.tests.json` used NodeNext, which rejects
  this app's extensionless imports and `import.meta.env`, and `typecheck` pointed
  at the solution-style root config (`files: []`), which typechecked nothing. Both
  are fixed — 41 tests pass — and the real errors they had hidden are gone:
  `AuthChangeEvent` was missing `PASSWORD_RECOVERY`, and three better-auth
  no-argument calls (`getSession`, `signOut`, `token`) failed the generated types.
  `src/integrations/supabase/client.ts` also imports `../autobase/client.ts` with
  its extension so Node can resolve it.
- `supabase/config.toml` still declared `verify_jwt = true` for `onesignal-send`,
  contradicting the deployed DB-token design: any CLI or config deploy would have
  silently turned every queued push off. It now matches the live function.
- Not fixed, only recorded: a deployed function `run-repo-migration` has no
  source in this repo, and the root `index.ts` duplicates the `admin-users`
  handler; the app calls neither.

- Deployed to Freebuff Sites (2026-11-18). Preview
  https://africa-of-hope-portal-kjxltx-preview.freebuff.site and production
  https://africa-of-hope-portal-kjxltx.freebuff.site, both published. The app is
  a prerendered Vite SPA, so `deploy/sites-worker.js` only forwards to the
  static asset binding and `sites.manifest.json` sets `spa: true` for client
  routes. Two build problems had to be fixed first: (a) a stub `vite.config.js`
  shadowed `vite.config.ts` (Vite prefers the `.js`), so `npm run build` could
  not resolve the `@/` alias — the stub is removed and the real config is the
  only one; (b) the build output ships `public/_redirects`, which Cloudflare
  rejects on upload as an infinite loop (error 100324), and `dist/.well-known`
  is refused as a hidden path, so `npm run build:sites` builds and then strips
  both before `sites_deploy`. Sites has no build step, so the `VITE_*` values
  must be present when the bundle is built. This deployment was built without
  them (the Autobase URL/key are platform-provisioned and absent from the
  repo), so the public site renders but sign-in and data features report the
  backend as not connected until the bundle is rebuilt with those values.

- Both Sites environments were rebuilt and redeployed on 2026-11-18 after the
  backend audit, so they now serve the fixed client (`rpc()` forwarding to the
  data client, guarded `import.meta.env`, the typecheck/test config fixes).
  Build: `VERCEL=1 npm run build:sites` (exit 0, 19 prerendered routes, bundle
  `index-Bmdn156H.js`); deploys: preview and production both `succeeded`, both
  still published. Production is https://aoh.freebuff.site — earlier notes said
  `africa-of-hope-portal-kjxltx.freebuff.site`, which now answers 307 to the
  `aoh` subdomain; the custom domain `www.africaofhopelr.online` is still
  `pending_dns`. Serving checked over HTTP: `/` 200 text/html, `/verify/` and
  `/admissions/` 200, `/programmes` 307 to `/programmes/`, `/sw.js` 200
  text/javascript, unknown paths fall back to `index.html`. Sign-in and data
  remain unavailable on these hosts: the bundle was built without
  `VITE_AUTOBASE_URL` and `VITE_AUTOBASE_PUBLISHABLE_KEY`, and the Supabase
  project (`gatnzfjpuokopqyksqoy`) does not serve better-auth (`/auth/ok` is
  404), so it cannot stand in for the Autobase backend.

- "Push library is unavailable offline" was a dead end (2026-11-18,
  `src/lib/onesignal.ts` + `OneSignalPanel`). `initOneSignal()` cached its first
  result for the life of the page and `loadPageSdk()` cached a rejected script
  promise, so a single blocked or slow CDN download — or one rejected
  `OS.init` — made Enable answer the same words on every retry, and "Refresh
  status" replayed the cached failure too. A failed init is no longer
  remembered, a dead `<script>` tag is removed so the next attempt really
  reloads, the download times out after 12 s instead of hanging, and the
  message now names the real cause. iOS is called out explicitly in both the
  message and the card: web push only works from the Home Screen app, never a
  Safari tab (iOS 16.4+).

- Authentication repair (2026-11-20). Sign-in and sign-up were dead in every
  build: `src/integrations/supabase/client.ts` was a bridge onto the managed
  Autobase backend, whose `VITE_AUTOBASE_URL` / `VITE_AUTOBASE_PUBLISHABLE_KEY`
  are set nowhere, so every `supabase.auth.*`, `supabase.from(...)` and realtime
  call went to `autobase-not-connected.invalid`. The module is now one real
  `@supabase/supabase-js` client for project `gatnzfjpuokopqyksqoy`, created once
  from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, with `detectSessionInUrl`,
  refresh-token rotation and the existing remember-me storage
  (`src/lib/authStorage.ts`). No screen, table, role or policy changed.
  `src/integrations/autobase/client.ts` stays in the repo but is no longer
  imported (`main.tsx` dropped its `completeSignIn()` call because Supabase
  finishes confirmation/recovery links itself).
- Supabase Auth configuration corrected: `uri_allow_list` only allowed
  `africaofhopelr.org`, so a confirmation or reset link sent from the deployed
  app redirected to the wrong site. It now also allows `https://aoh.freebuff.site`,
  the Sites preview origin, `africaofhopelr.online` / `www.africaofhopelr.online`
  and `http://localhost:3000` / `http://127.0.0.1:3000`. Email confirmation stays
  required (`mailer_autoconfirm=false`); SMTP is Resend through
  `auth@africaofhopelr.online` and accepts these sends.
- Signing in before confirming an address used to be a dead end (`email_not_confirmed`).
  `login()` in `src/context/AppContext.tsx` now recognises it, sends a fresh
  confirmation link (`resendConfirmationEmail`) and says so.
- Verified against the real project and the real UI: sign-up created the auth
  user and the `handle_new_user` trigger created its profile as Student /
  Pending Approval with the submitted name, phone and note; the confirmation
  email was accepted for delivery; sign-in before confirmation returned
  `email_not_confirmed` and the resend endpoint answered 200 with an app-origin
  redirect; after confirmation the sign-in form produced a session and the
  student dashboard; a page refresh kept the session; sign-out cleared it and
  returned to the public site. API checks: own profile readable under RLS, role
  self-promotion rejected ("An active account is required"), a staff-only
  `role_permissions` write denied (403), wrong password `invalid_credentials`,
  refresh rotated the token, and the refresh token was refused after logout
  (`refresh_token_not_found`). The two throwaway accounts and their profiles were
  deleted afterwards (39 users / 39 profiles, unchanged). `npm run typecheck`,
  `npm test` (41/41) and `VERCEL=1 npm run build:sites` pass, and the built
  bundle now contains the project URL instead of the placeholder host.
- This merge keeps the newer `main` work (`213b416`, `0d841a5`, `2dfa776`,
  `00784ef`, `30af657`: portal modules, the operations hub, the website settings
  scrolling fix and the better-auth response mapping). Only the data/auth client
  changed: those commits tried to make the managed backend answer; this one
  points the app at the project that actually holds the accounts.

- PDF text extraction through ApyHub (2026-11-21). New Edge Function
  `extract-pdf-text` (signed-in members only: Supabase's default gateway JWT
  check plus an in-handler session re-check, so no `[functions.*]` override was
  added to `config.toml`) takes the upload as multipart `file`, checks the MIME
  type/`.pdf` name, the `%PDF-`
  magic bytes and the 10 MB limit, then forwards it to
  `POST https://api.eu.apyhub.com/apyhub/extract-text-from-pdf/file` with the
  `apy-token` header and returns ApyHub's `data` string as
  `{ text, characters, truncated }`. `APY_TOKEN` is read from the function
  environment only and declared empty in `.env.example`; upstream 4xx/5xx,
  401/403, 413 and 429 answers, network failures and timeouts map to safe
  messages that never repeat the provider body, and an empty `data` string is
  reported as a scanned/empty PDF that needs OCR (this service does not OCR).
  Extracted text is normalised (CRLF, control bytes, 200k character cap) and is
  untrusted document content: render it as text, never as HTML.
  `src/lib/pdfText.ts` is the browser entry point (`extractPdfText(file)`).
  `tests/apyhubPdf.test.ts` builds a synthetic one-page PDF with a real text
  layer and covers the request shape, the upload checks and the error mapping;
  it also holds an opt-in live check that uploads that PDF to ApyHub and asserts
  the returned text contains it (`APY_TOKEN=... node --test
  tests/apyhubPdf.test.ts`), which skips when no token is present.
  Still owner-supplied for live use: `APY_TOKEN` as a Supabase secret — the
  live call has not run yet, so a real ApyHub answer is unconfirmed.

- PDF text extraction reconcile (2026-11-21). The `extract-pdf-text` Edge Function's
  repo source (`index.ts` importing from `../_shared/apyhubPdfHandler.ts`) could not
  be deployed as-is: the Supabase deploy tool bundles one file per function and cannot
  resolve `../_shared/` imports that sit outside the function's own directory, even
  though the same `_shared/` layout works for `newsletter` (which imports
  `../_shared/newsletter.ts`). Reconciled by making `supabase/functions/extract-pdf-text/index.ts`
  self-contained: it inlines the ApyHub client (`_shared/apyhubPdf.ts`) and the HTTP
  handler (`_shared/apyhubPdfHandler.ts`) so the repo file is now byte-for-byte what
  is deployed. The `_shared/` files are kept as the tested library source that
  `tests/apyhubPdf.test.ts` imports directly (Node resolves the path fine), and
  `index.ts` carries a comment pointing at them. Redeployed from repo source as
  `extract-pdf-text` v4 (ACTIVE, `verify_jwt = true`); the `APY_TOKEN` Supabase
  project secret was rotated to the full key and the function now returns 401
  (auth required) for anonymous calls instead of 503 (not configured) — confirmed
  working. To redeploy after future edits, invoke the Supabase deploy function tool
  with `index.ts`'s content; do not point it at the multi-file import version.

- Global scrolling pass: the document is the only vertical scroller. `src/index.css`
  now gives `html`, `body` and `#root` a `100dvh` minimum with no height cap and
  clips horizontal overflow (`clip`, not `hidden`, so sticky headers stay
  pinned), so every public page, dashboard and portal view expands to its
  content on phones, tablets and desktops. Long dialogs and sheets are capped at
  `calc(100dvh - 2rem)` and scroll inside (`[data-slot="dialog-content"]`,
  `[data-slot="sheet-content"]`, `.aoh-modal-scroll`), and `.aoh-drawer` no
  longer forces `height: 100dvh !important` (it now derives its height from the
  safe-area insets, so the last menu rows are reachable). The public menu, portal
  drawer and image lightbox share one reference-counted lock in
  `src/lib/scrollLock.ts`; the page can no longer stay locked after overlays
  close, and iOS restores the previous scroll offset. Quiz consent/submit modals,
  the WhatsApp enquiry sheet and the programme popup use the same capped scroll.
  Verified with `npm run typecheck`, `npm test` and `VERCEL=1 npm run build:sites`.

- Portal navigation audit (2026-11-22). The desktop sidebar was inert: `PortalSidebar`
  rendered nav buttons with no click handler and computed `active` by comparing
  `ctx.role` to the view key, so clicking a module did nothing and the current
  page never highlighted. It now takes `view`/`onNavigate`, routes on click and
  marks the active item. The mobile drawer was worse: `Navigation` filtered
  `PORTAL_VIEWS` through a mock context whose `can`/`canAny`/`canAll` always
  returned false, so staff lost every permission-gated module on mobile; the
  drawer now uses `useVisiblePortalViews()` and matches the desktop list. Also
  removed unused icon/component imports (`FileText`, `Lightbulb`,
  `StudentAssignments`, dead `HubTabs`), added `messages`, `timetable` and
  `report-cards` to the sidebar relevance order, and fixed the two hook-deps
  warnings. Backend/client audit found the Supabase client and `fetchState`
  per-table failure handling sound; RPC usage is covered by the existing tests.
  Verified with `npm run typecheck`, `npx eslint` on the touched files,
  `npm test` (52 pass, 1 skipped) and `npm run build:sites`.

- Messaging and Program Builder audit (2026-11-22). `ChatHub` was wired to the
  chat data layer only by import: it never loaded people or messages, called
  `useSignedUrl` inside the message `map` (a hook in a loop, the same React
  #300 failure the portal splash fix addressed), always built a DM target so
  group sends were unreachable, dropped the conversation name after sending,
  and had a fake recorder plus dead image/file buttons. It now uses
  `useConversations(meId, state.users, tick)` and `useChatThread`, keeps a
  stable conversation object, renders attachments through a `Bubble` child
  (one signed-URL hook per message), uploads images/files and real
  `MediaRecorder` voice notes, marks threads seen once messages load, scrolls
  to the newest message, and has working "New message" and "New group"
  flows using `createChatGroup`. `createChatGroup` inserts the owner membership
  row before the other members, because the STABLE admin policy cannot see rows
  from the same multi-row INSERT. Group unread badges now count only messages
  after the member's `last_read_at` instead of every group message ever, and
  `useChatThread` depends on a stable `kind:id` key rather than the target
  object, so inline targets in `DirectoryMessaging`/`PeopleManagement` no longer
  cause a refetch loop. The top-bar `PortalInbox` scanned `aoh-dm-*`
  localStorage keys that nothing writes (the chat layer uses Supabase plus
  `aoh-dm:v1:`); it now reads `useConversations` and opens the chat dialog
  directly. Program Builder's wizard dialog scrolls to the top on every step or
  validation error (the error message moved above the step body) and, after a
  create or edit, scrolls the affected catalogue card into view with a brief
  amber ring instead of leaving the user at the top of a long grid.
  Verified with `npm run typecheck`, `npx eslint` on every touched file and
  `npm test` (52 pass, 1 skipped). Not verified in a browser: the messaging
  flows need two signed-in accounts, and the Program Builder create flow was
  not driven end to end.

- Messaging smoke check (2026-11-22, dev server + signed-in student
  `test@africaofhopelr.org`). The first pass found one more real defect: on a
  phone the Messages module started in `view === "conversations"` while the
  conversation list was `hidden md:flex`, so the whole module showed only the
  "Select a conversation" placeholder with no list and no New message/New group
  buttons. The list is now the landing pane on small screens (it yields only
  when a thread is open) and the placeholder is desktop-only. Verified live:
  Messages renders the list, the New group dialog lists all 18 portal members,
  New message opens the DM thread (composer, photo, file and voice controls,
  "No messages yet"), `direct_messages` loads with HTTP 200 through the
  `useChatThread` key fix and no React error appears in the console. Not
  verified: sending a message or creating a group (no second live account), and
  the Program Builder wizard (the admin role is needed; no admin login here).

- Module/backend audit, instructor role and photo avatars (2026-11-22).
  Every module now renders a person's uploaded photo instead of initials
  (`UserAvatar`, which already falls back to initials when there is no photo):
  the Staff & Students directory rows (staff, students, applicants), the
  Applicant queue and Student Directory in `AdminTeacherViews`, both member
  pickers and the thread header in `ChatHub`, conversation rows and search
  results in the top-bar `PortalInbox`, the member profile dialog in
  `DirectoryMessaging`. Chat conversations already carried `avatarUrl` from
  `profiles.avatar_url`; groups keep an initials badge because they have no
  photo. The directory previously drew its own gradient initials bubble in
  four places, which hid the uploaded photo entirely.
  The stored Role value is still exactly `Teacher`: RLS policies, the
  `role_permissions` matrix, cohort triggers and the `admin-users` worker all
  key off it, so renaming the rows would have locked instructors out. Instead
  `src/lib/roleDisplay.ts` is now the single display layer (`displayRole` →
  "Instructor", `isInstructorRole`, `canonicalRole`) and every screen uses it:
  the staff directory's role filter, role select and badges, the Add staff
  role buttons and duplicate-email message, role/permission matrix columns and
  guide, chat and inbox role labels, and the sidebar group heading. This also
  fixed a real functional bug: the portal's instructor checks compared against
  `"Instructor"` while the database stores `"Teacher"`, so a teacher signing in
  got the admin dashboard, the Academic Approval Centre, an unfiltered
  timetable/report-card list, and — worst — `CohortCoordinator`'s teacher
  picker was empty, so a cohort could not be assigned to any instructor at all.
  Those checks now go through `isInstructorRole` (`DashboardView`, view labels,
  insights, `AcademicPlanning`, `CohortTimetable`, `TermReportCards`,
  `CourseDiscussions`, `HopeAssistant`, sidebar heading, cohort coordinator),
  announcements addressed to instructors match again, `usePermissions`
  resolves an `Instructor` role onto the stored `Teacher` grants, and the AOH
  AI staff allowlist accepts both spellings. Permission descriptions now say
  instructors.
  Backend audit with a live signed-in session: all 55 tables the client reads
  answer (the 12 that deny anon are readable to a member), all 21 `.rpc()`
  names have matching `create function` definitions in `supabase/migrations`
  and `finalize_expired_quiz_attempts` answered 200, and 58 of 59
  `.from().select()` column lists matched the live schema exactly (the 59th
  failed only because the probe URL was not encoded). Verified with
  `npm run typecheck`, `npx eslint` on the touched files, `npm test` (52 pass,
  1 skipped) and `VERCEL=1 npm run build:sites`. Not verified in a browser:
  the directory and chat need a staff login, and only the student QA account
  was available; a `Teacher`-role profile ("Samfort Kan") exists in
  `profiles` and the Super Admin profile has a real avatar, so both changes
  will show once a staff member signs in.

- Instructor wording completed and shipped to production (2026-11-22).
  Three module empty states, the CohortTimetable labels/placeholder and the
  AnnouncementManager audience option still said "Teachers-Instructors"; they
  now read "Instructors"/"instructor", and the welcome-email hint says
  instructors. Deployed to production (site 9c1d5f42, operation
  e8210b05… for 8016dea then 11f99c9b… for 22a9d33): the live bundle at
  https://www.africaofhopelr.org is `assets/index-BxOXBePY.js`, byte-identical
  to the local build (sha256 match), contains no "Teachers-Instructors" string,
  and `/`, `/portal/`, `/login/` answer 200. `aoh.freebuff.site` 307s to the
  custom domain.

- Backend write-path audit and completion (2026-11-22). Every table and RPC the
  client calls was diffed against the live project: 64 tables all exist, all 29
  `.rpc()` names exist with EXECUTE granted to `authenticated`, all three public
  views are `security_invoker`, and 51 client-written tables were checked
  policy-by-policy. Four write paths the UI offers had no RLS policy, so
  Postgres rejected them while the screens still toasted success and the change
  disappeared on reload: editing/deleting a discussion question, editing a
  reply body, deleting a reply, and the Aptitude Control `upsert` (an upsert is
  INSERT ... ON CONFLICT DO UPDATE, so it needs an INSERT policy). Migration
  `20261122120000_discussion_and_aptitude_write_paths.sql` is applied live: it
  adds `discussion_threads_edit` / `_delete`, `discussion_replies_edit` /
  `_delete` (author, cohort instructor, or `academic_plans.approve` moderator),
  `aptitude_settings_insert_staff`, and widens the aptitude write policy to
  include Super Admin, who could not publish rules before. `discussion_guard`
  now handles UPDATE: identity columns are immutable, an author edits their
  own text and a cohort instructor or academic administrator may moderate it,
  while the answer flag stays instructor-only. `CourseDiscussions` no
  longer swallows those errors — it selects the row back and reports the real
  refusal instead of claiming the edit was saved; `EntranceTestAdmin` says
  "saved on this device only" when the canonical row was rejected and now
  checks the error on preparation create/update/delete too. Device audit: all
  23 student views render at 390–432px with zero horizontal overflow and no
  page errors, every wide table is inside an `overflow-x-auto` container, and
  the portal shell keeps `main` as the only vertical scroller. Verified with
  `npm run typecheck`, `npx eslint` on both touched files, `npm test` (52 pass,
  1 skipped) and `VERCEL=1 npm run build:sites`. Not verified: staff/admin
  modules in a browser (no staff login available), and an end-to-end author
  edit of a real discussion (the project currently has no cohorts or threads).

- Sidebar redesign, working system theme, video uploads and the reset/email audit
  (2026-11-22). The desktop rail and the phone drawer were two different
  components with two palettes; the drawer also lost its "Reload live data"
  button to `resetDemoData()` while the desktop one dispatched
  `aoh-reload-live-data`, an event nothing listened to. `PortalSidebar` is now
  the single navigation rendered by both (`Navigation`'s bespoke drawer nav is
  deleted), driven by `themeSettings` through the new
  `src/lib/portalTheme.ts`: `sidebarTheme` (emerald / gold / midnight / light),
  `fontSize` (compact / comfortable / large), `sidebarAlign`, `backendTheme`
  for the portal background, and the admin-defined `customModules` under a
  "Shortcuts" group. The active item uses `--portal-primary` so the primary
  colour from Appearance is real. `AppContext.reloadLiveData()` refreshes every
  live table, bumps `reloadKey` for self-fetching modules and also answers the
  legacy `aoh-reload-live-data` event; both sidebars show a spinner and only
  report after the refresh settles. Admin → System Settings → Appearance gains
  a sidebar preview so the admin sees the palette/altitude before saving.
  Public video: `site-assets` only accepts images, so hero videos could never
  upload. New public bucket `site-videos` (mp4/webm/quicktime, 50 MB) with
  read-for-all and cms.manage / is_portal_admin write policies (migration
  `20261122130000_site_videos_and_email_audit.sql`, applied live),
  `uploadSiteVideo` in `src/lib/storage.ts`, a `VideoBox` in `CmsPrimitives`,
  `HeroSlide.video` and a poster-backed `<video>` in `HeroSlider` for the
  active slide (skipped under reduced motion). Password reset had a dead root
  cause: the project Site URL was `https://africaofhopelr.org`, which no longer
  resolves (DNS), so every admin reset/invite email without an explicit
  `redirectTo` pointed at a dead host; the live Auth config now uses
  `https://www.africaofhopelr.org`, SMTP rate limit went from 1/minute (which
  throttled bulk resets and confirmations) to 60/minute with
  `rate_limit_email_sent` 60, and `admin-users` passes `redirectTo` for invites
  and resets (uses APP_URL / PUBLIC_SITE_URL / the request Origin). The client
  reset link sends `${origin}/` to match the allowlist. Email audit: the
  outbox is readable by `email.manage` holders too (new policy) and the panel
  names a provider "sender not authorised" rejection instead of leaving a bare
  failed count; 11 failed rows are all provider-side (Resend key not authorised
  for `africaofhopelr.online`), which needs the owner to verify the domain or
  replace the key, then Retry failed. Public-site audit: canonicals, OG/Twitter
  images, JSON-LD, sitemap, robots, llms.txt and the Cloudflare `_redirects`
  all pointed at the dead apex and `_redirects` actively 301'd www → apex;
  `CANONICAL_ORIGIN`, `OG_IMAGE`, `scripts/prerender-routes.mjs` and those
  public files now use `https://www.africaofhopelr.org`, and `_redirects`
  canonicalises to www. Verified: `npm run typecheck`, `npm test` (52 pass, 1
  skipped), `VERCEL=1 npm run build:sites`, and in the cloud browser at 432px
  + 1440px (student account): public home renders live data, the drawer and
  desktop rail are the same themed sidebar, the desktop rail is 288px with
  background `#0b241c`, active item highlighted, no horizontal overflow, and
  Reload live data issued 42 REST reads. Not verified: uploading a video or
  changing the theme in the admin UI (no staff login), and the manifest 403 on
  the style.dev preview is the preview proxy refusing `.webmanifest` (local
  Vite serves it 200).

- Discussion write paths and entrance-test writes now report the real backend
  refusal instead of toasting a false success. `CourseDiscussions` selects the
  row back on edit/delete and throws when RLS or the `discussion_guard` denies
  it; `EntranceTestAdmin` reports "saved on this device only" when the canonical
  aptitude row was rejected, and the same pattern is applied to preparation
  create/update/delete. The write-path migration included here
  (`20261122120000_discussion_and_aptitude_write_paths.sql`) is the same family
  the previous audit applied.

- Auth-page background image added for login, sign-up and password reset.

- Self-paced learning hardened: RLS policies replaced permissive `using (true)` staff rules with `public.is_staff()` / ownership checks; added `published` state to weeks/lessons/activities and a `self_paced_resources` table for media/documents/links; component gained upload/link add, edit/delete, in-app link viewer and Live publish/unpublish toggles across content.
- Chat hub: moved poll creation into the message composer, removed the thread search box, moved group photo upload into group settings, added chat background image upload (migration `20261124100000_chat_group_background.sql`) and a wired Save button in group settings, and added online (green/faded) status dots plus live online member counts in group chat headers.
  `src/lib/storage.ts` gets `uploadAuthBackground(folder, file)` and
  `pruneAuthBackground(folder, keepUrl)`, which store into the public
  `site-assets` bucket under `auth-background/<folder>` as PNG/JPEG/WebP,
  preserving transparency for transparent backgrounds (same `uploadPublicImage`
  path as `uploadSiteAsset`). `AuthSettings.authBackgroundImage` is the new CMS
  field, the auth tab in `AdminWebsiteSettings` gets its own `AuthBackgroundBox`
  editor kept separate from the existing showcase image, and
  `src/components/AuthPortal.tsx` renders the published background on the
  desktop showcase side and keeps the form page on mobile. Typecheck and tests
  pass.

- Self-paced submission file upload wired (2026-11-23): `uploadDocument` now
  returns its storage path; `SelfPacedLearning` adds an "Attach file" control
  per activity, uploads via `uploadDocument`, stores the path in `file_url`, and
  `ActivityGrading` shows an "Open attachment" link (signed URL via
  `documentUrl`). `submitActivity` receives `fileUrl`.

- Chat settings pass (2026-11-23).
- Roles/permissions and PWA enforcement pass (2026-11-23). Added chat.use permission granted to all roles including Student; added Messages, Donate and Student Policy modules to every staff role guide. PWA install prompt re-prompts every 30s until accepted/declined; update and push-notification prompts re-prompt every 30s; push permission prompt added across public and portal shells. Group settings now load and save name/description/join policy, group member count opens a member list, upload preview shows for every file type, poll voting toggles options safely in multiple mode, and the Clear control was removed from the thread top bar.
- Donate, student policy and chat UX pass (2026-11-23). Donate page now shows verified Orange Money (0776679963) and MTN Mobile Money (0888061379) details to recipient Sheddrick K. Nungehn. School Policy renamed to Student Policy and made admin-editable. Chat composer gained a full emoji picker and a language switcher in the thread header.

- Knock notification foundation (2026-11-23). Added @knocklabs/client and @knocklabs/react, env vars VITE_KNOCK_PUBLIC_API_KEY and VITE_KNOCK_FEED_CHANNEL_ID, src/lib/knock.ts service wrapper, KnockProviderShell wrapping the portal, a conditional KnockNotificationBell in the header, src/lib/knockNotify.ts client helper, supabase/functions/knock-notify Edge Function scaffold for secure workflow triggers, and migration 20261124130000_knock_notification_audit.sql. Full Knock feed UI and per-module event wiring remain pending Knock credentials.
- Backend completion pass (2026-11-23). Applied pending Supabase migrations
  `20261124000000_self_paced_rls_media_publish` (RLS hardening, `published`
  columns, `self_paced_resources` table) and `20261124100000_chat_group_background`
  (`chat_groups.background_url`), plus a new `notifications_insert_self` /
  `_staff` insert policy so self-paced notifications can be written. Self-paced
  UI: unpublished weeks no longer leak to students; per-activity submission text
  is now independent (no shared input state). Backend/admin views: bare
  `grid grid-cols-2` layouts now stack on phones. Typecheck, tests (52/53,
  1 skipped) and build pass.


- Knock all-notifications rollout (2026-11-23). Added `knock-dispatch` Edge Function (verify_jwt=false, internal-token gated) that reads a `notifications` row and triggers the Knock workflow `in-app-notification` (configurable via KNOCK_WORKFLOW). Added DB trigger `notifications_dispatch_knock` so every inserted notification (DMs, payments, classwork, attendance, schedule, academic status, self-paced, etc.) is dispatched to Knock automatically, mirroring the existing push dispatch. Full in-app feed UI (`NotificationIconButton` + popover, `NotificationFeed`, notifications portal view), signed user-token minting (`knock-user-token`), and env wiring remain. Typecheck, tests (52/53, 1 skipped) and build pass.

- Knock workflow created: `in-app-notification` (in-app feed channel `africa-of-hope`) committed in development and promoted to production. Verified end-to-end: a test notification row triggered `knock-dispatch` which returned 200, and the temporary test row was removed. Helper function `knock-setup-workflow` deleted.

- UI polish pass (2026-11-23): removed stale bulletin Bell icon from portal header; message icon now navigates to the full Messages module (ChatHub) with unread badge; announcement scrolling banner enabled for all users when configured in admin (no longer gated on sitePublished); auth login card made translucent (bg-white/70 + backdrop-blur) over the published auth background image. Typecheck and build pass; deployed to production https://aoh.freebuff.site.

- Messaging for every role + PWA prompt reliability (2026-11-24). Root cause of
  "Messages is missing for everyone except Super Admin": `chat.use` existed only
  in the code defaults, never in `public.permissions` / `public.role_permissions`,
  and `src/data/liveData.ts` prefers the DB matrix whenever it has rows, so
  `can("chat.use")` was false for all 12 non-super-admin roles (40 of 41 accounts).
  Fixed by migration `20261124150000_chat_use_all_roles.sql`, which seeds the
  permission catalogue row and grants `chat.use` to every role except Super Admin
  (implicit). Verified live as a Student account: Messages appears in the sidebar
  and the ChatHub opens with New message / New group. Root cause of "the Feature
  update prompt never appears": `public/sw.js` had a hardcoded `VERSION` that never
  changed between deploys, so every release served a byte-identical worker, the
  browser never produced a waiting worker and `UpdatePrompt` had nothing to show.
  `scripts/stamp-service-worker.mjs` now runs last in `npm run build` (and
  `build:strict`) and rewrites `dist/sw.js` `VERSION` to `build-<hash of
  index.html + assets>`, so each real change ships a new worker. Verified on
  www.africaofhopelr.org: waiting worker found, "Update available / Refresh now"
  rendered, activation reloaded once and the old `v8-cms-brand` caches were
  replaced by `build-7ba9a69360c2`. Also: `beforeinstallprompt` is now captured at
  module scope in `src/lib/pwa.ts` (it can fire before React mounts, which lost the
  install card), the stale `aoh-pwa-installed` localStorage flag no longer
  suppresses the card after an uninstall, and Profile → Device & updates gained an
  explicit "Install app" card with manual Add-to-Home-Screen steps for browsers
  that never fire the event. Apex `africaofhopelr.org` still has no DNS record, so
  it cannot be served or redirected; the owner must add it in Cloudflare.

- Permission catalogue completed for every role (2026-11-24). The same drift that
  hid Messages also hid 14 more modules: `timetable.manage`, `reports.manage`,
  `grades.manage`, `library.manage`, `aptitude.manage`, `email.manage`,
  `transparency.manage`, `policies.manage`, `discussions.moderate`,
  `operations.manage`, `verification.manage`, `impact.manage`, `campus.manage`
  and `donations.manage` were defined in `src/lib/permissions.ts` but had no row
  in `public.permissions`, so no role could hold them and the client matrix
  (`src/data/liveData.ts`) left those screens hidden for everyone except Super
  Admin. Migration `20261124160000_seed_missing_permissions_all_roles.sql` seeds
  the 14 catalogue rows (labels, groups and sort orders mirrored from
  `PERMISSIONS`) and inserts 70 `role_permissions` grants mirrored from
  `DEFAULT_ROLE_PERMISSIONS`, joined against `public.roles` so the code-only
  `Instructor` role is skipped rather than failing the foreign key. Applied live:
  the catalogue now holds all 47 keys with zero missing or extra against the
  code, 64 grants landed (144 → 208 rows) and every profile role matches a row in
  `public.roles`. Super Admin stays implicit; no existing grant was removed, so
  owner edits made in Roles & Permissions are preserved.

- Immediate push repaired (2026-11-23, `src/lib/livePush.ts`,
  `src/components/pwa/PushPermissionPrompt.tsx`, `src/lib/onesignal.ts`). Two
  independent defects made the message badge count without any alert.
  (a) `broadcastLive()` sent on the Realtime topic `aoh-live-v1` while
  `useLivePush()` listened on `aoh-live-v1-rx`; Supabase broadcast has no
  wildcard, so a DM from another account never reached the receiver's listener
  and no toast/device alert fired (only the 5 s unread poll moved the badge).
  Both sides now share one module-level channel and one topic, with
  `broadcast.self: false` preventing the sender's own echo, and a listener
  registry so several mounts can observe the same channel.
  (b) `PushPermissionPrompt` called raw `Notification.requestPermission()` and
  stopped, so the browser said "granted" while OneSignal held no player — the
  outbox showed 89 pushes `failed` with `All included players are not
  subscribed` and `onesignal_devices`/`push_subscriptions` were both empty.
  The prompt now creates the real OneSignal subscription (`oneSignalOptIn()`)
  after permission, re-links the Supabase user id (`oneSignalLogin`), keeps
  itself visible when permission is already granted but no subscription exists
  ("Finish setup"), and shows the honest failure message instead of hiding.
  `oneSignalOptIn()` also re-reads `OS.User.PushSubscription` after asking the
  notification gate, for v16 builds that only expose it afterwards. Typecheck
  passes; a real device must press "Finish setup"/"Enable" on the production
  origin once before any push can be delivered (still zero OneSignal players).

- OneSignal SDK loader race repaired (2026-11-23, `src/lib/onesignal.ts`).
  Pressing "Finish setup" answered "The push library could not start on this
  device" every time. Cause: `https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`
  is only a ~590-byte loader — it appends the real ~150 KB
  `OneSignalSDK.page.es6.js` as a separate script — so the loader's own `load`
  event fires while `window.OneSignal` is still undefined. `loadPageSdk()` read
  that event as "library started" and rejected immediately, so `initOneSignal()`
  never reached `OS.init()`. It now treats `load` as "loader arrived" only and
  resolves when the SDK instance actually appears, via `window.OneSignalDeferred`
  plus a 60 ms poll bounded by the existing 12 s timeout; the instance from the
  deferred callback is kept in `sdkInstance` and read through `currentSdk()`
  everywhere (`oneSignalStatus`, login, tags, logout, opt-in/out, click routing)
  because some mobile browsers attach `window.OneSignal` a tick later.
  A blocked CDN request (`error` event) and a stalled download (timeout) still
  reset `scriptPromise` so retrying genuinely retries. `initOneSignal()` now
  records why it failed (`lastInitError`: blocked CDN, timeout, missing push
  support, or the SDK's own public message — e.g. a domain/app-id mismatch) and
  Enable reports that reason instead of blaming the connection. Typecheck and
  `build:sites` pass; device delivery still needs one real "Finish setup" press.
