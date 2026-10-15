import type { AppState, SystemSettings, WebsiteSettings } from "../types";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../lib/permissions";

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
  academyName: "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES",
  motto: "Certificates that open doors. Skills that build communities.",
  contactEmail: "",
  contactPhone: "For Inquiries: +231776679963/088806137 or afrohope033@gmail.com",
  address: "Boystown Junction-Lower Margibi, Republic of Liberia",
  accreditationNo: "NBTE/ACC/2024/0491",
  currency: "$",
  academicYear: "2025/2026",
  semester: "First Semester",
  selfRegistrationOpen: true,
  studentIdPrefix: "AOH-STU",
  passMark: 60,
  minAttendance: 75,
  sitePublished: true,
  marketingBanner: "Admissions for the 2025/2026 intake are now open. Apply online in minutes.",
  intakeStatus: "Open",
  featuredProgramIds: [],
  assistantEnabled: true,
};

export const defaultWebsiteSettings: WebsiteSettings = {
  logoUrl: "",
  faviconUrl: "",
  academyName: "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES",
  tagline: "Empowering future tech leaders and innovators.",
  announcementText:
    "Admissions for the 2025/2026 intake are now open. Apply online in minutes.",
  announcementEnabled: true,
  heroSlides: [
    {
      id: "hero-1",
      eyebrow: "Cohort Success",
      title: "Empowering Future",
      highlight: "Tech Leaders & Innovators",
      description:
        "Join hands-on, accredited certificate programs crafted to take you from foundational knowledge to job-ready mastery.",
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
      eyebrow: "Accredited Certification",
      title: "Verifiable Credentials That",
      highlight: "Open Real Career Doors",
      description:
        "Every graduate receives an authenticated, QR-verifiable certificate recognized across top industry partners.",
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
  stats: [
    { id: "stat-1", value: "96%", label: "Completion rate" },
    { id: "stat-2", value: "18", label: "Partner employers" },
    { id: "stat-3", value: "12", label: "Certificate programmes" },
    { id: "stat-4", value: "400+", label: "Graduates placed" },
  ],
  testimonials: [
    {
      id: "t-1",
      name: "Amara N.",
      program: "Full Stack Web Development",
      quote:
        "I joined with no coding background. Six months later I was shipping features for a fintech team in Lagos.",
    },
    {
      id: "t-2",
      name: "Yusuf K.",
      program: "Cloud Computing & DevOps",
      quote:
        "The labs were real servers, real tickets. My certificate was verified by my employer in seconds.",
    },
    {
      id: "t-3",
      name: "Chiamaka O.",
      program: "UI/UX Product Design",
      quote:
        "The portfolio I built here won my first three freelance contracts before I even graduated.",
    },
  ],
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
        "Tuition can be paid in full or by instalment. Every payment is receipted in the student portal.",
    },
    {
      id: "faq-4",
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
  contactPhone: "For Inquiries: +231776679963/088806137 or afrohope033@gmail.com",
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
        title: "",
        subtitle: "",
        body: "",
      },
      about: {
        eyebrow: "Our mission",
        title: "African excellence, delivered as practical skill.",
        subtitle: "",
        body:
          "Africa of Hope exists to close the distance between classroom learning and real work. We teach in cohorts, grade transparently, keep fees auditable, and issue certificates that any employer can verify online in seconds.",
        image: WORKBENCH_IMG,
      },
      features: {
        eyebrow: "Why choose us",
        title: "Reasons students finish strong.",
        subtitle: "Everything here is designed to get you from your first class to your first job offer.",
        image: WORKBENCH_IMG,
      },
      impact: {
        eyebrow: "Student success",
        title: "Student success and impact",
        subtitle: "Hear it from our graduates and see the numbers behind every cohort.",
        image: GRADUATE_IMG,
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
      body: "Partner employers review top performers for internships and junior roles.",
    },
  ],
  partners: [
    { id: "partner-1", name: "Lagos Tech Hub", logo: "" },
    { id: "partner-2", name: "Savannah Energy", logo: "" },
    { id: "partner-3", name: "Nimbus Cloud", logo: "" },
    { id: "partner-4", name: "Kano Health Trust", logo: "" },
    { id: "partner-5", name: "Umoja Bank", logo: "" },
    { id: "partner-6", name: "Accra Digital Works", logo: "" },
  ],
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
  footerAbout:
    "Certificates that open doors. Skills that build communities.",
  assistantLauncherLabel: "Ask Hope",
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
    stats: [
      { id: "auth-stat-1", value: "30+", label: "Programmes" },
      { id: "auth-stat-2", value: "400+", label: "Graduates placed" },
      { id: "auth-stat-3", value: "96%", label: "Completion rate" },
    ],
    testimonial: {
      quote: "I joined with no coding background. Six months later I was shipping features for a fintech team in Lagos.",
      name: "Amara N.",
      program: "Full Stack Web Development",
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
  programs: [],
  cohorts: [],
  attendance: [],
  assignments: [],
  submissions: [],
  fees: [],
  certificates: [],
  announcements: [],
  settings: defaultSettings,
  websiteSettings: defaultWebsiteSettings,
  rolePermissions: DEFAULT_ROLE_PERMISSIONS as unknown as Record<string, string[]>,
  permissionCatalogue: PERMISSIONS,
};
