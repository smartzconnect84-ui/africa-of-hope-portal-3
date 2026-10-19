import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronRight, Quote, Sparkles, Target } from "lucide-react";
import {
  ABOUT_APPROACH,
  ABOUT_APPROACH_INTRO,
  ABOUT_FUTURE,
  ABOUT_IMPACT,
  ABOUT_JOIN,
  ABOUT_META,
  ABOUT_MISSION,
  ABOUT_NAV,
  ABOUT_PROMISE,
  ABOUT_STORY,
  ABOUT_VALUES,
  ABOUT_WHY,
  ABOUT_WHO,
  type AboutProse,
} from "@/data/aboutContent";
import { MotionCard, ScrollReveal, StaggerGroup } from "./motion";
import { fadeUpVariants } from "./motionConstants";

/**
 * Public "About AFRICA OF HOPE" page.
 *
 * Content comes from `src/data/aboutContent.ts` — the owner's official
 * organisation profile. The page is a hash view (`#about`) in
 * PublicMarketingSite, so every internal jump inside it must scroll
 * manually: a real `#anchor` link would be read as a route change.
 */
export default function AboutPage() {
  const reduce = useReducedMotion();

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-emerald-950 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-emerald-500/25 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <ScrollReveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {ABOUT_META.eyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {ABOUT_META.headline}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium text-amber-200 sm:text-lg">{ABOUT_META.tagline}</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">{ABOUT_META.intro}</p>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="mt-8 flex flex-wrap gap-3">
            <a href="#programmes" className="btn-sheen inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300">
              Explore our programmes <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="#support" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white transition hover:border-amber-400/70 hover:text-amber-300">
              Partner or volunteer with us
            </a>
            <a href="#contact" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white transition hover:border-amber-400/70 hover:text-amber-300">
              Contact us
            </a>
          </ScrollReveal>

          <StaggerGroup className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ABOUT_META.stats.map((s) => (
              <motion.div key={s.id} variants={fadeUpVariants} className="aoh-glass-dark rounded-2xl px-4 py-4 text-center">
                <p className="text-2xl font-bold text-amber-300 sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">{s.label}</p>
              </motion.div>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* --------------------------------------------------------- quick jumps */}
      <nav aria-label="About sections" className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-3">
          <ul className="flex w-max items-center gap-2">
            {ABOUT_NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => jump(item.id)}
                  className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-emerald-900/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 transition hover:border-amber-400/70 hover:bg-emerald-50"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* -------------------------------------------------------------- prose */}
      <ProseBlock data={ABOUT_WHO} tone="white" />
      <ProseBlock data={ABOUT_STORY} tone="muted" />

      {/* ---------------------------------------------------- mission / vision */}
      <section id="about-mission" className="scroll-mt-24 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <SectionHeading eyebrow="What drives us" title="Mission, vision and purpose" />
          </ScrollReveal>
          <StaggerGroup className="mt-8 grid gap-5 lg:grid-cols-3">
            {ABOUT_MISSION.map((item) => {
              const Icon = item.icon;
              return (
                <MotionCard key={item.id} className="aoh-card aoh-glass flex h-full flex-col rounded-2xl p-6">
                  <span className="aoh-icon-tile grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-amber-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{item.eyebrow}</p>
                  <h3 className="mt-1 text-lg font-semibold text-emerald-950">{item.title}</h3>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    {item.body.map((p) => (
                      <p key={p.slice(0, 40)}>{p}</p>
                    ))}
                  </div>
                </MotionCard>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* -------------------------------------------------------- core values */}
      <section id="about-values" className="scroll-mt-24 bg-[#f6f8f7] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <SectionHeading
              eyebrow="Our core values"
              title="Values that guide every decision"
              lead="Our values guide our decisions, relationships, programs, and commitment to the communities we serve."
            />
          </ScrollReveal>
          <StaggerGroup className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ABOUT_VALUES.map((value, index) => {
              const Icon = value.icon;
              return (
                <MotionCard key={value.id} className="aoh-card flex h-full flex-col rounded-2xl bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="aoh-icon-tile grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-semibold text-emerald-950">
                      <span className="mr-1.5 text-xs font-bold text-amber-600">{String(index + 1).padStart(2, "0")}</span>
                      {value.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{value.body[0]}</p>
                </MotionCard>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ------------------------------------------------------ areas of impact */}
      <section id="about-impact" className="scroll-mt-24 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <SectionHeading
              eyebrow="Our areas of impact"
              title="Interconnected areas of service, empowerment and development"
              lead="AFRICA OF HOPE brings together interconnected areas of service, empowerment, and development to support individuals and communities."
            />
          </ScrollReveal>
          <StaggerGroup className="mt-8 grid gap-5 lg:grid-cols-2">
            {ABOUT_IMPACT.map((area) => {
              const Icon = area.icon;
              return (
                <motion.article key={area.id} variants={fadeUpVariants} className="aoh-card flex h-full flex-col rounded-2xl border border-emerald-900/10 bg-white p-6">
                  <div className="flex items-start gap-3">
                    <span className="aoh-icon-tile grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black text-amber-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="pt-2 text-lg font-semibold text-emerald-950">{area.title}</h3>
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    {area.body.map((p) => (
                      <p key={p.slice(0, 40)}>{p}</p>
                    ))}
                  </div>
                </motion.article>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ------------------------------------------------------------ approach */}
      <section id="about-approach" className="scroll-mt-24 bg-emerald-950 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">{ABOUT_APPROACH_INTRO.eyebrow}</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{ABOUT_APPROACH_INTRO.title}</h2>
            {ABOUT_APPROACH_INTRO.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="mt-4 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">
                {p}
              </p>
            ))}
          </ScrollReveal>
          <StaggerGroup className="mt-8 grid gap-4 sm:grid-cols-2">
            {ABOUT_APPROACH.map((step) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.id} variants={fadeUpVariants} className="aoh-glass-dark rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-emerald-950">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/75">{step.body[0]}</p>
                </motion.div>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* -------------------------------------------------------- commitment */}
      <ProseBlock data={ABOUT_FUTURE} tone="white" />

      {/* ------------------------------------------------------------ why us */}
      <section id="about-why" className="scroll-mt-24 bg-[#f6f8f7] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <SectionHeading eyebrow="Why AFRICA OF HOPE" title="What sets our work apart" />
          </ScrollReveal>
          <StaggerGroup className="mt-8 grid gap-4 md:grid-cols-2">
            {ABOUT_WHY.map((reason) => (
              <motion.div key={reason.id} variants={fadeUpVariants} className="aoh-card flex gap-3.5 rounded-2xl bg-white p-5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-emerald-950">{reason.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{reason.body}</p>
                </div>
              </motion.div>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ------------------------------------------------------- get involved */}
      <section id="about-join" className="scroll-mt-24 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-black p-8 text-white sm:p-12">
            <ScrollReveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                <Target className="h-3.5 w-3.5" aria-hidden="true" /> {ABOUT_JOIN.eyebrow}
              </p>
              <h2 className="mt-4 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{ABOUT_JOIN.title}</h2>
              <div className="mt-4 max-w-3xl space-y-3 text-sm leading-7 text-white/80 sm:text-base">
                {ABOUT_JOIN.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
              <p className="mt-5 max-w-3xl border-l-2 border-amber-400 pl-4 text-sm font-semibold text-amber-200 sm:text-base">
                {ABOUT_JOIN.signoff}
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="mt-8 flex flex-wrap gap-2.5">
              <a href="#programmes" className="btn-sheen inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300">
                Explore our programmes <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="#support" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-emerald-950 transition hover:bg-white/90">
                Partner with us
              </a>
              <a href="#support" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white transition hover:border-amber-400/70 hover:text-amber-300">
                Volunteer with us
              </a>
              <a href="#contact" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white transition hover:border-amber-400/70 hover:text-amber-300">
                Contact us
              </a>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- promise */}
      <section className="bg-black py-14 text-white sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <ScrollReveal>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-400/15 text-amber-400">
              <Quote className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">{ABOUT_PROMISE.eyebrow}</p>
            <blockquote className="mt-4 text-xl font-semibold leading-8 text-white sm:text-2xl sm:leading-9">
              {ABOUT_PROMISE.quote}
            </blockquote>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/75">{ABOUT_PROMISE.body}</p>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-amber-300">{ABOUT_PROMISE.signature}</p>
            <p className="mx-auto mt-4 max-w-xl text-xs italic leading-6 text-white/55">{ABOUT_PROMISE.footnote}</p>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">{title}</h2>
      {lead && <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{lead}</p>}
    </div>
  );
}

function ProseBlock({ data, tone }: { data: AboutProse; tone: "white" | "muted" }) {
  return (
    <section
      id={data.id}
      className={`scroll-mt-24 py-14 sm:py-20 ${tone === "muted" ? "bg-[#f6f8f7]" : "bg-white"}`}
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12">
        <ScrollReveal>
          <div className="lg:sticky lg:top-24">
            {data.eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{data.eyebrow}</p>
            )}
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">{data.title}</h2>
            <div aria-hidden="true" className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-amber-400 to-emerald-700" />
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.08}>
          <div className="space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            {data.paragraphs.map((p, i) => (
              <p key={p.slice(0, 40)} className={i === 0 ? "text-base font-medium text-slate-800 sm:text-lg" : undefined}>
                {p}
              </p>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}