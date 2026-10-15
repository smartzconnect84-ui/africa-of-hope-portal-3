import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  BadgeCheck,
  LogIn,
} from "lucide-react";
import { useApp } from "../context/AppContext";

interface Slide {
  image: string;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    image:
      "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902768004_IMG-20250919-WA0127.webp",
    eyebrow: "A. M. Kyne Collegiate Resource Center • Cohort Success",
    title: "Empowering Future",
    highlight: "Tech Leaders & Innovators",
    description:
      "Join hands-on, accredited certificate programs crafted to take you from foundational knowledge to job-ready mastery.",
  },
  {
    image:
      "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902655944_IMG-20251006-WA0070.webp",
    eyebrow: "Cohort One • Digital Marketing & Financial Literacy",
    title: "Celebrating Our",
    highlight: "Certified Cohort Graduates",
    description:
      "Recognizing ambitious professionals who mastered modern digital growth and financial management skill sets.",
  },
  {
    image:
      "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902768234_IMG-20251117-WA0113.webp",
    eyebrow: "Accredited Certification • Official Recognition",
    title: "Verifiable Credentials That",
    highlight: "Open Real Career Doors",
    description:
      "Every graduate receives an authenticated, QR-verifiable certificate recognized across top industry partners.",
  },
  {
    image:
      "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902768357_IMG-20251117-WA0114.webp",
    eyebrow: "Readers Are Leaders • Academic Milestone",
    title: "Excellence in Learning &",
    highlight: "Community Building",
    description:
      "Immersive learning environments equipped with modern digital resources and dedicated faculty mentors.",
  },
  {
    image:
      "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902683385_IMG-20251213-WA0229.jpg",
    eyebrow: "Network • Collaborate • Transform",
    title: "A Dynamic Community of",
    highlight: "Lifelong Learners",
    description:
      "Experience peer collaboration, live project labs, and mentorship that accelerates professional growth.",
  },
];

const AUTOPLAY_MS = 6000;

interface HeroSliderProps {
  onOpenApply: () => void;
  onEnterPortal: () => void;
}

export default function HeroSlider({ onOpenApply, onEnterPortal }: HeroSliderProps) {
  const { state } = useApp();
  const slides =
    state.websiteSettings.heroSlides.length > 0 ? state.websiteSettings.heroSlides : SLIDES;
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number, dir?: number) => {
      const next = ((index % slides.length) + slides.length) % slides.length;
      setDirection(dir ?? (next > current ? 1 : -1));
      setCurrent(next);
      setProgress(0);
    },
    [current]
  );

  const next = useCallback(() => goTo(current + 1, 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1, -1), [current, goTo]);

  useEffect(() => {
    if (paused || prefersReducedMotion) return;
    timerRef.current = setInterval(next, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, next, prefersReducedMotion]);

  useEffect(() => {
    if (paused || prefersReducedMotion) return;
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 0;
        return p + 100 / (AUTOPLAY_MS / 50);
      });
    }, 50);
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [paused, prefersReducedMotion, current]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80) next();
    else if (info.offset.x > 80) prev();
  };

  const slide = slides[current];

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  // Slow alternating Ken Burns: even slides breathe in, odd slides breathe out.
  const zoomOut = current % 2 === 1;
  const kenBurns = prefersReducedMotion
    ? { initial: { scale: 1 }, animate: { scale: 1 }, transition: { duration: 0 } }
    : {
        initial: { scale: zoomOut ? 1.16 : 1.04, y: zoomOut ? "-1.5%" : "0%" },
        animate: { scale: zoomOut ? 1.04 : 1.16, y: zoomOut ? "0%" : "-1.5%" },
        transition: { duration: (AUTOPLAY_MS + 1200) / 1000, ease: "linear" as const },
      };

  const textStagger = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.12, duration: 0.55, ease: "easeOut" as const },
    }),
  };

  return (
    <section
      className="relative overflow-hidden bg-emerald-950 text-white min-h-[560px] sm:min-h-[620px] md:min-h-[680px] lg:min-h-[760px] xl:min-h-[820px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Academy highlights"
    >
      {/* Background image layer */}
      <AnimatePresence custom={direction} mode="wait">
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.7, ease: "easeInOut" }}
          className="absolute inset-0"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
        >
          <motion.div
            key={`zoom-${current}`}
            {...kenBurns}
            className="absolute inset-0 will-change-transform"
          >
            <img
              src={slide.image}
              alt={slide.title}
              loading={current === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover object-[center_40%] sm:object-[center_34%] md:object-[center_30%] lg:object-[center_28%]"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/75 to-emerald-950/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content overlay */}
      <div className="relative z-10 mx-auto flex min-h-[560px] max-w-6xl flex-col justify-center px-4 py-16 sm:min-h-[620px] sm:py-20 md:min-h-[680px] lg:min-h-[760px] xl:min-h-[820px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="max-w-2xl"
          >
            {/* Eyebrow badge */}
            <motion.div custom={0} variants={textStagger} className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold ring-1 ring-white/15 backdrop-blur-sm">
                <BadgeCheck className="h-3.5 w-3.5 text-amber-400" />
                {slide.eyebrow}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/30 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Cohort Celebrations
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              custom={1}
              variants={textStagger}
              className="mt-6 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            >
              {slide.title}
              <br />
              <span className="text-amber-400">{slide.highlight}</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              custom={2}
              variants={textStagger}
              className="mt-5 max-w-[65ch] text-base text-emerald-100/90 sm:text-lg"
            >
              {slide.description}
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              custom={3}
              variants={textStagger}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={onOpenApply}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300 active:scale-[0.98]"
              >
                Apply Online <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onEnterPortal}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98]"
              >
                <LogIn className="h-4 w-4" /> Portal Login
              </button>
              <a
                href="#verify"
                className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-100 underline-offset-4 transition hover:text-white hover:underline"
              >
                <ShieldCheck className="h-4 w-4" /> Verify Certificate
              </a>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 active:scale-[0.95] sm:left-5"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 active:scale-[0.95] sm:right-5"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Bottom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
        {/* Progress bar */}
        <div className="mb-4 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-amber-400"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: "linear" }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Slide counter */}
          <span className="text-xs font-semibold tabular-nums text-emerald-200/80">
            {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>

          {/* Thumbnail pills */}
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                className={`group relative h-8 w-12 overflow-hidden rounded-lg ring-1 transition-all sm:h-10 sm:w-16 ${
                  i === current
                    ? "ring-amber-400 ring-2 scale-105"
                    : "ring-white/20 opacity-60 hover:opacity-100 hover:ring-white/40"
                }`}
              >
                <img
                  src={s.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.95]"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </section>
  );
}