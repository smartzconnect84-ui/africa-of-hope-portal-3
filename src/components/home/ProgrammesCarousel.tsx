import { useEffect, useState } from "react";
import { courseId } from "@/lib/identifiers";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { programImage } from "@/lib/programImages";
import { durationLabel } from "@/lib/programDelivery";
import type { Program } from "@/types";
import ProgramBrochureButton from "../public/ProgramBrochureButton";
import WhatsAppShareButton from "../public/WhatsAppShareButton";
import { ScrollReveal } from "../public/motion";

const INTERVAL_MS = 3500;

/** Cards visible at once for the current viewport width. */
function useVisibleCount() {
  const get = () => (typeof window === "undefined" ? 3 : window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
  const [count, setCount] = useState(get);
  useEffect(() => {
    const onResize = () => setCount(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return count;
}

/**
 * Homepage programme showcase: every programme in one row that advances one
 * card right-to-left every few seconds, looping endlessly. Pauses on hover,
 * focus or reduced-motion; arrows allow manual browsing.
 */
export default function ProgrammesCarousel({ programs, onApply }: { programs: Program[]; onApply: () => void }) {
  const reduceMotion = useReducedMotion();
  const visible = useVisibleCount();
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);

  const total = programs.length;
  const looping = total > visible;
  // Append the first `visible` cards so the strip can slide past the end and
  // snap back to the start without a visible jump.
  const slides = looping ? [...programs, ...programs.slice(0, visible)] : programs;

  useEffect(() => {
    if (!looping || paused || reduceMotion) return;
    const t = window.setInterval(() => {
      setAnimate(true);
      setIndex((i) => i + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [looping, paused, reduceMotion]);

  useEffect(() => {
    if (index >= total && total > 0) setIndex((i) => i % total);
  }, [total, index]);

  const step = (dir: 1 | -1) => {
    if (dir === -1 && index === 0) {
      // Jump to the duplicated tail instantly, then slide back one card.
      setAnimate(false);
      setIndex(total);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnimate(true);
          setIndex(total - 1);
        }),
      );
      return;
    }
    setAnimate(true);
    setIndex((i) => i + dir);
  };

  const onSlideDone = () => {
    if (index >= total) {
      setAnimate(false);
      setIndex(0);
    }
  };

  if (total === 0) return null;

  return (
    <section id="programs" className="scroll-mt-20 border-y border-emerald-900/10 bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Programmes</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
              {total} certificate programmes
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {looping && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous programme"
                  className="grid h-9 w-9 place-items-center rounded-full border border-emerald-900/15 text-emerald-800 transition hover:bg-emerald-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next programme"
                  className="grid h-9 w-9 place-items-center rounded-full border border-emerald-900/15 text-emerald-800 transition hover:bg-emerald-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <a
              href="#programmes"
              className="ml-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
            >
              View all <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </ScrollReveal>

        <div
          className="mt-8 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-roledescription="carousel"
        >
          <motion.div
            className="-mx-2.5 flex"
            animate={{ x: `-${(index * 100) / visible}%` }}
            transition={animate ? { duration: 0.6, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
            onAnimationComplete={onSlideDone}
          >
            {slides.map((program, i) => (
              <div
                key={`${program.id}-${i}`}
                className="shrink-0 px-2.5"
                style={{ width: `${100 / visible}%` }}
                aria-hidden={i >= total || undefined}
              >
                <article className="aoh-card aoh-glass group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 shadow-sm">
                  <div className="aoh-zoom relative overflow-hidden">
                    <img src={programImage(program)} alt="" className="h-40 w-full object-cover" loading="lazy" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      {program.category || "Certificate programme"}
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 text-base font-semibold text-emerald-950">{program.title}</h3>
                    <p className="mt-1 break-all font-mono text-[10px] text-slate-500">Course ID: {courseId(program)}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5 text-emerald-700" />
                        {program.durationWeeks ? durationLabel(program) : "Flexible"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="[&_button]:h-7 [&_button]:px-2 [&_button]:text-[11px]">
                          <ProgramBrochureButton program={program} variant="ghost" className="bg-black text-white hover:bg-neutral-800 hover:text-white" />
                        </span>
                        <WhatsAppShareButton
                          program={program}
                          variant="ghost"
                          label="Share"
                          className="h-7 w-auto px-1.5 text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={onApply}
                          tabIndex={i >= total ? -1 : undefined}
                          className="btn-sheen inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white transition hover:bg-emerald-800"
                        >
                          Apply <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </button>
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
