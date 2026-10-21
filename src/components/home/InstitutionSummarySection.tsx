import { ArrowRight, GraduationCap, HeartHandshake, MapPin, Sparkles } from "lucide-react";
import type { SectionCopy, SystemSettings, WebsiteSettings } from "@/types";
import { DEFAULT_ABOUT, paragraphText } from "@/data/publicPresentation";
import { ScrollReveal, StaggerGroup } from "../public/motion";
import { fadeUpVariants } from "../public/motionConstants";
import { motion } from "framer-motion";

/** The homepage and About page deliberately share the approved organization profile. */
export default function InstitutionSummarySection({ w, settings, programsCount }: {
  copy: SectionCopy; w: WebsiteSettings; settings: SystemSettings; programsCount?: number;
}) {
  const about = w.aboutPage || DEFAULT_ABOUT;
  const who = about.sections.find(section => section.id === 'about-who');
  const facts = [
    { icon: GraduationCap, label: "Programmes in catalogue", value: String(programsCount ?? "—") },
    { icon: Sparkles, label: "Established", value: about.stats[0]?.value || '—' },
    { icon: HeartHandshake, label: "Areas of impact", value: about.stats[1]?.value || '—' },
    { icon: MapPin, label: "Location", value: w.address || settings.address || "Contact our office" },
  ];
  return <section id="summary" className="scroll-mt-24 border-b border-emerald-900/10 bg-white py-16 sm:py-20">
    <div className="mx-auto max-w-6xl px-4">
      <ScrollReveal className="max-w-4xl">
        <p className="aoh-eyebrow inline-flex items-center gap-1.5 rounded-full border border-transparent bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{who?.eyebrow}</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">{who?.title}</h2>
        <p className="mt-4 text-base font-medium leading-7 text-emerald-900">{about.intro}</p>
        <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">{paragraphText(who?.body || '').map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
        <a href="#about" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-800 underline underline-offset-4">{w.publicCopy['summary.link'] || 'Explore our mission and story'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
      </ScrollReveal>
      <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(fact => { const Icon = fact.icon; return <motion.div key={fact.label} variants={fadeUpVariants} className="aoh-card aoh-glass min-w-0 rounded-2xl p-5"><Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" /><p className="mt-3 break-words text-xl font-bold text-emerald-950">{fact.value}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{fact.label}</p></motion.div>; })}
      </StaggerGroup>
    </div>
  </section>;
}
