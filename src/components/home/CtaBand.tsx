import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SectionCopy } from "@/types";
import { Reveal } from "../Navigation";

export default function CtaBand({
  copy,
  onApply,
  onLogin,
}: {
  copy: SectionCopy;
  onApply: (programId?: string) => void;
  onLogin: () => void;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 py-5 text-white sm:py-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="aoh-glass-dark grid gap-5 rounded-[2rem] border border-white/15 bg-white/5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Join our mission</p>
            {copy.title && <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-amber-300 sm:text-4xl">{copy.title}</h2>}
            {copy.subtitle && <p className="mt-2 text-sm leading-6 text-emerald-100/85 sm:text-base">{copy.subtitle}</p>}
            <p className="mt-3 text-xs leading-6 text-emerald-100/60">A not-for-profit learning community · Every application is reviewed by our registrar · Financial support options available.</p>
          </Reveal>
          <Reveal delay={0.08} className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button onClick={() => onApply()} className="h-12 rounded-2xl bg-amber-400 px-7 text-sm font-bold text-emerald-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-300">
              {copy.ctaText || "Apply online"} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button onClick={onLogin} variant="outline" className="h-12 rounded-2xl border-white/25 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white">
              <LogIn className="mr-1.5 h-4 w-4" /> MY PORTAL
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
