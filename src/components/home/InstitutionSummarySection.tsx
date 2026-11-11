import { ArrowRight, HeartHandshake, Sparkles, TrendingUp } from "lucide-react";
import type { SectionCopy, SystemSettings, WebsiteSettings } from "@/types";
import { ABOUT_MISSION } from "@/data/aboutContent";
import { DEFAULT_ABOUT, cleanAboutParagraphs } from "@/data/publicPresentation";
import { ScrollReveal } from "../public/motion";

/** Modern nonprofit mission snapshot: story first, mission/vision cards, dual CTAs. */
export default function InstitutionSummarySection({
  w,
  settings,
  programsCount,
  onApply,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
  programsCount?: number;
  onApply?: () => void;
}) {
  const about = w.aboutPage || DEFAULT_ABOUT;
  const summary = about.sections.find((section) => section.id === "about-summary");
  const who = about.sections.find((section) => section.id === "about-who");
  const headline = summary || who;
  void settings;
  const mission = ABOUT_MISSION.find((m) => m.id === "mission");
  const paragraphs = cleanAboutParagraphs(headline?.body || "").slice(0, 2);
  const cards = [
    { icon: TrendingUp, eyebrow: mission?.eyebrow || "Our mission", title: "Heal · Educate · Empower", body: mission?.body?.[0] || "" },
  ];
  return (
    <section id="summary" aria-labelledby="mission-heading" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <ScrollReveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-900">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {headline?.eyebrow || "Who we are"}
            </p>
            <h2 id="mission-heading" className="mt-4 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
              A not-for-profit school for practical hope
            </h2>
            <div className="mt-4 space-y-3 text-[15px] leading-7 text-slate-700">
              {paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/programmes"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Explore programmes <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              {onApply ? (
                <button
                  type="button"
                  onClick={onApply}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400 bg-amber-400 px-5 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-amber-300 hover:border-amber-300"
                >
                  <HeartHandshake className="h-4 w-4" aria-hidden="true" /> Get involved
                </button>
              ) : (
                <a
                  href="/?section=support"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400 bg-amber-400 px-5 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-amber-300 hover:border-amber-300"
                >
                  <HeartHandshake className="h-4 w-4" aria-hidden="true" /> Get involved
                </a>
              )}
            </div>
            <p className="mt-4 text-[13px] text-slate-500">
              {typeof programsCount === "number" && programsCount > 0
                ? `${programsCount} certificate programmes · verified credentials · mentor support`
                : "Verified credentials · mentor support · community cohorts"}
            </p>
          </ScrollReveal>
          <div className="grid gap-4">
            {cards.map((item) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.eyebrow} delay={0.06}>
                  <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-5 sm:p-6">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-amber-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{item.eyebrow}</p>
                    <p className="mt-1 text-lg font-bold text-emerald-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.body}</p>
                  </div>
                </ScrollReveal>
              );
            })}
            <a href="/about" className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
              {w.publicCopy["summary.link"] || "Read our full story"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
