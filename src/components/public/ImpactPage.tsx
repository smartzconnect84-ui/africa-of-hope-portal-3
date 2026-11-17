import { ArrowRight, GraduationCap, HeartHandshake, Quote, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getPublicPage } from '@/lib/publicPages';
import { ScrollReveal } from './motion';
import ExpandableImage from './PageImage';

/** Professional standalone Impact page: proof, stories, stats, partners and CTAs. CMS-driven. */
export default function ImpactPage({ onApply }: { onApply: (programId?: string) => void }) {
  const { state } = useApp();
  const w = state.websiteSettings;
  const page = getPublicPage(w, 'impact');
  const impactCopy = w.home.sections?.impact as { title?: string; subtitle?: string; image?: string } | undefined;
  const stories = (w.testimonials || []).filter((s) => s.quote?.trim() && s.name?.trim()).slice(0, 6);
  const stats = w.stats || [];
  const partners = (w as unknown as { partners?: { id: string; name: string; logo?: string }[] }).partners || [];
  const heroImage = page.image || impactCopy?.image || '';

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-emerald-950 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-24 h-96 w-96 rounded-full bg-emerald-700/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {page.eyebrow || 'Our impact'}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/85 sm:text-base">
              {page.subtitle || 'Practical certificate programmes, supportive mentors and clear proof — from application to verified certificate.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onApply()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" /> Explore programmes
              </button>
              <a
                href="/transparency"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> See transparency
              </a>
            </div>
          </ScrollReveal>
          {stats.length > 0 && (
            <ScrollReveal delay={0.08}>
              <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.slice(0, 4).map((stat) => (
                  <div key={stat.id} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-center backdrop-blur sm:p-5">
                    <dd className="break-words text-2xl font-bold tracking-tight text-amber-300 sm:text-4xl">{stat.value}</dd>
                    <dt className="mt-2 break-words text-[11px] font-medium uppercase leading-5 tracking-wider text-emerald-100">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </ScrollReveal>
          )}
        </div>
      </section>

      {heroImage ? <ExpandableImage src={heroImage} alt="Africa of Hope learning community" className="border-b bg-white" imgClassName="mx-auto h-64 w-full max-w-6xl object-cover sm:h-96" /> : null}

      {/* Mission body */}
      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Why it matters</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">Opportunity through practical learning</h2>
              <div className="mt-4 space-y-4 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
                <p>{page.body || 'Education is a foundation for opportunity and independence. At AFRICA OF HOPE, we focus on helping people build practical skills, develop their potential and take meaningful steps toward their future — fully online or onsite at Boystown Junction, Lower Margibi.'}</p>
              </div>
            </div>
          </ScrollReveal>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { icon: GraduationCap, title: 'Practical programmes', body: 'Two-week to six-month certificate tracks in technology, trades, business and hospitality — with clear entry requirements and study plans.' },
              { icon: HeartHandshake, title: 'Mentored cohorts', body: 'Small cohorts, working-professional mentors, attendance and assignment support from first class to completion.' },
              { icon: ShieldCheck, title: 'Verified certificates', body: 'Every certificate carries a unique serial checked live against the institutional register. Revoked serials report as revoked.' },
            ].map((card) => (
              <ScrollReveal key={card.title} className="h-full">
                <article className="flex h-full flex-col rounded-2xl border border-emerald-900/10 bg-[#f6f8f7] p-6">
                  <card.icon className="h-7 w-7 text-amber-600" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-emerald-950">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">{card.body}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="bg-emerald-950 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Student stories</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{impactCopy?.title || 'Student Success Stories'}</h2>
                {impactCopy?.subtitle ? <p className="mt-3 text-sm leading-7 text-emerald-100/85">{impactCopy.subtitle}</p> : null}
              </div>
              <a href="/programmes" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-amber-400/60 px-5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400 hover:text-emerald-950">
                Explore programmes <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </ScrollReveal>
          {stories.length > 0 ? (
            <div className={`mt-8 grid gap-5 ${stories.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {stories.map((story) => (
                <ScrollReveal key={story.id} className="h-full">
                  <figure className="flex h-full flex-col rounded-2xl bg-white p-6 text-emerald-950 sm:p-8">
                    <Quote className="h-8 w-8 text-amber-600" aria-hidden="true" />
                    <blockquote className="mt-4 flex-1 whitespace-pre-line text-base leading-8">{story.quote}</blockquote>
                    <figcaption className="mt-6 flex items-center gap-3 border-t border-emerald-900/10 pt-5">
                      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-base font-bold text-emerald-900">
                        {story.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{story.name}</span>
                        {story.program ? <span className="mt-0.5 block truncate text-xs text-slate-600">{story.program}</span> : null}
                      </span>
                    </figcaption>
                  </figure>
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-6 text-sm leading-7 text-emerald-50/85">
              Stories from our learning community will appear here once published by the academy team.
            </p>
          )}
        </div>
      </section>

      {/* Partners + CTA */}
      {(partners.length > 0 || stats.length > 4) && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Community & partners</p>
              <h2 className="mt-3 text-2xl font-bold text-emerald-950">Growing together</h2>
            </ScrollReveal>
            {stats.length > 4 && (
              <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.slice(4).map((stat) => (
                  <div key={stat.id} className="rounded-2xl border border-emerald-900/10 bg-[#f6f8f7] p-4 text-center">
                    <dd className="text-2xl font-bold text-emerald-900">{stat.value}</dd>
                    <dt className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-600">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            )}
            {partners.length > 0 && (
              <ul className="mt-6 flex flex-wrap items-center gap-3">
                {partners.map((partner) => (
                  <li key={partner.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-sm font-medium text-emerald-950 shadow-sm">
                    {partner.logo ? <img src={partner.logo} alt="" loading="lazy" className="h-6 w-6 rounded-full object-cover" /> : null}
                    {partner.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="bg-[#f6f8f7] pb-16 pt-2 sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-8 text-white sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Join the next cohort</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Start a practical certificate — online anytime or onsite with a cohort.</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onApply()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300"
              >
                Apply now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <a href="/donate" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" /> Support the mission
              </a>
              <a href="/verify" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verify a certificate
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
