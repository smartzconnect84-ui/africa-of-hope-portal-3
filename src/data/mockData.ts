import type { AppState, PortalThemeSettings, SystemSettings, WebsiteSettings } from "../types";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../lib/permissions";
import { CATALOG_2026 } from "./programCatalog2026";
import { DEFAULT_PUBLIC_COPY, DEFAULT_SUPPORT } from "./publicContent";
import { ABOUT_META } from "./aboutContent";

// Reused across the About and Impact homepage sections and the CTA band so the
// defaults look like today's live site until an admin uploads replacements.
const WORKBENCH_IMG =
  "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/generated-images/da27f14e-5252-4f4b-a327-6425a57f1e62/instructor-workbench-94a65568-1791250704601.webp";
const GRADUATE_IMG =
  "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/generated-images/da27f14e-5252-4f4b-a327-6425a57f1e62/graduate-portrait-692a8c54-1791250703262.webp";

/**
 * Offline defaults only. Every record now lives in Supabase and is hydrated by
 * AppProvider; no mock people, cohorts, marks or announcements are shipped.
 */

export const defaultSettings: SystemSettings = {
  academyName: "AFRICA OF HOPE",
  motto: "Certificates that open doors. Skills that build communities.",
  contactEmail: "",
  contactPhone: "For Inquiries: +231776679963 or afrohope033@gmail.com",
  address: "Boystown Junction-Lower Margibi, Republic of Liberia",
  accreditationNo: "NBTE/ACC/2024/0491",
  currency: "$",
  academicYear: "2026/2027",
  semester: "First Semester",
  selfRegistrationOpen: true,
  studentIdPrefix: "AOH-STU",
  passMark: 60,
  minAttendance: 75,
  sitePublished: true,
  marketingBanner: "Admissions for the 2026/2027 intake are now open. Apply online in minutes.",
  intakeStatus: "Open",
  featuredProgramIds: [],
  assistantEnabled: true,
};

export const defaultThemeSettings: PortalThemeSettings = {
  mode: "light",
  primaryColor: "#065f46",
  accentColor: "#f59e0b",
  fontFamily: "sans",
  iconStyle: "outline",
  contentAlignment: "left",
  borderRadius: "rounded",
};

export const defaultWebsiteSettings: WebsiteSettings = {
  brandRevision: 1,
  publicCopy: DEFAULT_PUBLIC_COPY,
  support: DEFAULT_SUPPORT,
  team: { enabled: false, title: "Meet our staff", description: "", members: [] },
  newsletter: {
    enabled: true,
    title: "Stay in touch",
    description: "Receive news and updates from Africa of Hope.",
    consent: "I agree to receive email updates. I can unsubscribe at any time.",
    button: "Subscribe",
  },
  logos: { header: '', footer: '', portal: '', auth: '', certificate: '', brochure: '' },
  logoUrl: "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png",
  faviconUrl: "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png",
  academyName: "AFRICA OF HOPE",
  tagline: "",
  announcementText:
    "Admissions for the 2026/2027 intake are now open. Apply online in minutes.",
  announcementEnabled: true,
  heroSlides: [
    {
      id: "hero-1",
      eyebrow: "Cohort Success",
      title: "Empowering Future",
      highlight: "Tech Leaders & Innovators",
      description:
        "Explore professional training programmes with practical skills and study options to support your next step.",
      image:
        "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902768004_IMG-20250919-WA0127.webp",
    },
    {
      id: "hero-2",
      eyebrow: "Digital Marketing & Financial Literacy",
      title: "Celebrating Our",
      highlight: "Certified Cohort Graduates",
      description:
        "Recognizing ambitious professionals who mastered modern digital growth and financial management skill sets.",
      image:
        "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902655944_IMG-20251006-WA0070.webp",
    },
    {
      id: "hero-3",
      eyebrow: "Certificate verification",
      title: "Verifiable Credentials That",
      highlight: "Open Real Career Doors",
      description:
        "Use our certificate verification service to check credentials issued through Africa of Hope.",
      image:
        "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/7df501ed-0d87-47d4-9851-c8a5505b89b3/1791902768234_IMG-20251117-WA0113.webp",
    },
  ],
  features: [
    {
      id: "feat-1",
      icon: "BookOpen",
      title: "Practical, project-based curriculum",
      description:
        "Every module ends with a deliverable graded like a real workplace brief, not a multiple-choice quiz.",
    },
    {
      id: "feat-2",
      icon: "Users",
      title: "Mentors who still practise",
      description:
        "Instructors are working professionals, so feedback reflects what employers actually look for.",
    },
    {
      id: "feat-3",
      icon: "Wallet",
      title: "Transparent, auditable fees",
      description:
        "Every instalment, receipt and balance is visible in your student portal, with no hidden charges.",
    },
  ],
  stats: ABOUT_META.stats.map((stat) => ({ ...stat })),
  testimonials: [],
  faqs: [
    {
      id: "faq-1",
      question: "When does the next intake begin?",
      answer:
        "Classes begin at the start of each semester. Check the admissions banner for the current intake status.",
    },
    {
      id: "faq-2",
      question: "Do I need previous experience?",
      answer:
        "Each programme lists its own entry requirements. Several certificate tracks welcome complete beginners.",
    },
    {
      id: "faq-3",
      question: "How is tuition paid?",
      answer:
        "Every course is tuition-free — you only pay a one-time registration package: US$45 for six-month courses, US$30 for three-month, US$10 for one-month and US$5 for two-week courses. Seat reservations and receipts are handled in the student portal.",
    },
    {
      id: "faq-4",
      question: "How many days a week will I attend?",
      answer:
        "You choose: fully online is 1 hour a day, 3 days a week; fully on-site is 2 hours daily, 2 days a week; partially online mixes both. The schedule follows the study plan you pick when applying.",
    },
    {
      id: "faq-5",
      question: "Are certificates internationally recognised?",
      answer:
        "Certificates are issued under our accreditation and are verifiable online by any employer.",
    },
  ],
  socials: [
    { id: "soc-1", platform: "Facebook", url: "https://facebook.com" },
    { id: "soc-2", platform: "Instagram", url: "https://instagram.com" },
    { id: "soc-3", platform: "LinkedIn", url: "https://linkedin.com" },
    { id: "soc-4", platform: "X", url: "https://x.com" },
  ],
  navLinks: [
    { id: "nav-programs", label: "Programs", href: "#programs" },
    { id: "nav-2", label: "About", href: "#about" },
    { id: "nav-3", label: "Impact", href: "#impact" },
    { id: "nav-4", label: "Verify", href: "#verify" },
    { id: "nav-5", label: "Admissions", href: "#admissions" },
  ],
  footerCopyright: "All rights reserved.",
  contactPhone: "For Inquiries: +231776679963 or afrohope033@gmail.com",
  contactEmail: "",
  address: "Boystown Junction-Lower Margibi, Republic of Liberia",
  officeHours: "Online 24/7",
  applyCtaText: "Apply Online",
  verifyEnabled: true,

  // ── Phase 2 CMS additions ────────────────────────────────────────────────
  header: {
    loginText: "Portal login",
    applyText: "Apply Online",
    showApply: true,
  },
  home: {
    order: ["summary", "about", "features", "impact", "admissions", "verify", "faq", "contact", "cta"],
    hidden: [],
    sections: {
      summary: {
        eyebrow: "Who we are",
        title: "Skills for the future of work.",
        subtitle: "Africa of Hope is a learning community built around access, applied skills and visible progress.",
        body: "We help people discover relevant programmes, learn with confidence and move from application to completion with clear guidance at every step. Our work brings together training, mentorship and opportunity so learners can build a stronger future for themselves, their families and their communities.",
      },
      about: {
eyebrow: "Our work",
    title: "Skills, programmes and proof that move people forward.",
    subtitle: "A practical learning platform for ambitious people across Liberia and beyond.",
    body:
      "Africa of Hope connects learners to relevant programmes, supportive mentors and clear proceedings from application to certification. Explore what is happening, choose your next step and build momentum with a community that believes in progress.",
        image: "/images/our-work-graduates.jpg",
      },
      features: {
        eyebrow: "Why choose us",
        title: "Reasons students finish strong.",
        subtitle: "Everything here is designed to get you from your first class to your first job offer.",
        image: WORKBENCH_IMG,
      },
      impact: {
        eyebrow: "Student success",
        title: "Student success stories from Liberia",
        subtitle: "Real graduates from Monrovia, Margibi and beyond, building careers at home.",
        image: "/images/student-success-certificate.jpg",
      },
      admissions: {
        eyebrow: "How admission works",
        title: "Simple steps to your first class.",
        subtitle: "Everything you need before you apply.",
        ctaText: "Apply online",
      },
      verify: {
        eyebrow: "Public verification",
        title: "Verify a certificate in seconds",
        subtitle: "Enter the serial number printed on an Africa of Hope certificate. No account is required.",
      },
      faq: {
        eyebrow: "FAQ and enquiries",
        title: "Questions before you apply?",
        subtitle: "",
      },
      contact: {
        eyebrow: "Visit, call or email",
        title: "Prefer to talk in person?",
        subtitle: "Our registrar's office welcomes walk-ins during office hours.",
      },
      cta: {
        eyebrow: "",
        title: "Ready to build your future? Apply today.",
        subtitle:
          "Join the students who have turned an Africa of Hope certificate into a career. Applications take less than five minutes.",
        ctaText: "Apply online",
        image: GRADUATE_IMG,
      },
    },
  },
  aboutPoints: [
    {
      id: "pillar-1",
      icon: "Target",
      title: "Cohort-based learning",
      body: "Small groups led by practising instructors, from week one to certification.",
    },
    {
      id: "pillar-2",
      icon: "Award",
      title: "Accredited certification",
      body: "Every graduate earns a serialised certificate that employers can verify online.",
    },
    {
      id: "pillar-3",
      icon: "Handshake",
      title: "Industry placement",
      body: "Partner employers across Liberia review top performers for internships and junior roles.",
    },
  ],
  partners: [],
  partnerShowcase: { title: "Industry & partnerships", description: "Working together to expand opportunity and strengthen communities.", autoRotate: true },
  admissionSteps: [
    {
      id: "step-1",
      title: "Create your account",
      description: "Apply online in minutes and choose the programmes you want to study.",
      icon: "UserPlus",
    },
    {
      id: "step-2",
      title: "Upload your documents",
      description: "Add a valid ID, your school records and a passport photo in your portal.",
      icon: "FileText",
    },
    {
      id: "step-3",
      title: "Admissions review",
      description: "Our team reviews your application and contacts you by email or SMS.",
      icon: "Search",
    },
    {
      id: "step-4",
      title: "Pay and join your cohort",
      description: "Pay your first instalment, get your student ID and attend orientation.",
      icon: "CalendarCheck",
    },
  ],
  admissionRequirements: [
    { id: "req-1", text: "Age 16 or older" },
    { id: "req-2", text: "Valid ID card or passport" },
    { id: "req-3", text: "Secondary school certificate or equivalent" },
    { id: "req-4", text: "Passport photograph" },
  ],
  verifyPoints: [
    { id: "vp-1", text: "Free and instant" },
    { id: "vp-2", text: "No account needed" },
    { id: "vp-3", text: "Shows name, programme, grade and issue date" },
  ],
  footerLinks: [
    { id: "flink-1", label: "Meet our team", href: "#" },
    { id: "flink-2", label: "Book a campus visit", href: "#" },
    { id: "flink-3", label: "Refund policy", href: "#" },
  ],
  footerAbout: "",
  assistantLauncherLabel: "AOH AI",
  auth: {
    showcaseImage: "",
    eyebrow: "Student and staff portal",
    headline: "Certificates that open doors.",
    highlight: "Skills that build communities.",
    description: "",
    features: [
      {
        id: "auth-feat-1",
        icon: "BadgeCheck",
        title: "Verifiable certificates",
        description: "QR-ready credentials employers confirm in seconds.",
      },
      {
        id: "auth-feat-2",
        icon: "Sparkles",
        title: "Track your progress",
        description: "Assignments, grades, attendance and fees in one place.",
      },
      {
        id: "auth-feat-3",
        icon: "ShieldCheck",
        title: "Secure by design",
        description: "Encrypted sessions and registrar-approved access.",
      },
    ],
    stats: [],
    testimonial: {
      quote: "",
      name: "",
      program: "",
      avatar: "",
    },
    signinTitle: "Welcome back",
    signinSubtitle: "Sign in to manage your courses, grades and certificates.",
    registerTitle: "Create your account",
    registerSubtitle: "Apply in three quick steps. The registrar reviews every application.",
    consentText: "By creating an account, you agree to be contacted about your application.",
    pendingTitle: "Application under review",
    pendingBody:
      "Your registration sits in the administrator approval queue. Portal access unlocks once the registrar approves your file.",
  },
};

export const initialState: AppState = {
  users: [],
  programs: CATALOG_2026,
  cohorts: [],
  attendance: [],
  assignments: [],
  submissions: [],
  fees: [],
  certificates: [],
  announcements: [],
  settings: defaultSettings,
  websiteSettings: defaultWebsiteSettings,
  themeSettings: defaultThemeSettings,
  rolePermissions: DEFAULT_ROLE_PERMISSIONS as unknown as Record<string, string[]>,
  permissionCatalogue: PERMISSIONS,
};
