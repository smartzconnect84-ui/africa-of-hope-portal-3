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
  onApply: () => void;
  onLogin: () => void;
}) {
  return (
    <section className="scroll-mt-24 bg-gradient-to-br from-emerald-800 to-emerald-950 py-14 text-white sm:py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 lg:flex-row lg:items-center lg:justify-between">
        <Reveal className="max-w-xl">
          {copy.title && <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h2>}
          {copy.subtitle && <p className="mt-2 text-sm text-emerald-100/85">{copy.subtitle}</p>}
        </Reveal>
        <Reveal delay={0.08} className="flex shrink-0 flex-wrap gap-3">
          <Button onClick={onApply} className="bg-amber-400 text-emerald-950 hover:bg-amber-300">
            {copy.ctaText || "Apply online"} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button onClick={onLogin} variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10">
            <LogIn className="mr-1.5 h-4 w-4" /> Portal login
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
