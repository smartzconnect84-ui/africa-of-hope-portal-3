/**
 * Stable per-course catalogue for crawlable programme detail pages.
 * Uses only established public facts (tracks, fees, schedules, contact)
 * so detail URLs stay accurate even before Supabase rows load.
 */

export interface CourseEntry {
  slug: string;
  title: string;
  track: string;
  blurb: string;
  modes: string[];
  schedule: string;
}

const TITLES: Array<[string, string, string]> = [
  ["computer-studies", "Computer Studies", "Technology"],
  ["tailoring-fashion", "Tailoring and Fashion", "Trades"],
  ["catering-hospitality", "Catering and Hospitality", "Hospitality"],
  ["electrical-installation", "Electrical Installation", "Trades"],
  ["plumbing", "Plumbing", "Trades"],
  ["business-entrepreneurship", "Business and Entrepreneurship", "Business"],
];

const BLURBS: Record<string, string> = {
  "computer-studies":
    "Practical computer skills — typing, office tools, internet and introductory digital skills — with mentor guidance and a verifiable certificate on completion.",
  "tailoring-fashion":
    "Hands-on tailoring and fashion training — measuring, cutting, sewing and finishing garments — with studio practice and a verifiable certificate on completion.",
  "catering-hospitality":
    "Practical catering and hospitality skills — food preparation, service and event support — with hands-on practice and a verifiable certificate on completion.",
  "electrical-installation":
    "Foundational electrical installation skills — wiring basics, safety and maintenance — with supervised practicals and a verifiable certificate on completion.",
  plumbing:
    "Foundational plumbing skills — fittings, installations and repairs — with supervised practicals and a verifiable certificate on completion.",
  "business-entrepreneurship":
    "Business skills for working adults — record-keeping, costing, customer care and starting a small enterprise — with online and on-site study options and a verifiable certificate.",
};

export const COURSE_CATALOGUE: CourseEntry[] = TITLES.map(([slug, title, track]) => ({
  slug,
  title,
  track,
  blurb: BLURBS[slug] ?? "",
  modes: ["Fully online", "Partially online", "Fully on-site"],
  schedule:
    "Fully online: 1 hour a day, 3 days a week. Fully on-site: 2 hours daily, 2 days a week. Partially online: online lessons plus one 2-hour campus practical day.",
}));

export function courseEntryForSlug(slug: string): CourseEntry | null {
  const key = (slug || "").trim().toLowerCase();
  return COURSE_CATALOGUE.find((c) => c.slug === key) ?? null;
}

/** Slug for a catalogue programme title, falling back to a stable id-based slug. */
export function programSlug(title: string, id: string): string {
  const key = (title || "").toLowerCase();
  if (/computer|ict|digital|software/.test(key)) return "computer-studies";
  if (/tailor|fashion|sew/.test(key)) return "tailoring-fashion";
  if (/cater|hospital|cook|culinary|food/.test(key)) return "catering-hospitality";
  if (/electric/.test(key)) return "electrical-installation";
  if (/plumb/.test(key)) return "plumbing";
  if (/business|entrepreneur|account|management/.test(key)) return "business-entrepreneurship";
  const slug = (title || id || "course")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "course";
}

export const COURSE_SLUGS = COURSE_CATALOGUE.map((c) => c.slug);
