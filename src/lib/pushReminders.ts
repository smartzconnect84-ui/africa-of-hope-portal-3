import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isIos, isStandalone } from "@/lib/pwa";

const BRAND_ICON = "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";
export type ReminderKind = "lesson" | "assignment" | "fee" | "announcement";
export interface ReminderItem { id: string; kind: ReminderKind; title: string; body: string; dueAt: string; url: string }
export interface ReminderPrefs { enabled: boolean; lessons: boolean; fees: boolean; announcements: boolean; windowHours: number }
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = { enabled: false, lessons: true, fees: true, announcements: true, windowHours: 24 };
const PREF_PREFIX = "aoh-reminders:prefs:";
export function loadReminderPrefs(userId?: string): ReminderPrefs {
  try { return userId ? { ...DEFAULT_REMINDER_PREFS, ...JSON.parse(localStorage.getItem(PREF_PREFIX + userId) || "{}") } : DEFAULT_REMINDER_PREFS; }
  catch { return DEFAULT_REMINDER_PREFS; }
}
export function notificationsSupported() {
  return typeof window !== "undefined" && window.isSecureContext && "Notification" in window && "serviceWorker" in navigator;
}
function currentPermission(): NotificationPermission { return notificationsSupported() ? Notification.permission : "default"; }
export function notificationHelp() {
  if (!window.isSecureContext) return "Device notifications require HTTPS. Open the published secure site.";
  if (isIos() && !isStandalone()) return "On iPhone/iPad (iOS/iPadOS 16.4+), open this site in Safari, tap Share → Add to Home Screen, then open the installed app and enable notifications here.";
  if (!notificationsSupported()) return "Notifications are not supported in this browser. Try a current Safari, Chrome, Edge or Firefox; portal messages remain available without permission.";
  if (Notification.permission === "denied") return isIos() ? "Notifications are blocked. Open Settings → Notifications → AFRICA OF HOPE and allow notifications, then return here. Also check Focus settings." : "Notifications are blocked. Allow this site in your browser's Site settings → Notifications and your device's notification settings, then return here.";
  return "Notifications are optional and requested only when you press Enable. Android: check Chrome Site settings and Android App notifications. iOS: check Settings → Notifications and Focus. The app does not need camera, microphone or location access for reminders.";
}
function message(error: unknown) { return error instanceof Error ? error.message : (error as { message?: string })?.message || "Request failed"; }
async function workerReady() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("The app worker is not ready. Reload online and try again.")), 10000); })]);
  } finally { clearTimeout(timer); }
}
function publicKeyBytes(value: string) {
  const text = atob((value + "=".repeat((4 - value.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(text, c => c.charCodeAt(0));
}
export function isReminderDue(item: ReminderItem, prefs: ReminderPrefs, now = Date.now()) {
  if (!(item.kind === "fee" ? prefs.fees : item.kind === "announcement" ? prefs.announcements : prefs.lessons)) return false;
  const due = Date.parse(item.dueAt);
  return item.kind === "announcement" ? due <= now && now - due <= 48 * 3600000 : due - now <= prefs.windowHours * 3600000 && due > now - 3600000;
}
async function showReminder(item: ReminderItem) {
  const worker = await workerReady();
  await worker.showNotification(item.title, { body: item.body, icon: BRAND_ICON, badge: BRAND_ICON, tag: item.id, data: { url: item.url } });
}
export type PushState = "idle" | "device" | "subscribed" | "error";
export interface ReminderController {
  supported: boolean; permission: NotificationPermission; prefs: ReminderPrefs; pushState: PushState;
  busy: boolean; notice: string; next: ReminderItem[]; help: string;
  enable: () => Promise<void>; disable: () => Promise<void>;
  toggleKind: (kind: "lessons" | "fees" | "announcements") => void;
  sendTest: () => Promise<void>;
}

/** Permission is requested synchronously from a user gesture, never on mount. */
export function useReminderNotifications(userId: string | undefined, items: ReminderItem[]): ReminderController {
  const [prefs, setPrefs] = useState(() => loadReminderPrefs(userId));
  const prefsRef = useRef(prefs);
  const [permission, setPermission] = useState(currentPermission);
  const [pushState, setPushState] = useState<PushState>("idle");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(notificationHelp);
  const owner = useRef(userId); owner.current = userId;
  const save = useCallback((next: ReminderPrefs) => {
    prefsRef.current = next; setPrefs(next);
    if (userId) { try { localStorage.setItem(PREF_PREFIX + userId, JSON.stringify(next)); } catch { /* session only */ } }
  }, [userId]);

  useEffect(() => {
    save(loadReminderPrefs(userId)); setPushState("idle"); setNotice("");
    let active = true;
    const inspect = async () => {
      setPermission(currentPermission()); setHelp(notificationHelp());
      if (!userId || !notificationsSupported()) return;
      try {
        const worker = await navigator.serviceWorker.getRegistration("/");
        const sub = await worker?.pushManager?.getSubscription();
        if (!sub) { if (active) setPushState("device"); return; }
        const { data, error } = await supabase.from("push_subscriptions").select("enabled").eq("user_id", userId).eq("endpoint", sub.endpoint).maybeSingle();
        if (active) setPushState(!error && data?.enabled ? "subscribed" : "device");
      } catch { if (active) setPushState("device"); }
    };
    void inspect();
    const onFocus = () => { void inspect(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { active = false; window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [userId, save]);

  const syncSettings = useCallback(async (next: ReminderPrefs) => {
    if (!userId) return;
    const { error } = await supabase.from("reminder_settings").upsert({ user_id: userId, enabled: next.enabled, lessons: next.lessons, fees: next.fees, announcements: next.announcements, window_hours: next.windowHours, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    const worker = await navigator.serviceWorker.getRegistration("/");
    const sub = await worker?.pushManager?.getSubscription();
    if (sub) {
      const { error: deviceError } = await supabase.from("push_subscriptions").update({ preferences: next, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("endpoint", sub.endpoint);
      if (deviceError) throw deviceError;
    }
  }, [userId]);

  const enable = useCallback(async () => {
    if (!userId || busy) return;
    if (!notificationsSupported() || (isIos() && !isStandalone())) { setNotice(notificationHelp()); return; }
    setBusy(true); setNotice("");
    try {
      const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(result); setHelp(notificationHelp());
      if (result !== "granted") { setNotice(result === "denied" ? notificationHelp() : "Permission was not granted. Tap Enable when you are ready."); return; }
      const next = { ...prefsRef.current, enabled: true }; save(next);
      const key = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
      const worker = await workerReady();
      if (!key || !worker.pushManager) { setPushState("device"); setNotice("Permission granted. Only open-app notifications are available until an administrator configures the Web Push public key and sender."); return; }
      const sub = await worker.pushManager.getSubscription() ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(key) as unknown as BufferSource });
      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, user_agent: navigator.userAgent.slice(0, 500), enabled: true, preferences: next, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
      if (error) throw error;
      await syncSettings(next);
      if (owner.current !== userId) return;
      setPushState("subscribed");
      setNotice("This device is registered for push. Background delivery still depends on the deployed sender, schedule, network and device settings. Send a local test below; it does not test the server sender.");
    } catch (error) { setPushState("error"); setNotice(`Push registration failed: ${message(error)}. Browser permission may still be granted. Retry Enable to register again.`); }
    finally { if (owner.current === userId) setBusy(false); }
  }, [userId, busy, save, syncSettings]);

  const disable = useCallback(async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const worker = await navigator.serviceWorker.getRegistration("/");
      const sub = await worker?.pushManager?.getSubscription();
      if (sub) {
        const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint);
        if (error) throw error;
        if (!await sub.unsubscribe()) throw new Error("Browser did not confirm unsubscribe. Retry to check.");
      }
      save({ ...prefsRef.current, enabled: false }); setPushState("idle");
      setNotice("Notifications disabled for this device. Your other devices are unchanged. Browser permission can be removed in site/device settings.");
    } catch (error) { setNotice(`Could not finish disabling this device: ${message(error)}. Please retry.`); }
    finally { setBusy(false); }
  }, [userId, busy, save]);

  const toggleKind = useCallback((kind: "lessons" | "fees" | "announcements") => {
    const next = { ...prefsRef.current, [kind]: !prefsRef.current[kind] }; save(next);
    void syncSettings(next).catch(error => setNotice(`Saved on this device only; backend sync failed: ${message(error)}`));
  }, [save, syncSettings]);
  const sendTest = useCallback(async () => {
    if (currentPermission() !== "granted") { setNotice("Allow notifications first."); return; }
    try {
      await showReminder({ id: `test-${Date.now()}`, kind: "lesson", title: "AFRICA OF HOPE notification test", body: "This tests this device only, not server push delivery.", dueAt: new Date().toISOString(), url: "/" });
      setNotice("Local test requested. If no alert appeared, check Focus/Do Not Disturb and browser/device notification settings. This is not a server push test.");
    } catch (error) { setNotice(`Local test failed: ${message(error)}`); }
  }, []);

  // Match the migration and the server sender: reminder_items, not reminder_queue.
  const signature = JSON.stringify(items);
  useEffect(() => {
    if (!userId || !prefs.enabled || pushState !== "subscribed") return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await syncSettings(prefs);
          const rows = items.slice(0, 80).filter(item => Number.isFinite(Date.parse(item.dueAt))).map(item => ({ user_id: userId, item_key: item.id, kind: item.kind, title: item.title.slice(0, 200), body: item.body.slice(0, 500), due_at: item.dueAt, url: item.url }));
          if (!rows.length) return;
          const { error } = await supabase.from("reminder_items").upsert(rows, { onConflict: "user_id,item_key" });
          if (error) throw error;
        } catch (error) { if (owner.current === userId) setNotice(`Push queue could not sync: ${message(error)}. Open-app reminders remain available.`); }
      })();
    }, 1000);
    return () => clearTimeout(timer);
  }, [userId, prefs, pushState, signature, syncSettings]);

  useEffect(() => {
    if (!userId || !prefs.enabled || permission !== "granted" || pushState === "subscribed") return;
    let cancelled = false;
    const run = async () => {
      let sent: Record<string, number> = {};
      try { sent = JSON.parse(localStorage.getItem(`aoh-reminders:sent:${userId}`) || "{}"); } catch { /* empty */ }
      for (const item of items) {
        if (cancelled || !isReminderDue(item, prefs) || Date.now() - (sent[item.id] || 0) < 12 * 3600000) continue;
        try { await showReminder(item); sent[item.id] = Date.now(); } catch { /* display errors available via local test */ }
      }
      try { localStorage.setItem(`aoh-reminders:sent:${userId}`, JSON.stringify(sent)); } catch { /* session only */ }
    };
    void run(); const timer = setInterval(() => void run(), 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [userId, prefs, permission, signature, pushState]);

  return { supported: notificationsSupported(), permission, prefs, pushState, busy, notice, help,
    next: items.filter(item => item.kind !== "announcement" && Date.parse(item.dueAt) > Date.now()).sort((a,b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0,3), enable, disable, toggleKind, sendTest };
}
