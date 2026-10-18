import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Megaphone, X } from "lucide-react";
import type { Program } from "@/types";
import { programImage } from "@/lib/programImages";
import { useLocale } from "@/lib/locale";

/**
 * Timing for the program announcement popup (section 4 of the brief).
 * Adjust these values to tune frequency — everything else reads from here.
 */
export const POPUP_CONFIG = {
  /** Delay before the first popup after a visitor starts browsing. */
  firstDelayMs: 15_000,
  /** Minimum wait after a dismissal before another popup may appear. */
  repeatDelayMs: 60_000,
  /** Maximum popup displays per browser session. */
  maxPerSession: 3,
  /** sessionStorage keys tracking dismissal state. */
  countKey: "aoh-popup-count",
  dismissedAtKey: "aoh-popup-dismissed-at",
  indexKey: "aoh-popup-index",
} as const;

function readNum(key: string, fallback: number): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNum(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // Private mode etc. — popup simply shows less often.
  }
}

interface Props {
  programs: Program[];
  /** Pause triggering while e.g. the mobile menu is open. */
  paused?: boolean;
  onExplore: () => void;
  onApply: () => void;
}

/**
 * Polished, non-intrusive announcement popup promoting real published
 * programmes. Rotates through `programs`, hides entirely when there are none,
 * and respects session cooldowns so it never nags. The backdrop is
 * pointer-transparent so the page stays usable; only the card itself captures
 * clicks. Bottom-right card on desktop, compact bottom sheet on mobile.
 */
export default function ProgramAnnouncementPopup({ programs, paused, onExplore, onApply }: Props) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [program, setProgram] = useState<Program | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismiss = useCallback((record: boolean) => {
    if (record) {
      writeNum(POPUP_CONFIG.countKey, readNum(POPUP_CONFIG.countKey, 0) + 1);
      writeNum(POPUP_CONFIG.dismissedAtKey, Date.now());
    }
    setProgram(null);
    // Return focus to whatever opened context the visitor was in.
    if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
  }, []);

  const maybeShow = useCallback(() => {
    if (programs.length === 0) return;
    if (readNum(POPUP_CONFIG.countKey, 0) >= POPUP_CONFIG.maxPerSession) return;
    const sinceDismiss = Date.now() - readNum(POPUP_CONFIG.dismissedAtKey, 0);
    // First display has no dismissal timestamp — allow it; later ones wait.
    if (readNum(POPUP_CONFIG.countKey, 0) > 0 && sinceDismiss < POPUP_CONFIG.repeatDelayMs) {
      timerRef.current = window.setTimeout(maybeShow, POPUP_CONFIG.repeatDelayMs - sinceDismiss);
      return;
    }
    // Never interrupt another modal/dialog or an important interaction.
    if (document.querySelector('[role="dialog"], [data-popup-block]')) {
      timerRef.current = window.setTimeout(maybeShow, POPUP_CONFIG.repeatDelayMs);
      return;
    }
    const next = readNum(POPUP_CONFIG.indexKey, 0) % programs.length;
    writeNum(POPUP_CONFIG.indexKey, next + 1);
    returnFocusRef.current = document.activeElement;
    setProgram(programs[next]);
  }, [programs]);

  // Schedule the first popup; each dismissal reschedules the next.
  useEffect(() => {
    if (paused || programs.length === 0) return;
    clearTimer();
    const shown = readNum(POPUP_CONFIG.countKey, 0);
    const delay =
      shown === 0
        ? POPUP_CONFIG.firstDelayMs
        : Math.max(
            POPUP_CONFIG.repeatDelayMs - (Date.now() - readNum(POPUP_CONFIG.dismissedAtKey, 0)),
            2_000,
          );
    timerRef.current = window.setTimeout(maybeShow, delay);
    return clearTimer;
  }, [paused, programs, program, maybeShow]);

  // Escape closes; focus lands on the close button for keyboard users.
  useEffect(() => {
    if (!program) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss(true);
        // Restart the cooldown cycle for the next rotation.
        timerRef.current = window.setTimeout(maybeShow, POPUP_CONFIG.repeatDelayMs);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [program, dismiss, maybeShow]);

  const handleClose = () => {
    dismiss(true);
    timerRef.current = window.setTimeout(maybeShow, POPUP_CONFIG.repeatDelayMs);
  };

  return (
    <AnimatePresence>
      {program && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-end sm:justify-end sm:p-6" aria-hidden={false}>
          {/* Restrained backdrop tint that never blocks the page. */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="absolute inset-0 bg-emerald-950/20"
          />
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-labelledby="aoh-popup-title"
            initial={reduceMotion ? false : { opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="aoh-glass pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl shadow-emerald-950/30"
          >
            <div className="relative">
              <img src={programImage(program)} alt="" className="h-32 w-full object-cover" loading="lazy" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/55 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-950">
                <Megaphone className="h-3 w-3" aria-hidden="true" /> {t("Admissions open")}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={handleClose}
                aria-label={t("Close announcement")}
                className="absolute right-2.5 top-2.5 grid h-9 w-9 min-h-9 min-w-9 place-items-center rounded-full bg-emerald-950/55 text-white backdrop-blur-sm transition hover:bg-emerald-950/75"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {program.category || t("Certificate programme")}
              </p>
              <h2 id="aoh-popup-title" className="mt-1.5 text-lg font-bold tracking-tight text-emerald-950">
                {program.title}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">
                {program.description || t("Practical, mentor-supported training with a verifiable certificate.")}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    dismiss(false);
                    writeNum(POPUP_CONFIG.countKey, readNum(POPUP_CONFIG.countKey, 0) + 1);
                    writeNum(POPUP_CONFIG.dismissedAtKey, Date.now());
                    timerRef.current = window.setTimeout(maybeShow, POPUP_CONFIG.repeatDelayMs);
                    onExplore();
                  }}
                  className="btn-sheen inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  {t("Explore Programs")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismiss(false);
                    writeNum(POPUP_CONFIG.countKey, readNum(POPUP_CONFIG.countKey, 0) + 1);
                    writeNum(POPUP_CONFIG.dismissedAtKey, Date.now());
                    onApply();
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-900/15 bg-white/70 px-4 text-sm font-semibold text-emerald-900 transition hover:bg-white"
                >
                  {t("Apply Now")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
