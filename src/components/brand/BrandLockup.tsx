import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One consistent brand lockup (logo image or crest fallback + academy name +
 * tagline) used everywhere the site shows the Africa of Hope brand: the
 * public header, mobile drawer and footer, the auth sign-in/register
 * showcase, and the portal header/drawer.
 *
 * Logo visibility treatment: uploaded logos usually arrive on a solid white
 * (or dark) rectangle. True pixel-level background removal can't happen in
 * CSS, so the logo is seated on a small white plate (rounded, ringed,
 * shadowed) that visually "cuts" the rectangle away — the plate merges with
 * the logo's own background while lifting it off emerald/dark surfaces.
 * Sizes were stepped up ~30-40% for visibility; the outer flex row, gap and
 * text block are untouched so nearby nav links, buttons, cards and text do
 * not shift.
 */

type Size = "sm" | "md" | "lg";
type Tone = "light" | "dark";

const BOX: Record<Size, string> = {
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-[4.5rem] w-[4.5rem]",
};

const ICON: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const NAME_SIZE: Record<Size, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const TAGLINE_SIZE: Record<Size, string> = {
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs",
};

const TONE_NAME: Record<Tone, string> = {
  light: "text-emerald-900",
  dark: "text-white",
};

const TONE_TAGLINE: Record<Tone, string> = {
  light: "text-slate-500",
  dark: "text-emerald-200/90",
};

export interface BrandLockupProps {
  logoUrl?: string;
  academyName: string;
  tagline?: string;
  size?: Size;
  tone?: Tone;
  /** Short portal label used where the full institution name is too long. */
  displayName?: string;
  /** Hide the tagline line entirely (name-only lockup). */
  showTagline?: boolean;
  className?: string;
  nameClassName?: string;
  /** Extra classes on the tagline line — e.g. `"hidden sm:block"` so compact headers drop it on narrow phones. */
  taglineClassName?: string;
}

export default function BrandLockup({
  logoUrl,
  academyName,
  tagline,
  size = "md",
  tone = "light",
  showTagline = true,
  className,
  nameClassName,
  taglineClassName,
  displayName,
}: BrandLockupProps) {
  const visibleName = displayName || academyName;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {logoUrl ? (
        <span
          className={cn(
            BOX[size],
            "relative grid shrink-0 isolate place-items-center overflow-hidden rounded-2xl bg-white p-1.5",
            "shadow-[0_6px_18px_-6px_rgba(2,44,34,0.5)] ring-1",
            tone === "dark" ? "ring-white/40" : "ring-emerald-900/10",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={`${academyName} logo`}
            loading="lazy"
            className="h-full w-full object-contain [filter:contrast(1.06)_saturate(1.08)_drop-shadow(0_1px_2px_rgba(2,44,34,0.25))]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/60"
          />
        </span>
      ) : (
        <span
          className={cn(
            BOX[size],
            "grid shrink-0 place-items-center rounded-2xl bg-white shadow-[0_6px_18px_-6px_rgba(2,44,34,0.5)] ring-1",
            tone === "dark" ? "ring-white/40" : "ring-emerald-900/10",
          )}
          role="img"
          aria-label={`${academyName} logo`}
        >
          <GraduationCap className={cn(ICON[size], "text-emerald-800")} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            NAME_SIZE[size],
            "truncate font-bold uppercase tracking-[0.18em]",
            TONE_NAME[tone],
            nameClassName,
          )}
        >
          {visibleName}
        </p>
        {showTagline && tagline && (
          <p className={cn(TAGLINE_SIZE[size], "truncate", TONE_TAGLINE[tone], taglineClassName)}>{tagline}</p>
        )}
      </div>
    </div>
  );
}
