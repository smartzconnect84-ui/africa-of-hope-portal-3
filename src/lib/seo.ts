export const CANONICAL_ORIGIN =
  "https://africaofhopelr.org";

export const SITE_NAME =
  "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES";

export const SITE_DESCRIPTION =
  "AFRICA OF HOPE in Liberia offers practical certificate programmes with online admissions and verifiable certificates.";

export const SITE_KEYWORDS =
  "AFRICA OF HOPE, professional studies Liberia, certificate programmes Liberia, online admissions Liberia, verify certificate Liberia, vocational training Margibi, computer training Liberia";

export const OG_IMAGE =
  "https://africaofhopelr.org/og-card.png";

export const OG_IMAGE_ALT =
  "AFRICA OF HOPE School of Professional Studies — practical certificate programmes with verifiable certificates in Liberia";

/** Six factual FAQs — mirrors the FAQPage JSON-LD in index.html. */
export const SEO_FAQS = [
  {
    q: "What courses can I study?",
    a: "Two-week, one-month, three-month or six-month certificate tracks, including computer studies, tailoring, catering, electrical work, plumbing, business and more. Fully online study is 1 hour a day, 3 days a week; fully on-site study is 2 hours daily, 2 days a week.",
  },
  {
    q: "How much does it cost?",
    a: "Tuition is sponsored, so you only pay a one-time registration package: US$5 for two-week courses, US$10 for one-month courses, US$30 for three-month courses and US$45 for six-month courses. You can reserve a seat with half of the package.",
  },
  {
    q: "How do admissions work?",
    a: "Admissions for 2026/2027 are open. Strictly online students can enrol anytime once they meet the requirements — pick your 3 training days, attend within them, finish within the course duration and receive your certificate on completion. Apply online in minutes from the Admissions page.",
  },
  {
    q: "Who is AFRICA OF HOPE for, and what does it not do?",
    a: "It is for high-school leavers and working adults in Liberia who want practical, job-ready skills with a verifiable certificate. It does not offer degree programmes, and it never issues a certificate without completed coursework — any credential can be checked on the Verify page.",
  },
  {
    q: "How can an employer verify my certificate?",
    a: "Every certificate carries a unique serial number. Enter it on the Verify page and it is checked live against the institutional register. A valid result shows the holder's name, programme and issue date; revoked certificates are reported as revoked.",
  },
  {
    q: "What is AFRICA OF HOPE School of Professional Studies?",
    a: "AFRICA OF HOPE is a practical training school at Boystown Junction, Lower Margibi, Liberia. It offers short certificate programmes in trades, technology, business and hospitality, with mentors who guide learners from enrolment to graduation.",
  },
];

/**
 * Phrases someone would type to find a school like this.
 * Used in llms.txt and kept next to the meta keywords so copy stays aligned.
 */
export const SEO_SEARCH_PHRASES = [
  "certificate programmes in Liberia",
  "professional studies school Liberia",
  "computer training in Liberia",
  "vocational training Margibi",
  "tailoring school Liberia",
  "catering training Liberia",
  "verify certificate Liberia",
  "online admissions Liberia",
  "short courses for high-school leavers Liberia",
  "job-ready skills training Liberia",
];

/**
 * Profiles that are the same organisation. Only established public
 * contact points are listed here — the owner can append official
 * LinkedIn / X / Facebook URLs when they exist.
 */
export const SAME_AS_PROFILES = [
  "https://africaofhopelr.org/",
  "https://wa.me/231776679963",
];

export function applySearchConsoleVerification() {
  const verification = (import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined)?.trim();
  if (!verification) return;
  let tag = document.head.querySelector<HTMLMetaElement>('meta[name="google-site-verification"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "google-site-verification";
    document.head.appendChild(tag);
  }
  tag.content = verification;
}
