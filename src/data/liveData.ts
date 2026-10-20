import { supabase } from "@/integrations/supabase/client";
import type {
  Announcement,
  AppState,
  AttendanceStatus,
  Certificate,
  Cohort,
  FeeTransaction,
  HomeSectionKey,
  PortalThemeSettings,
  Program,
  SystemSettings,
  User,
  WebsiteSettings,
} from "../types";
import { defaultSettings, defaultThemeSettings, defaultWebsiteSettings } from "./mockData";
import { CATALOG_2026 } from "./programCatalog2026";
import { programIsPublished, removeDemoPublicData } from "../lib/publicSiteData";
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
    accountNumber: p.account_number == null ? undefined : txt(p.account_number),
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

export function settingsRow(
  settings: SystemSettings,
  websiteSettings: WebsiteSettings,
  themeSettings: PortalThemeSettings,
) {
  return {
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
    theme_settings: themeSettings,
  };
}

function explainSettingsError(message: string): string {
  if (/column .* does not exist|schema cache|could not find the table/i.test(message)) {
    return "System settings are not fully configured in the database yet. Ask an administrator to apply the latest portal migration, then save again.";
  }
  if (/permission denied|row-level security|42501/i.test(message)) {
    return "You don't have permission to save these settings. Sign in as a Super Admin or School Admin.";
  }
  return message;
}

/**
 * Writes one settings patch to the singleton system_settings row.
 * Uses the existing row's real primary key without changing it. New rows use
 * the database's ID default. Reports a miss instead of pretending success.
 */
export async function persistSettingsPatch(patch: Record<string, unknown>): Promise<string | null> {
  const existing = await supabase.from("system_settings").select("id").limit(1).maybeSingle();
  if (existing.error) return explainSettingsError(existing.error.message);

  const writeExisting = async (rowId: unknown) => {
    const { data, error } = await supabase
      .from("system_settings")
      .update(patch)
      .eq("id", rowId)
      .select("id");
    if (error) return explainSettingsError(error.message);
    if (!data?.length) {
      return "Settings were not saved. Your account may not have permission to update system settings.";
    }
    return null;
  };

  const rowId = existing.data?.id;
  if (rowId !== undefined && rowId !== null) return writeExisting(rowId);

  const inserted = await supabase.from("system_settings").insert(patch).select("id");
  if (!inserted.error) {
    return inserted.data?.length ? null : "Settings were not saved. No settings row was returned.";
  }
  if (/duplicate key|unique/i.test(inserted.error.message)) {
    const retry = await supabase.from("system_settings").select("id").limit(1).maybeSingle();
    if (retry.data && retry.data.id !== undefined && retry.data.id !== null) {
      return writeExisting(retry.data.id);
    }
    return "A settings row exists but this account cannot update it. Sign in as a Super Admin or School Admin.";
  }
  return explainSettingsError(inserted.error.message);
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
  return removeDemoPublicData({
    ...merged,
    home: { ...merged.home, order: normalizeHomeOrder(merged.home.order, defaults.home.order) },
  });
}

/**
 * Deep-merges a saved `theme_settings` JSON blob onto the current defaults, so
 * adding a new appearance field never leaves it blank for portals that saved
 * their theme before the field existed.
 */
export function mergeThemeSettings(
  defaults: PortalThemeSettings,
  raw: unknown,
): PortalThemeSettings {
  return mergeObject(defaults as unknown as Record<string, unknown>, raw) as unknown as PortalThemeSettings;
}

function mapSettings(
  row: Row | null,
  fallback: SystemSettings,
  fallbackWebsite: WebsiteSettings,
  fallbackTheme: PortalThemeSettings,
): { settings: SystemSettings; websiteSettings: WebsiteSettings; themeSettings: PortalThemeSettings } {
  if (!row) return { settings: fallback, websiteSettings: fallbackWebsite, themeSettings: fallbackTheme };
  const raw = row.website_settings;
  const websiteSettings =
    raw && typeof raw === "object" && Object.keys(raw as object).length
      ? mergeWebsiteSettings(fallbackWebsite, raw)
      : fallbackWebsite;
  const rawTheme = row.theme_settings;
  const themeSettings =
    rawTheme && typeof rawTheme === "object" && Object.keys(rawTheme as object).length
      ? mergeThemeSettings(fallbackTheme, rawTheme)
      : fallbackTheme;
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
    themeSettings,
  };
}

export interface SettingsLoadStatus {
  /** A system_settings row was read. False means the CMS is still on local defaults. */
  configured: boolean;
  /** The row has a saved website_settings document, not just starter copy. */
  websitePublished: boolean;
  readError: string | null;
}

export interface FetchResult {
  state: AppState;
  /** Tables the current visitor could not read; their slices keep the previous values. */
  failed: string[];
  settingsStatus: SettingsLoadStatus;
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

  const moduleRows = (modules.data ?? []) as Row[];  const mappedPrograms: Program[] = ((programs.data ?? []) as Row[]).map((p) => ({
    id: txt(p.id),
    courseNumber: p.course_number == null ? undefined : txt(p.course_number),
    title: txt(p.title) || txt(p.name),
    published: programIsPublished(p),
    category: txt(p.category),
    durationWeeks: num(p, "duration_weeks"),
    tuition: num(p, "tuition"),
    certification: txt(p.certification),
    description: txt(p.description),
    entryRequirements: txt(p.entry_requirements),
    imageUrl: p.image_url ? txt(p.image_url) : undefined,
    deliveryModes: (Array.isArray(p.delivery_modes)
      ? (p.delivery_modes as string[])
      : typeof p.delivery_mode === "string"
        ? [p.delivery_mode]
        : []
    ).filter((m) => m === "online" || m === "blended" || m === "onsite") as Program["deliveryModes"],
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
    defaultThemeSettings,
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
    programs: mappedPrograms.length > 0 ? mappedPrograms : CATALOG_2026,
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
      status: c.status === "Valid" ? "Valid" : "Revoked",
      revokedAt: c.revoked_at ? txt(c.revoked_at) : undefined,
      revokedBy: c.revoked_by ? txt(c.revoked_by) : undefined,
      revocationReason: c.revocation_reason ? txt(c.revocation_reason) : undefined,
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
    themeSettings: settingsPair.themeSettings,
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
    state.themeSettings = previous.themeSettings;
  }

  const settingsRowData = (settings.data as Row | null) ?? null;
  const rawWebsite = settingsRowData?.website_settings;
  const settingsStatus: SettingsLoadStatus = {
    configured: !settings.error && Boolean(settingsRowData),
    websitePublished:
      !settings.error &&
      Boolean(rawWebsite) &&
      typeof rawWebsite === "object" &&
      Object.keys(rawWebsite as object).length > 0,
    readError: settings.error?.message ?? null,
  };
  if (bad("permissions")) state.permissionCatalogue = previous.permissionCatalogue;
  if (bad("role_permissions")) state.rolePermissions = previous.rolePermissions;

  return { state, failed, settingsStatus };
}
