import type { DeliveryMode, Program } from "@/types";

/**
 * Registrar's 2026/2027 admission rules (owner update):
 *  · former 9-month courses → 6 months, registration US$45
 *  · former 6-month courses → 3 months, registration US$30
 *  · former 3-month courses → 1 month, registration US$10
 *  · former 1-month courses → 2 weeks, registration US$5
 * Tuition stays sponsored; the registration package is the only fixed charge.
 * Class times depend on the chosen study mode:
 *  · fully online  → 1 hour a day, 3 days a week
 *  · fully on-site → 2 hours daily, 2 days a week
 *  · partially online → online lessons plus one 2-hour campus practical day a week
 */
const SIX_MONTH = { category: "Six-Month Courses", weeks: 26, fee: 45 } as const;
const THREE_MONTH = { category: "Three-Month Courses", weeks: 13, fee: 30 } as const;
const ONE_MONTH = { category: "One-Month Courses", weeks: 4, fee: 10 } as const;
const TWO_WEEK = { category: "Two-Week Courses", weeks: 2, fee: 5 } as const;

function make(
  id: string,
  title: string,
  track: { category: string; weeks: number; fee: number },
  certification: string,
  description: string,
  deliveryModes: DeliveryMode[],
): Program {
  return {
    id,
    title,
    category: track.category,
    durationWeeks: track.weeks,
    tuition: track.fee,
    certification,
    description,
    entryRequirements:
      "Be a high school student or above. Pay 50% of the registration package to reserve your seat and own a smartphone or laptop. " +
      "Classes follow your study plan: fully online is 1 hour a day, 3 days a week; fully on-site is 2 hours daily, 2 days a week; " +
      "partially online combines online lessons with one 2-hour campus practical day a week.",
    // Photography comes from programImages (the owner's African student photo)
    // unless an administrator uploads a programme image.
    imageUrl: undefined,
    deliveryModes,
    modules: [],
  };
}

/**
 * Official 2026/2027 admission catalogue transcribed from the registrar's
 * flyer (Admission 2026/2027 is open — Certificate & Diploma courses).
 * Used as the offline/public fallback when the Supabase `programs` table
 * is empty or unreadable, so the public site always shows real courses.
 */
export const CATALOG_2026: Program[] = [
  // ── Six-month courses · REG 45 US$ ───────────────────────────────
  make("cat-nine-media", "Media & Communication Studies", SIX_MONTH, "Diploma in Media & Communication Studies", "News writing, reporting, presentation and media ethics with studio and field practice.", ["blended", "onsite"]),
  make("cat-nine-teacher", "Teacher's Education", SIX_MONTH, "Diploma in Teacher Education", "Lesson planning, classroom management and child-centred teaching with teaching practice.", ["onsite", "blended"]),
  make("cat-nine-audio", "Audio Ads Production", SIX_MONTH, "Diploma in Audio Ads Production", "Voice-over, scripting, jingles and radio commercials produced in a real studio workflow.", ["blended", "onsite"]),
  make("cat-nine-secre", "Secretarial Science", SIX_MONTH, "Diploma in Secretarial Science", "Office administration, shorthand speed, records, front-desk etiquette and computer applications.", ["onsite", "blended"]),
  make("cat-nine-admin", "School Administration", SIX_MONTH, "Diploma in School Administration", "School records, admissions, staff supervision, discipline systems and parent relations.", ["online", "blended"]),
  make("cat-nine-tv", "Online-TV Production", SIX_MONTH, "Diploma in Online-TV Production", "Live streaming, camera operation, lighting, switching and publishing for online channels.", ["online", "blended"]),
  make("cat-nine-multi", "Professional Multimedia", SIX_MONTH, "Diploma in Professional Multimedia", "Flagship blend of graphics, video, audio and motion for work-ready multimedia producers.", ["blended", "onsite"]),

  // ── Three-month courses · REG 30 US$ ─────────────────────────────
  make("cat-six-graphics", "Professional Graphics", THREE_MONTH, "Certificate in Professional Graphics", "Logos, flyers, branding and print design with portfolio reviews every month.", ["online", "blended"]),
  make("cat-six-hr", "HR Management", THREE_MONTH, "Certificate in HR Management", "Recruitment, staff records, payroll basics, appraisals and workplace relations.", ["online", "blended"]),
  make("cat-six-podcast", "General Podcasting", THREE_MONTH, "Certificate in General Podcasting", "Show formats, recording, editing and publishing podcasts that keep listeners.", ["online"]),
  make("cat-six-me", "Monitoring & Evaluation", THREE_MONTH, "Certificate in Monitoring & Evaluation", "Indicators, data collection, field tools and donor-ready M&E reports.", ["online", "blended"]),
  make("cat-six-guidance", "Guidance & Counseling", THREE_MONTH, "Certificate in Guidance & Counseling", "Counselling skills, safeguarding, youth mentorship and referral practice.", ["online", "onsite"]),
  make("cat-six-pm", "Project Management", THREE_MONTH, "Certificate in Project Management", "Proposals, work plans, budgets, supervision and closing community projects well.", ["online", "blended"]),
  make("cat-six-digital", "Digital Marketing", THREE_MONTH, "Certificate in Digital Marketing", "Social campaigns, WhatsApp selling, ads, analytics and content calendars.", ["online"]),
  make("cat-six-video", "Video Production", THREE_MONTH, "Certificate in Video Production", "Shooting, directing, editing and delivery for events, adverts and online shows.", ["blended", "onsite"]),
  make("cat-six-pr", "General Public Relations", THREE_MONTH, "Certificate in General Public Relations", "Press releases, media relations, events and reputation management.", ["online", "blended"]),

  // ── One-month courses · REG 10 US$ ───────────────────────────────
  make("cat-three-computer", "Introduction to Computer", ONE_MONTH, "Certificate in Computer Foundations", "Typing, files, Word, Excel, internet, email and safe smartphone and laptop use.", ["onsite", "blended"]),
  make("cat-three-speaking", "Public Speaking", ONE_MONTH, "Certificate in Public Speaking", "Stage confidence, speech structure, microphone technique and audience engagement.", ["onsite", "blended"]),
  make("cat-three-social", "Social Media Management", ONE_MONTH, "Certificate in Social Media Management", "Managing business pages, content planning, growth and customer messages.", ["online"]),
  make("cat-three-mgraphics", "Mobile Graphics", ONE_MONTH, "Certificate in Mobile Graphics", "Professional flyers and adverts designed entirely on a smartphone.", ["online"]),
  make("cat-three-mmulti", "Mobile Multimedia", ONE_MONTH, "Certificate in Mobile Multimedia", "Shoot, edit and publish video, audio and graphics from one phone.", ["online"]),
  make("cat-three-care", "Customer's Care & Reception", ONE_MONTH, "Certificate in Customer Care & Reception", "Front-desk service, phone handling, complaints and repeat-customer care.", ["onsite", "blended"]),
  make("cat-three-vpod", "Video Podcasting", ONE_MONTH, "Certificate in Video Podcasting", "Video talk shows: set, lighting, hosting, editing and YouTube publishing.", ["online", "blended"]),
  make("cat-three-entre", "Entrepreneurship & Business", ONE_MONTH, "Certificate in Entrepreneurship", "Business ideas, costing, pricing, records and starting a small enterprise.", ["online", "onsite"]),
  make("cat-three-lead", "Leadership & Management", ONE_MONTH, "Certificate in Leadership & Management", "Team leadership, meetings, supervision and community organisation.", ["online", "blended"]),

  // ── Two-week courses · REG 5 US$ ─────────────────────────────────
  make("cat-one-mgraphics", "Mobile Graphics (Fast Track)", TWO_WEEK, "Certificate in Mobile Graphics", "Two-week fast track: adverts and social designs on your phone.", ["online"]),
  make("cat-one-proposal", "Project Proposal Writing", TWO_WEEK, "Certificate in Proposal Writing", "Write clear NGO and business proposals with budgets and logframes.", ["online"]),
  make("cat-one-event", "Event Planning", TWO_WEEK, "Certificate in Event Planning", "Plan, decorate, budget and coordinate weddings, programs and launches.", ["blended", "onsite"]),
  make("cat-one-speech", "Speech & Article Writing", TWO_WEEK, "Certificate in Speech & Article Writing", "Write speeches, articles and press pieces people actually finish.", ["online"]),
  make("cat-one-quick", "QuickBooks", TWO_WEEK, "Certificate in QuickBooks", "Set up company books, invoices, expenses and simple reports in QuickBooks.", ["online", "blended"]),
  make("cat-one-book", "Book Keeping", TWO_WEEK, "Certificate in Book Keeping", "Daily sales records, ledgers, cash control and month-end balancing.", ["online", "blended"]),
];
