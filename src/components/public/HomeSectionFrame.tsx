import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Relevance-aware frame for every homepage block.
 * Pure presentation wrapper — it never reads or rewrites copy, CTAs or CMS
 * data. It only gives the landing page a consistent rhythm:
 * generous anchors, a hairline divider between light sections, and an
 * elevated treatment for conversion-critical blocks (programmes, admissions).
 */
const ELEVATED_KEYS = new Set(["programmes", "admissions", "impact", "cta"]);
const DARK_KEYS = new Set(["impact"]);

export default function HomeSectionFrame({
  sectionKey,
  children,
}: {
  sectionKey: string;
  children: ReactNode;
}) {
  const elevated = ELEVATED_KEYS.has(sectionKey);
  const dark = DARK_KEYS.has(sectionKey);
  return (
    <div
      data-home-block={sectionKey}
      className={cn(
        "home-block relative min-w-0 scroll-mt-20 overflow-x-clip md:scroll-mt-24",
        elevated && "home-block--elevated",
        dark && "home-block--dark",
      )}
    >
      {/* Hairline rhythm divider — hidden on dark / elevated blocks that carry their own surface */}
      {!dark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-emerald-900/15 to-transparent"
        />
      )}
      {children}
    </div>
  );
}
