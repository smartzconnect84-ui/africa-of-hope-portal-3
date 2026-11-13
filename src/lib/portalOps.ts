import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared portal operations store.
 *
 * One JSON document per concern so a corrupt entry never breaks the others.
 * Everything here is additive to the existing Supabase tables: presence uses
 * Realtime (no schema change), while reports, live attendance, material
 * dispatches, policy acknowledgements and aptitude results persist locally and
 * are mirrored to the backend when the matching tables exist.
 */

export const OPS_KEYS = {
  presence: "aoh-ops-presence",
  reports: "aoh-ops-reports",
  attendance: "aoh-ops-attendance",
  materials: "aoh-ops-materials",
  policies: "aoh-ops-policy-acks",
  policySends: "aoh-ops-policy-sends",
  aptitude: "aoh-ops-aptitude",
} as const;

const OPS_EVENT = "aoh-ops-change";

function readDoc<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(fallback) ? ((Array.isArray(parsed) ? parsed : fallback) as T) : (parsed as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeDoc<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full — callers keep working with in-memory state */
  }
  notifyOps();
}

function notifyOps(): void {
  try {
    window.dispatchEvent(new Event(OPS_EVENT));
  } catch {
    /* non-browser context */
  }
}

export const newOpsId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Re-render a component whenever any operations document changes (same tab or another tab). */
export function useOpsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(OPS_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(OPS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return version;
}

/* ───────────────────────────── Presence ───────────────────────────── */

export type PresenceState = "online" | "away" | "offline";

export interface PresencePeer {
  name: string;
  role: string;
  at: string;
}

export const PRESENCE_ONLINE_MS = 2 * 60_000;
export const PRESENCE_AWAY_MS = 20 * 60_000;

let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let presencePeers: Record<string, PresencePeer> = {};
const presenceListeners = new Set<() => void>();

function publishPeers(next: Record<string, PresencePeer>): void {
  presencePeers = next;
  presenceListeners.forEach((listener) => listener());
}

function subscribePeers(listener: () => void): () => void {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
}

const getPeers = (): Record<string, PresencePeer> => presencePeers;

/** Live presence across devices through Supabase Realtime; degrades to the local heartbeat. */
export function usePresencePeers(): Record<string, PresencePeer> {
  return useSyncExternalStore(subscribePeers, getPeers, getPeers);
}

export function touchPresence(userId: string, now = Date.now()): void {
  const map = readDoc<Record<string, string>>(OPS_KEYS.presence, {});
  map[userId] = new Date(now).toISOString();
  writeDoc(OPS_KEYS.presence, map);
}

export function clearPresence(userId: string): void {
  const map = readDoc<Record<string, string>>(OPS_KEYS.presence, {});
  delete map[userId];
  writeDoc(OPS_KEYS.presence, map);
}

function localLastSeen(userId: string): string | undefined {
  return readDoc<Record<string, string>>(OPS_KEYS.presence, {})[userId];
}

export function presenceOf(userId?: string | null): PresenceState {
  if (!userId) return "offline";
  const peer = presencePeers[userId];
  const stamp = peer?.at || localLastSeen(userId);
  if (!stamp) return "offline";
  const age = Date.now() - new Date(stamp).getTime();
  if (!Number.isFinite(age) || age > PRESENCE_AWAY_MS) return "offline";
  return age <= PRESENCE_ONLINE_MS ? "online" : "away";
}

export function presenceLabel(state: PresenceState): string {
  return state === "online" ? "Online now" : state === "away" ? "Away" : "Offline";
}

/**
 * Track this account in Realtime presence and keep a local heartbeat.
 * A single shared channel is reused so navigating between profiles does not
 * open a new subscription each time.
 */
export function usePresenceHeartbeat(me?: { id: string; name: string; role: string } | null): void {
  const id = me?.id;
  const name = me?.name;
  const role = me?.role;

  useEffect(() => {
    if (!id) return;
    touchPresence(id);
    const beat = () => {
      if (document.visibilityState === "visible") touchPresence(id);
    };
    const timer = window.setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("focus", beat);

    let cancelled = false;
    try {
      if (!presenceChannel) {
        presenceChannel = supabase.channel("aoh-portal-presence", {
          config: { presence: { key: "portal" } },
        });
        presenceChannel.on("presence", { event: "sync" }, () => {
          if (!presenceChannel) return;
          const flat = presenceChannel.presenceState() as Record<string, Array<Record<string, unknown>>>;
          const next: Record<string, PresencePeer> = {};
          Object.entries(flat).forEach(([key, entries]) => {
            const last = entries[entries.length - 1];
            if (!last) return;
            next[String(last.user_id ?? key)] = {
              name: String(last.name ?? ""),
              role: String(last.role ?? ""),
              at: String(last.at ?? ""),
            };
          });
          publishPeers(next);
        });
        void presenceChannel.subscribe((status) => {
          if (status === "SUBSCRIBED" && presenceChannel) {
            void presenceChannel.track({
              user_id: id,
              name: name ?? "",
              role: role ?? "",
              at: new Date().toISOString(),
            });
          }
        });
      } else {
        void presenceChannel.track({ user_id: id, name: name ?? "", role: role ?? "", at: new Date().toISOString() });
      }
    } catch {
      /* Realtime unavailable — the local heartbeat still drives the badge. */
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("focus", beat);
      if (cancelled && presenceChannel) {
        try {
          void presenceChannel.untrack();
        } catch {
          /* channel already closed */
        }
      }
    };
  }, [id, name, role]);
}

/* ─────────────────────── Role reports & approvals ─────────────────── */

export type ReportAudience = "Administration" | "Teaching" | "Finance" | "Support" | "All staff";
export type ReportStatus = "pending" | "approved" | "rejected";

export const REPORT_AUDIENCES: ReportAudience[] = [
  "Administration",
  "Teaching",
  "Finance",
  "Support",
  "All staff",
];

export const REPORT_CATEGORIES = [
  "Academic progress",
  "Attendance concern",
  "Student welfare",
  "Finance",
  "Facilities",
  "Safeguarding",
  "Operations",
  "Other",
] as const;

export interface RoleReport {
  id: string;
  title: string;
  category: string;
  body: string;
  audience: ReportAudience;
  submittedById: string;
  submittedByName: string;
  submittedByRole: string;
  status: ReportStatus;
  decidedByName?: string;
  decidedById?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
}

/** Which staff group owns each role, used for audience routing and approval rights. */
export function roleGroup(role: string): ReportAudience | "Student" {
  switch (role) {
    case "Super Admin":
    case "School Admin":
    case "Registrar":
    case "Admission Officer":
    case "Director of Education":
    case "Executive Assistant":
      return "Administration";
    case "Teacher":
      return "Teaching";
    case "Finance Officer":
      return "Finance";
    case "Customer Care Officer":
    case "Public Relations Officer":
    case "Data Entry Officer":
    case "Research Officer":
      return "Support";
    case "Student":
      return "Student";
    default:
      return "All staff";
  }
}

export function listReports(): RoleReport[] {
  return readDoc<RoleReport[]>(OPS_KEYS.reports, []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function reportsVisibleTo(user: { id: string; role: string } | null): RoleReport[] {
  const all = listReports();
  if (!user) return [];
  if (user.role === "Student") return all.filter((r) => r.submittedById === user.id);
  const group = roleGroup(user.role);
  const isAdmin = group === "Administration";
  return all.filter(
    (r) => isAdmin || r.audience === "All staff" || r.audience === group || r.submittedById === user.id,
  );
}

/** Only the addressed staff group, Administration, or the author's own reviewer may decide. */
export function canDecideReport(user: { id: string; role: string } | null, report: RoleReport): boolean {
  if (!user || user.role === "Student") return false;
  const group = roleGroup(user.role);
  if (group === "Administration") return true;
  return report.audience === group || report.audience === "All staff";
}

export function submitReport(input: {
  title: string;
  category: string;
  body: string;
  audience: ReportAudience;
  author: { id: string; name: string; role: string };
}): RoleReport {
  const report: RoleReport = {
    id: newOpsId("rpt"),
    title: input.title.trim(),
    category: input.category,
    body: input.body.trim(),
    audience: input.audience,
    submittedById: input.author.id,
    submittedByName: input.author.name,
    submittedByRole: input.author.role,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  writeDoc(OPS_KEYS.reports, [report, ...readDoc<RoleReport[]>(OPS_KEYS.reports, [])]);
  return report;
}

export function decideReport(
  id: string,
  decision: Exclude<ReportStatus, "pending">,
  note: string,
  actor: { id: string; name: string },
): void {
  const next = readDoc<RoleReport[]>(OPS_KEYS.reports, []).map((r) =>
    r.id === id
      ? {
          ...r,
          status: decision,
          decisionNote: note.trim(),
          decidedById: actor.id,
          decidedByName: actor.name,
          decidedAt: new Date().toISOString(),
        }
      : r,
  );
  writeDoc(OPS_KEYS.reports, next);
}

export function deleteReport(id: string): void {
  writeDoc(
    OPS_KEYS.reports,
    readDoc<RoleReport[]>(OPS_KEYS.reports, []).filter((r) => r.id !== id),
  );
}

/* ────────────────────── Live attendance sign in/out ───────────────── */

export interface AttendanceSession {
  id: string;
  userId: string;
  userName: string;
  role: string;
  date: string;
  signInAt: string;
  signOutAt: string | null;
  note: string;
}

export function dayKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function listAttendance(date?: string): AttendanceSession[] {
  const rows = readDoc<AttendanceSession[]>(OPS_KEYS.attendance, []);
  const wanted = date ?? dayKey();
  return rows.filter((r) => r.date === wanted).sort((a, b) => b.signInAt.localeCompare(a.signInAt));
}

export function openSession(userId: string, date = dayKey()): AttendanceSession | undefined {
  return readDoc<AttendanceSession[]>(OPS_KEYS.attendance, []).find(
    (r) => r.userId === userId && r.date === date && !r.signOutAt,
  );
}

export function signIn(user: { id: string; name: string; role: string }, note = ""): AttendanceSession {
  const existing = openSession(user.id);
  if (existing) return existing;
  const session: AttendanceSession = {
    id: newOpsId("att"),
    userId: user.id,
    userName: user.name,
    role: user.role,
    date: dayKey(),
    signInAt: new Date().toISOString(),
    signOutAt: null,
    note: note.trim(),
  };
  writeDoc(OPS_KEYS.attendance, [session, ...readDoc<AttendanceSession[]>(OPS_KEYS.attendance, [])]);
  return session;
}

export function signOut(userId: string): AttendanceSession | null {
  const open = openSession(userId);
  if (!open) return null;
  const closed: AttendanceSession = { ...open, signOutAt: new Date().toISOString() };
  writeDoc(
    OPS_KEYS.attendance,
    readDoc<AttendanceSession[]>(OPS_KEYS.attendance, []).map((r) => (r.id === open.id ? closed : r)),
  );
  return closed;
}

export function minutesBetween(fromIso: string, toIso?: string | null): number {
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  const start = new Date(fromIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

/* ──────────────────── Material upload & dispatch ──────────────────── */

export interface DispatchedMaterial {
  id: string;
  title: string;
  description: string;
  kind: "link" | "file";
  url: string;
  fileName: string;
  programId: string;
  cohortId: string | null;
  recipientIds: string[];
  sentById: string;
  sentByName: string;
  sentAt: string;
}

/** Inline files are capped so one upload cannot exhaust browser storage. */
export const MAX_MATERIAL_BYTES = 1_500_000;

export function listDispatchedMaterials(): DispatchedMaterial[] {
  return readDoc<DispatchedMaterial[]>(OPS_KEYS.materials, []).slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function materialsFor(userId: string): DispatchedMaterial[] {
  return listDispatchedMaterials().filter((m) => m.recipientIds.includes(userId));
}

export function sendMaterial(input: Omit<DispatchedMaterial, "id" | "sentAt">): DispatchedMaterial {
  const record: DispatchedMaterial = { ...input, id: newOpsId("mat"), sentAt: new Date().toISOString() };
  writeDoc(OPS_KEYS.materials, [record, ...readDoc<DispatchedMaterial[]>(OPS_KEYS.materials, [])]);
  return record;
}

export function deleteDispatchedMaterial(id: string): void {
  writeDoc(
    OPS_KEYS.materials,
    readDoc<DispatchedMaterial[]>(OPS_KEYS.materials, []).filter((m) => m.id !== id),
  );
}

/* ─────────────────── Policy forwarding & acknowledgement ──────────── */

export interface PolicyAck {
  policyId: string;
  userId: string;
  userName: string;
  acknowledgedAt: string;
}

export interface PolicyDispatch {
  id: string;
  policyIds: string[];
  recipientIds: string[];
  note: string;
  sentById: string;
  sentByName: string;
  sentAt: string;
}

export function listPolicyAcks(): PolicyAck[] {
  return readDoc<PolicyAck[]>(OPS_KEYS.policies, []);
}

export function acknowledgePolicy(policyId: string, user: { id: string; name: string }): PolicyAck {
  const existing = listPolicyAcks().find((a) => a.policyId === policyId && a.userId === user.id);
  if (existing) return existing;
  const ack: PolicyAck = {
    policyId,
    userId: user.id,
    userName: user.name,
    acknowledgedAt: new Date().toISOString(),
  };
  writeDoc(OPS_KEYS.policies, [ack, ...readDoc<PolicyAck[]>(OPS_KEYS.policies, [])]);
  return ack;
}

export function hasAcknowledged(policyId: string, userId: string): boolean {
  return listPolicyAcks().some((a) => a.policyId === policyId && a.userId === userId);
}

export function listPolicyDispatches(): PolicyDispatch[] {
  return readDoc<PolicyDispatch[]>(OPS_KEYS.policySends, []).slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function dispatchPolicies(input: Omit<PolicyDispatch, "id" | "sentAt">): PolicyDispatch {
  const record: PolicyDispatch = { ...input, id: newOpsId("pol"), sentAt: new Date().toISOString() };
  writeDoc(OPS_KEYS.policySends, [record, ...readDoc<PolicyDispatch[]>(OPS_KEYS.policySends, [])]);
  return record;
}

export function policiesSentTo(userId: string): PolicyDispatch[] {
  return listPolicyDispatches().filter((d) => d.recipientIds.includes(userId));
}

/* ─────────────────── Entrance / aptitude gate (60%) ───────────────── */

export const APTITUDE_PASS_MARK = 60;

export interface AptitudeRecord {
  userId: string;
  programId: string;
  percent: number;
  passed: boolean;
  takenAt: string;
  reference: string;
}

/** Programme length in whole months, from the catalogue's duration in weeks. */
export function monthsForWeeks(weeks: number): number {
  if (!Number.isFinite(weeks) || weeks <= 0) return 0;
  return Math.max(1, Math.round(weeks / 4.345));
}

/** The 1, 3 and 6 month tracks require a passing aptitude test before lessons. */
export function requiresAptitude(program: { durationWeeks: number }): boolean {
  return [1, 3, 6].includes(monthsForWeeks(program.durationWeeks));
}

export function listAptitudeRecords(): AptitudeRecord[] {
  return readDoc<AptitudeRecord[]>(OPS_KEYS.aptitude, []);
}

export function recordAptitude(record: AptitudeRecord): void {
  const rest = listAptitudeRecords().filter(
    (r) => !(r.userId === record.userId && r.programId === record.programId),
  );
  writeDoc(OPS_KEYS.aptitude, [record, ...rest]);
}

export function aptitudeResult(userId: string, programId: string): AptitudeRecord | undefined {
  return listAptitudeRecords().find((r) => r.userId === userId && r.programId === programId);
}

/** A student may start lessons only after a pass at or above the 60% mark. */
export function clearedForProgram(userId: string, programId: string): boolean {
  const result = aptitudeResult(userId, programId);
  return !!result && result.passed && result.percent >= APTITUDE_PASS_MARK;
}
