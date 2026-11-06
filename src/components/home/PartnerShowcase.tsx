import { useMemo, useState } from 'react';
import { Briefcase, Pause, Play } from 'lucide-react';
import Marquee from '@/components/animata/container/marquee';
import type { PartnerItem, WebsiteSettings } from '@/types';

/**
 * Live partnership shelf — logo-first, no duplication.
 * CMS partners win when they include a logo; otherwise the five supplied
 * partner marks keep real logos on screen instead of text-only cards.
 * A single scrolling row shows each logo once per cycle.
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

function LogoCard({ partner }: { partner: PartnerItem }) {
  const [failed, setFailed] = useState(false);
  const initial = partner.name.trim().charAt(0).toUpperCase() || '•';
  return (
    <div
      className="w-56 shrink-0 sm:w-64"
      title={partner.description ? `${partner.name} — ${partner.description}` : partner.name}
    >
      <div className="flex h-32 items-center justify-center rounded-2xl border border-white/20 bg-white p-4 shadow-sm sm:h-36">
        {!failed && partner.logo ? (
          <img
            src={partner.logo}
            alt={`${partner.name} logo`}
            loading="lazy"
            decoding="async"
            className="aoh-logo h-full max-h-24 w-full sm:max-h-28"
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-16 w-16 place-items-center rounded-full bg-emerald-950 text-2xl font-bold text-amber-300"
          >
            {initial}
          </span>
        )}
        <span className="sr-only">{partner.name}</span>
      </div>
    </div>
  );
}

/** CMS logos win; text-only CMS entries never replace real logos. Single row, no duplicates. */
export default function PartnerShowcase({ w }: { w: WebsiteSettings }) {
  const partners = useMemo(() => {
    const saved = w.partners.filter(p => p.name.trim());
    const withLogos = saved.filter(p => (p.logo ?? '').trim());
    const seen = new Set<string>();
    const deduped = (withLogos.length ? withLogos : saved.length ? saved : SUPPLIED_PARTNERS).filter(p => {
      const key = p.id || p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!deduped.length) {
      return SUPPLIED_PARTNERS;
    }
    // If CMS supplied names but no logos, keep real supplied logos on screen.
    if (withLogos.length === 0 && saved.length > 0) {
      return SUPPLIED_PARTNERS;
    }
    return deduped;
  }, [w.partners]);

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
            Our partners — scrolling continuously. Hover to pause.
          </p>
          <a
            href="/support-partner"
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-400/60 px-4 text-sm font-semibold text-amber-200 transition hover:-translate-y-0.5 hover:bg-amber-400 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
          >
            Start a partnership <span aria-hidden="true">→</span>
          </a>
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

      <div className={paused ? 'aoh-marquee-paused mt-6' : 'mt-6'}>
        <Marquee
          repeat={2}
          pauseOnHover
          applyMask
          className="overflow-hidden rounded-2xl"
          style={{ ['--duration' as string]: '45s', ['--gap' as string]: '16px' } as React.CSSProperties}
        >
          {partners.map(p => <LogoCard key={p.id} partner={p} />)}
        </Marquee>
      </div>
    </section>
  );
}
