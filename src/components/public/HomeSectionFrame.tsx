import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Relevance-aware frame for every homepage block — modern nonprofit rhythm.
 * Pure presentation wrapper — it never reads or rewrites copy, CTAs or CMS
 * data. It gives the landing page a calm, airy cadence: generous anchors,
 * alternating soft surfaces for light sections, and a contained elevated
 * treatment for conversion-critical blocks (programmes, admissions, cta).
 */
const ELEVATED_KEYS = new Set(["programmes", "admissions", "cta"]);
const DARK_KEYS = new Set(["impact"]);
const TINT_KEYS = new Set(["features", "faq", "newsletter", "support", "team", "blog"]);

export default function HomeSectionFrame({
  sectionKey,
  children,
}: {
  sectionKey: string;
  children: ReactNode;
}) {
  const elevated = ELEVATED_KEYS.has(sectionKey);
  const dark = DARK_KEYS.has(sectionKey);
  const tinted = TINT_KEYS.has(sectionKey);
  return (
    <div
      data-home-block={sectionKey}
      className={cn(
        "home-block relative min-w-0 scroll-mt-20 overflow-x-clip md:scroll-mt-24",
        tinted && !dark && "bg-[#f7f5ee]",
        elevated && "home-block--elevated",
        dark && "home-block--dark",
      )}
    >
      {/* Soft top glow for elevated conversion blocks — no hard dividers */}
      {elevated && !dark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-24 max-w-6xl bg-gradient-to-b from-amber-100/60 via-transparent to-transparent"
        />
      )}
      {children}
    </div>
  );
}
