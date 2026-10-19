import { ShieldCheck } from "lucide-react";
import type { WebsiteSettings, SectionCopy, SystemSettings } from "@/types";
import { Reveal } from "../Navigation";
import { resolveIcon } from "./icons";

export default function AboutSection({
  copy,
  w,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
}) {
  return (
    <section id="about" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
        {copy.image && (
          <Reveal>
            <div className="relative">
              <img
                src={copy.image}
                alt="Africa of Hope graduates celebrating their certification"
                className="h-80 w-full rounded-3xl object-cover object-[center_20%] shadow-lg shadow-emerald-900/10 sm:h-[28rem]"
              />
              <div className="aoh-card aoh-glass absolute -bottom-5 left-5 rounded-2xl p-4">
                <p className="text-2xl font-semibold text-emerald-800">{w.partners.length || 18}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Partner employers</p>
              </div>
            </div>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          {copy.eyebrow && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900">
              <ShieldCheck className="h-3.5 w-3.5" /> {copy.eyebrow}
            </p>
          )}
          {copy.title && (
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {copy.title}
            </h2>
          )}
          {copy.body && <p className="mt-4 text-sm text-slate-600 sm:text-base">{copy.body}</p>}
          {w.aboutPoints.length > 0 && (
            <div className="mt-7 space-y-3">
              {w.aboutPoints.map((p) => {
                const Icon = resolveIcon(p.icon);
                return (
                  <div key={p.id} className="flex gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-amber-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="self-center text-sm font-semibold text-slate-800">{p.title}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
