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

const PAGE_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
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
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-onesignal="v16"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Push library failed to load. Check your connection and retry.")), { once: true });
      return;
    }
    const tag = document.createElement("script");
    tag.src = PAGE_SDK_URL;
    tag.async = true;
    tag.defer = true;
    tag.dataset.onesignal = "v16";
    tag.addEventListener("load", () => resolve(), { once: true });
    tag.addEventListener("error", () => reject(new Error("Push library failed to load. Check your connection and retry.")), { once: true });
    document.head.appendChild(tag);
  });
  return scriptPromise;
}

/** Initialize once; safe to call from multiple components (StrictMode-proof). */
export function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
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
  })();
  return initPromise;
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
    const subId: string | null | undefined = await OS.User?.PushSubscription?.id?.catch?.(() => null).catch(() => null);
    const optedIn: boolean = await OS.User?.PushSubscription?.optedIn?.catch?.(() => false).catch(() => false);
    let externalId: string | null = null;
    try {
      externalId = (await OS.login?.externalId?.catch?.(() => null)) ?? (OS.User?.externalId as string | undefined) ?? null;
    } catch { externalId = null; }
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
  if ("Notification" in window && Notification.permission === "denied") {
    return { subscribed: false, message: "Notifications are blocked for this site. Allow them in your browser / device settings, then retry." };
  }
  const ready = await initOneSignal();
  if (!ready || !window.OneSignal) return { subscribed: false, message: "Push library is unavailable offline. Reconnect and retry." };
  try {
    await window.OneSignal.User?.PushSubscription?.optIn?.();
    return { subscribed: true, message: "Notifications enabled on this device, including when the screen is locked (OS / browser permitting)." };
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
