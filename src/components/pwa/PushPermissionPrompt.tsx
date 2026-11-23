import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

const DISMISSED_KEY = "aoh-push-prompt-dismissed-at";
const DECLINED_KEY = "aoh-push-prompt-declined";

function supported() {
  return typeof window !== "undefined" && window.isSecureContext && "Notification" in window;
}

export default function PushPermissionPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported() ? Notification.permission : "denied",
  );
  const [visible, setVisible] = useState(false);
  const [declined, setDeclined] = useState(() => {
    try { return localStorage.getItem(DECLINED_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!supported() || declined) return;
    const show = () => {
      if (Notification.permission === "default") setVisible(true);
      else setVisible(false);
    };
    show();
    const interval = window.setInterval(show, 30000);
    const onVis = () => { if (document.visibilityState === "visible") show(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [declined]);

  useEffect(() => {
    setPermission(supported() ? Notification.permission : "denied");
  }, [visible]);

  if (!supported() || declined || permission !== "default" || !visible) return null;

  const accept = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "denied") {
        try { localStorage.setItem(DECLINED_KEY, "1"); } catch { /* ignore */ }
        setDeclined(true);
      }
      if (result === "granted") setVisible(false);
    } catch {
      /* ignore */
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
      if (Notification.permission === "default") setVisible(true);
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
          <p className="text-sm font-semibold text-black">Enable notifications</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">
            Get updates about messages, fees, grades and announcements even when the app is closed.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void accept()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#16803C] px-4 text-sm font-semibold text-white transition hover:bg-[#12692f]"
            >
              Enable
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