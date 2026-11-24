import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  isOneSignalConfigured,
  oneSignalLogin,
  oneSignalOptIn,
  oneSignalStatus,
} from "@/lib/onesignal";

const DISMISSED_KEY = "aoh-push-prompt-dismissed-at";
const DECLINED_KEY = "aoh-push-prompt-declined";

function supported() {
  return typeof window !== "undefined" && window.isSecureContext && "Notification" in window;
}

export default function PushPermissionPrompt() {
  const { currentUser } = useApp();
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported() ? Notification.permission : "denied",
  );
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [declined, setDeclined] = useState(() => {
    try { return localStorage.getItem(DECLINED_KEY) === "1"; } catch { return false; }
  });
  // Browser permission is not the same thing as a push subscription. OneSignal
  // holds the deliverable subscription; granting the OS prompt alone leaves no
  // player, which is why pushes answered "All included players are not
  // subscribed" while the UI showed permission "granted".
  const subscribedRef = useRef(false);

  // Re-read the real subscription state. Keeps the prompt visible for members
  // who already granted permission through the old flow but never subscribed.
  const refresh = useCallback(async () => {
    if (!supported()) return false;
    const perm = Notification.permission;
    setPermission(perm);
    if (perm === "denied") {
      subscribedRef.current = false;
      return false;
    }
    if (!isOneSignalConfigured()) {
      // Nothing to subscribe to; hide and behave as done.
      subscribedRef.current = true;
      return true;
    }
    try {
      const status = await oneSignalStatus();
      subscribedRef.current = Boolean(status.subscribed);
      return Boolean(status.subscribed);
    } catch {
      subscribedRef.current = false;
      return false;
    }
  }, []);

  useEffect(() => {
    if (!supported() || declined) return;
    let cancelled = false;
    const evaluate = async () => {
      const ok = await refresh();
      if (cancelled) return;
      const perm = Notification.permission;
      // Show while undecided, and also while permission is granted but no
      // OneSignal subscription exists yet (otherwise the member is stuck:
      // "granted" hides the prompt forever and nothing is ever delivered).
      setVisible(perm === "default" || (perm === "granted" && !ok));
    };
    void evaluate();
    const interval = window.setInterval(() => { void evaluate(); }, 30000);
    const onVis = () => { if (document.visibilityState === "visible") void evaluate(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [declined, refresh, currentUser?.id]);

  if (!supported() || declined || !visible) return null;

  const alreadyGranted = permission === "granted";

  const accept = async () => {
    setBusy(true);
    setNotice("");
    try {
      // Ask the OS inside the click gesture first, then create the actual
      // OneSignal push subscription. Requesting permission alone never
      // subscribes the device.
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === "denied") {
          try { localStorage.setItem(DECLINED_KEY, "1"); } catch { /* ignore */ }
          setDeclined(true);
          setVisible(false);
          return;
        }
      }
      const outcome = await oneSignalOptIn();
      if (!outcome.subscribed) {
        // Honest failure: keep the prompt up so the member can retry instead
        // of silently believing notifications are on.
        setNotice(outcome.message);
        return;
      }
      if (currentUser?.id) {
        // Re-link identity now that a player exists, so targeted pushes match
        // this Supabase user id.
        try { await oneSignalLogin(currentUser.id); } catch { /* best-effort */ }
      }
      subscribedRef.current = true;
      setVisible(false);
      try { localStorage.removeItem(DISMISSED_KEY); } catch { /* ignore */ }
    } catch {
      setNotice("Could not enable notifications. Check browser/device settings and try again.");
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    try { localStorage.setItem(DECLINED_KEY, "1"); } catch { /* ignore */ }
    setDeclined(true);
    setVisible(false);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
    window.setTimeout(() => {
      try { if (localStorage.getItem(DECLINED_KEY) === "1") return; } catch { /* ignore */ }
      void refresh().then((ok) => {
        if (Notification.permission === "default" || (Notification.permission === "granted" && !ok)) setVisible(true);
      });
    }, 30000);
  };

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      className="fixed bottom-4 left-1/2 z-[79] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border-4 border-[#D4AF37] bg-white p-3.5 shadow-2xl"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#16803C]">
          <Bell className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-black">
            {alreadyGranted ? "Finish enabling notifications" : "Enable notifications"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">
            {alreadyGranted
              ? "Your browser allowed notifications, but this device is not subscribed yet. Finish setup to receive messages, fees, grades and announcements."
              : "Get updates about messages, fees, grades and announcements even when the app is closed."}
          </p>
          {notice && (
            <p role="status" className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
              {notice}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void accept()}
              disabled={busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#16803C] px-4 text-sm font-semibold text-white transition hover:bg-[#12692f] disabled:opacity-60"
            >
              {busy ? "Enabling…" : alreadyGranted ? "Finish setup" : "Enable"}
            </button>
            <button
              type="button"
              onClick={decline}
              className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification prompt"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
