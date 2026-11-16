# OneSignal Web Push — setup, secrets & verification

> Code is implemented. Push DELIVERY is not verified here (no production
> domain access, no OneSignal account, no physical device in this environment).
>
> Android APK: this repo is web-only (no Capacitor/native/TWA wrapper checked
> in). The shared backend + navigation already serve both installs — see
> `supabase/ANDROID_APK_PUSH_SETUP.md` for the Firebase/OneSignal dashboard
> steps, Digital Asset Links and the device test matrix.

## What was built (code)

- `src/lib/onesignal.ts` — lazy official Web SDK v16 loader (`OneSignalSDK.page.js`
  via CDN, no npm dep), init-once, graceful failure, identity login/logout,
  trusted role/course tags, opt-in/out helpers. Never blocks render, never
  auto-prompts users who already decided.
- `public/OneSignalSDKWorker.js` — required OneSignal worker path at site root.
- `public/sw.js` — now `importScripts` the OneSignal worker FIRST, then existing
  PWA caches. Whichever registration the browser keeps serves both push + offline.
- `src/components/notifications/OneSignalPanel.tsx` — per-role subscription card
  (status, Enable/Turn off, lock-screen explanation). Mount alongside the existing
  `ReminderSettings` card; identity links on sign-in.
- `supabase/functions/onesignal-send/index.ts` — authorized central sender.
  Staff-only JWT check, broadcast restricted to admin/registrar, server-side
  audience resolution, idempotency keys, bounded OneSignal REST call, outbox log,
  in-app `notifications` rows for direct recipients. Never logs the REST key.
- `supabase/migrations/20261107000000_onesignal_push.sql` — `notification_outbox`,
  `onesignal_devices`, `notifications` + RLS (users see only their own rows;
  staff read outbox history). Additive only.
- `src/components/admin/OneSignalAdminPanel.tsx` — admin composer (title/message/
  destination/audience), confirm-before-broadcast, history, honest
  accepted ≠ delivered ≠ read copy.
- `supabase/config.toml` — add below before deploy:

```toml
[functions.onesignal-send]
verify_jwt = true
```

## Credentials wired in this build

- Frontend default App ID: `1c7444cf-8299-48c3-adf7-0d1b32dbed7b` (owner-supplied 2026-10-26).
  `VITE_ONESIGNAL_APP_ID` still overrides it when set.
- Frontend default Safari Web ID: `web.onesignal.auto.3431b9a6-8377-4186-9b23-bf65dbb4a731`.
  `VITE_ONESIGNAL_SAFARI_WEB_ID` still overrides it when set.
- The App ID is public and frontend-safe. The REST API key was NOT supplied, so
  server sends still need it (see below) — no key was fabricated.

## Required OneSignal dashboard settings (owner action)

1. Create a Web Push app at onesignal.com → **App ID** (public, frontend-safe).
2. **Settings → Platforms → Web**: Site URL = the REAL production origin
   (e.g. `https://www.yourschool.edu`), NOT localhost/preview. Upload the site's
   default icon (`/icons/icon-192.png`, green #16803C branding).
3. Keep the default worker path `/OneSignalSDKWorker.js` at the domain root.
4. Create a **REST API key** (server only).

## Required secrets (never in frontend / GitHub)

- Frontend (Vite, safe to expose): `VITE_ONESIGNAL_APP_ID=<app-id>`,
  optional `VITE_ONESIGNAL_SAFARI_WEB_ID`.
- Server only (Supabase Edge Function secrets):
  `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`.
  Set via: `supabase secrets set ONESIGNAL_APP_ID=... ONESIGNAL_REST_API_KEY=...`
  then `supabase functions deploy onesignal-send`.

No credential is fabricated anywhere; until you supply them the UI shows
"not configured" and the function returns HTTP 503 (no fake success).

## Remaining manual steps

1. Apply pending migrations in order (incl. `20261107000000_onesignal_push.sql`).
2. Deploy `onesignal-send`; set the two server secrets above.
3. Set `VITE_ONESIGNAL_APP_ID` in production env; rebuild/redeploy frontend so
   `/OneSignalSDKWorker.js` is served at root over HTTPS.
4. In the OneSignal dashboard confirm the subscription appears after enabling.
5. Mount `<OneSignalPanel/>` next to `ReminderSettings` and
   `<OneSignalAdminPanel/>` in the admin hub (staff route).

## Verification matrix (honest status)

- [x] Production build + TypeScript compile (via `check_project`).
- [x] `/OneSignalSDKWorker.js` file present for root serving.
- [x] No secret in frontend bundle (App ID only; REST key server-only).
- [ ] SDK loads on production origin — needs deployed site.
- [ ] Subscription appears in OneSignal dashboard — needs real App ID + browser opt-in.
- [ ] Single-device test notification + correct deep link — needs dashboard/manual send.
- [ ] Background + Android locked-screen delivery — needs physical device.
- [ ] iOS Home-Screen (16.4+) delivery — needs iPhone + installed PWA.
- [ ] Role/course targeting, RLS isolation, unauthorized-send rejection — needs live Supabase with migration applied.
- [ ] Class-reminder scheduling/timezone/dedup — wire cron → `onesignal-send` per event; logic is idempotency-keyed, live run pending.
- [ ] Existing PWA install/offline/update regression — needs device test after deploy.

Delivery depends on browser support, OS battery/data-saver, network and user
permission — instant delivery is never promised.
