import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Briefcase, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { WebsiteSettings } from '@/types';

/** Only published CMS partners are presented; no generated organization names. */
export default function PartnerShowcase({ w }: { w: WebsiteSettings }) {
  const partners = useMemo(() => w.partners.filter(p => p.name.trim()), [w.partners]);
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const config = w.partnerShowcase;
  const rotating = partners.length > 1 && config?.autoRotate !== false && !reduced && !paused && !hovered && !focused && visible;
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % partners.length), 6000);
    return () => window.clearInterval(timer);
  }, [rotating, partners.length]);
  if (!partners.length) return null;
  const current = index % partners.length;
  const partner = partners[current];
  const move = (step: number) => setIndex((current + step + partners.length) % partners.length);
  const controlClass = 'grid min-h-11 min-w-11 place-items-center rounded-full border border-amber-400/60 text-amber-200 transition hover:bg-amber-400 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300';
  return <section aria-label={config?.title || 'Industry and partnerships'} aria-roledescription="carousel" className="mt-10 border-t border-white/15 pt-8" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-2xl"><h3 className="flex items-center gap-2 text-lg font-semibold text-amber-200"><Briefcase className="h-5 w-5 shrink-0" aria-hidden="true" />{config?.title || 'Industry and partnerships'}</h3>{config?.description && <p className="mt-2 text-sm leading-6 text-emerald-100/85">{config.description}</p>}</div>
      {partners.length > 1 && <div className="flex items-center gap-2">
        <button type="button" onClick={() => move(-1)} aria-label="Previous partner" className={controlClass}><ChevronLeft className="h-5 w-5" /></button>
        {config?.autoRotate !== false && !reduced && <button type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? 'Resume partner rotation' : 'Pause partner rotation'} aria-pressed={paused} className={controlClass}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>}
        <button type="button" onClick={() => move(1)} aria-label="Next partner" className={controlClass}><ChevronRight className="h-5 w-5" /></button>
      </div>}
    </div>
    <div className="mt-5" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.article key={partner.id} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }} role="group" aria-roledescription="slide" aria-label={`${current + 1} of ${partners.length}`} className="aoh-card grid min-h-48 items-center gap-6 rounded-2xl bg-white p-6 text-emerald-950 sm:grid-cols-[12rem_1fr] sm:p-8">
          <div className="flex h-28 items-center justify-center rounded-xl bg-emerald-50 p-4">{partner.logo ? <img key={partner.logo} src={partner.logo} alt={`${partner.name} logo`} loading="lazy" className="max-h-full max-w-full object-contain" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <Briefcase className="h-12 w-12 text-emerald-700" aria-hidden="true" />}</div>
          <div className="min-w-0"><h4 className="break-words text-xl font-bold">{partner.name}</h4>{partner.description && <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600">{partner.description}</p>}<p className="mt-4 text-xs font-semibold text-emerald-700">{current + 1} / {partners.length}</p></div>
        </motion.article>
      </AnimatePresence>
    </div>
  </section>;
}
