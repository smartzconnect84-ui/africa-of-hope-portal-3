import { supabase } from "@/integrations/supabase/client";
import type {
  Announcement,
  AppState,
  AttendanceStatus,
  Certificate,
  Cohort,
  FeeTransaction,
  HomeSectionKey,
  Program,
  SystemSettings,
  User,
  WebsiteSettings,
} from "../types";
import { defaultSettings, defaultWebsiteSettings } from "./mockData";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type PermissionKey } from "../lib/permissions";

export type Row = Record<string, unknown>;

export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);

const txt = (v: unknown, fallback = "") => (v === null || v === undefined ? fallback : String(v));
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const num = (p: Row, key: string, fallback = 0) => {
  const v = p[key];
  return v === null || v === undefined ? fallback : Number(v);
};
const flag = (p: Row, key: string, fallback: boolean) =>
  typeof p[key] === "boolean" ? (p[key] as boolean) : fallback;

function mapUser(p: Row, cohortIds: string[]): User {
  return {
    id: txt(p.id),
    name: txt(p.name) || txt(p.full_name) || txt(p.email) || "Unnamed member",
    email: txt(p.email),
    phone: txt(p.phone),
    role: (txt(p.role, "Student") as User["role"]) || "Student",
    status: (txt(p.status, "Pending Approval") as User["status"]) || "Pending Approval",
    joinedDate: txt(p.joined_date, today()).slice(0, 10),
    title: p.title ? txt(p.title) : undefined,
    programIds: ids(p.program_ids),
    cohortIds,
    note: p.note ? txt(p.note) : undefined,
    documents: p.documents ? txt(p.documents) : undefined,
    avatarUrl: p.avatar_url ? txt(p.avatar_url) : undefined,
    bio: p.bio ? txt(p.bio) : undefined,
    address: p.address ? txt(p.address) : undefined,
    dateOfBirth: p.date_of_birth ? txt(p.date_of_birth).slice(0, 10) : undefined,
  };
}

export function settingsRow(settings: SystemSettings, websiteSettings: WebsiteSettings) {
  return {
    id: true,
    academy_name: settings.academyName,
    motto: settings.motto,
    contact_email: settings.contactEmail,
    contact_phone: settings.contactPhone,
    address: settings.address,
    accreditation_no: settings.accreditationNo,
    currency: settings.currency,
    academic_year: settings.academicYear,
    semester: settings.semester,
    self_registration_open: settings.selfRegistrationOpen,
    student_id_prefix: settings.studentIdPrefix,
    pass_mark: settings.passMark,
    min_attendance: settings.minAttendance,
    site_published: settings.sitePublished,
    marketing_banner: settings.marketingBanner,
    intake_status: settings.intakeStatus,
    featured_program_ids: settings.featuredProgramIds,
    assistant_enabled: settings.assistantEnabled,
    website_settings: websiteSettings,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeObject<T extends Record<string, unknown>>(defaults: T, raw: unknown): T {
  if (!isPlainObject(raw)) return defaults;
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    const rawValue = raw[key];
    if (rawValue === undefined) continue;
    if (Array.isArray(defaultValue)) {
      // A saved array wins even when empty, so deletes made in the CMS stick.
      out[key] = Array.isArray(rawValue) ? rawValue : defaultValue;
    } else if (isPlainObject(defaultValue)) {
      out[key] = mergeObject(defaultValue as Record<string, unknown>, rawValue);
    } else {
      out[key] = rawValue;
    }
  }
  return out as T;
}

/**
 * A saved `home.order` array wins as-is (see `mergeObject` above), so a site
 * that saved its section order before a new homepage section was registered
 * (e.g. "summary") would otherwise never see that section in the CMS reorder
 * list or on the public site. Append any registry key missing from the saved
 * order — "summary" goes first since it's meant to lead the page — so both
 * AdminWebsiteSettings and PublicMarketingSite can treat `home.order` as
 * always-complete and never special-case a missing key.
 */
function normalizeHomeOrder(order: HomeSectionKey[], knownOrder: HomeSectionKey[]): HomeSectionKey[] {
  const present = new Set(order);
  const missing = knownOrder.filter((key) => !present.has(key));
  if (missing.length === 0) return order;
  const rest = missing.filter((key) => key !== "summary");
  return missing.includes("summary") ? ["summary", ...order, ...rest] : [...order, ...rest];
}

/**
 * Deep-merges a saved `website_settings` JSON blob onto the current defaults,
 * so adding a new CMS field (or renaming an old one's defaults) never leaves a
 * section blank for sites that saved before the field existed. `data:` image
 * URLs saved by the old ImageBox still render — they're just strings here.
 */
export function mergeWebsiteSettings(
  defaults: WebsiteSettings,
  raw: unknown,
): WebsiteSettings {
  const merged = mergeObject(defaults as unknown as Record<string, unknown>, raw) as unknown as WebsiteSettings;
  return {
    ...merged,
    home: { ...merged.home, order: normalizeHomeOrder(merged.home.order, defaults.home.order) },
  };
}

function mapSettings(
  row: Row | null,
  fallback: SystemSettings,
  fallbackWebsite: WebsiteSettings,
): { settings: SystemSettings; websiteSettings: WebsiteSettings } {
  if (!row) return { settings: fallback, websiteSettings: fallbackWebsite };
  const raw = row.website_settings;
  const websiteSettings =
    raw && typeof raw === "object" && Object.keys(raw as object).length
      ? mergeWebsiteSettings(fallbackWebsite, raw)
      : fallbackWebsite;
  return {
    settings: {
      academyName: txt(row.academy_name, fallback.academyName),
      motto: txt(row.motto, fallback.motto),
      contactEmail: txt(row.contact_email, fallback.contactEmail),
      contactPhone: txt(row.contact_phone, fallback.contactPhone),
      address: txt(row.address, fallback.address),
      accreditationNo: txt(row.accreditation_no, fallback.accreditationNo),
      currency: txt(row.currency, fallback.currency),
      academicYear: txt(row.academic_year, fallback.academicYear),
      semester: txt(row.semester, fallback.semester),
      selfRegistrationOpen: flag(row, "self_registration_open", fallback.selfRegistrationOpen),
      studentIdPrefix: txt(row.student_id_prefix, fallback.studentIdPrefix),
      passMark: num(row, "pass_mark", fallback.passMark),
      minAttendance: num(row, "min_attendance", fallback.minAttendance),
      sitePublished: flag(row, "site_published", fallback.sitePublished),
      marketingBanner: txt(row.marketing_banner, fallback.marketingBanner),
      intakeStatus: txt(row.intake_status, fallback.intakeStatus),
      featuredProgramIds: ids(row.featured_program_ids),
      assistantEnabled: flag(row, "assistant_enabled", fallback.assistantEnabled),
    },
    websiteSettings,
  };
}

export interface FetchResult {
  state: AppState;
  /** Tables the current visitor could not read; their slices keep the previous values. */
  failed: string[];
}

/**
 * Reads every portal table and maps the snake_case rows onto the app model.
 * One unreadable table (for example a permission error for anonymous visitors)
 * no longer discards everything else: its slice keeps the previous value.
 * Throws only when no table could be read at all.
 */
export async function fetchState(previous: AppState): Promise<FetchResult> {
  const [
    profiles,
    programs,
    modules,
    cohorts,
    links,
    attendance,
    assignments,
    submissions,
    fees,
    certificates,
    announcements,
    settings,
    permissionsRows,
    rolePermissionRows,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("programs").select("*").order("created_at", { ascending: true }),
    supabase.from("program_modules").select("*"),
    supabase.from("cohorts").select("*").order("created_at", { ascending: true }),
    supabase.from("cohort_students").select("*"),
    supabase.from("attendance").select("*"),
    supabase.from("assignments").select("*"),
    supabase.from("submissions").select("*"),
    supabase.from("fee_transactions").select("*"),
    supabase.from("certificates").select("*"),
    supabase.from("announcements").select("*").order("published_date", { ascending: false }),
    supabase.from("system_settings").select("*").limit(1).maybeSingle(),
    supabase.from("permissions").select("*"),
    supabase.from("role_permissions").select("*"),
  ]);

  const results = {
    profiles,
    programs,
    program_modules: modules,
    cohorts,
    cohort_students: links,
    attendance,
    assignments,
    submissions,
    fee_transactions: fees,
    certificates,
    announcements,
    system_settings: settings,
    permissions: permissionsRows,
    role_permissions: rolePermissionRows,
  };
  const failed = Object.entries(results)
    .filter(([, res]) => res.error)
    .map(([table]) => table);
  if (failed.length === Object.keys(results).length) {
    throw new Error(settings.error?.message ?? "No portal data could be read");
  }
  const bad = (...tables: (keyof typeof results)[]) => tables.some((t) => results[t].error);

  const linkRows = (links.data ?? []) as Row[];
  const users = ((profiles.data ?? []) as Row[]).map((p) =>
    mapUser(
      p,
      linkRows
        .filter((l) => txt(l.student_id) === txt(p.id))
        .map((l) => txt(l.cohort_id)),
    ),
  );

  const moduleRows = (modules.data ?? []) as Row[];
  const mappedPrograms: Program[] = ((programs.data ?? []) as Row[]).map((p) => ({
    id: txt(p.id),
    title: txt(p.title),
    category: txt(p.category),
    durationWeeks: num(p, "duration_weeks"),
    tuition: num(p, "tuition"),
    certification: txt(p.certification),
    description: txt(p.description),
    entryRequirements: txt(p.entry_requirements),
    imageUrl: p.image_url ? txt(p.image_url) : undefined,
    modules: moduleRows
      .filter((m) => txt(m.program_id) === txt(p.id))
      .sort((a, b) => num(a, "position") - num(b, "position"))
      .map((m) => ({
        id: txt(m.id),
        title: txt(m.title),
        weeks: num(m, "weeks", 1),
        summary: txt(m.summary),
      })),
  }));

  const mappedCohorts: Cohort[] = ((cohorts.data ?? []) as Row[]).map((c) => ({
    id: txt(c.id),
    name: txt(c.name),
    programId: txt(c.program_id),
    teacherId: txt(c.teacher_id),
    startDate: txt(c.start_date).slice(0, 10),
    endDate: txt(c.end_date).slice(0, 10),
    room: txt(c.room),
    studentIds: linkRows.filter((l) => txt(l.cohort_id) === txt(c.id)).map((l) => txt(l.student_id)),
  }));

  const settingsPair = mapSettings(
    (settings.data as Row | null) ?? null,
    defaultSettings,
    defaultWebsiteSettings,
  );

  const permissionCatalogue = ((permissionsRows.data ?? []) as Row[]).length
    ? ((permissionsRows.data ?? []) as Row[])
        .map((p) => ({
          key: txt(p.key),
          group: txt(p.grp),
          label: txt(p.label),
          description: txt(p.description),
          sort: num(p, "sort"),
        }))
        .sort((a, b) => a.sort - b.sort)
    : PERMISSIONS;

  const rolePermissionData = (rolePermissionRows.data ?? []) as Row[];
  const rolePermissions: Record<string, string[]> = rolePermissionData.length
    ? rolePermissionData.reduce<Record<string, string[]>>((acc, row) => {
        const role = txt(row.role);
        const permission = txt(row.permission);
        if (!role || !permission) return acc;
        (acc[role] ??= []).push(permission);
        return acc;
      }, {})
    : (DEFAULT_ROLE_PERMISSIONS as unknown as Record<string, PermissionKey[]>);

  const state: AppState = {
    users,
    programs: mappedPrograms,
    cohorts: mappedCohorts,
    attendance: ((attendance.data ?? []) as Row[]).map((a) => ({
      id: txt(a.id),
      cohortId: txt(a.cohort_id),
      studentId: txt(a.student_id),
      date: txt(a.attendance_date).slice(0, 10),
      status: (txt(a.status, "Present") as AttendanceStatus) || "Present",
    })),
    assignments: ((assignments.data ?? []) as Row[]).map((a) => ({
      id: txt(a.id),
      cohortId: txt(a.cohort_id),
      title: txt(a.title),
      dueDate: txt(a.due_date).slice(0, 10),
      maxMarks: num(a, "max_marks", 100),
      description: txt(a.description),
      timeLimitMinutes: a.time_limit_minutes === null || a.time_limit_minutes === undefined ? null : Number(a.time_limit_minutes),
    })),
    submissions: ((submissions.data ?? []) as Row[]).map((s) => ({
      id: txt(s.id),
      assignmentId: txt(s.assignment_id),
      studentId: txt(s.student_id),
      submittedAt: s.submitted_at ? txt(s.submitted_at) : null,
      marks: s.marks === null || s.marks === undefined ? null : Number(s.marks),
      feedback: txt(s.feedback),
      status: (txt(s.status, "Missing") as "In Progress" | "Submitted" | "Graded" | "Missing") || "Missing",
      responseText: txt(s.response_text),
      attachmentPath: s.attachment_path ? txt(s.attachment_path) : null,
      startedAt: s.started_at ? txt(s.started_at) : null,
      isLate: Boolean(s.is_late),
      timeSpentSeconds: s.time_spent_seconds === null || s.time_spent_seconds === undefined ? null : Number(s.time_spent_seconds),
    })),
    fees: ((fees.data ?? []) as Row[]).map((f) => ({
      id: txt(f.id),
      studentId: txt(f.student_id),
      category: (txt(f.category, "Tuition") as FeeTransaction["category"]) || "Tuition",
      amount: num(f, "amount"),
      date: txt(f.transaction_date).slice(0, 10),
      method: txt(f.method),
      reference: txt(f.reference),
    })),
    certificates: ((certificates.data ?? []) as Row[]).map((c) => ({
      id: txt(c.id),
      studentId: txt(c.student_id),
      programId: txt(c.program_id),
      serial: txt(c.serial),
      issueDate: txt(c.issue_date).slice(0, 10),
      honors: txt(c.honors),
      grade: txt(c.grade),
      status: (txt(c.status, "Valid") as Certificate["status"]) || "Valid",
    })),
    announcements: ((announcements.data ?? []) as Row[]).map((a) => ({
      id: txt(a.id),
      title: txt(a.title),
      body: txt(a.body),
      category: (txt(a.category, "Academic") as Announcement["category"]) || "Academic",
      date: txt(a.published_date).slice(0, 10),
      author: txt(a.author_name),
      status: (txt(a.status, "published") as Announcement["status"]) || "published",
      audience: (txt(a.audience, "all") as Announcement["audience"]) || "all",
      scheduledAt: a.scheduled_at ? txt(a.scheduled_at) : null,
      expiresAt: a.expires_at ? txt(a.expires_at) : null,
      publishedAt: a.published_at ? txt(a.published_at) : null,
    })),
    settings: settingsPair.settings,
    websiteSettings: settingsPair.websiteSettings,
    rolePermissions,
    permissionCatalogue,
  };

  // Never replace real data with empty or default values because one read failed.
  // This also stops an admin save from overwriting settings with defaults.
  if (bad("profiles", "cohort_students")) state.users = previous.users;
  if (bad("programs", "program_modules")) state.programs = previous.programs;
  if (bad("cohorts", "cohort_students")) state.cohorts = previous.cohorts;
  if (bad("attendance")) state.attendance = previous.attendance;
  if (bad("assignments")) state.assignments = previous.assignments;
  if (bad("submissions")) state.submissions = previous.submissions;
  if (bad("fee_transactions")) state.fees = previous.fees;
  if (bad("certificates")) state.certificates = previous.certificates;
  if (bad("announcements")) state.announcements = previous.announcements;
  if (bad("system_settings")) {
    state.settings = previous.settings;
    state.websiteSettings = previous.websiteSettings;
  }
  if (bad("permissions")) state.permissionCatalogue = previous.permissionCatalogue;
  if (bad("role_permissions")) state.rolePermissions = previous.rolePermissions;

  return { state, failed };
}
