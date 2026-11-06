/**
 * Central SEO / answer-engine facts for AFRICA OF HOPE.
 * Single source of truth for canonical URLs, descriptions, FAQs,
 * target search phrases and certificate-verification explainer copy.
 * Used by index.html, public/llms.txt, sitemap.xml and the runtime
 * per-page head updater (src/lib/publicSeo.ts).
 */

export const CANONICAL_ORIGIN = "https://africaofhope.monstarx.app";

export const SITE_NAME = "AFRICA OF HOPE School of Professional Studies";

export const SITE_DESCRIPTION =
  "AFRICA OF HOPE in Liberia offers practical certificate programmes with online admissions and verifiable certificates.";

export const SITE_KEYWORDS =
  "AFRICA OF HOPE, professional studies Liberia, certificate programmes Liberia, online admissions Liberia, verify certificate Liberia, vocational training Margibi, computer training Liberia";

export const OG_IMAGE =
  "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";

export const OG_IMAGE_ALT =
  "AFRICA OF HOPE School of Professional Studies — practical certificate programmes with verifiable certificates in Liberia";

export const CONTACT = {
  phone: "+231776679963",
  email: "afrohope033@gmail.com",
  address: "Boystown Junction, Lower Margibi, Republic of Liberia",
} as const;

/** Real crawlable paths for every public section (hash links redirect here). */
export const PUBLIC_PATHS = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/programmes", label: "Programmes" },
  { path: "/admissions", label: "Admissions" },
  { path: "/term-dates", label: "Term dates" },
  { path: "/verify", label: "Verify a certificate" },
  { path: "/donate", label: "Donate" },
  { path: "/transparency", label: "Transparency reports" },
  { path: "/team", label: "Our team" },
  { path: "/blog", label: "Blog" },
  { path: "/policies", label: "School policies" },
  { path: "/campus-life", label: "Campus life" },
] as const;

export interface SeoFaq {
  q: string;
  a: string;
}

/** Six plain-sentence questions and answers, also published as FAQ JSON-LD + llms.txt. */
export const SEO_FAQS: SeoFaq[] = [
  {
    q: "What is AFRICA OF HOPE School of Professional Studies?",
    a: "AFRICA OF HOPE is a practical training school at Boystown Junction, Lower Margibi, Liberia. It offers short certificate programmes in trades, technology, business and hospitality, with mentors who guide learners from enrolment to graduation.",
  },
  {
    q: "What courses can I study?",
    a: "You can choose two-week, one-month, three-month or six-month certificate tracks, including computer studies, tailoring, catering, electrical work, plumbing, business and more. Fully online study is 1 hour a day, 3 days a week; fully on-site study is 2 hours daily, 2 days a week.",
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
    q: "How can an employer verify my certificate?",
    a: "Every certificate carries a unique serial number. Enter it on the Verify page and it is checked live against the institutional register. A valid result shows the holder's name, programme and issue date; revoked certificates are reported as revoked.",
  },
  {
    q: "Who is AFRICA OF HOPE for, and what does it not do?",
    a: "It is for high-school leavers and working adults in Liberia who want practical, job-ready skills with a verifiable certificate. It does not offer degree programmes, and it never issues a certificate without completed coursework — any credential can be checked on the Verify page.",
  },
];

/** Phrases people type when looking for a school like this one. */
export const TARGET_SEARCH_PHRASES = [
  "certificate courses in Liberia",
  "professional studies school Liberia",
  "computer training in Liberia",
  "vocational school Margibi",
  "online certificate courses Liberia",
  "tailoring school Liberia",
  "catering training Liberia",
  "verify certificate Liberia",
  "admissions open Liberia 2026",
  "short courses for high school leavers Liberia",
];

/** How certificate verification works — rendered on /verify and in llms.txt. */
export const VERIFY_STEPS = [
  "Find the unique serial number printed on the certificate (or scan its QR code).",
  "Enter the serial number in the verification box on the Verify page.",
  "A valid result shows the holder's name, programme, completion date and status; revoked or unknown serials are reported as not valid.",
] as const;

export const SEO_SUMMARY =
  "AFRICA OF HOPE School of Professional Studies at Boystown Junction, Lower Margibi, Liberia offers practical two-week to six-month certificate programmes in trades, technology, business and hospitality for high-school leavers and working adults. Tuition is sponsored — learners pay only a registration package of US$5 to US$45. Strictly online students can enrol anytime; on-site cohorts follow the published term calendar. Every certificate carries a unique serial number that employers can check live on the Verify page. The school does not offer degree programmes and never issues certificates without completed coursework.";

/**
 * Inserts the Google Search Console ownership token when configured.
 * Set VITE_GOOGLE_SITE_VERIFICATION in the environment (or paste the
 * token into the commented meta tag in index.html) to activate.
 */
export function applySearchConsoleVerification(): void {
  try {
    const token = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GOOGLE_SITE_VERIFICATION;
    if (!token || document.querySelector('meta[name="google-site-verification"]')) return;
    const meta = document.createElement("meta");
    meta.name = "google-site-verification";
    meta.content = token;
    document.head.appendChild(meta);
  } catch { /* verification is optional */ }
}
