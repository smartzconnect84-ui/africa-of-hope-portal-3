import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, Smartphone, X } from "lucide-react";
import { usePwaInstall } from "@/lib/pwa";

export default function InstallPrompt() {
  const { canInstall, isIos, installed, dismissed, install, dismiss } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (installed || dismissed || done) return null;
  // Android/Chrome: show when the browser fires beforeinstallprompt.
  // iOS Safari: no prompt event — show manual Add-to-Home-Screen steps.
  const showIos = isIos && !installed;
  if (!canInstall && !showIos) return null;

  const onInstall = async () => {
    setBusy(true);
    const outcome = await install();
    setBusy(false);
    if (outcome === "accepted") setDone(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        role="dialog"
        aria-label="Install the Africa of Hope app"
        className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md rounded-2xl border border-emerald-900/10 bg-emerald-950 p-4 text-white shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto sm:w-[380px]"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400">
            <Smartphone className="h-5 w-5 text-emerald-950" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Get the Africa of Hope app</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-100/80">
              {canInstall
                ? "Install it for one-tap access, offline reading and a full-screen experience."
                : "Add it to your Home Screen for one-tap access and full-screen learning."}
            </p>
            {showIos && !canInstall && (
              <ol className="mt-2 space-y-1 text-xs leading-5 text-emerald-100/90">
                <li className="flex items-center gap-1.5">
                  <Share className="h-3.5 w-3.5 text-amber-400" /> 1. Tap the Share button in Safari
                </li>
                <li>2. Choose “Add to Home Screen”</li>
                <li>3. Tap “Add” — the app icon appears on your home screen</li>
              </ol>
            )}
            <div className="mt-3 flex items-center gap-2">
              {canInstall && (
                <button
                  type="button"
                  onClick={onInstall}
                  disabled={busy}
                  className="inline-flex h-10 min-h-10 items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {busy ? "Installing…" : "Install app"}
                </button>
              )}
              <button
                type="button"
                onClick={showIos && !canInstall ? () => setDone(true) : dismiss}
                className="inline-flex h-10 min-h-10 items-center rounded-xl px-3 text-sm font-medium text-emerald-100/80 transition hover:bg-white/10 hover:text-white"
              >
                {showIos && !canInstall ? "Got it" : "Not now"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="grid h-8 w-8 min-h-8 min-w-8 shrink-0 place-items-center rounded-lg text-emerald-100/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
