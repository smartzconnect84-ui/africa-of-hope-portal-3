import { BadgeCheck, Briefcase, Star, TrendingUp } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { WebsiteSettings, SectionCopy } from "@/types";
import { Reveal } from "../Navigation";

export default function ImpactSection({ copy, w }: { copy: SectionCopy; w: WebsiteSettings }) {
  const { state } = useApp();
  const graduates = state.users.filter((u) => u.role === "Student").length;
  const completionStat = w.stats.find((s) => /completion/i.test(s.label));

  return (
    <section id="impact" className="scroll-mt-24 bg-emerald-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              {copy.title && (
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h2>
              )}
              <p className="mt-1.5 text-sm text-emerald-100/80">
                {copy.subtitle || `Learners enrolled in the portal right now: ${graduates}`}
              </p>
            </div>
            {completionStat && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold ring-1 ring-white/15">
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> {completionStat.value} {completionStat.label}
              </span>
            )}
          </div>
        </Reveal>

        {w.stats.length > 0 && (
          <Reveal delay={0.05}>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {w.stats.map((s) => (
                <div key={s.id} className="rounded-2xl bg-white/5 p-4 text-center ring-1 ring-white/10">
                  <p className="text-2xl font-semibold text-amber-400">{s.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-100/70">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {w.testimonials.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.06} className="h-full">
                <figure className="flex h-full flex-col rounded-2xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="flex gap-0.5 text-amber-400">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-3 flex-1 text-sm text-emerald-50/90">{t.quote}</blockquote>
                  <figcaption className="mt-4 border-t border-white/10 pt-3">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-[11px] text-emerald-200/80">{t.program}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          {copy.image && (
            <Reveal delay={0.12}>
              <div className="relative h-full overflow-hidden rounded-3xl ring-1 ring-white/10">
                <img src={copy.image} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-950 to-transparent p-5">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verifiable credential
                  </p>
                  <p className="mt-1 text-sm text-white">
                    Every certificate carries a unique serial that employers can confirm instantly.
                  </p>
                </div>
              </div>
            </Reveal>
          )}
        </div>

        {w.partners.length > 0 && (
          <Reveal delay={0.1}>
            <div className="mt-10 border-t border-white/10 pt-8">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-200/80">
                <Briefcase className="h-3.5 w-3.5" /> Industry partners
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {w.partners.map((p) =>
                  p.logo ? (
                    <img
                      key={p.id}
                      src={p.logo}
                      alt={p.name}
                      title={p.name}
                      className="h-9 rounded-lg bg-white/10 object-contain px-2 py-1"
                    />
                  ) : (
                    <span
                      key={p.id}
                      className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-emerald-50 ring-1 ring-white/10"
                    >
                      {p.name}
                    </span>
                  ),
                )}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
