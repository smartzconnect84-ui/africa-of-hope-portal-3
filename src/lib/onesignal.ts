/**
 * AFRICA OF HOPE — OneSignal Web Push frontend integration.
 *
 * Uses the official OneSignal Web SDK v16 via CDN (no npm dependency):
 *   https://documentation.onesignal.com/docs/web-push-setup
 *
 * Guarantees:
 * - SDK loads lazily AFTER first render, initializes at most once.
 * - No render blocking, no duplicate init in StrictMode/dev.
 * - Failures are graceful and never expose secrets.
 * - Supabase user id is used as external_id (login/logout reassociation).
 * - Role/course/category tags are set from trusted app data only
 *   (callers pass values already loaded from Supabase; never trust browser input).
 * - Never auto-prompts users who already decided (granted/denied).
 */

import { dispatchPushNavigate, pushPlatformTag } from "./androidPush";
import { isNativeWrapper } from "./nativeOneSignal";
import { isIos, isStandalone } from "./pwa";

const PAGE_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
/** A blocked or hanging CDN request must not leave Enable spinning forever. */
const SDK_LOAD_TIMEOUT_MS = 12000;
const APP_ID_KEY = "VITE_ONESIGNAL_APP_ID";
const SAFARI_WEB_ID_KEY = "VITE_ONESIGNAL_SAFARI_WEB_ID";
// Owner-supplied production OneSignal app (public IDs only — safe for frontend).
// Env vars override these when set; the REST API key is NEVER placed here.
const DEFAULT_APP_ID = "1c7444cf-8299-48c3-adf7-0d1b32dbed7b";
const DEFAULT_SAFARI_WEB_ID = "web.onesignal.auto.3431b9a6-8377-4186-9b23-bf65dbb4a731";

let initPromise: Promise<boolean> | null = null;
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
  }
}

export function oneSignalAppId(): string {
  const fromEnv = ((import.meta as any)?.env?.[APP_ID_KEY] as string | undefined)?.trim() ?? "";
  return fromEnv || DEFAULT_APP_ID;
}

export function oneSignalSafariWebId(): string {
  const fromEnv = ((import.meta as any)?.env?.[SAFARI_WEB_ID_KEY] as string | undefined)?.trim() ?? "";
  return fromEnv || DEFAULT_SAFARI_WEB_ID;
}

export function isOneSignalConfigured(): boolean {
  return oneSignalAppId().length > 0;
}

export function pushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext && "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
}

function loadPageSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.OneSignal) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-onesignal="v16"]`);
    const tag = existing ?? document.createElement("script");
    let settled = false;
    let timer: number | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      tag.removeEventListener("load", onLoad);
      tag.removeEventListener("error", onError);
      if (!error) { resolve(); return; }
      // A failed or blocked load must not poison later retries: forget the
      // cached promise and drop the dead tag so Enable can genuinely try again.
      scriptPromise = null;
      if (!window.OneSignal) tag.remove();
      reject(error);
    };
    const onLoad = () => {
      if (window.OneSignal) finish();
      else finish(new Error("Push library loaded but did not start."));
    };
    const onError = () => finish(new Error("Push library could not be downloaded."));
    tag.addEventListener("load", onLoad, { once: true });
    tag.addEventListener("error", onError, { once: true });
    timer = window.setTimeout(() => finish(new Error("Push library download timed out.")), SDK_LOAD_TIMEOUT_MS);
    if (!existing) {
      tag.src = PAGE_SDK_URL;
      tag.async = true;
      tag.defer = true;
      tag.dataset.onesignal = "v16";
      document.head.appendChild(tag);
    }
  });
  scriptPromise = promise;
  return promise;
}

/** Initialize once; safe to call from multiple components (StrictMode-proof).
 *  Skips the Web SDK inside the Capacitor APK wrapper — the native SDK
 *  (src/lib/nativeOneSignal.ts) owns push there, so we never double-init. */
export function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  const attempt = (async (): Promise<boolean> => {
    try {
      if (isNativeWrapper()) return false;
    } catch { /* fall through to web path */ }
    const appId = oneSignalAppId();
    if (!appId || typeof window === "undefined") return false;
    if (!pushSupported()) return false;
    try {
      await loadPageSdk();
      const OS = window.OneSignal;
      if (!OS?.init) return false;
      const safariWebId = oneSignalSafariWebId() || undefined;
      await OS.init({
        appId,
        // One registration only. By default the SDK registers
        // /OneSignalSDKWorker.js at scope "/" — the same scope the PWA worker
        // owns — so each side replaces the other's script and every swap
        // installs a fresh "waiting" worker. That made the in-app update
        // prompt reappear moments after the user refreshed. /sw.js already
        // importScripts the OneSignal worker, so point the SDK at it instead.
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "/sw.js",
        ...(safariWebId ? { safari_web_id: safariWebId } : {}),
        allowLocalhostAsSecureOrigin: true,
        // Custom branded subscription UI (OneSignalPanel) replaces the default bell.
        notifyButton: { enable: false },
        promptOptions: { slidedown: { enabled: false } },
        welcomeNotification: { disable: true },
      });
      return true;
    } catch {
      // Graceful: portal + local reminders keep working; OneSignal stays off.
      return false;
    }
  })().catch(() => false);
  // A failed initialisation is deliberately not remembered. It used to be
  // cached for the life of the page, so one blocked script download or one
  // rejected OS.init made “Enable notifications” answer “push library is
  // unavailable” until a full reload, however often the user retried.
  initPromise = attempt.then((ok) => {
    if (!ok) initPromise = null;
    return ok;
  });
  return initPromise;
}

/** The v16 SDK exposes some fields as plain values and others as promises. */
async function resolveValue<T>(input: unknown, fallback: T): Promise<T> {
  try {
    const value = input && typeof (input as Promise<T>).then === "function" ? await (input as Promise<T>) : input;
    return (value ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export type OneSignalStatus = {
  configured: boolean;
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  externalId: string | null;
};

export async function oneSignalStatus(): Promise<OneSignalStatus> {
  const configured = isOneSignalConfigured();
  if (!configured || typeof window === "undefined" || !pushSupported()) {
    return { configured, supported: false, permission: "unsupported", subscribed: false, externalId: null };
  }
  const permission: NotificationPermission = "Notification" in window ? Notification.permission : "default";
  try {
    const ready = await initOneSignal();
    if (!ready || !window.OneSignal) return { configured, supported: true, permission, subscribed: false, externalId: null };
    const OS = window.OneSignal;
    const subId = await resolveValue<string | null>(OS.User?.PushSubscription?.id, null);
    const optedIn = await resolveValue<boolean>(OS.User?.PushSubscription?.optedIn, false);
    const externalId = await resolveValue<string | null>(OS.login?.externalId ?? OS.User?.externalId, null);
    return { configured, supported: true, permission, subscribed: Boolean(optedIn || subId), externalId };
  } catch {
    return { configured, supported: true, permission, subscribed: false, externalId: null };
  }
}

/** Link the browser subscription to the Supabase user. Call after sign-in. */
export async function oneSignalLogin(userId: string, tags?: Record<string, string>): Promise<void> {
  if (!userId || !isOneSignalConfigured()) return;
  const ready = await initOneSignal();
  if (!ready || !window.OneSignal) return;
  const OS = window.OneSignal;
  try {
    await OS.login(userId);
  } catch { /* identity sync is best-effort; in-app records remain authoritative */ }
  // Platform hint for PWA-vs-APK audience splits. Server re-validates
  // role/course eligibility; tags are never trusted for authorization.
  try {
    await OS.User?.addTags?.({
      ...pushPlatformTag(),
      ...(tags ?? {}),
    });
    return;
  } catch { /* non-fatal */ }
  if (tags && Object.keys(tags).length) {
    try { await OS.User?.addTags?.(tags); } catch { /* non-fatal */ }
  }
}

/** Set trusted targeting tags (role / courses / categories). Server re-validates. */
export async function oneSignalSetTags(tags: Record<string, string>): Promise<void> {
  if (!isOneSignalConfigured()) return;
  const ready = await initOneSignal();
  if (!ready || !window.OneSignal?.User?.addTags) return;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    const key = String(k).slice(0, 64);
    const val = String(v).slice(0, 128);
    if (key && val) clean[key] = val;
  }
  if (!Object.keys(clean).length) return;
  try { await window.OneSignal.User.addTags(clean); } catch { /* non-fatal */ }
}

/** Unlink identity on sign-out WITHOUT deleting the browser subscription. */
export async function oneSignalLogout(): Promise<void> {
  if (!isOneSignalConfigured() || !window.OneSignal) return;
  try { await window.OneSignal.logout(); } catch { /* best-effort */ }
}

/** Explicit opt-in from a user gesture. Respects prior deny; never auto-prompts. */
export async function oneSignalOptIn(): Promise<{ subscribed: boolean; message: string }> {
  if (!isOneSignalConfigured()) return { subscribed: false, message: "Push is not configured yet. Ask an administrator to add the OneSignal App ID." };
  if (!pushSupported()) return { subscribed: false, message: "This browser does not support push. Portal messages still work without it." };
  // iOS only delivers web push to the installed (Home Screen) app, never to a
  // plain Safari tab — the SDK fails to subscribe there, which is why the card
  // stayed at "off" while the permission read "granted".
  if (isIos() && !isStandalone()) {
    return { subscribed: false, message: "On iPhone or iPad, notifications only work from the installed app: open this site in Safari, tap Share → Add to Home Screen, open it from the Home Screen, then press Enable there (iOS 16.4 or newer)." };
  }
  if ("Notification" in window && Notification.permission === "denied") {
    return { subscribed: false, message: "Notifications are blocked for this site. Allow them in your browser / device settings, then retry." };
  }
  const ready = await initOneSignal();
  if (!ready || !window.OneSignal) {
    return { subscribed: false, message: "The push library could not start on this device. Check your connection or a content blocker, reload the page, then press Enable again." };
  }
  try {
    const OS = window.OneSignal;
    const subscription = OS?.User?.PushSubscription;
    // Optional chaining used to make this resolve successfully even when the SDK
    // had no subscription object, so the card claimed success while OneSignal
    // never recorded a player. Only report success once one exists.
    if (!subscription?.optIn) {
      return { subscribed: false, message: "The push library did not expose a subscription. Reload the page and try again." };
    }
    await subscription.optIn();
    // The v16 SDK exposes these as plain values on some builds and as promises
    // on others, so accept either rather than reporting a false failure.
    const id = await resolveValue<string | null>(OS?.User?.PushSubscription?.id, null);
    const optedIn = await resolveValue<boolean>(OS?.User?.PushSubscription?.optedIn, false);
    if (id || optedIn) {
      return { subscribed: true, message: "Notifications enabled on this device, including when the screen is locked (OS / browser permitting)." };
    }
    return {
      subscribed: false,
      message: "The browser did not create a push subscription. Allow notifications for this site, make sure it is served over HTTPS, then retry.",
    };
  } catch {
    return { subscribed: false, message: "Could not enable notifications. Check Focus / Do Not Disturb and retry." };
  }
}

export async function oneSignalOptOut(): Promise<void> {
  if (!window.OneSignal) return;
  try { await window.OneSignal.User?.PushSubscription?.optOut?.(); } catch { /* best-effort */ }
}

/** Foreground click routing: OneSignal notification tap inside the running app.
 *  Register once after init; handles PWA + APK WebView/TWA identically.
 *  Background/locked taps arrive via the service worker (?push_view=) instead. */
export async function initOneSignalClickRouting(): Promise<void> {
  try {
    const ready = await initOneSignal();
    if (!ready || !window.OneSignal) return;
    const OS = window.OneSignal;
    const handler = (event: any) => {
      try {
        const url = event?.notification?.additionalData?.target_url
          || event?.notification?.url
          || event?.notification?.launchURL
          || "/";
        if (typeof url !== "string") return;
        // Same-origin only; cross-origin targets open via the worker path.
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin !== window.location.origin) return;
        dispatchPushNavigate(parsed.pathname + parsed.search + parsed.hash);
      } catch { /* routing is best-effort */ }
    };
    try {
      OS?.Notifications?.addEventListener?.("click", handler);
    } catch {
      try { OS?.Notifications?.clicked?.subscribe?.(handler); } catch { /* older SDK shape */ }
    }
  } catch { /* never break the app for click routing */ }
}

/** Click-through routing is handled in /sw.js + OneSignalSDKWorker.js notificationclick. */
export function oneSignalHowLockScreenWorks(): string {
  return "When subscribed, alerts arrive through the OS push service even with the screen off or the app closed. Delivery still depends on browser support, OS battery/data-saver rules, network and permission — nothing here uses timers or requires the site open.";
}
