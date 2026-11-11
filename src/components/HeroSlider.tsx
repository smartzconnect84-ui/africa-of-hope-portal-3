import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
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

  // Keep the CMS contract exactly as before: fill blanks from the fallback set
  // so the hero never renders dead or empty text, and drop imageless slides.
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

  // Autoplay — honours reduced motion and pauses on hover / focus.
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

  // Performance: warm the first hero photo + the next one so slides never flash blank.
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
      className="aoh-hero relative overflow-hidden bg-emerald-950 text-white"
    >
      {/* Backdrop: deep emerald + gold glow + faint grid + bottom fade into page */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(52rem_30rem_at_12%_-8%,rgba(251,191,36,0.16),transparent_60%),radial-gradient(44rem_28rem_at_95%_20%,rgba(16,185,129,0.22),transparent_60%),linear-gradient(180deg,#06281d_0%,#05352408_55%,#02231a00_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(70% 60% at 30% 20%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(70% 60% at 30% 20%, black 30%, transparent 75%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 md:gap-10 md:pt-16 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:gap-12 lg:pb-24 lg:pt-20">
        {/* ——— Copy column ——— */}
        <div className="aoh-hero-copy min-w-0">
          {/* Trust eyebrow row */}
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

          {/* Headline */}
          <div aria-live="polite" className="mt-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                transition={{ duration: prefersReducedMotion ? 0.2 : 0.45, ease: "easeOut" }}
              >
                <h1 className="text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight text-white min-[480px]:text-4xl sm:text-5xl md:text-[3.25rem] md:leading-[1.04] lg:text-[3.6rem]">
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

          {/* Rating + verification micro-proof */}
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
              className="inline-flex items-center gap-1.5 font-medium text-emerald-50/90 underline-offset-4 transition hover:text-white hover:underline"
            >
              <ShieldCheck className="h-4 w-4 text-amber-300" aria-hidden="true" />
              {verifyLabel}
            </a>
          </div>

          {/* CTAs — full-width stacked tap targets on phones, inline row on tablet/desktop */}
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
              className="inline-flex h-12 items-center gap-2 rounded-2xl px-3 text-sm font-semibold text-amber-100/90 underline-offset-4 transition hover:text-amber-200 hover:underline"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {portalLabel}
            </button>
          </div>

          {/* Proof points — 1 col phones, 3 cols from small tablets up */}
          <dl className="mt-8 grid grid-cols-1 gap-3 min-[560px]:grid-cols-3 md:gap-4">
            {PROOF_POINTS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md transition hover:border-amber-300/30 hover:bg-white/[0.07]"
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

          {/* Slide selector — swipeable strip on phones/tablets, grid on desktop */}
          {safeSlides.length > 1 ? (
            <div className="mt-7" role="tablist" aria-label="Choose a highlight">
              <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
                {safeSlides.slice(0, 5).map((s, i) => {
                  const active = i === current % safeSlides.length;
                  return (
                    <button
                      key={`${s.title}-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={`Show highlight ${i + 1}: ${s.title} ${s.highlight}`.trim()}
                      onClick={() => goTo(i)}
                      className={cn(
                        "group relative w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.98] sm:w-auto",
                        active
                          ? "border-amber-300/50 bg-white/10 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-bold tabular-nums",
                            active ? "text-amber-300" : "text-emerald-50/50",
                          )}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className={cn("truncate text-xs font-semibold", active ? "text-white" : "text-emerald-50/75")}>
                          {s.title} {s.highlight}
                        </span>
                      </span>
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
                        <span
                          className={cn("block h-full rounded-full transition-all", active ? "bg-amber-300" : "bg-transparent")}
                          style={{ width: active ? `${Math.round(progress)}%` : "0%" }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* ——— Visual column: stacked below copy on mobile/tablet, side-by-side on desktop ——— */}
        <div className="relative mx-auto w-full max-w-[520px] md:max-w-[640px] lg:mx-0 lg:max-w-none">
          {/* Offset gold frame */}
          <div aria-hidden="true" className="absolute -inset-3 rounded-[2.2rem] bg-gradient-to-br from-amber-300/25 via-transparent to-emerald-400/20 blur-[1px]" />
          <div aria-hidden="true" className="absolute -right-5 -top-5 hidden h-28 w-28 rounded-3xl border border-amber-300/30 sm:block" />

          <div className="relative overflow-hidden rounded-[2rem] bg-emerald-900 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/15">
            <div className="relative aspect-[4/3.1] w-full min-[480px]:aspect-[4/3.2] md:aspect-[16/10] lg:aspect-[4/4.5]">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={slide.image + current}
                  src={slide.image}
                  alt={`${slide.title} ${slide.highlight}`.trim()}
                  loading={current === 0 ? "eager" : "lazy"}
                  fetchPriority={current === 0 ? "high" : "low"}
                  decoding="async"
                  draggable={false}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
                  transition={{ duration: prefersReducedMotion ? 0.2 : 0.65, ease: "easeOut" }}
                  className="aoh-photo absolute inset-0 h-full w-full object-cover object-center"
                />
              </AnimatePresence>
              {/* Legibility scrims */}
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-950/10 to-emerald-950/10" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-tr from-emerald-950/40 via-transparent to-transparent" />

              {/* Top overlay: live pill + controls */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/70 py-1.5 pl-2 pr-3 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
                  </span>
                  2026 / 2027 intake open
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={prev}
                    aria-label="Previous highlight"
                    className="grid h-9 w-9 place-items-center rounded-full bg-emerald-950/60 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-emerald-950/85 active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Next highlight"
                    className="grid h-9 w-9 place-items-center rounded-full bg-emerald-950/60 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-emerald-950/85 active:scale-95"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
                    aria-pressed={paused}
                    className="grid h-9 w-9 place-items-center rounded-full bg-emerald-950/60 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-emerald-950/85 active:scale-95"
                  >
                    {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Bottom overlay: caption + counter */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0 rounded-2xl bg-emerald-950/65 px-4 py-3 ring-1 ring-white/15 backdrop-blur-md">
                  <p className="truncate text-sm font-bold text-white">
                    {slide.title} {slide.highlight}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-50/80">
                    <CalendarDays className="h-3 w-3 text-amber-300" aria-hidden="true" />
                    Apply in minutes — no payment to start
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-100 ring-1 ring-white/15 backdrop-blur-md">
                  {String((current % safeSlides.length) + 1).padStart(2, "0")} / {String(safeSlides.length).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>

          {/* Floating: verified credential */}
          <div className="absolute -left-3 top-8 hidden items-center gap-3 rounded-2xl border border-white/40 bg-white/95 p-3 pr-4 text-emerald-950 shadow-xl backdrop-blur-md sm:flex lg:-left-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs font-extrabold">Certificate verified</span>
              <span className="block text-[11px] font-medium text-emerald-800/80">Check any credential online</span>
            </span>
          </div>

          {/* Floating: donate / intake */}
          <div className="absolute -bottom-6 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200/60 bg-emerald-950/90 p-3.5 pl-4 shadow-2xl ring-1 ring-amber-300/20 backdrop-blur-md sm:left-6 sm:right-auto sm:min-w-[300px]">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-emerald-950">
                <HeartHandshake className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-extrabold text-white">Fuel a scholarship</span>
                <span className="block text-[11px] text-emerald-50/70">Every gift keeps fees transparent</span>
              </span>
            </span>
            <a
              href="/donate"
              aria-label="Donate to AFRICA OF HOPE"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-xs font-bold text-emerald-950 transition hover:bg-amber-300 active:scale-[0.97]"
            >
              {donateLabel}
            </a>
          </div>
        </div>
      </div>

      {/* Bottom hairline proof strip */}
      <div className="relative border-t border-white/10 bg-emerald-950/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/60">
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
