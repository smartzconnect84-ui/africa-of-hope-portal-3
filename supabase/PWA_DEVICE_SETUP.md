# PWA device setup and validation

No production changes or migrations have been applied by the editor. Browser compilation is not a physical-device or remote-delivery test.

## Production prerequisites

- Serve the app at the root of an HTTPS origin. Serve `/sw.js` and `/manifest.webmanifest` with `Cache-Control: no-cache`; do not rewrite these URLs to the SPA HTML. Versioned `/assets/` can be immutable.
- Apply `migrations/20261028000000_push_reminders.sql` after review. Client and worker use `reminder_settings`, `reminder_items`, and `push_subscriptions`.
- Configure a matching VAPID key pair: only `VITE_VAPID_PUBLIC_KEY` goes into the app build. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` stay in Supabase secrets. Never put the private key in browser variables.
- Deploy the updated `send-deadline-reminders` function. Schedule POST every 15 minutes with `Authorization: Bearer <REMINDER_CRON_SECRET>` (server-only secret). The service-role token is accepted for existing server cron jobs. If using a custom cron secret, disable Supabase's JWT gateway validation for this function and rely on its exact bearer-secret check; do not disable its in-function authorization.
- This queue contains deadlines/announcements discovered when the portal was last opened. It does not promise to discover new deadlines while nobody is signed in. A server-side enqueue job is needed for that additional behavior. Remote push requires connectivity and can be delayed by Focus, battery-saving and OS policy.

## Device permissions

Every signed-in role can use Profile → Device & updates. Notification access is requested only by pressing Enable; camera, microphone, location and contacts are not requested because these features do not use them. No web app can override OS permission choices.

- iPhone/iPad: iOS/iPadOS 16.4+; open in Safari, Share → Add to Home Screen, launch that installed app, sign in, then enable notifications. If blocked, change Settings → Notifications for the installed app. In-browser iOS tabs do not support web push.
- Android: current Chrome/Edge/Firefox with HTTPS and notifications enabled. Installation is recommended but not required for browsers supporting push. Use browser Site settings and Android app notification settings if denied.
- Desktop: current browsers with Service Worker, Notifications and PushManager support. Unsupported browsers retain portal reminders and explain limitations.
- Pause disables this account's subscription on this device, not every device. A browser subscription owned by another signed-in account is not silently reassigned.
- The Local device test checks OS display only, not remote sender delivery.

## Real-device acceptance checks (pending)

1. On Android, installed iPhone/iPad, and desktop: install, launch, resize/rotate, verify offline banner, navigate offline and reconnect.
2. Keep version A open, deploy a changed `/sw.js` (increment VERSION). Resume app or Profile → Device & updates → Check for updates. Save work and press Refresh. Confirm new version loads once; dismiss must not reload. Test offline activation error/retry.
3. Test default, granted and denied permission states; verify no permission prompt on render. Enable, send local test, reload and verify registration restored; pause and verify disabled backend row.
4. With a real test account, queue an eligible reminder, run authorized cron, confirm receipt while the PWA is closed and tap opens a same-origin URL. Repeat for denied/paused permissions and multiple devices. Verify expired endpoints are removed and unauthenticated worker calls return 401.

Do not report remote push delivery as working until these tests succeed on the actual production domain.
