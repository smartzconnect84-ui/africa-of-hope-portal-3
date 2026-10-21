import { useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { DEFAULT_ABOUT, paragraphText, resolveIcon } from '@/data/publicPresentation';
import { ScrollReveal } from './motion';
import { publicDestination } from '@/lib/publicSettingsValidation';

/** Owner-approved copy is the fallback; published CMS content is authoritative. */
export default function AboutPage() {
  const { state } = useApp();
  const content = state.websiteSettings.aboutPage || DEFAULT_ABOUT;
  const reduce = useReducedMotion();
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  return <div>
    <section className="bg-emerald-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">{content.eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">{content.title}</h1>
          <p className="mt-5 max-w-3xl text-lg text-amber-200">{content.tagline}</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">{content.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">{content.ctas.map(cta => { const Icon = resolveIcon(cta.icon); return <a key={cta.id} href={publicDestination(cta.href)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-amber-300"><Icon className="h-4 w-4" aria-hidden="true" />{cta.label}</a>; })}</div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">{content.stats.map(stat => <div key={stat.id} className="aoh-glass-dark rounded-2xl p-4 text-center"><p className="text-3xl font-bold text-amber-300">{stat.value}</p><p className="mt-2 text-xs text-white/80">{stat.label}</p></div>)}</div>
        </ScrollReveal>
      </div>
    </section>
    <nav aria-label="About sections" className="border-b bg-white"><div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-4">{content.sections.map(section => <button key={section.id} type="button" onClick={() => jump(section.id)} className="min-h-11 shrink-0 rounded-full border border-emerald-900/20 px-4 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">{section.eyebrow || section.title}</button>)}</div></nav>
    {content.sections.map((section, index) => { const Icon = resolveIcon(section.icon); return <section key={section.id} id={section.id} className={`scroll-mt-24 py-14 sm:py-20 ${index % 2 ? 'bg-[#f6f8f7]' : 'bg-white'}`}>
      <div className="mx-auto max-w-6xl px-4">
        <ScrollReveal>
          <div className="max-w-3xl"><Icon className="h-7 w-7 text-emerald-700" aria-hidden="true" /><p className="mt-4 text-xs font-semibold uppercase tracking-widest text-emerald-700">{section.eyebrow}</p><h2 className="mt-3 text-2xl font-bold text-emerald-950 sm:text-3xl">{section.title}</h2>{section.subtitle && <p className="mt-4 text-lg text-slate-600">{section.subtitle}</p>}</div>
          {section.image && <img src={section.image} alt={section.title} loading="lazy" className="aoh-photo mt-6 h-64 w-full rounded-2xl object-cover object-center sm:h-96" />}
          <div className="mt-5 max-w-4xl space-y-4 text-sm leading-7 text-slate-600 sm:text-base">{paragraphText(section.body).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
          {section.cards.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2">{section.cards.map(card => { const CardIcon = resolveIcon(card.icon); return <article key={card.id} className="aoh-card rounded-2xl bg-white p-6"><CardIcon className="h-6 w-6 text-emerald-700" aria-hidden="true" /><p className="mt-3 text-xs uppercase tracking-wide text-emerald-700">{card.eyebrow}</p><h3 className="mt-2 text-lg font-semibold text-emerald-950">{card.title}</h3><div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">{paragraphText(card.body).map((p, i) => <p key={i}>{p}</p>)}</div></article>; })}</div>}
        </ScrollReveal>
      </div>
    </section>; })}
  </div>;
}
