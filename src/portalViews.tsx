import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Boxes,
  Award,
  ShieldQuestion,
  ShieldCheck,
  Scale,
  LibraryBig,
  Megaphone,
  ClipboardCheck,
  NotebookPen,
  Banknote,
  Settings,
  Globe,
  UserCircle,
  FileQuestion,
  CalendarRange,
  CalendarDays,
  GraduationCap,
  Gavel,
  Newspaper,
  Smartphone,
  Mail,
  Activity,
  TrendingUp,
  HeartHandshake,
  Briefcase,
  Inbox,
  LifeBuoy,
  ReceiptText,
  FolderOpen,
  FileText,
  Lightbulb,
  MessageSquare,
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
  GradeEvaluation,
} from "./components/AdminTeacherViews";
import {
  StudentPortal,
  StudentAssignments,
  FeeRegister,
} from "./components/StudentFinancialViews";
import { CertificateStudio, VerificationPortal } from "./components/CertificateVerification";
import AdminOpportunities from "./components/AdminOpportunities";
import AdminSystemSettings from "./components/AdminSystemSettings";
import AdminWebsiteSettings from "./components/AdminWebsiteSettings";
import ProfilePage from "./components/ProfilePage";
import RolesPermissions from "./components/RolesPermissions";
import PeopleManagement from "./components/PeopleManagement";
import QuizBuilder from "./components/quiz/QuizBuilder";
import StudentQuizzes from "./components/quiz/StudentQuizzes";
import AcademicPlanning from "./components/AcademicPlanning";
import AnnouncementManager from "./components/AnnouncementManager";
import MessagingWorkspace from "./components/messaging/MessagingWorkspace";
import BlogManager from "./components/portal/BlogManager";
import SchoolPolicies from "./components/policies/SchoolPolicies";
import RecommendedTraining from "./components/portal/RecommendedTraining";
import StudentPayments from "./components/portal/StudentPayments";
import PaymentsReview from "./components/portal/PaymentsReview";
import EmailOutboxPanel from "./components/portal/EmailOutboxPanel";
import EngagementInbox from "./components/portal/EngagementInbox";
import OperationsHub from "./components/OperationsHub";
import CoursePlayer from "./components/academic/CoursePlayer";
import StudentCalendar from "./components/academic/StudentCalendar";
import StudyPlanner from "./components/academic/StudyPlanner";
import AssignmentInbox from "./components/academic/AssignmentInbox";
import CompletionCertificates from "./components/academic/CompletionCertificates";
import TeacherInsights from "./components/academic/TeacherInsights";
import TransparencyLibrary from "./components/public/TransparencyLibrary";
import Helpdesk from "./components/portal/Helpdesk";
import GradeAppeals from "./components/portal/GradeAppeals";
import TermReportCards from "./components/academic/TermReportCards";
import CohortTimetable from "./components/academic/CohortTimetable";
import ReferenceLetters from "./components/portal/ReferenceLetters";
import EntranceTest from "./components/portal/EntranceTest";
import EntranceTestAdmin from "./components/admin/EntranceTestAdmin";
import EntrancePrepPack from "./components/public/EntrancePrepPack";
import DonatePage from "./components/public/DonatePage";

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

function HubTabs({ tabs, initial }: { tabs: { key: string; label: string }[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Section">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => setActive(t.key)}
          className={active === t.key ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}
        >
          {t.label}
        </button>
      ))}
      <span className="hidden" data-hub-active={active} />
    </div>
  );
}

function AptitudeControlHub({ ctx }: { ctx: PortalViewContext }) {
  const [tab, setTab] = useState<"control" | "test" | "prep">("control");
  if (ctx.role === "Student") {
    return (
      <div className="space-y-8">
        <section aria-label="My entrance result"><EntranceTest /></section>
        <section aria-label="Entrance preparation pack">
          <h2 className="mb-3 text-lg font-bold text-emerald-950">Entrance prep pack — how to get ready</h2>
          <EntrancePrepPack />
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Aptitude Control sections">
        {([ ["control", "Aptitude Test Control"], ["test", "Test Preview"], ["prep", "Test Samples"] ] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={tab === k ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>{label}</button>
        ))}
      </div>
      {tab === "control" ? <EntranceTestAdmin /> : tab === "test" ? <EntranceTest /> : <EntrancePrepPack />}
    </div>
  );
}

function HelpdeskHub({ ctx }: { ctx: PortalViewContext }) {
  const [tab, setTab] = useState<"tickets" | "letters">("tickets");
  const canReview = !!ctx.currentUser && ctx.role !== "Student" && (ctx.can("helpdesk.manage") || ctx.can("students.manage"));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Student helpdesk sections">
        <button type="button" role="tab" aria-selected={tab === "tickets"} onClick={() => setTab("tickets")} className={tab === "tickets" ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>Helpdesk tickets</button>
        <button type="button" role="tab" aria-selected={tab === "letters"} onClick={() => setTab("letters")} className={tab === "letters" ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>Reference letters</button>
      </div>
      {tab === "tickets" ? <Helpdesk key={`${ctx.currentUser?.id}:${ctx.role}`} /> : <ReferenceLetters key={`ref-${ctx.currentUser?.id}`} canReview={canReview} />}
    </div>
  );
}

function BulletinHub({ ctx }: { ctx: PortalViewContext }) {
  const [tab, setTab] = useState<"board" | "reports">("board");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bulletin Board sections">
        <button type="button" role="tab" aria-selected={tab === "board"} onClick={() => setTab("board")} className={tab === "board" ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>Announcements</button>
        <button type="button" role="tab" aria-selected={tab === "reports"} onClick={() => setTab("reports")} className={tab === "reports" ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>Transparency reports</button>
      </div>
      {tab === "board" ? <AnnouncementManager /> : <TransparencyLibrary key={ctx.currentUser?.id} management={ctx.can("cms.manage")} />}
    </div>
  );
}

function PeopleHub({ ctx }: { ctx: PortalViewContext }) {
  const [tab, setTab] = useState<"directory" | "roles">("directory");
  if (!ctx.isSuperAdmin) return <PeopleManagement />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Staff and Students sections">
        <button type="button" role="tab" aria-selected={tab === "directory"} onClick={() => setTab("directory")} className={tab === "directory" ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>Directory</button>
        <button type="button" role="tab" aria-selected={tab === "roles"} onClick={() => setTab("roles")} className={tab === "roles" ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white" : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"}>Roles &amp; Permissions</button>
      </div>
      {tab === "directory" ? <PeopleManagement /> : <RolesPermissions />}
    </div>
  );
}

function DashboardView({ role }: { role: Role | null }) {
  if (role === "Student") return <StudentPortal />;
  if (role === "Teacher") return <TeacherDashboard />;
  if (role === "Admission Officer") return <PeopleManagement initialTab="applicants" />;
  if (role === "Customer Care Officer") return <Helpdesk key="dashboard-helpdesk" />;
  if (role === "Data Entry Officer") return <PeopleManagement />;
  if (role === "Public Relations Officer") return <AdminWebsiteSettings />;
  return <AdminDashboard />;
}

function AssignmentsView() {
  return <AssignmentInbox />;
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
    key: "messages",
    label: "Messages",
    icon: MessageSquare,
    visible: (ctx) => ctx.isSignedIn,
    render: () => <MessagingWorkspace />,
  },
  {
    key: "people",
    label: "Staff & Students",
    icon: Users,
    visible: (ctx) => ctx.canAny("people.view", "students.manage", "staff.manage"),
    render: (ctx) => <PeopleHub ctx={ctx} />,
  },
  {
    key: "admissions-inbox",
    label: "Admissions & Support",
    icon: Inbox,
    visible: (ctx) => ctx.canAny("students.manage", "fees.manage"),
    render: () => <EngagementInbox />,
  },
  {
    key: "academic-planning",
    label: (ctx) => ctx.role === "Student" ? "My Course Plan" : ctx.role === "Teacher" ? "Course Planning" : "Academic Approvals",
    icon: CalendarRange,
    visible: (ctx) => ctx.canAny("courses.enroll", "academic_plans.manage", "academic_plans.approve"),
    render: () => <AcademicPlanning />,
  },
  {
    key: "course-player",
    label: (ctx) => (ctx.role === "Student" ? "My Courses" : "Course Player"),
    icon: GraduationCap,
    visible: (ctx) => ctx.canAny("courses.enroll", "academic_plans.manage", "academic_plans.approve", "lessons.manage"),
    render: () => <CoursePlayer />,
  },
  {
    key: "helpdesk",
    label: "Student helpdesk",
    icon: LifeBuoy,
    visible: (ctx) => ctx.isSignedIn && (ctx.role === "Student" || ctx.can("helpdesk.manage")),
    render: (ctx) => <HelpdeskHub ctx={ctx} />,
  },
  {
    key: "grade-appeals",
    label: (ctx) => (ctx.role === "Student" ? "Grade appeals" : "Appeal & remark desk"),
    icon: Gavel,
    visible: (ctx) => ctx.isSignedIn && (ctx.role === "Student" || ctx.can("grades.review_appeals")),
    render: (ctx) => <GradeAppeals key={`${ctx.currentUser?.id}:${ctx.role}`} />,
  },
  {
    key: "entrance-control",
    label: (ctx) => (ctx.role === "Student" ? "My entrance result" : "Aptitude Control"),
    icon: ShieldCheck,
    visible: (ctx) => ctx.isSignedIn && (ctx.role === "Student" || ctx.canAny("students.manage", "quizzes.manage_all", "quizzes.view_results", "aptitude.manage")),
    render: (ctx) => <AptitudeControlHub ctx={ctx} />,
  },
  {
    key: "study-calendar",
    label: "Study Calendar",
    icon: CalendarDays,
    visible: (ctx) => ctx.isSignedIn,
    render: () => <StudentCalendar />,
  },
  {
    key: "study-plan",
    label: "My Study Plan",
    icon: CalendarRange,
    visible: (ctx) => ctx.role === "Student",
    render: () => <StudyPlanner />,
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
    key: "insights",
    label: "Progress Insights",
    icon: TrendingUp,
    visible: (ctx) =>
      ctx.canAny("reports.manage", "grades.manage", "attendance.manage", "academic_plans.manage", "academic_plans.approve") ||
      ctx.role === "Teacher" ||
      ctx.role === "School Admin" ||
      ctx.role === "Super Admin" ||
      ctx.role === "Director of Education" ||
      ctx.role === "Research Officer",
    render: () => <TeacherInsights />,
  },
  {
    key: "assignments",
    label: (ctx) => (ctx.role === "Student" ? "Assignments" : "Grade Evaluation"),
    icon: NotebookPen,
    visible: (ctx) => ctx.canAny("assignments.manage", "assignments.own") || ctx.role === "Student",
    render: (ctx) => (ctx.role === "Student" ? <AssignmentsView /> : <GradeEvaluation />),
  },
  {
    key: "timetable",
    label: "Timetable",
    icon: CalendarDays,
    visible: (ctx) => ctx.role === "Student" || ctx.canAny("timetable.manage", "cohorts.manage", "attendance.manage", "attendance.own", "programs.manage", "academic_plans.manage"),
    render: () => <CohortTimetable />,
  },
  {
    key: "report-cards",
    label: (ctx) => (ctx.role === "Student" ? "My Report Card" : "Report Cards"),
    icon: Award,
    visible: (ctx) => ctx.canAny("assignments.manage", "assignments.own", "reports.manage", "grades.manage") || ctx.role === "Student",
    render: () => <TermReportCards />,
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
    icon: ReceiptText,
    visible: (ctx) => ctx.can("payments.confirm"),
    render: () => <PaymentsReview />,
  },
  {
    key: "donate",
    label: "Donate",
    icon: HeartHandshake,
    visible: (ctx) => ctx.isSignedIn,
    render: () => <DonatePage onLogin={() => window.dispatchEvent(new Event("aoh-open-donate"))} />,
  },
  {
    key: "certificates",
    label: (ctx) => (ctx.role === "Student" ? "My Certificates" : "Certificates"),
    icon: Award,
    visible: (ctx) => ctx.can("certificates.manage") || ctx.role === "Student",
    render: (ctx) => (ctx.role === "Student" ? <CompletionCertificates /> : <CertificateStudio />),
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
    render: (ctx) => <BulletinHub ctx={ctx} />,
  },
  {
    key: "blog",
    label: "Blog",
    icon: Newspaper,
    visible: (ctx) => ctx.can("blog.manage"),
    render: () => <BlogManager />,
  },
  {
    key: "policies",
    label: "School Policies",
    icon: Scale,
    visible: () => true,
    render: () => <SchoolPolicies />,
  },
  {
    key: "training-library",
    label: "Training Library",
    icon: LibraryBig,
    visible: (ctx) => ctx.canAny("materials.manage", "materials.approve", "lessons.manage", "courses.enroll", "library.manage"),
    render: () => <RecommendedTraining />,
  },
  {
    key: "opportunities",
    label: "Vacancies & Businesses",
    icon: Briefcase,
    visible: (ctx) => ctx.canAny("cms.manage", "transparency.manage", "donations.manage"),
    render: () => <AdminOpportunities />,
  },
  {
    key: "website",
    label: "Website CMS",
    icon: Globe,
    visible: (ctx) => ctx.canAny("cms.manage", "blog.manage", "transparency.manage", "policies.manage", "impact.manage", "campus.manage", "donations.manage"),
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
    key: "my-files",
    label: "My files",
    icon: FolderOpen,
    visible: () => true,
    render: () => <OperationsHub personalOnly />,
  },
  {
    key: "operations",
    label: "Operations Centre",
    icon: Activity,
    visible: (ctx) => ctx.canAny("settings.manage", "materials.approve", "operations.manage"),
    render: () => <OperationsHub />,
  },
  {
    key: "email-outbox",
    label: "Email delivery",
    icon: Mail,
    visible: (ctx) => ctx.canAny("settings.manage", "email.manage"),
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

/**
 * Relevance order for the sidebar nav (most-used first, system last).
 * Dashboard stays first, My Profile stays last. `useVisiblePortalViews` sorts
 * the filtered views by this list so the drawer reads in workflow order:
 * administration (people, admissions, cohorts) → learning → money →
 * support/comms → system. Staff see their daily management tools first;
 * students only see the learning subset, already in journey order.
 */
const NAV_RELEVANCE_ORDER = [
  "dashboard",
  "messages",
  "people",
  "admissions-inbox",
  "cohorts",
  "programs",
  "attendance",
  "insights",
  "course-player",
  "academic-planning",
  "study-plan",
  "study-calendar",
  "assignments",
  "quizzes",
  "training-library",
  "entrance-control",
  "fees",
  "payments",
  "payment-review",
  "certificates",
  "verification",
  "announcements",
  "helpdesk",
  "grade-appeals",
  "policies",
  "blog",
  "opportunities",
  "donate",
  "my-files",
  "operations",
  "website",
  "email-outbox",
  "settings",
  "profile",
];

export const NAV_RELEVANCE_RANK = new Map(NAV_RELEVANCE_ORDER.map((key, i) => [key, i]));

/** The sidebar/router list, filtered and ordered for the signed-in user. */
export function useVisiblePortalViews(): { ctx: PortalViewContext; views: PortalView[] } {
  const ctx = usePortalViewContext();
  const views = PORTAL_VIEWS.filter((v) => v.visible(ctx)).sort((a, b) => {
    const ra = NAV_RELEVANCE_RANK.get(a.key) ?? 999;
    const rb = NAV_RELEVANCE_RANK.get(b.key) ?? 999;
    return ra - rb;
  });
  return { ctx, views };
}

export function getPortalView(key: string): PortalView | undefined {
  return PORTAL_VIEWS.find((v) => v.key === key);
}

export function portalViewLabel(view: PortalView, ctx: PortalViewContext): string {
  return typeof view.label === "function" ? view.label(ctx) : view.label;
}

/**
 * Sidebar categories for the portal nav. Each group renders as an
 * expandable dropdown so every visible module is reachable in one tap.
 * Keys must cover every PORTAL_VIEWS key; unknown keys fall into "More".
 */
export const PORTAL_NAV_GROUPS: { id: string; label: string; keys: string[] }[] = [
  { id: "overview", label: "Overview", keys: ["dashboard", "messages", "insights"] },
  {
    id: "administration",
    label: "Administration",
    keys: ["people", "admissions-inbox", "cohorts", "programs", "attendance", "entrance-control"],
  },
  {
    id: "learning",
    label: "Academics",
    keys: [
      "course-player",
      "academic-planning",
      "study-plan",
      "study-calendar",
      "assignments",
      "quizzes",
      "training-library",
      "timetable",
      "report-cards",
    ],
  },
  {
    id: "finance",
    label: "Finance & Records",
    keys: ["fees", "payments", "payment-review", "certificates", "verification"],
  },
  {
    id: "community",
    label: "Support & Community",
    keys: ["announcements", "helpdesk", "grade-appeals", "policies", "blog", "opportunities", "donate"],
  },
  {
    id: "system",
    label: "System & Resources",
    keys: ["my-files", "operations", "website", "email-outbox", "settings", "profile"],
  },
];
