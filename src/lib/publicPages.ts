import type { WebsiteSettings } from "@/types";

export interface PublicPageSetting {
  enabled: boolean;
  title: string;
  eyebrow: string;
  subtitle: string;
  body: string;
  image: string;
}

export interface PublicPageDef {
  key: string;
  label: string;
  href: string;
  hint: string;
  imageFolder: string;
  canDisable: boolean;
  defaults: PublicPageSetting;
}

export const PUBLIC_PAGE_DEFS: PublicPageDef[] = [
  {
    key: "home",
    label: "Home",
    href: "#home",
    hint: "Main landing page hero and entry point. Hiding is disabled to keep the site reachable.",
    imageFolder: "pages/home",
    canDisable: false,
    defaults: {
      enabled: true,
      title: "Africa of Hope",
      eyebrow: "Welcome",
      subtitle: "Skills for the future of work.",
      body: "Explore programmes, apply online, verify certificates and get involved.",
      image: "",
    },
  },
  {
    key: "about",
    label: "About",
    href: "#about",
    hint: "Organisation profile, mission and story.",
    imageFolder: "pages/about",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "About Africa of Hope",
      eyebrow: "Who we are",
      subtitle: "Skills, programmes and proof that move people forward.",
      body: "Africa of Hope connects learners to relevant programmes, supportive mentors and clear proceedings from application to certification.",
      image: "",
    },
  },
  {
    key: "programmes",
    label: "Programmes",
    href: "#programmes",
    hint: "Course catalogue, tracks, duration and delivery modes.",
    imageFolder: "pages/programmes",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Choose your course, duration and how you study.",
      eyebrow: "Admission 2026/2027 is open",
      subtitle: "Two-week, one-month, three-month and six-month tracks.",
      body: "Fully online is 1 hour a day, 3 days a week; fully on-site is 2 hours daily, 2 days a week. Tuition-free: you only pay the registration package. Strictly online students can enrol anytime.",
      image: "",
    },
  },
  {
    key: "admissions",
    label: "Admissions",
    href: "#admissions",
    hint: "How admission works, anytime online enrolment and training-days rule.",
    imageFolder: "pages/admissions",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Admissions: start online anytime.",
      eyebrow: "Admissions 2026/2027 is open",
      subtitle: "Enrol anytime once you meet the requirements.",
      body: "Strictly online students can enrol anytime — no waiting for the general school opening. Pick your 3 training days, attend within them, complete within the duration and receive your certificate on completion.",
      image: "",
    },
  },
  {
    key: "term-dates",
    label: "Term dates",
    href: "#term-dates",
    hint: "Academic calendar, intakes and countdown.",
    imageFolder: "pages/term-dates",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Term dates & intake countdown.",
      eyebrow: "Academic calendar",
      subtitle: "Online and onsite training calendar.",
      body: "Our school offers both online and onsite training. Online training enrolment is open to every student at any time once the admission requirements are met. Onsite cohorts meet at Boystown Junction, Lower Margibi; the next onsite intake dates are published on the Term dates page.",
      image: "",
    },
  },
  {
    key: "team",
    label: "Team",
    href: "#team",
    hint: "Public staff and founder profiles.",
    imageFolder: "pages/team",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Meet the team",
      eyebrow: "Our people",
      subtitle: "Mentors and staff behind every cohort.",
      body: "Working professionals who guide learners from first class to completion.",
      image: "",
    },
  },
  {
    key: "blog",
    label: "Blog",
    href: "#blog",
    hint: "News, stories and announcements.",
    imageFolder: "pages/blog",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "News and stories",
      eyebrow: "Blog",
      subtitle: "Updates from across the academy.",
      body: "Cohort celebrations, programme news and learner stories.",
      image: "",
    },
  },
  {
    key: "policies",
    label: "Policies",
    href: "#policies",
    hint: "Governance, admissions, fees, conduct and safeguarding rules.",
    imageFolder: "pages/policies",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "School policies",
      eyebrow: "Governance",
      subtitle: "Fair, safe and transparent learning.",
      body: "The rules that keep learning fair, safe and transparent — admissions, attendance, fees and refunds, conduct, safeguarding, examinations, privacy and campus life.",
      image: "",
    },
  },
  {
    key: "transparency",
    label: "Transparency",
    href: "#transparency",
    hint: "Registration papers, audited accounts and annual reports.",
    imageFolder: "pages/transparency",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Transparency reports",
      eyebrow: "Accountability",
      subtitle: "Registration papers, audited accounts and annual reports.",
      body: "Published documents that show how funds are used and how the academy is governed.",
      image: "",
    },
  },
  {
    key: "donate",
    label: "Donate",
    href: "#donate",
    hint: "Tuition-free mission support and pledge form.",
    imageFolder: "pages/donate",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Fuel a tuition-free education.",
      eyebrow: "Support the mission",
      subtitle: "Every franc stays in the classroom.",
      body: "Your gift covers data bundles, mentors, certificates and exam fees for learners across Africa.",
      image: "",
    },
  },
  {
    key: "support",
    label: "Get involved",
    href: "#support",
    hint: "Donate, volunteer, partner and staff enquiry section on Home.",
    imageFolder: "pages/support",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Get involved",
      eyebrow: "Support",
      subtitle: "Donate, volunteer, partner or join our staff.",
      body: "Choose how you would like to help and send an enquiry in minutes.",
      image: "",
    },
  },
  {
    key: "verify",
    label: "Verify",
    href: "#verify",
    hint: "Public certificate verification lookup.",
    imageFolder: "pages/verify",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Verify a certificate",
      eyebrow: "Verification",
      subtitle: "Checked live against the institutional register.",
      body: "Every certificate carries a unique serial number. The serial is checked live against the institutional register — revoked certificates are reported as revoked.",
      image: "",
    },
  },
  {
    key: "cookies",
    label: "Cookies",
    href: "#cookies",
    hint: "Cookie policy and consent details.",
    imageFolder: "pages/cookies",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Cookies policy",
      eyebrow: "Privacy",
      subtitle: "How we use cookies on this site.",
      body: "We use only the cookies needed to run the site and remember your preferences.",
      image: "",
    },
  },
  {
    key: "contact",
    label: "Contact",
    href: "#contact",
    hint: "Contact strip shown on Home (address, phone, email, office hours).",
    imageFolder: "pages/contact",
    canDisable: true,
    defaults: {
      enabled: true,
      title: "Contact us",
      eyebrow: "Contact",
      subtitle: "We reply to every enquiry.",
      body: "Reach the academy by address, phone, email or office hours listed in the footer.",
      image: "",
    },
  },
];

export const DEFAULT_PUBLIC_PAGES: Record<string, PublicPageSetting> = Object.fromEntries(
  PUBLIC_PAGE_DEFS.map((d) => [d.key, { ...d.defaults }]),
);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

/** Merged CMS values for one public page, with legacy pageImages as image fallback. */
export function getPublicPage(settings: Pick<WebsiteSettings, "pages" | "pageImages">, key: string): PublicPageSetting {
  const def = PUBLIC_PAGE_DEFS.find((d) => d.key === key);
  const fallback: PublicPageSetting = def
    ? { ...def.defaults }
    : { enabled: true, title: "", eyebrow: "", subtitle: "", body: "", image: "" };
  const saved = settings.pages?.[key];
  const legacyImage = settings.pageImages?.[key] ?? "";
  if (!isRecord(saved)) {
    return { ...fallback, image: fallback.image || legacyImage };
  }
  const rec = saved as unknown as Record<string, unknown>;
  return {
    enabled: typeof rec.enabled === "boolean" ? rec.enabled : fallback.enabled,
    title: text(rec.title, fallback.title),
    eyebrow: text(rec.eyebrow, fallback.eyebrow),
    subtitle: text(rec.subtitle, fallback.subtitle),
    body: text(rec.body, fallback.body),
    image: text(rec.image, fallback.image || legacyImage),
  };
}

/** A page with no CMS record (or enabled !== false) is visible. Home cannot be disabled. */
export function isPublicPageEnabled(settings: Pick<WebsiteSettings, "pages">, key: string): boolean {
  if (key === "home") return true;
  const saved = settings.pages?.[key] as unknown as Record<string, unknown> | undefined;
  if (!isRecord(saved)) return true;
  return saved.enabled !== false;
}

/** Normalise saved pages: keep stored edits, fill missing pages/fields from defaults. */
export function normalizePublicPages(
  raw: unknown,
  legacyImages?: Record<string, string>,
): Record<string, PublicPageSetting> {
  const out: Record<string, PublicPageSetting> = {};
  const saved = isRecord(raw) ? (raw as Record<string, unknown>) : {};
  for (const def of PUBLIC_PAGE_DEFS) {
    const entry = saved[def.key];
    const rec = isRecord(entry) ? (entry as Record<string, unknown>) : {};
    const legacy = legacyImages?.[def.key] ?? "";
    out[def.key] = {
      enabled: def.canDisable ? (typeof rec.enabled === "boolean" ? rec.enabled : true) : true,
      title: text(rec.title, def.defaults.title),
      eyebrow: text(rec.eyebrow, def.defaults.eyebrow),
      subtitle: text(rec.subtitle, def.defaults.subtitle),
      body: text(rec.body, def.defaults.body),
      image: text(rec.image, legacy || def.defaults.image),
    };
  }
  return out;
}
