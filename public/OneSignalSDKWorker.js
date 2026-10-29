/* AFRICA OF HOPE — OneSignal service worker.
 *
 * OneSignal requires this file at the site root (/OneSignalSDKWorker.js).
 * It loads the official OneSignal worker AND reuses the existing PWA worker
 * (/sw.js) so offline caching, install and updates keep working no matter
 * which registration the browser keeps (both live at scope "/").
 *
 * Do NOT register a second worker manually — the OneSignal SDK registers
 * this file automatically once initialized (see src/lib/onesignal.ts).
 */
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
  // CDN unreachable (offline first install): PWA logic below still applies.
}
try {
  importScripts("/sw.js");
} catch (e) {
  // /sw.js unreachable: OneSignal push handling above still applies.
}
