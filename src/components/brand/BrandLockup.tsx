import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One consistent brand lockup (logo image or crest fallback + academy name +
 * tagline) used everywhere the site shows the Africa of Hope brand: the
 * public header, mobile drawer and footer, the auth sign-in/register
 * showcase, and the portal header/drawer.
 *
 * Logo treatment: the uploaded logo is rendered raw and transparent — no
 * surrounding plate, box, ring, drop shadow or background shape anywhere in
 * the system — and stepped up ~40% in size for visibility. The outer flex row, gap and
 * text block are untouched so nearby nav links, buttons, cards and text do
 * not shift. For a truly clean cut, upload a PNG with a transparent
 * background in Website Settings → Branding; any flat background baked into
 * the file itself can only be removed in an image editor, not in CSS.
 */

type Size = "sm" | "md" | "lg";
type Tone = "light" | "dark";

const IMG: Record<Size, string> = {
  sm: "h-14 w-auto max-w-[190px]",
  md: "h-16 w-auto max-w-[230px] sm:h-[4.5rem]",
  lg: "h-20 w-auto max-w-[260px] sm:h-24",
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
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt={`${academyName} logo`}
          loading="lazy"
          decoding="async"
          className={cn(
            IMG[size],
            "shrink-0 bg-transparent object-contain [filter:none] [text-shadow:none] [box-shadow:none]",
          )}
        />
      ) : (
        <span
          className="grid shrink-0 place-items-center bg-transparent"
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
        {showTagline && tagline && !/practical\s+pathway/i.test(tagline) && (
          <p className={cn(TAGLINE_SIZE[size], "truncate", TONE_TAGLINE[tone], taglineClassName)}>{tagline}</p>
        )}
      </div>
    </div>
  );
}
