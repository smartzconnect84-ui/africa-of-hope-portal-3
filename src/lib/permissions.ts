import type { Role } from "../types";

/**
 * Single source of truth for the permission catalogue, the six fixed roles
 * and the default role -> permission matrix. Mirrors the seed data in
 * supabase/migrations/20261014010000_roles_permissions_cms.sql exactly, so
 * the frontend has a sane fallback before that table loads (or before the
 * migration is applied at all).
 *
 * Super Admin is never stored in role_permissions: has_permission() (and
 * hasPermission() below) always return true for an Active Super Admin.
 */

export const ROLES: Role[] = [
  "Super Admin",
  "School Admin",
  "Teacher",
  "Registrar",
  "Finance Officer",
  "Student",
];

/** Roles that can be created as staff accounts (every role except Student). */
export const STAFF_ROLES: Role[] = [
  "Super Admin",
  "School Admin",
  "Teacher",
  "Registrar",
  "Finance Officer",
];

export const PERMISSION_KEYS = [
  "people.view",
  "students.manage",
  "staff.manage",
  "programs.manage",
  "cohorts.manage",
  "courses.enroll",
  "academic_plans.manage",
  "academic_plans.approve",
  "lessons.manage",
  "materials.manage",
  "materials.approve",
  "attendance.manage",
  "attendance.own",
  "assignments.manage",
  "assignments.own",
  "quizzes.manage",
  "quizzes.manage_all",
  "quizzes.take",
  "quizzes.view_results",
  "fees.view",
  "fees.manage",
  "payments.submit",
  "payments.confirm",
  "certificates.manage",
  "announcements.manage",
  "cms.manage",
  "blog.manage",
  "settings.manage",
  "assistant.use",
  "assistant.admin_help",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface PermissionDef {
  key: PermissionKey;
  group: string;
  label: string;
  description: string;
  sort: number;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "people.view", group: "People", label: "View staff & student directory", description: "See the Staff & Students screen and every profile in it.", sort: 10 },
  { key: "students.manage", group: "People", label: "Manage students", description: "Approve applicants, suspend/reinstate students, assign programmes and cohorts.", sort: 20 },
  { key: "staff.manage", group: "People", label: "Manage staff", description: "Add staff accounts, change roles, suspend, reset passwords and delete people.", sort: 30 },
  { key: "programs.manage", group: "Academics", label: "Manage programmes", description: "Create and edit programmes and their modules.", sort: 40 },
  { key: "cohorts.manage", group: "Academics", label: "Manage cohorts", description: "Create and edit cohorts, assign teachers and students.", sort: 50 },
  { key: "courses.enroll", group: "Academics", label: "Plan own courses", description: "Check conflicts and submit course enrollment plans.", sort: 51 },
  { key: "academic_plans.manage", group: "Academics", label: "Create academic plans", description: "Create course plans, lessons and class timetables for assigned cohorts.", sort: 52 },
  { key: "academic_plans.approve", group: "Academics", label: "Approve academic plans", description: "Review student enrollments and teacher plans, lessons and schedules.", sort: 53 },
  { key: "lessons.manage", group: "Academics", label: "Manage lessons", description: "Create chapters, modules and topics for assigned courses.", sort: 54 },
  { key: "materials.manage", group: "Academics", label: "Manage training materials", description: "Submit files and educational resources for assigned courses.", sort: 55 },
  { key: "materials.approve", group: "Academics", label: "Approve training materials", description: "Review training resources before students can access them.", sort: 56 },
  { key: "attendance.manage", group: "Academics", label: "Manage all attendance", description: "Record and edit attendance for every cohort.", sort: 60 },
  { key: "attendance.own", group: "Academics", label: "Manage own cohort attendance", description: "Record and edit attendance for cohorts you teach.", sort: 70 },
  { key: "assignments.manage", group: "Academics", label: "Manage all assignments", description: "Create assignments and grade submissions for every cohort.", sort: 80 },
  { key: "assignments.own", group: "Academics", label: "Manage own cohort assignments", description: "Create assignments and grade submissions for cohorts you teach.", sort: 90 },
  { key: "quizzes.manage", group: "Quizzes", label: "Manage own quizzes", description: "Build, edit and publish quizzes for cohorts you teach or quizzes you created.", sort: 100 },
  { key: "quizzes.manage_all", group: "Quizzes", label: "Manage all quizzes", description: "Manage any quiz, regardless of who created it.", sort: 110 },
  { key: "quizzes.take", group: "Quizzes", label: "Take quizzes", description: "See and attempt published quizzes for your own cohorts/programmes.", sort: 120 },
  { key: "quizzes.view_results", group: "Quizzes", label: "View quiz results", description: "See attempts and scores for quizzes you can manage.", sort: 130 },
  { key: "fees.view", group: "Finance", label: "View fees", description: "See fee transactions and balances for students.", sort: 140 },
  { key: "fees.manage", group: "Finance", label: "Manage fees", description: "Record payments and edit fee transactions.", sort: 150 },
  { key: "payments.submit", group: "Finance", label: "Submit mobile money payments", description: "Report own MTN MoMo or Orange Money fee payments for confirmation.", sort: 151 },
  { key: "payments.confirm", group: "Finance", label: "Confirm mobile money payments", description: "Confirm or reject reported payments and issue receipts.", sort: 152 },
  { key: "certificates.manage", group: "Certificates", label: "Manage certificates", description: "Issue, edit and revoke certificates.", sort: 160 },
  { key: "announcements.manage", group: "Comms", label: "Post announcements", description: "Create and edit bulletin board announcements.", sort: 170 },
  { key: "cms.manage", group: "Website", label: "Manage website content", description: "Edit the public website: homepage, login/register page, logo and footer.", sort: 180 },
  { key: "blog.manage", group: "Website", label: "Manage blog", description: "Write, schedule, publish and archive public blog posts.", sort: 185 },
  { key: "settings.manage", group: "Settings", label: "Manage system settings", description: "Edit academy details, academic calendar and portal-wide settings.", sort: 190 },
  { key: "assistant.use", group: "AI", label: "Use Hope Assistant", description: "Chat with the Hope Assistant and get answers about your own data.", sort: 200 },
  { key: "assistant.admin_help", group: "AI", label: "Assistant screen help & stats", description: "Get screen guidance and aggregate statistics from the Hope Assistant.", sort: 210 },
];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

/**
 * Default seed matrix (mirrors the migration's `on conflict do nothing`
 * seed). Super Admin is intentionally absent: it always has every
 * permission through hasPermission()/has_permission().
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<Role, "Super Admin">, PermissionKey[]> = {
  "School Admin": [
    "people.view",
    "students.manage",
    "staff.manage",
    "programs.manage",
    "cohorts.manage",
    "academic_plans.approve",
    "materials.approve",
    "attendance.manage",
    "assignments.manage",
    "quizzes.manage",
    "quizzes.manage_all",
    "quizzes.view_results",
    "fees.view",
    "fees.manage",
    "payments.confirm",
    "certificates.manage",
    "announcements.manage",
    "cms.manage",
    "blog.manage",
    "settings.manage",
    "assistant.use",
    "assistant.admin_help",
  ],
  Teacher: [
    "academic_plans.manage",
    "lessons.manage",
    "materials.manage",
    "attendance.own",
    "assignments.own",
    "quizzes.manage",
    "quizzes.view_results",
    "announcements.manage",
    "assistant.use",
    "assistant.admin_help",
  ],
  Registrar: [
    "people.view",
    "students.manage",
    "programs.manage",
    "cohorts.manage",
    "academic_plans.approve",
    "materials.approve",
    "quizzes.view_results",
    "fees.view",
    "certificates.manage",
    "announcements.manage",
    "assistant.use",
    "assistant.admin_help",
  ],
  "Finance Officer": [
    "people.view",
    "fees.view",
    "fees.manage",
    "payments.confirm",
    "announcements.manage",
    "assistant.use",
    "assistant.admin_help",
  ],
  Student: ["courses.enroll", "quizzes.take", "payments.submit", "assistant.use"],
};

/** True when `role` has `key`, using Super Admin's implicit all-access rule. */
export function roleHasPermission(
  role: Role | undefined,
  key: PermissionKey,
  rolePermissions: Record<string, PermissionKey[]>,
): boolean {
  if (!role) return false;
  if (role === "Super Admin") return true;
  return (rolePermissions[role] ?? DEFAULT_ROLE_PERMISSIONS[role as Exclude<Role, "Super Admin">] ?? []).includes(
    key,
  );
}
