import { supabase } from "@/integrations/supabase/client";

/**
 * Donations, volunteer sign-ups, partnership requests and applicant study
 * plans. Every submission is written to Supabase (`support_pledges` /
 * `study_plans`) and mirrored into localStorage so a failed or offline write
 * is never lost and can be shown in the admin inbox.
 */

export type SupportKind = "donation" | "volunteer" | "partner" | "staff";
export type SupportStatus = "new" | "contacted" | "closed" | "archived";

export interface SupportPledge {
  id: string;
  kind: SupportKind;
  name: string;
  email: string;
  phone: string;
  /** Donation amount in the school's local currency (0 for volunteer/partner). */
  amount: number;
  frequency: "once" | "monthly" | "";
  method: string;
  /** Volunteer skills, partnership type or donor message. */
  message: string;
  createdAt: string;
  status: SupportStatus;
  synced: boolean;
}

export interface StudyPlanRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  programId: string;
  programTitle: string;
  mode: "online" | "blended" | "onsite";
  duration: string;
  registrationFee: string;
  educationLevel: string;
  intake: string;
  notes: string;
  createdAt: string;
  status: SupportStatus;
  synced: boolean;
}

const SUPPORT_KEY = "aoh-support-pledges-v1";
const PLAN_KEY = "aoh-study-plans-v1";

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows.slice(0, 500)));
  } catch {
    /* private mode — the remote write below is still attempted */
  }
}

// The generated Supabase types only cover the original portal tables, so these
// two tables are addressed through a minimal structural client.
interface RemoteResult {
  data: unknown[] | null;
  error: { message?: string } | null;
}
interface LooseClient {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>;
    update(row: Record<string, unknown>): {
      eq(column: string, value: string): { select(columns: string): PromiseLike<RemoteResult> };
    };
    select(columns: string): {
      order(column: string, opts: { ascending: boolean }): PromiseLike<RemoteResult>;
    };
  };
}
const remote = supabase as unknown as LooseClient;

export interface SubmitResult {
  row: SupportPledge | StudyPlanRequest;
  stored: "remote" | "local";
  error: string | null;
}

export async function submitSupportPledge(
  input: Omit<SupportPledge, "id" | "createdAt" | "status" | "synced">,
): Promise<SubmitResult> {
  const row: SupportPledge = {
    ...input,
    id: newId("sup"),
    createdAt: new Date().toISOString(),
    status: "new",
    synced: false,
  };
  let error: string | null = null;
  const { error: remoteError } = await remote.from("support_pledges").insert({
    id: row.id,
    kind: row.kind,
    name: row.name,
    email: row.email,
    phone: row.phone,
    amount: row.amount,
    frequency: row.frequency,
    method: row.method,
    message: row.message,
    status: row.status,
    created_at: row.createdAt,
  });
  if (remoteError) error = remoteError.message ?? "Could not reach the server";
  else row.synced = true;
  writeLocal(SUPPORT_KEY, [row, ...readLocal<SupportPledge>(SUPPORT_KEY)]);
  return { row, stored: row.synced ? "remote" : "local", error };
}

export async function submitStudyPlan(
  input: Omit<StudyPlanRequest, "id" | "createdAt" | "status" | "synced">,
): Promise<SubmitResult> {
  const row: StudyPlanRequest = {
    ...input,
    id: newId("plan"),
    createdAt: new Date().toISOString(),
    status: "new",
    synced: false,
  };
  let error: string | null = null;
  const { error: remoteError } = await remote.from("study_plans").insert({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    program_id: row.programId,
    program_title: row.programTitle,
    mode: row.mode,
    duration: row.duration,
    registration_fee: row.registrationFee,
    education_level: row.educationLevel,
    intake: row.intake,
    notes: row.notes,
    status: row.status,
    created_at: row.createdAt,
  });
  if (remoteError) error = remoteError.message ?? "Could not reach the server";
  else row.synced = true;
  writeLocal(PLAN_KEY, [row, ...readLocal<StudyPlanRequest>(PLAN_KEY)]);
  return { row, stored: row.synced ? "remote" : "local", error };
}

function normaliseStatus(value: unknown): SupportStatus {
  return value === "contacted" || value === "closed" || value === "archived" ? value : "new";
}

export async function listSupportPledges(): Promise<SupportPledge[]> {
  const local = readLocal<SupportPledge>(SUPPORT_KEY);
  const { data, error } = await remote
    .from("support_pledges")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return local;
  const rows: SupportPledge[] = data.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      kind: (r.kind === "volunteer" || r.kind === "partner" || r.kind === "staff" ? r.kind : "donation") as SupportKind,
      name: String(r.name ?? ""),
      email: String(r.email ?? ""),
      phone: String(r.phone ?? ""),
      amount: Number(r.amount ?? 0) || 0,
      frequency: (r.frequency === "monthly" ? "monthly" : r.frequency === "once" ? "once" : "") as SupportPledge["frequency"],
      method: String(r.method ?? ""),
      message: String(r.message ?? ""),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      status: normaliseStatus(r.status),
      synced: true,
    };
  });
  const merged = [...rows];
  local.filter((l) => !l.synced && !merged.some((r) => r.id === l.id)).forEach((l) => merged.push(l));
  return merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listStudyPlans(): Promise<StudyPlanRequest[]> {
  const local = readLocal<StudyPlanRequest>(PLAN_KEY);
  const { data, error } = await remote
    .from("study_plans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return local;
  const rows: StudyPlanRequest[] = data.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      email: String(r.email ?? ""),
      phone: String(r.phone ?? ""),
      programId: String(r.program_id ?? ""),
      programTitle: String(r.program_title ?? ""),
      mode: (r.mode === "blended" || r.mode === "onsite" ? r.mode : "online") as StudyPlanRequest["mode"],
      duration: String(r.duration ?? ""),
      registrationFee: String(r.registration_fee ?? ""),
      educationLevel: String(r.education_level ?? ""),
      intake: String(r.intake ?? ""),
      notes: String(r.notes ?? ""),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      status: normaliseStatus(r.status),
      synced: true,
    };
  });
  const merged = [...rows];
  local.filter((l) => !l.synced && !merged.some((r) => r.id === l.id)).forEach((l) => merged.push(l));
  return merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** RLS enforces staff access. A remote failure must not look like a saved edit. */
export async function updateEngagementStatus(
  type: "support" | "plans", row: SupportPledge | StudyPlanRequest, status: SupportStatus,
): Promise<void> {
  if (row.synced) {
    const { data, error } = await remote.from(type === "support" ? "support_pledges" : "study_plans")
      .update({ status }).eq("id", row.id).select("id");
    if (error || !data?.length) throw new Error(error?.message || "No record updated. Check your permissions.");
  }
  const key = type === "support" ? SUPPORT_KEY : PLAN_KEY;
  writeLocal(key, readLocal<SupportPledge | StudyPlanRequest>(key).map((r) => r.id === row.id ? { ...r, status } : r));
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? "")).join(",")),
  ].join("\n");
}