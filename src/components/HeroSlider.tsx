import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  LogIn,
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

const PROOF_POINTS = [
  { icon: ShieldCheck, title: "Verifiable certificates", body: "Every credential checks out online" },
  { icon: Users, title: "Mentor-led cohorts", body: "Guided by working professionals" },
  { icon: GraduationCap, title: "Practical curriculum", body: "Workplace briefs, not just quizzes" },
] as const;

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
      const next = ((index % safeSlides.length) + safeSlides.length) % safeSlides.length;
      setCurrent(next);
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
      className="aoh-hero relative overflow-hidden bg-emerald-950 text-white"
    >
      {/* Full-bleed photographic backdrop — images only, no text layer.
          Ghost / faded headline text was removed: background carries photos + scrims. */}
      <div aria-hidden="true" className="absolute inset-0">
        {safeSlides.map((s, i) => {
          const active = i === current % safeSlides.length;
          return (
            <div
              key={s.image + i}
              className={cn(
                "absolute inset-0 transition-opacity duration-[1200ms] ease-out",
                active ? "opacity-100" : "opacity-0",
              )}
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
        {/* Professional legibility system: left-to-right + bottom scrims, gold glow, hairline */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#02231a] via-[#02231a]/92 via-55% to-[#02231a]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#02231a] via-[#02231a]/25 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(46rem_26rem_at_12%_0%,rgba(251,191,36,0.18),transparent_62%),radial-gradient(40rem_24rem_at_95%_85%,rgba(16,185,129,0.16),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage: "linear-gradient(to top, transparent 10%, black 55%)",
            WebkitMaskImage: "linear-gradient(to top, transparent 10%, black 55%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:pb-14 lg:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12">
          {/* ——— Copy column: single live headline, no duplicated background titles ——— */}
          <div className="aoh-hero-copy min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {slide.eyebrow ? (
                <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200 ring-1 ring-white/15 backdrop-blur-md">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                  <span className="truncate">{slide.eyebrow}</span>
                </span>
              ) : null}
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
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                  transition={{ duration: prefersReducedMotion ? 0.2 : 0.45, ease: "easeOut" }}
                >
                  <h1 className="text-balance text-[2.1rem] font-extrabold leading-[1.06] tracking-tight text-white min-[480px]:text-4xl sm:text-5xl md:text-[3.3rem] lg:text-[3.7rem]">
                    {slide.title}
                    {slide.highlight ? (
                      <>
                        <br />
                        <span className="relative inline-block text-amber-300">
                          {slide.highlight}
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 300 12"
                            preserveAspectRatio="none"
                            className="absolute -bottom-1.5 left-0 h-2.5 w-full text-amber-400/70"
                          >
                            <path
                              d="M4 8 C 70 3, 200 3, 296 7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </>
                    ) : null}
                  </h1>
                  <p className="mt-4 max-w-[58ch] text-pretty text-base leading-relaxed text-emerald-50/90 sm:text-lg">
                    {slide.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-amber-200">
                <span className="flex" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  ))}
                </span>
                <span className="font-semibold text-white">Cohort-trusted</span>
              </span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-white/20 sm:block" />
              <a
                href="/verify"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-emerald-50/90 underline-offset-4 transition hover:text-white hover:underline"
              >
                <ShieldCheck className="h-4 w-4 text-amber-300" aria-hidden="true" />
                {verifyLabel}
              </a>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onOpenApply}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 text-sm font-bold text-emerald-950 shadow-[0_16px_40px_-12px_rgba(251,191,36,0.7)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 active:scale-[0.98] sm:w-auto"
              >
                {applyLabel}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <a
                href="#programmes"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/40 hover:bg-white/10 active:scale-[0.98] sm:w-auto"
              >
                Explore programmes
                <ArrowUpRight className="h-4 w-4 text-amber-300" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={onEnterPortal}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold text-amber-100/90 underline-offset-4 transition hover:text-amber-200 hover:underline sm:justify-start"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {portalLabel}
              </button>
            </div>

            <dl className="mt-8 grid grid-cols-1 gap-3 min-[560px]:grid-cols-3 md:gap-4">
              {PROOF_POINTS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-white/10 bg-emerald-950/55 p-3.5 backdrop-blur-md transition hover:border-amber-300/30 hover:bg-emerald-950/70"
                >
                  <dt className="flex items-center gap-2 text-[13px] font-bold text-white">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/25">
                      <p.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {p.title}
                  </dt>
                  <dd className="mt-1.5 text-xs leading-relaxed text-emerald-50/70">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ——— Side panel: intake / verification / controls ——— */}
          <div className="w-full lg:justify-self-end lg:pb-1">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-emerald-950/60 shadow-[0_32px_80px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
                  </span>
                  2026 / 2027 intake open
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-100 ring-1 ring-white/15">
                  {String((current % safeSlides.length) + 1).padStart(2, "0")} /{" "}
                  {String(safeSlides.length).padStart(2, "0")}
                </span>
              </div>

              <div className="space-y-3 px-5 py-5">
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/90 text-white">
                    <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold text-white">Certificate verified</span>
                    <span className="block truncate text-xs text-emerald-50/70">Check any credential online in seconds</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-emerald-950">
                    <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold text-white">Fuel a scholarship</span>
                    <span className="block truncate text-xs text-emerald-50/70">Every gift keeps fees transparent</span>
                  </span>
                  <a
                    href="/donate"
                    aria-label="Donate to AFRICA OF HOPE"
                    className="inline-flex h-10 shrink-0 items-center rounded-xl bg-amber-400 px-4 text-xs font-bold text-emerald-950 transition hover:bg-amber-300 active:scale-[0.97]"
                  >
                    {donateLabel}
                  </a>
                </div>
                <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-emerald-50/70">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                  Apply in minutes — no payment to start
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={prev}
                    aria-label="Previous highlight"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/15 transition hover:bg-white/[0.12] active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Next highlight"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/15 transition hover:bg-white/[0.12] active:scale-95"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
                    aria-pressed={paused}
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/15 transition hover:bg-white/[0.12] active:scale-95"
                  >
                    {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/50 min-[420px]:block">
                  Swipe or use arrows
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial slide selector — numbered progress tabs, not giant faded titles */}
        {safeSlides.length > 1 ? (
          <div className="mt-10" role="tablist" aria-label="Choose a highlight">
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {safeSlides.slice(0, 5).map((s, i) => {
                const active = i === current % safeSlides.length;
                return (
                  <button
                    key={`${s.image}-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Show highlight ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={cn(
                      "group overflow-hidden rounded-2xl border p-3 text-left backdrop-blur-md transition active:scale-[0.98]",
                      active
                        ? "border-amber-300/50 bg-white/[0.10]"
                        : "border-white/10 bg-emerald-950/45 hover:border-white/25 hover:bg-white/[0.07]",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-[11px] font-extrabold tabular-nums tracking-[0.14em]",
                          active ? "text-amber-300" : "text-emerald-50/55",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "h-1 w-1.5 rounded-full transition",
                          active ? "bg-amber-300" : "bg-white/25 group-hover:bg-white/45",
                        )}
                      />
                    </span>
                    <span className={cn("mt-1.5 line-clamp-2 block min-h-[2rem] text-xs font-semibold leading-snug", active ? "text-white" : "text-emerald-50/65")}>
                      {s.eyebrow}
                    </span>
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/15">
                      <span
                        className={cn("block h-full rounded-full transition-all", active ? "bg-amber-300" : "bg-white/20")}
                        style={{ width: active ? `${Math.round(progress)}%` : i < current % safeSlides.length ? "100%" : "0%" }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom proof strip */}
      <div className="relative border-t border-white/10 bg-[#021912]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/60 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-300/80" aria-hidden="true" /> Transparent fees
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-amber-300/80" aria-hidden="true" /> Cohort community
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-amber-300/80" aria-hidden="true" /> Career-ready briefs
          </span>
          <span className="ml-auto hidden tabular-nums text-emerald-50/40 sm:block">
            {String((current % safeSlides.length) + 1).padStart(2, "0")} — {String(safeSlides.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}
