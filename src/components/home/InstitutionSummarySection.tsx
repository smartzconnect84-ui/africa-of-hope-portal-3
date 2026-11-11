import { ArrowRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import type { SectionCopy, SystemSettings, WebsiteSettings } from "@/types";
import { ABOUT_MISSION } from "@/data/aboutContent";
import { DEFAULT_ABOUT, cleanAboutParagraphs } from "@/data/publicPresentation";
import { ScrollReveal, StaggerGroup } from "../public/motion";
import { fadeUpVariants } from "../public/motionConstants";
import { motion } from "framer-motion";

/** The homepage and About page deliberately share the approved organization profile. */
export default function InstitutionSummarySection({ w, settings, programsCount }: {
  copy: SectionCopy; w: WebsiteSettings; settings: SystemSettings; programsCount?: number;
}) {
  const about = w.aboutPage || DEFAULT_ABOUT;
  const summary = about.sections.find(section => section.id === 'about-summary');
  const who = about.sections.find(section => section.id === 'about-who');
  const headline = summary || who;
  void programsCount;
  void settings;
  const mission = ABOUT_MISSION.find(m => m.id === 'mission');
  const vision = ABOUT_MISSION.find(m => m.id === 'vision');
  const statements = [
    { icon: TrendingUp, eyebrow: mission?.eyebrow || 'Our mission', title: 'VISION AND MISSION STATEMENTS', body: mission?.body?.[0] || '' },
    { icon: Lightbulb, eyebrow: vision?.eyebrow || 'Our vision', title: 'Where we are going', body: vision?.body?.[0] || '' },
  ];
  return <section id="summary" className="scroll-mt-24 border-b border-emerald-900/10 bg-white py-10 sm:py-12">
    <div className="mx-auto max-w-6xl px-4">
      <ScrollReveal className="max-w-4xl">
        <p className="aoh-eyebrow inline-flex items-center gap-1.5 rounded-full border border-transparent bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{headline?.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-amber-600 sm:text-4xl">HEAL | EDUCATE | EMPOWER</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-black sm:text-base">{cleanAboutParagraphs(headline?.body || '').map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
        <a href="/about" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber-700 underline underline-offset-4 hover:text-amber-800">{w.publicCopy['summary.link'] || 'Read our full story'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
      </ScrollReveal>
      <StaggerGroup className="mt-6 grid gap-4 sm:grid-cols-2">
        {statements.map(item => { const Icon = item.icon; return <motion.div key={item.eyebrow} variants={fadeUpVariants} className="aoh-card aoh-glass min-w-0 rounded-2xl p-5"><Icon className="h-5 w-5 text-amber-600" aria-hidden="true" /><p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">{item.eyebrow}</p><p className="mt-1 text-base font-bold text-emerald-950">{item.title}</p><p className="mt-2 text-sm leading-6 text-black">{item.body}</p></motion.div>; })}
      </StaggerGroup>
    </div>
  </section>;
}
