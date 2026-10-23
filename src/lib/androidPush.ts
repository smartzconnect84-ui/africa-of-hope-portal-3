/**
 * AFRICA OF HOPE — shared push-destination handling for the installed PWA
 * and an Android APK wrapper (TWA / WebView / Capacitor-style shell).
 *
 * The repo ships a web-only PWA (no android/ project, no Capacitor, no
 * google-services.json). An APK therefore wraps THIS same web app. Both
 * installs share one backend (Supabase + onesignal-send Edge Function) and
 * one identity (Supabase user id -> OneSignal external_id), so a student can
 * use the PWA, the APK, or both without duplicate accounts.
 *
 * Server rules still apply: recipient eligibility and role/course targeting
 * are resolved server-side; tags set from the browser are hints only.
 */

export type PushPlatform = "installed-pwa" | "android-wrapper" | "mobile-browser" | "desktop-browser";

export function detectPushPlatform(): PushPlatform {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop-browser";
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  // WebView / TWA / Capacitor shell hints. Chrome TWA sends the full Chrome
  // UA with no WebView token, so an android-app:// referrer is the tell.
  const isWebView = /; wv\)|Version\/.*Chrome\/.*Mobile/i.test(ua) && /wv/i.test(ua);
  const fromAndroidApp = typeof document !== "undefined" && document.referrer.startsWith("android-app://");
  const capacitor = typeof (window as any).Capacitor !== "undefined";
  let standalone = false;
  try {
    standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
  } catch { standalone = false; }
  if (capacitor || fromAndroidApp || (isAndroid && (isWebView || (window as any).AOH_APK === true))) {
    return "android-wrapper";
  }
  if (standalone) return "installed-pwa";
  return isAndroid ? "mobile-browser" : "desktop-browser";
}

export function pushPlatformTag(): Record<string, string> {
  const platform = detectPushPlatform();
  return { platform, pwa_installed: platform === "installed-pwa" ? "1" : "0" };
}

/** Portal view keys that push destinations may open (see src/portalViews.tsx). */
const PORTAL_VIEWS = new Set([
  "dashboard", "course-player", "discussions", "study-calendar", "study-plan",
  "quizzes", "assignments", "certificates", "verification", "announcements",
  "fees", "payments", "helpdesk", "grade-appeals", "profile", "academic-planning",
]);

export type PushDestination = { site: "portal"; view: string } | { site: "public"; anchor: string } | null;

/**
 * Map a school event to its default in-app destination.
 * Used when composing push payloads so PWA + APK open the same screen.
 */
export function defaultDestinationFor(kind: string): string {
  switch (String(kind || "").toLowerCase()) {
    case "class_reminder":
    case "schedule_change":
      return "/?push_view=study-calendar";
    case "material":
    case "course_material":
      return "/?push_view=course-player";
    case "exam":
    case "exam_reminder":
    case "assessment":
    case "assessment_result":
      return "/?push_view=quizzes";
    case "certificate":
      return "/?push_view=certificates";
    case "announcement":
      return "/?push_view=announcements";
    case "enrollment":
      return "/?push_view=dashboard";
    case "fees":
      return "/?push_view=fees";
    case "helpdesk":
      return "/?push_view=helpdesk";
    case "grade_appeal":
      return "/?push_view=grade-appeals";
    default:
      return "/?push_view=dashboard";
  }
}

/** Parse a same-origin push URL into a portal view or public anchor. */
export function resolvePushDestination(raw: string): PushDestination {
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const view = url.searchParams.get("push_view") || url.searchParams.get("push_target");
    if (view && PORTAL_VIEWS.has(view)) return { site: "portal", view };
    const hash = url.hash?.replace(/^#\/?/, "") ?? "";
    if (hash) return { site: "public", anchor: hash };
    return { site: "portal", view: "dashboard" };
  } catch { return null; }
}

const PENDING_KEY = "aoh-pending-push-destination";

/** Remember where a tapped notification should land (survives the login flow). */
export function storePendingDestination(url: string): void {
  try {
    if (!resolvePushDestination(url)) return;
    sessionStorage.setItem(PENDING_KEY, url);
    localStorage.setItem(PENDING_KEY, url);
  } catch { /* storage unavailable */ }
}

export function consumePendingDestination(): string | null {
  try {
    const url =
      sessionStorage.getItem(PENDING_KEY) ?? localStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    return url && resolvePushDestination(url) ? url : null;
  } catch { return null; }
}

/** Broadcast a push-tap inside the running app (PWA or APK WebView alike). */
export function dispatchPushNavigate(url: string): void {
  storePendingDestination(url);
  window.dispatchEvent(new CustomEvent<string>("aoh-push-navigate", { detail: url }));
}

/**
 * Handle a cold start from a notification tap (?push_view= / ?push_target=).
 * Keeps only same-origin targets, stores them for post-login resume, and
 * strips the query so the URL stays shareable.
 */
export function handlePushColdStart(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("push_view") || params.get("push_target");
    if (!view || !PORTAL_VIEWS.has(view)) return null;
    const url = `/?push_view=${view}`;
    storePendingDestination(url);
    params.delete("push_view");
    params.delete("push_target");
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
    window.history.replaceState(null, "", clean);
    return url;
  } catch { return null; }
}

/** Legacy cold-start query (?push_target=view) consumed once at startup. */
export function takeLaunchPushTarget(): { view: string } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("push_target");
    if (!view || !PORTAL_VIEWS.has(view)) return null;
    storePendingDestination(`/?push_view=${view}`);
    params.delete("push_target");
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
    window.history.replaceState(null, "", clean);
    return { view };
  } catch { return null; }
}

/** Detect how the app is running: browser tab, installed PWA, or APK wrapper.
 *
 * Detection is heuristic and honest: a TWA/Capacitor wrapper reports itself
 * via display-mode, user-agent and bridge objects. Nothing here invents an
 * APK identity — the package name only matters for assetlinks/FCM setup.
 */
export interface AndroidPlatform {
  wrapper: boolean;
  installed: boolean;
  standalone: boolean;
  twa: boolean;
  platformTag: string;
  displayMode: string;
}

export function getDisplayMode(): string {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return "browser";
    if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
    if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return "minimal-ui";
    if (window.matchMedia("(display-mode: picture-in-picture)").matches) return "picture-in-picture";
    return "browser";
  } catch { return "browser"; }
}

export function isAndroidWrapper(): boolean {
  try {
    const ua = navigator.userAgent || "";
    const w = window as any;
    // Capacitor bridge, Cordova, or a TWA/Custom-Tab wrapper intent.
    if (w.Capacitor?.isNativePlatform?.() || w.cordova) return true;
    if (/;\s*wv\)/.test(ua)) return true; // Android System WebView token
    if (/Version\/4.+Chrome/.test(ua) && /Mobile/.test(ua) && !/wv/.test(ua)) return false;
    if (document.referrer) {
      try {
        if (new URL(document.referrer).protocol === "android-app:") return true;
      } catch { /* ignore */ }
    }
    return false;
  } catch { return false; }
}

export function isInstalledPwa(): boolean {
  try {
    const w = window as any;
    if (w.matchMedia && w.matchMedia("(display-mode: standalone)").matches) return true;
    if (w.matchMedia && w.matchMedia("(display-mode: fullscreen)").matches) return true;
    if ((navigator as any).standalone === true) return true; // iOS
    return false;
  } catch { return false; }
}

/** Short tag used for OneSignal data-tags + diagnostics (never an identity). */
export function androidPlatformTag(): string {
  try {
    if (isAndroidWrapper()) return "apk";
    if (isInstalledPwa()) return "pwa";
    return getDisplayMode() === "browser" ? "web" : getDisplayMode();
  } catch { return "web"; }
}

export function detectAndroidPlatform(): AndroidPlatform {
  const wrapper = isAndroidWrapper();
  const installed = isInstalledPwa();
  const displayMode = getDisplayMode();
  const standalone = displayMode === "standalone" || displayMode === "fullscreen";
  let twa = false;
  try { twa = wrapper && document.referrer ? new URL(document.referrer).protocol === "android-app:" : false; }
  catch { twa = false; }
  return { wrapper, installed, standalone, twa, platformTag: androidPlatformTag(), displayMode };
}

/** Remember a portal view across the login flow (tab-scoped, then device). */
export function storePendingPushView(view: string): void {
  storePendingDestination(`/?push_view=${view}`);
}

/** Read + clear the pending portal view stored by a notification tap. */
export function consumePendingPushView(): string | null {
  const dest = consumePendingDestination();
  if (!dest) return null;
  try {
    const view = new URL(dest, window.location.origin).searchParams.get("push_view");
    return view && PORTAL_VIEWS.has(view) ? view : null;
  } catch { return null; }
}
