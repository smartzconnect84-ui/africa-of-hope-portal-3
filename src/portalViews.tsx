import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Boxes,
  Award,
  ShieldQuestion,
  ShieldCheck,
  Megaphone,
  ClipboardCheck,
  NotebookPen,
  Banknote,
  Settings,
  Globe,
  UserCircle,
  FileQuestion,
  CalendarRange,
  Newspaper,
  Smartphone,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "./context/AppContext";
import { usePermissions, type PermissionsApi } from "./hooks/usePermission";
import type { PermissionKey } from "./lib/permissions";
import type { Role, User } from "./types";
import {
  AdminDashboard,
  ProgramBuilder,
  CohortCoordinator,
  TeacherDashboard,
  AttendanceSheet,
  Gradebook,
} from "./components/AdminTeacherViews";
import {
  StudentPortal,
  StudentAssignments,
  FeeRegister,
} from "./components/StudentFinancialViews";
import { CertificateStudio, VerificationPortal } from "./components/CertificateVerification";
import AdminSystemSettings from "./components/AdminSystemSettings";
import AdminWebsiteSettings from "./components/AdminWebsiteSettings";
import ProfilePage from "./components/ProfilePage";
import RolesPermissions from "./components/RolesPermissions";
import PeopleManagement from "./components/PeopleManagement";
import QuizBuilder from "./components/quiz/QuizBuilder";
import StudentQuizzes from "./components/quiz/StudentQuizzes";
import AcademicPlanning from "./components/AcademicPlanning";
import AnnouncementManager from "./components/AnnouncementManager";
import BlogManager from "./components/portal/BlogManager";
import StudentPayments from "./components/portal/StudentPayments";
import PaymentsReview from "./components/portal/PaymentsReview";
import EmailOutboxPanel from "./components/portal/EmailOutboxPanel";

/** Everything a view's `visible`/`render` function needs, computed once per render. */
export interface PortalViewContext extends PermissionsApi {
  currentUser: User | null;
}

export interface PortalView {
  key: string;
  /** Static label, or computed from context (used by "dashboard" per role). */
  label: string | ((ctx: PortalViewContext) => string);
  icon: LucideIcon;
  visible: (ctx: PortalViewContext) => boolean;
  render: (ctx: PortalViewContext) => ReactNode;
}

function DashboardView({ role }: { role: Role | null }) {
  if (role === "Student") return <StudentPortal />;
  if (role === "Teacher") return <TeacherDashboard />;
  return <AdminDashboard />;
}

function AssignmentsView({ role }: { role: Role | null }) {
  return role === "Student" ? <StudentAssignments /> : <Gradebook />;
}

function QuizzesView({ role }: { role: Role | null }) {
  return role === "Student" ? <StudentQuizzes /> : <QuizBuilder />;
}

const QUIZ_PERMISSIONS: PermissionKey[] = [
  "quizzes.manage",
  "quizzes.manage_all",
  "quizzes.take",
  "quizzes.view_results",
];

/**
 * Single registry driving both the sidebar (Navigation.tsx) and the portal
 * router (App.tsx). Order here is the sidebar order. Each item is gated by
 * `visible`; `Portal` falls back to "dashboard" once the current view is
 * no longer visible (role switch, permission revoked, etc.).
 */
export const PORTAL_VIEWS: PortalView[] = [
  {
    key: "dashboard",
    label: (ctx) =>
      ctx.role === "Student" ? "My Portal" : ctx.role === "Teacher" ? "My Workspace" : "Dashboard",
    icon: LayoutDashboard,
    visible: () => true,
    render: (ctx) => <DashboardView role={ctx.role} />,
  },
  {
    key: "people",
    label: "Staff & Students",
    icon: Users,
    visible: (ctx) => ctx.canAny("people.view", "students.manage", "staff.manage"),
    render: () => <PeopleManagement />,
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    icon: ShieldCheck,
    visible: (ctx) => ctx.isSuperAdmin,
    render: () => <RolesPermissions />,
  },
  {
    key: "academic-planning",
    label: (ctx) => ctx.role === "Student" ? "My Course Plan" : ctx.role === "Teacher" ? "Course Planning" : "Academic Approvals",
    icon: CalendarRange,
    visible: (ctx) => ctx.canAny("courses.enroll", "academic_plans.manage", "academic_plans.approve"),
    render: () => <AcademicPlanning />,
  },
  {
    key: "quizzes",
    label: "Quizzes",
    icon: FileQuestion,
    visible: (ctx) => ctx.canAny(...QUIZ_PERMISSIONS),
    render: (ctx) => <QuizzesView role={ctx.role} />,
  },
  {
    key: "programs",
    label: "Program Builder",
    icon: BookOpen,
    visible: (ctx) => ctx.can("programs.manage"),
    render: () => <ProgramBuilder />,
  },
  {
    key: "cohorts",
    label: "Cohort Coordinator",
    icon: Boxes,
    visible: (ctx) => ctx.can("cohorts.manage"),
    render: () => <CohortCoordinator />,
  },
  {
    key: "attendance",
    label: "Attendance Sheet",
    icon: ClipboardCheck,
    visible: (ctx) => ctx.canAny("attendance.manage", "attendance.own"),
    render: () => <AttendanceSheet />,
  },
  {
    key: "assignments",
    label: (ctx) => (ctx.role === "Student" ? "Assignments" : "Gradebook"),
    icon: NotebookPen,
    visible: (ctx) => ctx.canAny("assignments.manage", "assignments.own") || ctx.role === "Student",
    render: (ctx) => <AssignmentsView role={ctx.role} />,
  },
  {
    key: "fees",
    label: (ctx) => (ctx.role === "Student" ? "Fees & Receipts" : "Finance Ledger"),
    icon: Banknote,
    visible: (ctx) => ctx.canAny("fees.view", "fees.manage") || ctx.role === "Student",
    render: () => <FeeRegister />,
  },
  {
    key: "payments",
    label: "Pay fees",
    icon: Smartphone,
    visible: (ctx) => ctx.can("payments.submit") && !ctx.can("payments.confirm"),
    render: () => <StudentPayments />,
  },
  {
    key: "payment-review",
    label: "Payment confirmations",
    icon: ClipboardCheck,
    visible: (ctx) => ctx.can("payments.confirm"),
    render: () => <PaymentsReview />,
  },
  {
    key: "certificates",
    label: (ctx) => (ctx.role === "Student" ? "My Certificates" : "Certificates"),
    icon: Award,
    visible: (ctx) => ctx.can("certificates.manage") || ctx.role === "Student",
    render: () => <CertificateStudio />,
  },
  {
    key: "verification",
    label: "Verification Hub",
    icon: ShieldQuestion,
    visible: () => true,
    render: () => <VerificationPortal />,
  },
  {
    key: "announcements",
    label: "Bulletin Board",
    icon: Megaphone,
    visible: () => true,
    render: () => <AnnouncementManager />,
  },
  {
    key: "blog",
    label: "Blog",
    icon: Newspaper,
    visible: (ctx) => ctx.can("blog.manage"),
    render: () => <BlogManager />,
  },
  {
    key: "website",
    label: "Website CMS",
    icon: Globe,
    visible: (ctx) => ctx.can("cms.manage"),
    render: () => <AdminWebsiteSettings />,
  },
  {
    key: "settings",
    label: "System Settings",
    icon: Settings,
    visible: (ctx) => ctx.can("settings.manage"),
    render: () => <AdminSystemSettings />,
  },
  {
    key: "email-outbox",
    label: "Email delivery",
    icon: Mail,
    visible: (ctx) => ctx.can("settings.manage"),
    render: () => <EmailOutboxPanel />,
  },
  {
    key: "profile",
    label: "My Profile",
    icon: UserCircle,
    visible: () => true,
    render: () => <ProfilePage />,
  },
];

export function usePortalViewContext(): PortalViewContext {
  const { currentUser } = useApp();
  const perms = usePermissions();
  return { ...perms, currentUser };
}

/** The sidebar/router list, filtered and ordered for the signed-in user. */
export function useVisiblePortalViews(): { ctx: PortalViewContext; views: PortalView[] } {
  const ctx = usePortalViewContext();
  const views = PORTAL_VIEWS.filter((v) => v.visible(ctx));
  return { ctx, views };
}

export function getPortalView(key: string): PortalView | undefined {
  return PORTAL_VIEWS.find((v) => v.key === key);
}

export function portalViewLabel(view: PortalView, ctx: PortalViewContext): string {
  return typeof view.label === "function" ? view.label(ctx) : view.label;
}
