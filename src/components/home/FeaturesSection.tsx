import type { WebsiteSettings, SectionCopy } from "@/types";
import { Reveal } from "../Navigation";
import { resolveIcon } from "./icons";

export default function FeaturesSection({ copy, w }: { copy: SectionCopy; w: WebsiteSettings }) {
  if (w.features.length === 0) return null;
  return (
    <section className="scroll-mt-24 bg-emerald-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="max-w-2xl">
            {copy.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-white/15">
                {copy.eyebrow}
              </p>
            )}
            {copy.title && (
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h2>
            )}
            {copy.subtitle && <p className="mt-2 text-sm text-emerald-100/80">{copy.subtitle}</p>}
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {w.features.map((f, i) => {
            const Icon = resolveIcon(f.icon);
            return (
              <Reveal key={f.id} delay={i * 0.06}>
                <div className="h-full rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/20 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-emerald-100/70">{f.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
