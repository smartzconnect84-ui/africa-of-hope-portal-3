/**
 * AFRICA OF HOPE — native Android push bridge (Capacitor + OneSignal).
 *
 * Why this file exists:
 * - This repo is a web-only Vite PWA (no android/ folder). The Play APK is
 *   built by wrapping THIS same web bundle in a Capacitor shell (or TWA).
 * - The OneSignal *native* Android SDK must live in that Android shell, NOT
 *   in the web bundle. This module is the web side of that integration: when
 *   running inside the Capacitor wrapper it talks to the native SDK through
 *   `onesignal-cordova-plugin` (the OneSignal-supported Capacitor path) and
 *   stays completely inert in a normal browser / installed PWA.
 *
 * Follows:
 * - https://raw.githubusercontent.com/OneSignal/sdk-ai-prompts/main/docs/android/ai-prompt.md
 *   (native Application init, FCM delivery, channels, POST_NOTIFICATIONS,
 *   lock-screen visibility, cold-start deep link) — the native halves live in
 *   the Android project template referenced below.
 * - OneSignal Capacitor docs: onesignal-cordova-plugin setAppId + login +
 *   User.pushSubscription + Notifications permission + opened/click handlers.
 *
 * Secrets: only the public OneSignal App ID is used here (same ID as web).
 * NEVER put google-services.json, FCM server keys, service-account JSON or
 * the OneSignal REST key in this file or the web bundle.
 */

import { dispatchPushNavigate, defaultDestinationFor } from "./androidPush";
import { oneSignalAppId } from "./onesignal";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

export function isNativeWrapper(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const w = window as any;
    if (w?.Capacitor?.isNativePlatform?.()) return true;
    if (typeof w?.Capacitor !== "undefined" && w?.Capacitor?.getPlatform?.() === "android") return true;
    if (typeof w?.cordova !== "undefined") return true;
  } catch { /* ignore */ }
  return false;
}

let nativeReady: Promise<boolean> | null = null;
let openedHandlerInstalled = false;

async function getNativeOneSignal(): Promise<any | null> {
  if (!isNativeWrapper()) return null;
  try {
    // Dynamic import keeps the web bundle free of Cordova globals.
    const mod: any = await import("onesignal-cordova-plugin");
    return mod?.default ?? mod?.OneSignal ?? mod ?? null;
  } catch {
    return null;
  }
}

function toPushUrl(additionalData: any, fallbackKind = "announcement"): string {
  try {
    const target = (additionalData as any)?.target_url;
    if (typeof target === "string" && target.startsWith("/?push_view=")) return target;
    const kind = String((additionalData as any)?.kind ?? fallbackKind);
    return defaultDestinationFor(kind);
  } catch {
    return defaultDestinationFor(fallbackKind);
  }
}

/**
 * Initialise the NATIVE OneSignal SDK inside the Capacitor APK.
 * No-op in browsers / installed PWA (web SDK owns those).
 * Safe to call multiple times; resolves true only when native push is live.
 */
export function initNativeOneSignal(): Promise<boolean> {
  if (nativeReady) return nativeReady;
  nativeReady = (async () => {
    if (!isNativeWrapper()) return false;
    const OneSignal: any = await getNativeOneSignal();
    if (!OneSignal) return false;
    const appId = oneSignalAppId();
    if (!appId) return false;
    try {
      // Matches the native ai-prompt: init with appId, disable auto-prompt,
      // permission is requested from an explicit user gesture instead.
      if (typeof OneSignal.setAppId === "function") {
        await OneSignal.setAppId(appId);
      } else if (typeof OneSignal.initWithContext === "function") {
        OneSignal.initWithContext(appId);
      } else {
        return false;
      }
      try { OneSignal.setLogLevel?.(6, 0); } catch { /* quiet in prod */ }
      // Foreground display: show banner so taps work while app is open.
      try { OneSignal.setNotificationWillShowInForegroundHandler?.(() => undefined); } catch { /* optional */ }
      if (!openedHandlerInstalled) {
        openedHandlerInstalled = true;
        try {
          // v5 cordova shape: Notifications.addEventListener("click", ...)
          const add = OneSignal?.Notifications?.addEventListener;
          if (typeof add === "function") {
            add.call(OneSignal.Notifications, "click", (event: any) => {
              try {
                const data = event?.notification?.additionalData ?? {};
                dispatchPushNavigate(toPushUrl(data));
              } catch { /* routing best-effort */ }
            });
          } else if (typeof OneSignal.setNotificationOpenedHandler === "function") {
            OneSignal.setNotificationOpenedHandler((opened: any) => {
              try {
                const data = opened?.notification?.additionalData ?? {};
                dispatchPushNavigate(toPushUrl(data));
              } catch { /* routing best-effort */ }
            });
          }
        } catch { /* never break launch */ }
      }
      try {
        await OneSignal?.User?.pushSubscription?.optInAsync?.();
      } catch { /* permission-gated; OneSignalPanel retries from gesture */ }
      return true;
    } catch {
      return false;
    }
  })();
  return nativeReady;
}

/** Android 13+ runtime permission via the native SDK (call from a tap). */
export async function nativeRequestPermission(): Promise<boolean> {
  try {
    const OneSignal: any = await getNativeOneSignal();
    if (!OneSignal) return false;
    if (typeof OneSignal?.Notifications?.requestPermission === "function") {
      return await OneSignal.Notifications.requestPermission(true);
    }
    if (typeof OneSignal?.promptForPushNotificationsWithUserResponse === "function") {
      return await OneSignal.promptForPushNotificationsWithUserResponse();
    }
    return false;
  } catch {
    return false;
  }
}

/** Link native subscription to Supabase user (same external_id as web). */
export async function nativeLogin(userId: string, tags?: Record<string, string>): Promise<void> {
  if (!userId) return;
  const ready = await initNativeOneSignal();
  if (!ready) return;
  try {
    const OneSignal: any = await getNativeOneSignal();
    await OneSignal?.login?.(userId);
    const clean: Record<string, string> = { platform: "android-wrapper", pwa_installed: "0" };
    for (const [k, v] of Object.entries(tags ?? {})) {
      const key = String(k).slice(0, 64);
      const val = String(v).slice(0, 128);
      if (key && val) clean[key] = val;
    }
    try { await OneSignal?.User?.addTags?.(clean); } catch { /* non-fatal */ }
  } catch { /* identity sync best-effort */ }
}

export async function nativeLogout(): Promise<void> {
  try {
    if (!isNativeWrapper()) return;
    const OneSignal: any = await getNativeOneSignal();
    await OneSignal?.logout?.();
  } catch { /* best-effort */ }
}

export async function nativeOptIn(): Promise<{ subscribed: boolean; message: string }> {
  try {
    const OneSignal: any = await getNativeOneSignal();
    if (!OneSignal) {
      return { subscribed: false, message: "Native push is unavailable. Open this build as the installed APK (not a browser tab) and retry." };
    }
    await OneSignal?.User?.pushSubscription?.optInAsync?.();
    return { subscribed: true, message: "Notifications enabled in the APK, including lock-screen alerts (Android permission permitting)." };
  } catch {
    return { subscribed: false, message: "Could not enable notifications. Check Do Not Disturb / battery optimisation and retry." };
  }
}

export async function nativeOptOut(): Promise<void> {
  try {
    const OneSignal: any = await getNativeOneSignal();
    if (!OneSignal) return;
    if (typeof OneSignal?.User?.pushSubscription?.optOutAsync === "function") {
      await OneSignal.User.pushSubscription.optOutAsync();
      return;
    }
    if (typeof OneSignal?.disablePush === "function") {
      await OneSignal.disablePush(true);
    }
  } catch { /* best-effort */ }
}

export async function nativeStatus(): Promise<{ native: boolean; subscribed: boolean; id: string | null; permission: string }> {
  try {
    if (!isNativeWrapper()) return { native: false, subscribed: false, id: null, permission: "unsupported" };
    const OneSignal: any = await getNativeOneSignal();
    if (!OneSignal) return { native: true, subscribed: false, id: null, permission: "default" };
    let id: string | null = null;
    let opted = false;
    try { id = (await OneSignal?.User?.pushSubscription?.getIdAsync?.()) ?? null; } catch { id = null; }
    try { opted = (await OneSignal?.User?.pushSubscription?.getOptedInAsync?.()) ?? Boolean(id); } catch { opted = Boolean(id); }
    const subscribed = Boolean(opted || id);
    return { native: true, subscribed, id, permission: subscribed ? "granted" : "default" };
  } catch {
    return { native: true, subscribed: false, id: null, permission: "default" };
  }
}
