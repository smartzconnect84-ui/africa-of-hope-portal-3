# Release checklist — Edge Functions, SQL, storage, realtime

Nothing in this file has been executed here. No SQL was applied, no function was
deployed, no secret was set and no email or push message was sent. Treat every
box as owner/operator work with backend access.

## 1. Function auth modes and secrets

`supabase/config.toml` records the gateway mode for each function:

| Function | Gateway JWT | Authorised by | Server-only secrets |
| --- | --- | --- | --- |
| `admin-users` | required | authenticated staff role re-check inside the handler | service role |
| `assistant` | public | handler rate limit / size caps | `GROQ_API_KEY`, `GROQ_MODEL` |
| `newsletter` | public | hashed + HMAC-signed tokens, honeypot, per-IP throttle | `NEWSLETTER_TOKEN_SECRET` (≥32 chars), `PUBLIC_SITE_URL` |
| `verify-certificate` | public | exact-serial RPC that returns public fields only | anon key |
| `send-email` | public | `x-cron-secret` header compared constant-time against `EMAIL_CRON_SECRET`, or a staff JWT holding `settings.manage` | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `NEWSLETTER_TOKEN_SECRET` |
| `send-deadline-reminders` | public | `x-cron-secret` header compared constant-time against `REMINDER_CRON_SECRET` (or `CRON_SECRET`), falling back to the service-role key when neither is set | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

- [ ] Set every secret above with `supabase secrets set` — never in a `VITE_`/`PUBLIC_` name.
- [ ] Confirm no service-role key, Resend key, Groq key or VAPID private key appears in the repo or browser bundle.
- [ ] Set `EMAIL_CRON_SECRET` and `REMINDER_CRON_SECRET` to long random values, use the matching value in each scheduler call, and rotate either if it ever leaked. Setting only `CRON_SECRET` is enough for reminders but not for the email worker.
- [ ] Re-check that `PUBLIC_SITE_URL` is the real production origin so emailed confirm/unsubscribe links resolve.

## 2. Database upgrades — staging first, forward only

- [ ] Take a full backup plus an inventory of Auth users, row counts, certificate serials and storage objects; prove a restore on a disposable project.
- [ ] Compare the deployed migration list with `supabase/migrations/`. Never replay the historical baseline, `APPLY_ALL_PENDING_SQL.sql`, duplicate unversioned SQL or catalogue seeds against live data.
- [ ] Apply only the reviewed missing additive migrations in timestamp order: certificate issuance/revocation → unique identifiers → `20261030000000_production_access_hardening.sql`.
- [ ] Inspect for duplicate or blank certificate serials and orphaned rows before migrating. Stop for registrar review; never silently renumber or delete records.
- [ ] Keep existing primary keys and real records. Do not run rollback snippets or contract-test fixtures against production (`supabase/tests/*` create synthetic Auth users).

## 3. Storage

- [ ] Confirm bucket names, MIME allow-lists and size limits match `src/lib/storage.ts` and the hardening migration.
- [ ] Personal documents stay private (signed URLs only); public images stay public-read.
- [ ] Upload once as each role and confirm rejected types/sizes show a real error and that no object is deleted before its record update succeeds.

## 4. Realtime

- [ ] Confirm every subscribed table is in the `supabase_realtime` publication; a missing table fails silently in the browser.
- [ ] While signed in on two devices, edit a record and confirm the second view refreshes once (debounced), cleans up after sign-out, and does not resurrect data from a previous identity.
- [ ] Confirm RLS still blocks cross-account reads even with realtime enabled.

## 5. Live journeys to verify (each unverified today)

- [ ] **Email**: claim a row from `email_outbox`, send, and check the worker reports `sent` and acknowledges the row. Re-run and confirm no duplicate is sent.
- [ ] **Push**: subscribe on a physical iOS device (installed to Home Screen) and an Android device, force a reminder, and confirm delivery with the app closed. Revoke a subscription and confirm cleanup.
- [ ] **Newsletter**: subscribe, confirm from the email link, receive a queued campaign, unsubscribe from the footer link.
- [ ] **Certificates**: issue one certificate, download PDF/CSV/JSON, revoke it with a reason, and confirm public verification reports revocation while bulk register reads stay restricted.
- [ ] **AOH AI**: send one real prompt through `assistant` and confirm a Groq reply. An implemented handler is not a tested assistant.
- [ ] **Auth**: sign in as every role (Super Admin, School Admin, Admission Officer, Teacher, Student, Parent) and confirm each sees only permitted screens and data. Confirm no passwordless profile switch remains.
- [ ] **PWA**: install, go offline, confirm the offline fallback and banner, then deploy a new build and confirm the update prompt activates the new worker.

## 6. Operations

- [ ] Schedule both cron workers (email every few minutes, reminders daily) with the matching `x-cron-secret` header and confirm runs appear in function logs, including a run where `acknowledgementErrors` is empty.
- [ ] Set log retention/alerts for 5xx responses, `acknowledgementErrors`, Resend failures and Groq errors.
- [ ] Verify the attached-logo URL used by `public/sw.js`, `manifest.webmanifest` and launch/install UI loads on production. Confirm installability and icon rendering on real devices; existing home-screen icons may need reinstalling.
- [ ] Rotate any administrator password ever embedded in repository history and review Auth logs.
- [ ] Run the role-by-role file-action, Remember me, homework attachment and revoked-certificate tests in `supabase/BACKEND_ACTION_COVERAGE.md`.
- [ ] Re-read `supabase/PRODUCTION_AUDIT.md`; only claim production readiness after every box above is checked by an actual run.
