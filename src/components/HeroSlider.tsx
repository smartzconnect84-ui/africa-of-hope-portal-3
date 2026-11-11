import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "@/lib/utils";

interface Slide {
  image: string;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
}

const FALLBACK_SLIDES: Slide[] = [
  {
    image:
      "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902768004_IMG-20250919-WA0127.webp",
    eyebrow: "A. M. Kyne Collegiate Resource Center • Cohort Success",
    title: "Empowering Future",
    highlight: "Tech Leaders & Innovators",
    description:
      "Explore practical programmes from AFRICA OF HOPE, with course duration, study options and registration details in our catalogue.",
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
    eyebrow: "Professional Learning • Certificate Verification",
    title: "Verifiable Credentials That",
    highlight: "Open Real Career Doors",
    description:
      "Use the certificate verification page to check credentials issued through AFRICA OF HOPE.",
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

const AUTOPLAY_MS = 6500;

interface HeroSliderProps {
  onOpenApply: () => void;
  onEnterPortal: () => void;
}

export default function HeroSlider({ onOpenApply, onEnterPortal }: HeroSliderProps) {
  const { state } = useApp();
  const rawSlides =
    state.websiteSettings.heroSlides.length > 0 ? state.websiteSettings.heroSlides : FALLBACK_SLIDES;

  const slides = (rawSlides.length > 0 ? rawSlides : FALLBACK_SLIDES)
    .map((s, i) => ({
      image: (s.image || FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].image).trim(),
      eyebrow: (s.eyebrow || FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].eyebrow || "AFRICA OF HOPE").trim(),
      title: (s.title || FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].title || "Learn practical skills").trim(),
      highlight: (s.highlight || FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].highlight || "").trim(),
      description: (
        s.description ||
        FALLBACK_SLIDES[i % FALLBACK_SLIDES.length].description ||
        "Practical certificate programmes with mentors and verifiable certificates."
      ).trim(),
    }))
    .filter((s) => s.image.length > 0 && (s.title.length > 0 || s.description.length > 0));
  const safeSlides = slides.length > 0 ? slides : FALLBACK_SLIDES;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchX = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      const nextIdx = ((index % safeSlides.length) + safeSlides.length) % safeSlides.length;
      setCurrent(nextIdx);
      setProgress(0);
    },
    [safeSlides.length],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (paused || prefersReducedMotion || safeSlides.length < 2) return;
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const step = 100 / (AUTOPLAY_MS / 100);
        if (p + step >= 100) {
          setCurrent((c) => (c + 1) % safeSlides.length);
          return 0;
        }
        return p + step;
      });
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, prefersReducedMotion, safeSlides.length, current]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const firstImage = safeSlides[0]?.image;
  const secondImage = safeSlides[1]?.image;
  useEffect(() => {
    try {
      [firstImage, secondImage].forEach((src, i) => {
        if (!src) return;
        const l = document.createElement("link");
        l.rel = "preload";
        l.as = "image";
        l.href = src;
        if (i === 0) l.setAttribute("fetchpriority", "high");
        document.head.appendChild(l);
      });
    } catch {
      /* best-effort */
    }
  }, [firstImage, secondImage]);

  const slide = safeSlides[current % safeSlides.length];
  const copy = state.websiteSettings.publicCopy;
  const badgeText = (copy["hero.badge"] || "").trim();
  const applyLabel = copy["hero.apply"] || "Apply Online";
  const donateLabel = copy["hero.donate"] || "Donate";
  const verifyLabel = copy["hero.verify"] || "Verify Certificate";
  const portalLabel = copy["hero.portal"] || "School Portal Login";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Academy highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 48) {
          if (dx < 0) next();
          else prev();
        }
        touchX.current = null;
      }}
      className="aoh-hero relative overflow-hidden bg-[#fdfcf7] text-emerald-950"
    >
      {/* Light editorial backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/80 via-[#fdfcf7] to-emerald-50/60" />
        <div className="absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -right-40 top-24 h-[30rem] w-[30rem] rounded-full bg-emerald-200/50 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: "radial-gradient(rgba(6,78,59,0.10) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 62%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 62%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-800 via-amber-400 to-emerald-800" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-14 lg:pb-28 lg:pt-16">
        <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          {/* ——— Copy ——— */}
          <div className="aoh-hero-copy min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 py-1.5 pl-1.5 pr-3 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-900 shadow-sm backdrop-blur">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900 px-2.5 py-1 text-[10px] tracking-[0.12em] text-amber-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
                  </span>
                  2026 / 27
                </span>
                <span className="truncate">{slide.eyebrow}</span>
              </span>
              {badgeText ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-950 shadow-[0_8px_24px_-8px_rgba(251,191,36,0.8)]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {badgeText}
                </span>
              ) : null}
            </div>

            <div aria-live="polite" className="mt-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                  transition={{ duration: prefersReducedMotion ? 0.2 : 0.45, ease: "easeOut" }}
                >
                  <h1 className="text-balance text-[2.05rem] font-extrabold leading-[1.04] tracking-tight text-emerald-950 min-[480px]:text-5xl sm:text-6xl lg:text-[4.1rem]">
                    {slide.title}
                    {slide.highlight ? (
                      <>
                        <br />
                        <span className="relative inline-block text-emerald-800">
                          {slide.highlight}
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 300 12"
                            preserveAspectRatio="none"
                            className="absolute -bottom-1.5 left-0 h-3 w-full text-amber-400"
                          >
                            <path
                              d="M4 8 C 70 3, 200 3, 296 7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </>
                    ) : null}
                  </h1>
                  <p className="mt-5 max-w-[56ch] text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
                    {slide.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onOpenApply}
                className="group inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-950 px-5 text-[13px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(6,78,59,0.6)] transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto"
              >
                {applyLabel}
                <ArrowRight className="h-4 w-4 text-amber-300 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <a
                href="#programmes"
                className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-5 text-[13px] font-bold text-emerald-950 shadow-sm transition hover:border-emerald-900/30 hover:bg-emerald-50 active:scale-[0.98] sm:w-auto"
              >
                Explore programmes
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="/donate"
                className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-[13px] font-bold text-emerald-950 shadow-[0_14px_30px_-12px_rgba(251,191,36,0.8)] transition hover:bg-amber-300 active:scale-[0.98] sm:w-auto"
              >
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                {donateLabel}
              </a>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="flex" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </span>
                <span className="font-semibold text-emerald-950">Cohort-trusted</span>
                <span className="text-slate-500">· mentor-led learning</span>
              </span>
              <a
                href="/verify"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-emerald-800 underline-offset-4 transition hover:text-emerald-950 hover:underline"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {verifyLabel}
              </a>
              <button
                type="button"
                onClick={onEnterPortal}
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-slate-600 underline-offset-4 transition hover:text-emerald-950 hover:underline"
              >
                {portalLabel} →
              </button>
            </div>

            {/* Slide selector removed per design review — prev/next + caption controls remain on the visual card. */}
          </div>

          {/* ——— Visual ——— */}
          <div className="relative mx-auto w-full max-w-[560px] lg:mx-0">
            {/* Arch frame */}
            <div className="relative overflow-hidden rounded-[2rem] rounded-tr-[4.5rem] border border-emerald-900/10 bg-white shadow-[0_40px_80px_-30px_rgba(6,78,59,0.35)]">
              <div className="relative aspect-[4/3.6] min-h-[320px] w-full overflow-hidden bg-emerald-100 min-[480px]:aspect-[4/4] sm:aspect-[5/4.6] sm:min-h-[400px] lg:aspect-[4/4.6] lg:min-h-[440px]">
                {safeSlides.map((s, i) => {
                  const active = i === current % safeSlides.length;
                  return (
                    <div
                      key={s.image + i}
                      className={cn(
                        "absolute inset-0 transition-opacity duration-[1100ms] ease-out",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden={!active}
                    >
                      <img
                        src={s.image}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        loading={i === 0 ? "eager" : "lazy"}
                        decoding="async"
                        className={cn(
                          "h-full w-full object-cover object-center",
                          active && !prefersReducedMotion ? "aoh-hero-kenburns" : "",
                        )}
                      />
                    </div>
                  );
                })}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/55 via-transparent to-transparent" />
                {/* Caption */}
                <div className="absolute inset-x-4 bottom-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-emerald-950/55 px-4 py-3 backdrop-blur-xl"
                    >
                      <p className="min-w-0 truncate text-[13px] font-semibold text-white">
                        <span className="mr-2 font-extrabold tabular-nums text-amber-300">
                          {String((current % safeSlides.length) + 1).padStart(2, "0")} /{" "}
                          {String(safeSlides.length).padStart(2, "0")}
                        </span>
                        <span className="truncate">{slide.eyebrow}</span>
                      </p>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={prev}
                          aria-label="Previous highlight"
                          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 active:scale-95"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={next}
                          aria-label="Next highlight"
                          className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-emerald-950 transition hover:bg-amber-300 active:scale-95"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaused((p) => !p)}
                          aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
                          aria-pressed={paused}
                          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 active:scale-95"
                        >
                          {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Floating: verified */}
            <div className="absolute -left-3 top-8 flex items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/95 py-2.5 pl-2.5 pr-4 shadow-xl shadow-emerald-950/10 backdrop-blur sm:-left-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-800 text-amber-300">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[13px] font-extrabold leading-tight text-emerald-950">
                  Certificate verified
                </span>
                <span className="block text-xs text-slate-500">Check any credential online</span>
              </span>
            </div>

            {/* Floating: intake */}
            <div className="absolute -right-2 bottom-24 hidden w-[230px] rounded-2xl border border-emerald-900/10 bg-white/95 p-3.5 shadow-xl shadow-emerald-950/10 backdrop-blur sm:block lg:-right-6">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                <GraduationCap className="h-4 w-4" aria-hidden="true" /> Intake open
              </p>
              <p className="mt-1.5 text-[13px] font-semibold leading-snug text-emerald-950">
                Apply in minutes — no payment to start
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={onOpenApply}
                  className="h-9 flex-1 rounded-xl bg-emerald-950 text-xs font-bold text-white transition hover:bg-emerald-900"
                >
                  Apply
                </button>
                <a
                  href="/verify"
                  className="grid h-9 flex-1 place-items-center rounded-xl border border-emerald-900/15 text-xs font-bold text-emerald-950 transition hover:bg-emerald-50"
                >
                  Verify
                </a>
              </div>
            </div>

            {/* Thumbnails */}
            {safeSlides.length > 1 ? (
              <div className="mt-4 flex items-center gap-2.5 overflow-x-auto pb-1">
                {safeSlides.slice(0, 5).map((s, i) => {
                  const active = i === current % safeSlides.length;
                  return (
                    <button
                      key={`thumb-${s.image}-${i}`}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`View photo ${i + 1}`}
                      aria-current={active}
                      className={cn(
                        "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition active:scale-95",
                        active
                          ? "border-amber-400 shadow-lg"
                          : "border-white opacity-70 hover:opacity-100",
                      )}
                    >
                      <img src={s.image} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
                      {active ? <span className="absolute inset-0 ring-1 ring-inset ring-emerald-950/20" /> : null}
                    </button>
                  );
                })}
                <div className="ml-1 hidden items-center gap-4 rounded-xl border border-emerald-900/10 bg-white/80 px-4 py-3 backdrop-blur min-[480px]:flex">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <Users className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Cohort community
                  </span>
                  <span className="h-4 w-px bg-emerald-900/15" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Transparent fees
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
