import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie } from "lucide-react";

const KEY = "aoh-cookie-consent";

type Choice = "accepted" | "declined" | null;

export function getCookieConsent(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(getCookieConsent());
    setReady(true);
  }, []);

  const pick = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode */
    }
    setChoice(value);
  };

  if (!ready || choice) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        role="dialog"
        aria-label="Cookie consent"
        className="fixed bottom-4 left-4 right-4 z-[65] mx-auto max-w-2xl rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-2xl sm:bottom-6 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50">
            <Cookie className="h-5 w-5 text-emerald-800" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-950">We use cookies</p>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
              We use essential cookies to keep you signed in and remember your preferences,
              plus optional analytics to improve our programmes. Read our{" "}
              <a href="#cookies" className="font-semibold text-emerald-800 underline hover:text-emerald-900">
                Cookies Policy
              </a>
              .
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => pick("accepted")}
                className="inline-flex h-10 min-h-10 items-center rounded-xl bg-emerald-950 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => pick("declined")}
                className="inline-flex h-10 min-h-10 items-center rounded-xl border border-emerald-900/15 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-emerald-700/40 hover:text-emerald-900"
              >
                Essential only
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
