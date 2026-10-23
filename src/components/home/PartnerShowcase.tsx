import { useMemo, useState } from 'react';
import { Briefcase, Pause, Play } from 'lucide-react';
import Marquee from '@/components/animata/container/marquee';
import type { PartnerItem, WebsiteSettings } from '@/types';

/**
 * Live partnership shelf.
 * CMS partners win when saved; otherwise the five supplied partner marks
 * keep the section live so the page never renders empty.
 */
const SUPPLIED_PARTNERS: PartnerItem[] = [
  {
    id: 'partner-eagles-nest',
    name: "Eagles' Nest Academy — Day-Care, Elem. & Jr. High School, Boys' Town Community",
    logo: 'https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png',
    description: 'Motto: Every child is a potential leader. Est. 2013. Community schooling partner.',
  },
  {
    id: 'partner-dmg',
    name: 'DMG — Deesire Moore Grace Foundation',
    logo: 'https://files.monstarx.app/54c3deukza/public/uploads/chat/cd6mq1yuax/file_0000000009d471fdb2483f23fe455e95.png',
    description: 'Transforming & empowering lives through hope, change & inspiration.',
  },
  {
    id: 'partner-games-james',
    name: 'Games James',
    logo: 'https://files.monstarx.app/54c3deukza/public/uploads/chat/mo35wdme29/file_000000009acc81f4a3b11508f1c06aa7.png',
    description: 'Sport, energy and youth community engagement partner.',
  },
  {
    id: 'partner-love-lamp',
    name: 'Love and Lamp Children Mission — Matthew 25:35',
    logo: 'https://files.monstarx.app/54c3deukza/public/uploads/chat/jdo1hlptc9/file_0000000009d471fdb2483f23fe455e95.png',
    description: 'Children-focused mission partner serving with heart, faith and light.',
  },
  {
    id: 'partner-global-hope',
    name: 'Global Hope Foundation — Charity Organization',
    logo: 'https://files.monstarx.app/54c3deukza/public/uploads/chat/8gnc2n2zi0/file_0000000009d471fdb2483f23fe455e95.png',
    description: 'Global charity partner caring for communities with hope in hand.',
  },
];

function FlipCard({ partner }: { partner: PartnerItem }) {
  return (
    <div
      className="aoh-partner-flip group w-60 shrink-0 sm:w-72"
      tabIndex={0}
      role="group"
      aria-label={`${partner.name}${partner.description ? `. ${partner.description}` : ''}`}
    >
      <div className="aoh-partner-flip-inner relative h-44 sm:h-48">
        <div className="aoh-partner-face absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white p-4 text-center shadow-sm">
          <img
            src={partner.logo}
            alt={`${partner.name} logo`}
            loading="lazy"
            className="aoh-logo h-20 w-full sm:h-24"
            onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
          />
          <p className="line-clamp-2 text-xs font-bold leading-5 text-emerald-950">{partner.name}</p>
        </div>
        <div className="aoh-partner-face aoh-partner-back absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-950 p-4 text-center text-white">
          <Briefcase className="h-6 w-6 text-amber-300" aria-hidden="true" />
          <p className="line-clamp-2 text-xs font-bold leading-5 text-amber-200">{partner.name}</p>
          {partner.description && (
            <p className="line-clamp-4 text-[11px] leading-5 text-emerald-100/90">{partner.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Only published CMS partners are presented; supplied marks fill an empty CMS list. */
export default function PartnerShowcase({ w }: { w: WebsiteSettings }) {
  const saved = useMemo(() => w.partners.filter(p => p.name.trim()), [w.partners]);
  const partners = saved.length ? saved : SUPPLIED_PARTNERS;
  const [paused, setPaused] = useState(false);
  const config = w.partnerShowcase;

  return (
    <section
      aria-label={config?.title || 'Industry and partnerships'}
      aria-roledescription="marquee"
      className="mt-10 overflow-hidden border-t border-white/15 pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-200">
            <Briefcase className="h-5 w-5 shrink-0" aria-hidden="true" />
            {config?.title || 'Industry and partnerships'}
          </h3>
          {config?.description && (
            <p className="mt-2 text-sm leading-6 text-emerald-100/85">{config.description}</p>
          )}
          <p className="mt-2 text-xs leading-5 text-emerald-100/60">
            Live shelf — scrolling continuously. Hover to pause, hover or focus a card to flip it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? 'Resume partner scrolling' : 'Pause partner scrolling'}
          aria-pressed={paused}
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-amber-400/60 text-amber-200 transition hover:bg-amber-400 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      </div>

      <div className={paused ? 'aoh-marquee-paused mt-6 space-y-4' : 'mt-6 space-y-4'}>
        <Marquee
          repeat={3}
          pauseOnHover
          applyMask
          className="overflow-hidden rounded-2xl"
          style={{ ['--duration' as string]: '45s', ['--gap' as string]: '16px' } as React.CSSProperties}
        >
          {partners.map(p => <FlipCard key={`row-a-${p.id}`} partner={p} />)}
        </Marquee>
        <Marquee
          repeat={3}
          reverse
          pauseOnHover
          applyMask
          className="overflow-hidden rounded-2xl"
          style={{ ['--duration' as string]: '55s', ['--gap' as string]: '16px' } as React.CSSProperties}
        >
          {[...partners].reverse().map(p => <FlipCard key={`row-b-${p.id}`} partner={p} />)}
        </Marquee>
      </div>
    </section>
  );
}
