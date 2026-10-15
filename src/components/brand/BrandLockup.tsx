import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One consistent brand lockup (logo image or crest fallback + academy name +
 * tagline) used everywhere the site shows the Africa of Hope brand: the
 * public header, mobile drawer and footer, the auth sign-in/register
 * showcase, and the portal header/drawer. Fixed aspect ratio, `object-contain`
 * (never stretched), always has alt text, and truncates on small screens.
 */

type Size = "sm" | "md" | "lg";
type Tone = "light" | "dark";

const BOX: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const ICON: Record<Size, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
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
        <img
          src={logoUrl}
          alt={`${academyName} logo`}
          className={cn(BOX[size], "shrink-0 bg-transparent object-contain")}
          style={{ mixBlendMode: tone === "dark" ? "screen" : "multiply" }}
        />
      ) : (
        <span
          className={cn(BOX[size], "grid shrink-0 place-items-center")}
          role="img"
          aria-label={`${academyName} logo`}
        >
          <GraduationCap className={cn(ICON[size], tone === "dark" ? "text-amber-400" : "text-emerald-800")} aria-hidden="true" />
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
