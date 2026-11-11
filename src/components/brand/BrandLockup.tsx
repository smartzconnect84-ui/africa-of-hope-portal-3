import { useEffect, useState } from "react";
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
 * the system. The outer flex row, gap and
 * text block are untouched so nearby nav links, buttons, cards and text do
 * not shift. For a truly clean cut, upload a PNG with a transparent
 * background in Website Settings → Branding; any flat background baked into
 * the file itself can only be removed in an image editor, not in CSS.
 */

type Size = "sm" | "md" | "lg";
type Tone = "light" | "dark";

const IMG: Record<Size, string> = {
  sm: "h-9 w-auto max-w-[160px] object-contain",
  md: "h-10 w-auto max-w-[210px] object-contain md:h-12 md:max-w-[250px]",
  lg: "h-12 w-auto max-w-[220px] object-contain sm:h-14",
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
  /** Hide the name line entirely (logo-only lockup, e.g. footer where the image already carries the name). */
  showName?: boolean;
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
  showName = true,
  className,
  nameClassName,
  taglineClassName,
  displayName,
}: BrandLockupProps) {
  const visibleName = displayName || academyName;
  const showTaglineLine = showTagline && Boolean(tagline);
  // Built-in frontend copy: when a Supabase-hosted logo cannot be reached
  // (storage disconnected / offline), fall back to the bundled production
  // logo so the header, footer, portal and sign-in never lose their mark.
  const FALLBACK_LOGO = "/logo/aoh-logo.png";
  const initialSrc = logoUrl && logoUrl.trim() ? logoUrl : FALLBACK_LOGO;
  const [src, setSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);
  // Keep in sync when CMS value changes (draft preview / publish).
  useEffect(() => {
    setSrc(initialSrc);
    setFailed(false);
  }, [initialSrc]);
  const activeSrc = failed ? FALLBACK_LOGO : src;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={activeSrc}
          onError={() => {
            if (!failed) {
              setFailed(true);
              setSrc(FALLBACK_LOGO);
            }
          }}
          alt={`${academyName} logo`}
          loading="lazy"
          decoding="async"
          className={cn(
            IMG[size],
            "block max-h-full shrink-0 bg-transparent object-contain [filter:none] [text-shadow:none] [box-shadow:none]",
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
      {(showName || showTaglineLine) && (
        <div className="min-w-0 leading-tight">
          {showName && (
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
          )}
          {showTaglineLine && (
            <p className={cn(TAGLINE_SIZE[size], "truncate", TONE_TAGLINE[tone], taglineClassName)}>{tagline}</p>
          )}
        </div>
      )}
    </div>
  );
}
