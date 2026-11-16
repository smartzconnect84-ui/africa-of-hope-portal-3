import type { Role } from "../types";

export interface StaffRoleGuide {
  role: Extract<
    Role,
    | "Public Relations Officer"
    | "Data Entry Officer"
    | "Executive Assistant"
    | "Research Officer"
    | "Customer Care Officer"
    | "Director of Education"
  >;
  mission: string;
  modules: string[];
  accountsNote: string;
}

export const NEW_BACK_OFFICE_ROLES: StaffRoleGuide[] = [
  {
    role: "Director of Education",
    mission: "Owns academic standards: approves course plans and materials, reviews grade appeals, oversees programmes, cohorts and certificates.",
    modules: [
      "Dashboard",
      "Staff & Students",
      "Academic Approvals",
      "Program Builder",
      "Cohort Coordinator",
      "Gradebook",
      "Appeal & remark desk",
      "Finance Ledger (view)",
      "Certificates",
      "Bulletin Board",
      "Blog",
      "Training Library",
      "Operations Centre",
    ],
    accountsNote: "Create via Staff & Students → Add staff. One email = one account.",
  },
  {
    role: "Public Relations Officer",
    mission: "Owns public image: website CMS, news/blog, announcements, transparency reports and vacancies pages.",
    modules: [
      "Dashboard (Website CMS)",
      "Bulletin Board",
      "Blog",
      "Website CMS",
      "Transparency reports",
      "Vacancies & Businesses",
    ],
    accountsNote: "Create via Staff & Students → Add staff. Give cms.manage + blog.manage only.",
  },
  {
    role: "Customer Care Officer",
    mission: "Front desk for enquiries: helpdesk tickets, admissions & support inbox, applicant follow-up and fee FAQs.",
    modules: [
      "Dashboard (Helpdesk)",
      "Staff & Students (view)",
      "Admissions & support forms",
      "Student helpdesk",
      "Finance Ledger (view)",
      "Bulletin Board",
    ],
    accountsNote: "Create via Staff & Students → Add staff. Sees names/contacts but cannot change roles.",
  },
  {
    role: "Data Entry Officer",
    mission: "Enters records accurately: applicants, students, attendance, cohorts and certificate details for review.",
    modules: [
      "Dashboard (Staff & Students)",
      "Staff & Students",
      "Admissions & support forms",
      "Cohort Coordinator",
      "Attendance Sheet",
      "Certificates",
      "Finance Ledger (view)",
    ],
    accountsNote: "Create via Staff & Students → Add staff. Cannot manage staff, website or settings.",
  },
  {
    role: "Executive Assistant",
    mission: "Supports leadership: announcements, helpdesk triage, website updates, files and coordination.",
    modules: [
      "Dashboard",
      "Admissions & support forms",
      "Student helpdesk",
      "Bulletin Board",
      "Website CMS",
      "My files",
    ],
    accountsNote: "Create via Staff & Students → Add staff. No access to fees management or settings.",
  },
  {
    role: "Research Officer",
    mission: "Builds learning content: training library materials, programme research, quizzes insight and blog stories.",
    modules: [
      "Dashboard",
      "Program Builder",
      "Training Library",
      "Quizzes",
      "Bulletin Board",
      "Blog",
      "Operations Centre",
    ],
    accountsNote: "Create via Staff & Students → Add staff. Can approve materials, cannot touch fees or staff.",
  },
];

export const NEW_ROLE_NAMES = NEW_BACK_OFFICE_ROLES.map((r) => r.role);

/** Alias used by Roles & Permissions screen. Same list, shared with the team. */
export const STAFF_ROLE_GUIDE = NEW_BACK_OFFICE_ROLES.map((r) => ({
  role: r.role,
  duty: r.mission,
  modules: r.modules,
  accountsNote: r.accountsNote,
}));
