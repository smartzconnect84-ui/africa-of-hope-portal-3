export type Role =
  | "Super Admin"
  | "School Admin"
  | "Teacher"
  | "Registrar"
  | "Admission Officer"
  | "Finance Officer"
  | "Student";
export type AcademicStatus = "Active" | "Suspended" | "Pending Approval";
export type AttendanceStatus = "Present" | "Absent" | "Late";
export type FeeCategory = "Registration" | "Tuition" | "Exam" | "Certificate";
export type SubmissionStatus = "In Progress" | "Submitted" | "Graded" | "Missing";
export type CertificateStatus = "Valid" | "Revoked";
/** The award actually being issued. Never assume every award is a diploma. */
export type CertificateType =
  | "Certificate of Completion"
  | "Certificate of Achievement"
  | "Certificate of Participation"
  | "Professional Training Certificate"
  | "Certificate of Excellence"
  | "Diploma Certificate";
export type AnnouncementCategory = "Urgent" | "Academic" | "Financial";

export interface User {
  id: string;
  /** Database-assigned, immutable number (all account roles). */
  accountNumber?: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: AcademicStatus;
  joinedDate: string;
  title?: string;
  programIds: string[];
  cohortIds: string[];
  note?: string;
  documents?: string;
  /** Highest completed schooling, captured at registration. */
  educationLevel?: string;
  avatarUrl?: string;
  bio?: string;
  address?: string;
  dateOfBirth?: string;
}

export interface Module {
  id: string;
  title: string;
  weeks: number;
  summary: string;
}

export type DeliveryMode = "online" | "blended" | "onsite";

export interface Program {
  id: string;
  /** Database-assigned, immutable course number. */
  courseNumber?: string;
  title: string;
  category: string;
  durationWeeks: number;
  /** How the programme is delivered: fully online, partially online, or on-site. */
  deliveryModes?: DeliveryMode[];
  tuition: number;
  certification: string;
  description: string;
  entryRequirements: string;
  modules: Module[];
  imageUrl?: string;
  /** Explicit backend publication state; legacy records without a flag remain public. */
  published?: boolean;
}

export interface Cohort {
  id: string;
  name: string;
  programId: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  room: string;
  studentIds: string[];
}

export interface AttendanceRecord {
  id: string;
  cohortId: string;
  date: string;
  studentId: string;
  status: AttendanceStatus;
}

export interface Assignment {
  id: string;
  cohortId: string;
  title: string;
  dueDate: string;
  maxMarks: number;
  description: string;
  timeLimitMinutes?: number | null;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: string | null;
  marks: number | null;
  feedback: string;
  status: SubmissionStatus;
  responseText?: string;
  attachmentPath?: string | null;
  startedAt?: string | null;
  isLate?: boolean;
  timeSpentSeconds?: number | null;
}

export interface FeeTransaction {
  id: string;
  studentId: string;
  category: FeeCategory;
  amount: number;
  date: string;
  method: string;
  reference: string;
}

export interface Certificate {
  id: string;
  studentId: string;
  programId: string;
  serial: string;
  issueDate: string;
  honors: string;
  grade: string;
  status: CertificateStatus;
  /** Award printed on the certificate; older records fall back to Certificate of Completion. */
  certificateType?: CertificateType | string;
  /** Date the programme requirements were met, when recorded separately from the issue date. */
  completionDate?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  date: string;
  author: string;
  status?: "draft" | "scheduled" | "published";
  audience?: "public" | "all" | "students" | "teachers";
  scheduledAt?: string | null;
  expiresAt?: string | null;
  publishedAt?: string | null;
}

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  image: string;
}

export interface FeatureHighlight {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  program: string;
  quote: string;
  avatar?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export interface NavLink {
  id: string;
  label: string;
  href: string;
}

/** A short bullet of text, used for requirement/trust-point lists. */
export interface TextItem {
  id: string;
  text: string;
}

/** Mission / vision / values style pillar, shown in the About section. */
export interface PillarItem {
  id: string;
  icon: string;
  title: string;
  body: string;
}

export interface PartnerItem {
  id: string;
  name: string;
  logo: string;
  description?: string;
}

export interface StepItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export type HomeSectionKey =
  | "summary"
  | "about"
  | "features"
  | "impact"
  | "admissions"
  | "verify"
  | "faq"
  | "contact"
  | "cta";

export interface SectionCopy {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  image?: string;
  ctaText?: string;
}

export interface HeaderSettings {
  loginText: string;
  applyText: string;
  showApply: boolean;
}

export interface HomeSettings {
  order: HomeSectionKey[];
  hidden: HomeSectionKey[];
  sections: Record<HomeSectionKey, SectionCopy>;
}

export interface AuthTestimonial {
  quote: string;
  name: string;
  program: string;
  avatar?: string;
}

export interface AuthSettings {
  showcaseImage: string;
  eyebrow: string;
  headline: string;
  highlight: string;
  description: string;
  features: FeatureHighlight[];
  stats: StatItem[];
  testimonial: AuthTestimonial;
  signinTitle: string;
  signinSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  consentText: string;
  pendingTitle: string;
  pendingBody: string;
}

export type LogoPlacement = "header" | "footer" | "portal" | "auth" | "certificate" | "brochure";

/** One authorised signature area. Names, titles and signature images come from settings only. */
export interface CertificateSignatory {
  id: string;
  name: string;
  title: string;
  signatureUrl: string;
}

/**
 * Institutional wording and the verified contact block printed on certificates.
 * Blank contact fields are omitted rather than filled with invented details.
 */
export interface CertificateBranding {
  institutionName: string;
  parentName: string;
  descriptor: string;
  motto: string;
  tagline: string;
  presentationLine: string;
  completionLine: string;
  awardingLine: string;
  websiteUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  /** Base public verification address; blank means the current site's /verify route. */
  verificationBaseUrl: string;
  sealCaption: string;
  signatories: CertificateSignatory[];
}

export interface WebsiteSettings {
  aboutPage?: import('./data/publicPresentation').AboutContent;
  presentation?: { font: string; iconWeight: string };
  pwa?: typeof import('./data/publicPresentation').DEFAULT_PWA;
  publicLayout?: string[];
  /** Records the owner-requested logo replacement; later CMS edits stay independent. */
  brandRevision?: number;
  /** One-time owner-supplied Team seed; later CMS edits/removals remain authoritative. */
  teamRevision?: number;
  /** Placement-specific overrides; blank entries inherit the default logo. */
  logos?: Partial<Record<LogoPlacement, string>>;
  /** Certificate wording, signatories and verified institutional contact details. */
  certificate?: CertificateBranding;
  logoUrl: string;
  faviconUrl: string;
  academyName: string;
  tagline: string;
  announcementText: string;
  announcementEnabled: boolean;
  heroSlides: HeroSlide[];
  features: FeatureHighlight[];
  stats: StatItem[];
  testimonials: TestimonialItem[];
  faqs: FaqItem[];
  socials: SocialLink[];
  navLinks: NavLink[];
  footerCopyright: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  officeHours: string;
  applyCtaText: string;
  verifyEnabled: boolean;
  // Phase 2: full-site CMS additions. mergeWebsiteSettings() keeps old saved
  // JSON working by falling back to these defaults for any missing key.
  header: HeaderSettings;
  home: HomeSettings;
  aboutPoints: PillarItem[];
  partners: PartnerItem[];
  partnerShowcase?: { title: string; description: string; autoRotate: boolean };
  admissionSteps: StepItem[];
  admissionRequirements: TextItem[];
  verifyPoints: TextItem[];
  footerLinks: NavLink[];
  footerAbout: string;
  assistantLauncherLabel: string;
  auth: AuthSettings;
  publicCopy: Record<string, string>;
  support: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    description: string;
    responseNote: string;
    cards: { id: string; label: string; blurb: string; cta: string }[];
  };
  team: {
    enabled: boolean;
    title: string;
    description: string;
    members: { id: string; name: string; role: string; bio: string; image: string }[];
  };
  newsletter: { enabled: boolean; title: string; description: string; consent: string; button: string };
}

export type WebsiteListKey =
  | "heroSlides"
  | "features"
  | "stats"
  | "testimonials"
  | "faqs"
  | "socials"
  | "navLinks"
  | "aboutPoints"
  | "partners"
  | "admissionSteps"
  | "admissionRequirements"
  | "verifyPoints"
  | "footerLinks";

export interface PermissionDef {
  key: string;
  group: string;
  label: string;
  description: string;
  sort: number;
}

export interface AppState {
  users: User[];
  programs: Program[];
  cohorts: Cohort[];
  attendance: AttendanceRecord[];
  assignments: Assignment[];
  submissions: Submission[];
  fees: FeeTransaction[];
  certificates: Certificate[];
  announcements: Announcement[];
  settings: SystemSettings;
  websiteSettings: WebsiteSettings;
  themeSettings: PortalThemeSettings;
  /** role name -> permission keys it holds. Loaded from `role_permissions`. */
  rolePermissions: Record<string, string[]>;
  /** The full permission catalogue, loaded from `permissions`. */
  permissionCatalogue: PermissionDef[];
}

export interface PortalThemeSettings {
  mode: "light" | "dark" | "system";
  primaryColor: string;
  accentColor: string;
  fontFamily: "sans" | "serif" | "mono";
  iconStyle: "outline" | "filled";
  contentAlignment: "left" | "center";
  borderRadius: "sharp" | "rounded" | "pill";
}

export interface SystemSettings {
  academyName: string;
  motto: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  accreditationNo: string;
  currency: string;
  academicYear: string;
  semester: string;
  selfRegistrationOpen: boolean;
  studentIdPrefix: string;
  passMark: number;
  minAttendance: number;
  sitePublished: boolean;
  marketingBanner: string;
  intakeStatus: string;
  featuredProgramIds: string[];
  /** Hope Assistant kill switch, edited from Admin > System Settings. */
  assistantEnabled: boolean;
}

// ───────────────────────────── Quizzes ─────────────────────────────

export type QuizQuestionType = "single" | "multi" | "true_false" | "short";
export type QuizStatus = "draft" | "published" | "archived";
export type QuizShowAnswers = "after_submit" | "after_close" | "never";
export type QuizAttemptStatus = "in_progress" | "submitted" | "auto_submitted";

/** One selectable option for a `single`/`multi` question. */
export interface QuizOption {
  id: string;
  text: string;
}

/** Full question shape, used only by the builder (teacher/admin) -- never
 * sent to a student before they submit their attempt. */
export interface QuizQuestion {
  id: string;
  quizId: string;
  position: number;
  type: QuizQuestionType;
  prompt: string;
  options: QuizOption[];
  /** single/multi: option id(s). true_false: [true] or [false]. short: accepted strings. */
  correct: (string | boolean)[];
  points: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  programId: string | null;
  cohortId: string | null;
  /** Optional lesson this quiz practices. When set, the quiz appears inside that lesson in the learning path. */
  learningUnitId: string | null;
  createdBy: string | null;
  status: QuizStatus;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  passMark: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswers: QuizShowAnswers;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

/** A student-facing question inside an in-progress attempt: never includes
 * `correct` or `explanation`. Options are in the frozen, per-attempt order. */
export interface PlayerQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  points: number;
  options: QuizOption[];
}

export interface QuizAttemptPayload {
  attemptId: string;
  attemptNo: number;
  status: QuizAttemptStatus;
  deadlineAt: string | null;
  serverNow: string;
  quiz: {
    id: string;
    title: string;
    description: string;
    timeLimitMinutes: number | null;
    totalPoints: number;
    maxAttempts: number;
    passMark: number;
  };
  questions: PlayerQuestion[];
  answers: Record<string, unknown>;
}

export interface QuizSubmitResult {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  status: QuizAttemptStatus;
  submittedAt: string | null;
  reviewAvailable: boolean;
}

/** Row for the student "available quizzes" list / teacher results table. */
export interface QuizAttemptSummary {
  attemptId: string;
  quizId: string;
  studentId: string;
  attemptNo: number;
  status: QuizAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  deadlineAt: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
}

/** One reviewed question, returned by `get_quiz_review`. */
export interface QuizReviewQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  points: number;
  options: QuizOption[];
  correct: (string | boolean)[];
  explanation: string;
  answer: unknown;
  awardedPoints: number;
  isCorrect: boolean;
  overridden: boolean;
}

export interface QuizReview {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  attemptNo: number;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  startedAt: string;
  submittedAt: string | null;
  questions: QuizReviewQuestion[];
}
