import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WebsiteSettings, SectionCopy } from "@/types";
import { Reveal } from "../Navigation";
import { resolveIcon } from "./icons";

export default function AdmissionsSection({
  copy,
  w,
  onApply,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  onApply: () => void;
}) {
  return (
    <section id="admissions" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="max-w-2xl">
            {copy.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
                {copy.eyebrow}
              </p>
            )}
            {copy.title && (
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {copy.title}
              </h2>
            )}
            {copy.subtitle && <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>}
          </div>
        </Reveal>

        {w.admissionSteps.length > 0 && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {w.admissionSteps.map((s, i) => {
              const Icon = resolveIcon(s.icon);
              return (
                <Reveal key={s.id} delay={i * 0.06}>
                  <div className="relative h-full rounded-2xl border border-emerald-900/10 bg-[#f6f8f7] p-5">
                    <span className="absolute -top-3 left-5 grid h-7 w-7 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="mt-2 grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-slate-800">{s.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{s.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          {w.admissionRequirements.length > 0 && (
            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-emerald-900/10 bg-[#f6f8f7] p-6">
                <h3 className="text-lg font-semibold text-slate-900">What you need</h3>
                <ul className="mt-4 space-y-2.5">
                  {w.admissionRequirements.map((r) => (
                    <li key={r.id} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}
          <Reveal delay={0.16}>
            <div className="flex h-full flex-col items-start justify-center gap-3 rounded-3xl bg-emerald-950 p-6 text-white">
              <p className="text-lg font-semibold">Ready when you are.</p>
              <p className="text-sm text-emerald-100/80">
                Applications take less than five minutes and our registrar reviews every file personally.
              </p>
              <Button onClick={onApply} className="mt-2 bg-amber-400 text-emerald-950 hover:bg-amber-300">
                {copy.ctaText || "Apply online"} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
