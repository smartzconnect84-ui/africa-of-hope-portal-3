import { ArrowRight, GraduationCap, Quote } from 'lucide-react';
import PartnerShowcase from './PartnerShowcase';
import type { WebsiteSettings, SectionCopy } from '@/types';
import { Reveal } from '../Navigation';

/** CMS-led stories: no generated quotes, star ratings or inferred graduate counts. */
export default function ImpactSection({ copy, w }: { copy: SectionCopy; w: WebsiteSettings }) {
  const stories = w.testimonials.filter((story) => story.quote.trim() && story.name.trim());
  return (
    <section id="impact" aria-labelledby="success-heading" className="relative scroll-mt-24 overflow-hidden bg-emerald-950 py-16 text-white sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-emerald-700/20 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/15 pb-8">
            <div className="max-w-2xl min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300"><GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" /> Our learning community</p>
              <h2 id="success-heading" className="mt-4 break-words text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{copy.title || 'Student Success Stories'}</h2>
              {copy.subtitle && <p className="mt-4 text-base leading-7 text-emerald-100/85">{copy.subtitle}</p>}
            </div>
            <a href="#programmes" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-amber-400/60 px-5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">Explore programmes <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </Reveal>

        {copy.image && <Reveal delay={0.05} className="mt-8">
          <figure className="aoh-card grid overflow-hidden rounded-3xl bg-emerald-900/40 md:grid-cols-[1.15fr_0.85fr]">
            <div className="min-w-0 bg-emerald-900">
              <img src={copy.image} alt="Africa of Hope learning community" loading="lazy" decoding="async" className="aspect-[4/3] h-full max-h-[34rem] w-full object-cover object-[center_30%] sm:aspect-[16/10] md:aspect-[4/3]" />
            </div>
            <figcaption className="flex min-w-0 flex-col justify-center px-6 py-8 sm:p-10">
              <span className="mb-5 h-1 w-12 rounded-full bg-amber-400" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Opportunity through learning</p>
              <h3 className="mt-3 text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">Knowledge. Confidence. Possibility.</h3>
              <p className="mt-4 text-sm leading-7 text-emerald-50/85">Education is a foundation for opportunity and independence. At AFRICA OF HOPE, our focus is helping people build practical skills, develop their potential and take meaningful steps toward their future.</p>
              <a href="#about" className="mt-6 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-amber-200 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-100">Meet the organization behind the mission <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></a>
            </figcaption>
          </figure>
        </Reveal>}

        {stories.length > 0 && <div className={`mt-8 grid min-w-0 gap-5 ${stories.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {stories.map((story, index) => <Reveal key={story.id} delay={Math.min(index * 0.05, 0.2)} className="h-full min-w-0">
            <figure className="aoh-card flex h-full min-w-0 flex-col rounded-2xl bg-white p-6 text-emerald-950 sm:p-8">
              <Quote className="h-8 w-8 text-amber-600" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 whitespace-pre-line break-words text-base leading-8 sm:text-lg">{story.quote}</blockquote>
              <figcaption className="mt-6 flex min-w-0 items-center gap-3 border-t border-emerald-900/10 pt-5">
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-base font-bold text-emerald-900">{story.name.trim().charAt(0).toUpperCase()}</span>
                <div className="min-w-0"><p className="break-words text-sm font-bold">{story.name}</p>{story.program && <p className="mt-1 break-words text-xs leading-5 text-slate-600">{story.program}</p>}</div>
              </figcaption>
            </figure>
          </Reveal>)}
        </div>}

        {w.stats.length > 0 && <Reveal delay={0.1} className="mt-8">
          <dl className="grid grid-cols-1 divide-y divide-white/15 rounded-2xl border border-white/15 bg-white/5 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {w.stats.map((stat) => <div key={stat.id} className="min-w-0 px-5 py-6 sm:py-8"><dd className="break-words text-3xl font-bold tracking-tight text-amber-300 sm:text-4xl">{stat.value}</dd><dt className="mt-2 break-words text-xs font-medium uppercase leading-5 tracking-wider text-emerald-100">{stat.label}</dt></div>)}
          </dl>
        </Reveal>}

        <PartnerShowcase w={w} />
      </div>
    </section>
  );
}
