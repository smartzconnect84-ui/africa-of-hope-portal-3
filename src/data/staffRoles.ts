import type { Role } from "../types";

export interface StaffRoleGuide {
  role: Role;
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
      "Grade Evaluation",
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
const CORE_ROLE_GUIDE: StaffRoleGuide[] = [
  {
    role: "School Admin",
    mission: "Day-to-day academic and operational administration: people, admissions, cohorts, grade evaluation, finance review, certificates and website CMS.",
    modules: ["Dashboard", "Staff & Students", "Admissions & support inbox", "Cohort Coordinator", "Grade Evaluation", "Finance Ledger", "Certificates", "Website CMS", "System Settings"],
    accountsNote: "Create via Staff & Students → Add staff. Has every operational permission except full user admin.",
  },
  {
    role: "Teacher",
    mission: "Teaches cohorts: attendance, assignments, quizzes, grade evaluation, report cards and training materials.",
    modules: ["Dashboard", "Attendance Sheet", "Assignments inbox", "Quizzes", "Grade Evaluation", "Report cards", "Training Library", "Discussions"],
    accountsNote: "Create via Staff & Students → Add staff, then assign as cohort teacher.",
  },
  {
    role: "Registrar",
    mission: "Owns admissions, programmes, cohorts, certificates and verification; reviews grades and results.",
    modules: ["Staff & Students", "Admissions & support inbox", "Program Builder", "Cohort Coordinator", "Certificates", "Verification Hub", "Grade Evaluation (view)"],
    accountsNote: "Create via Staff & Students → Add staff. Approve applicants before assigning cohorts.",
  },
  {
    role: "Admission Officer",
    mission: "Owns the admissions pipeline: new applications, applicant follow-up, intake status and enrolment readiness.",
    modules: ["Dashboard", "Staff & Students (applicants)", "Admissions & support inbox", "Bulletin Board"],
    accountsNote: "Create via Staff & Students → Add staff. Focus on Pending Approval applicants.",
  },
  {
    role: "Finance Officer",
    mission: "Fee collection and the finance ledger: records payments, confirms paystack receipts and reviews balances.",
    modules: ["Dashboard", "Finance Ledger", "Vacancies & Businesses (donations)", "Certificates (view)"],
    accountsNote: "Create via Staff & Students → Add staff. Cannot change staff roles or system settings.",
  },
];

export const STAFF_ROLE_GUIDE = [...CORE_ROLE_GUIDE, ...NEW_BACK_OFFICE_ROLES].map((r) => ({
  role: r.role,
  duty: r.mission,
  modules: r.modules,
  accountsNote: r.accountsNote,
}));
