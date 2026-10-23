# Android APK push — FCM + OneSignal setup (AFRICA OF HOPE)

Status: **code-ready, device delivery NOT yet verified.** The repo ships a
web-only PWA (no `android/` project, no Capacitor, no `google-services.json`,
no Firebase config). An APK therefore wraps this same web app (TWA / WebView
shell built externally, e.g. PWABuilder / Capacitor build lane). No
incompatible native SDK was added to the web build.

Shared backend: the PWA and the APK use the SAME `onesignal-send` Edge
Function, the same notification templates, and the same identity
(`Supabase user id` → OneSignal `external_id`). A student may use the PWA,
the APK, or both — no duplicate accounts. PWA (Web Push) and APK (FCM)
subscriptions are separate OneSignal subscriptions under one user.

## 1. What the code already does

- `src/lib/androidPush.ts` — detects `installed-pwa` vs `android-wrapper`
  (TWA/WebView/Capacitor shell) vs browser; maps every school event
  (class reminder, material, exam, certificate, announcement, enrollment,
  fees, helpdesk, grade appeal) to one portal view; `?push_view=` cold-start
  + post-login resume via `aoh-push-navigate`.
- `src/lib/onesignal.ts` — tags each subscription with `platform` /
  `pwa_installed` (hints only; server re-validates role/course), registers a
  foreground click handler that routes inside the running app, never
  auto-prompts.
- `src/App.tsx` — listens for `aoh-push-navigate`, opens the portal view
  when signed in, otherwise parks the destination and resumes after login.
- `public/.well-known/assetlinks.json` — TEMPLATE with placeholders. Fill
  only with the real package name + SHA-256; wrong values break App Links.
- Every push URL is same-origin (`/?push_view=<portal key>`); protected
  pages still require a valid session.

## 2. Required: Firebase Console (owner actions)

1. Open (or create) the school's Firebase project at
   https://console.firebase.google.com — reuse the existing project if the
   school already has one; do NOT create a second one unnecessarily.
2. Add an Android app with the EXACT production package name
   (e.g. from the APK builder — never invent it here). Use the real name.
3. Download `google-services.json` into the ANDROID project used to build
   the APK (the external TWA/Capacitor lane — this web repo has no
   `android/` folder, so this file does NOT belong in this repo or GitHub).
4. Enable **Cloud Messaging**. For OneSignal Android delivery, open the
   OneSignal dashboard → Settings → Platforms → Google Android (FCM) and
   supply the FCM credential OneSignal currently asks for (today: the FCM
   **Server key** / Sender ID pair; OneSignal documents a move to the FCM
   HTTP v1 service-account JSON on some plans — follow the dashboard's
   current prompt, never paste private keys into frontend code or GitHub).
5. Create the notification channel in the ANDROID wrapper project
   (not in this web repo): id `aoh_school` (or per-category ids), name
   "School alerts", importance HIGH, vibration + lights on, lock-screen
   visibility PUBLIC. Time-sensitive alerts use high priority; routine
   digests use default priority — never abuse high priority.
6. Declare `POST_NOTIFICATIONS` (Android 13+) and request it at runtime
   from a user gesture; handle Deny gracefully (portal messages keep
   working). Add `RECEIVE_BOOT_COMPLETED` only if the wrapper needs
   reschedule-on-reboot.

NEVER commit `google-services.json`, service-account private keys, or the
OneSignal REST API key to GitHub or frontend code. REST key lives in the
Edge Function secret (`ONESIGNAL_REST_API_KEY`).

## 3. Required: OneSignal dashboard (owner actions)

1. Same OneSignal app (`1c7444cf-…`) → add/configure the **Google Android
   (FCM)** platform with the credential from §2. This makes the app
   dual-platform: Web Push (PWA) + FCM (APK) under one `external_id`.
2. Android notification channel + icon: set the small icon (white-on-
   transparent, existing logo silhouette), accent `#16803C`, channel id
   matching §2, lock-screen visibility Public.
3. Site URL stays the production web origin (PWA platform unaffected).
4. Send a test to ONE subscribed APK device → confirm it appears in
   Audience → Subscriptions as an Android/FCM subscription under the right
   `external_id`, tagged `platform=android-wrapper`.

## 4. Lock-screen / Doze notes (Android)

- Delivery path is FCM → system tray, NOT a foreground timer: works with
  the screen off, locked, backgrounded, or the UI closed, while the device
  has network and the user granted permission.
- Doze/App Standby may defer non-urgent pushes; high priority shortens but
  does not eliminate deferral. Never promise instant delivery while offline
  or battery-saver-restricted.
- Verify on a physical phone: app closed + screen locked → send class
  reminder → banner on lock screen → tap opens Study Calendar.

## 5. Testing matrix (mark each verified / pending)

Web/PWA regression: PWA install, worker scope `/`, offline cache, update
prompt, PWA push subscribe/opt-out, denied-permission copy — must keep
passing (`check_project` covers build+types only).

APK (needs built APK + physical device — NOT verifiable from this editor):
[ ] APK installs; [ ] OneSignal initializes; [ ] subscription appears in
dashboard as Android; [ ] foreground banner; [ ] background tray;
[ ] lock-screen with UI closed; [ ] tap → correct portal view;
[ ] user targeting; [ ] course targeting; [ ] denied permission graceful;
[ ] PWA still receives independently; [ ] no duplicate on same install;
[ ] logout/account-switch isolates identities.

## 6. Deliverables status

- Framework detected: **none in repo — web-only PWA** (no Capacitor, no
  native project, no TWA config, no Firebase). APK is built externally.
- OneSignal Android SDK: NOT installed in this repo (correct — a native
  SDK belongs in the Android wrapper project, not the web bundle).
- FCM: NOT configured — needs owner Firebase + OneSignal dashboard steps.
- Package name / fingerprints / keys: NOT invented — placeholders only.
- APK build + lock-screen test: PENDING physical device + owner build lane.
