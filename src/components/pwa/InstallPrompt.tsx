import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Share, Smartphone, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { resolvedPwa } from "@/lib/publicSettingsValidation";
import { DEFAULT_PWA } from "@/data/publicPresentation";

import { usePwaInstall } from "@/lib/pwa";

const FALLBACK_ICON = "/icons/icon-192.png";

/**
 * Branded install prompt.
 * Android/Chrome/desktop: uses the browser's `beforeinstallprompt` event.
 * iOS Safari: no prompt event exists, so manual Add-to-Home-Screen steps are
 * shown instead. Nothing is displayed once the app is already installed.
 */
export default function InstallPrompt() {
  const { canInstall, isIos, installed, dismissed, install, dismiss } = usePwaInstall();
  const { state } = useApp();
  const pwa = state?.websiteSettings ? resolvedPwa(state.websiteSettings) : DEFAULT_PWA;
  const icon = pwa.icon192 || FALLBACK_ICON;
  const appName = pwa.shortName || pwa.name || DEFAULT_PWA.shortName;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (installed || dismissed || done) return null;
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
        aria-label={`Install the ${appName} app`}
        className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border-4 border-[#D4AF37] bg-black p-4 text-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:left-auto sm:right-6 sm:w-[382px]"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#D4AF37]/60 bg-white">
            {canInstall || showIos ? (
              <img src={icon} alt="" className="h-9 w-9 object-contain" />
            ) : (
              <Smartphone className="h-5 w-5 text-[#16803C]" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install the {appName} app</p>
            <p className="mt-0.5 text-xs leading-5 text-white/75">
              {canInstall
                ? "One-tap access from your home screen, full screen, with pages you visited still available offline."
                : "Add it to your Home Screen for one-tap access and a full-screen experience."}
            </p>

            {showIos && !canInstall && (
              <ol className="mt-2 space-y-1 text-xs leading-5 text-white/85">
                <li className="flex items-center gap-1.5">
                  <Share className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                  1. Tap the Share button in Safari
                </li>
                <li>2. Choose “Add to Home Screen”</li>
                <li>3. Tap “Add” — the icon appears on your home screen</li>
              </ol>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canInstall && (
                <button
                  type="button"
                  onClick={onInstall}
                  disabled={busy}
                  className="inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl bg-[#16803C] px-4 text-sm font-semibold text-white transition hover:bg-[#12692f] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
                >
                  {done ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {busy ? "Installing…" : done ? "Installed" : "Install app"}
                </button>
              )}
              <button
                type="button"
                onClick={showIos && !canInstall ? () => setDone(true) : dismiss}
                className="inline-flex h-11 min-h-11 items-center rounded-xl px-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                {showIos && !canInstall ? "Got it" : "Not now"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="grid h-9 w-9 min-h-9 min-w-9 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}