import { supabase } from "@/integrations/supabase/client";

export interface SelfPacedParticipation {
  id: string;
  userId: string;
  programId: string;
  cohortId: string | null;
  status: "selected" | "pending_approval" | "active" | "completed" | "withdrawn";
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  selectedAt: string;
}

export interface SelfPacedWeek {
  id: string;
  programId: string;
  weekNumber: number;
  title: string;
  objectives: string | null;
  availableFrom: string | null;
  completionRequiresPercent: number;
  published: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SelfPacedResource {
  id: string;
  weekId: string;
  title: string;
  url: string;
  resourceType: "media" | "document" | "link";
  published: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SelfPacedLesson {
  id: string;
  weekId: string;
  title: string;
  content: string | null;
  resourceUrls: string[];
  published: boolean;
  orderIndex: number;
}

export interface SelfPacedActivity {
  id: string;
  weekId: string;
  lessonId: string | null;
  type: "exercise" | "self_eval" | "assignment" | "assessment";
  title: string;
  description: string | null;
  maxScore: number;
  dueDate: string | null;
  published: boolean;
}

export interface SelfPacedSubmission {
  id: string;
  activityId: string;
  userId: string;
  content: string | null;
  fileUrl: string | null;
  score: number | null;
  status: "submitted" | "graded";
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
  submittedAt: string;
}

export interface SelfPacedProgress {
  id: string;
  userId: string;
  weekId: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  score: number | null;
}

const str = (v: unknown): string => (v == null ? "" : String(v));

function mapParticipation(r: Record<string, unknown>): SelfPacedParticipation {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    programId: str(r.program_id),
    cohortId: r.cohort_id ? str(r.cohort_id) : null,
    status: (r.status as SelfPacedParticipation["status"]) ?? "selected",
    requiresApproval: r.requires_approval === true,
    approvedBy: r.approved_by ? str(r.approved_by) : null,
    approvedAt: r.approved_at ? str(r.approved_at) : null,
    selectedAt: str(r.selected_at),
  };
}

function mapWeek(r: Record<string, unknown>): SelfPacedWeek {
  return {
    id: str(r.id),
    programId: str(r.program_id),
    weekNumber: Number(r.week_number ?? 1),
    title: str(r.title),
    objectives: r.objectives ? str(r.objectives) : null,
    availableFrom: r.available_from ? str(r.available_from) : null,
    completionRequiresPercent: Number(r.completion_requires_percent ?? 80),
    published: r.published !== false,
    createdBy: r.created_by ? str(r.created_by) : null,
    createdAt: str(r.created_at),
  };
}

function mapResource(r: Record<string, unknown>): SelfPacedResource {
  return {
    id: str(r.id),
    weekId: str(r.week_id),
    title: str(r.title),
    url: str(r.url),
    resourceType: (r.resource_type as SelfPacedResource["resourceType"]) ?? "link",
    published: r.published !== false,
    createdBy: r.created_by ? str(r.created_by) : null,
    createdAt: str(r.created_at),
  };
}

function mapLesson(r: Record<string, unknown>): SelfPacedLesson {
  const urls = Array.isArray(r.resource_urls) ? (r.resource_urls as unknown[]).map(String) : [];
  return {
    id: str(r.id),
    weekId: str(r.week_id),
    title: str(r.title),
    content: r.content ? str(r.content) : null,
    resourceUrls: urls,
    published: r.published !== false,
    orderIndex: Number(r.order_index ?? 0),
  };
}

function mapActivity(r: Record<string, unknown>): SelfPacedActivity {
  return {
    id: str(r.id),
    weekId: str(r.week_id),
    lessonId: r.lesson_id ? str(r.lesson_id) : null,
    type: (r.type as SelfPacedActivity["type"]) ?? "exercise",
    title: str(r.title),
    description: r.description ? str(r.description) : null,
    maxScore: Number(r.max_score ?? 100),
    dueDate: r.due_date ? str(r.due_date) : null,
    published: r.published !== false,
  };
}

function mapSubmission(r: Record<string, unknown>): SelfPacedSubmission {
  return {
    id: str(r.id),
    activityId: str(r.activity_id),
    userId: str(r.user_id),
    content: r.content ? str(r.content) : null,
    fileUrl: r.file_url ? str(r.file_url) : null,
    score: r.score == null ? null : Number(r.score),
    status: (r.status as SelfPacedSubmission["status"]) ?? "submitted",
    feedback: r.feedback ? str(r.feedback) : null,
    gradedBy: r.graded_by ? str(r.graded_by) : null,
    gradedAt: r.graded_at ? str(r.graded_at) : null,
    submittedAt: str(r.submitted_at),
  };
}

function mapProgress(r: Record<string, unknown>): SelfPacedProgress {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    weekId: str(r.week_id),
    status: (r.status as SelfPacedProgress["status"]) ?? "not_started",
    completedAt: r.completed_at ? str(r.completed_at) : null,
    score: r.score == null ? null : Number(r.score),
  };
}

// --- Participations ---
export async function listParticipations(userId?: string): Promise<SelfPacedParticipation[]> {
  let q = supabase.from("self_paced_participations").select("*").order("selected_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapParticipation(r as Record<string, unknown>));
}

export async function selectParticipation(input: {
  userId: string;
  programId: string;
  cohortId?: string | null;
  requiresApproval?: boolean;
}): Promise<SelfPacedParticipation> {
  const status = input.requiresApproval ? "pending_approval" : "active";
  const { data, error } = await supabase
    .from("self_paced_participations")
    .upsert(
      {
        user_id: input.userId,
        program_id: input.programId,
        cohort_id: input.cohortId ?? null,
        status,
        requires_approval: input.requiresApproval ?? false,
        selected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,program_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapParticipation(data as Record<string, unknown>);
}

export async function approveParticipation(id: string, approverId: string): Promise<void> {
  const { error } = await supabase
    .from("self_paced_participations")
    .update({ status: "active", approved_by: approverId, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function withdrawParticipation(id: string): Promise<void> {
  const { error } = await supabase.from("self_paced_participations").update({ status: "withdrawn" }).eq("id", id);
  if (error) throw error;
}

// --- Weeks ---
export async function listWeeks(programId: string): Promise<SelfPacedWeek[]> {
  const { data, error } = await supabase
    .from("self_paced_weeks")
    .select("*")
    .eq("program_id", programId)
    .order("week_number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapWeek(r as Record<string, unknown>));
}

export async function createWeek(input: {
  programId: string;
  weekNumber: number;
  title: string;
  objectives?: string;
  availableFrom?: string;
  completionRequiresPercent?: number;
  createdBy: string;
}): Promise<SelfPacedWeek> {
  const { data, error } = await supabase
    .from("self_paced_weeks")
    .insert({
      program_id: input.programId,
      week_number: input.weekNumber,
      title: input.title,
      objectives: input.objectives ?? null,
      available_from: input.availableFrom ?? null,
      completion_requires_percent: input.completionRequiresPercent ?? 80,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapWeek(data as Record<string, unknown>);
}

export async function deleteWeek(id: string): Promise<void> {
  const { error } = await supabase.from("self_paced_weeks").delete().eq("id", id);
  if (error) throw error;
}

export async function updateWeek(id: string, patch: { title?: string; objectives?: string | null; availableFrom?: string | null; completionRequiresPercent?: number; published?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.objectives !== undefined) row.objectives = patch.objectives;
  if (patch.availableFrom !== undefined) row.available_from = patch.availableFrom;
  if (patch.completionRequiresPercent !== undefined) row.completion_requires_percent = patch.completionRequiresPercent;
  if (patch.published !== undefined) row.published = patch.published;
  const { error } = await supabase.from("self_paced_weeks").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from("self_paced_lessons").delete().eq("id", id);
  if (error) throw error;
}

export async function updateLesson(id: string, patch: { title?: string; content?: string | null; resourceUrls?: string[]; published?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.resourceUrls !== undefined) row.resource_urls = patch.resourceUrls;
  if (patch.published !== undefined) row.published = patch.published;
  const { error } = await supabase.from("self_paced_lessons").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from("self_paced_activities").delete().eq("id", id);
  if (error) throw error;
}

export async function updateActivity(id: string, patch: { title?: string; description?: string | null; published?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.published !== undefined) row.published = patch.published;
  const { error } = await supabase.from("self_paced_activities").update(row).eq("id", id);
  if (error) throw error;
}

// --- Media / document / link resources ---
export async function listResources(weekId: string): Promise<SelfPacedResource[]> {
  const { data, error } = await supabase
    .from("self_paced_resources")
    .select("*")
    .eq("week_id", weekId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapResource(r as Record<string, unknown>));
}

export async function createResource(input: {
  weekId: string;
  title: string;
  url: string;
  resourceType?: SelfPacedResource["resourceType"];
  published?: boolean;
  createdBy: string;
}): Promise<SelfPacedResource> {
  const { data, error } = await supabase
    .from("self_paced_resources")
    .insert({
      week_id: input.weekId,
      title: input.title,
      url: input.url,
      resource_type: input.resourceType ?? "link",
      published: input.published ?? true,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapResource(data as Record<string, unknown>);
}

export async function updateResource(id: string, patch: { title?: string; url?: string; published?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.published !== undefined) row.published = patch.published;
  const { error } = await supabase.from("self_paced_resources").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from("self_paced_resources").delete().eq("id", id);
  if (error) throw error;
}

// --- Lessons ---
export async function listLessons(weekId: string): Promise<SelfPacedLesson[]> {
  const { data, error } = await supabase
    .from("self_paced_lessons")
    .select("*")
    .eq("week_id", weekId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapLesson(r as Record<string, unknown>));
}

export async function createLesson(input: {
  weekId: string;
  title: string;
  content?: string;
  resourceUrls?: string[];
  orderIndex?: number;
}): Promise<SelfPacedLesson> {
  const { data, error } = await supabase
    .from("self_paced_lessons")
    .insert({
      week_id: input.weekId,
      title: input.title,
      content: input.content ?? null,
      resource_urls: input.resourceUrls ?? [],
      order_index: input.orderIndex ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapLesson(data as Record<string, unknown>);
}

// --- Activities ---
export async function listActivities(weekId: string): Promise<SelfPacedActivity[]> {
  const { data, error } = await supabase
    .from("self_paced_activities")
    .select("*")
    .eq("week_id", weekId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapActivity(r as Record<string, unknown>));
}

export async function createActivity(input: {
  weekId: string;
  lessonId?: string | null;
  type: SelfPacedActivity["type"];
  title: string;
  description?: string;
  maxScore?: number;
  dueDate?: string;
}): Promise<SelfPacedActivity> {
  const { data, error } = await supabase
    .from("self_paced_activities")
    .insert({
      week_id: input.weekId,
      lesson_id: input.lessonId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      max_score: input.maxScore ?? 100,
      due_date: input.dueDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapActivity(data as Record<string, unknown>);
}

// --- Submissions ---
export async function listSubmissions(activityId: string): Promise<SelfPacedSubmission[]> {
  const { data, error } = await supabase
    .from("self_paced_submissions")
    .select("*")
    .eq("activity_id", activityId);
  if (error) throw error;
  return (data ?? []).map((r) => mapSubmission(r as Record<string, unknown>));
}

export async function submitActivity(input: {
  activityId: string;
  userId: string;
  content?: string;
  fileUrl?: string;
}): Promise<SelfPacedSubmission> {
  const { data, error } = await supabase
    .from("self_paced_submissions")
    .upsert(
      {
        activity_id: input.activityId,
        user_id: input.userId,
        content: input.content ?? null,
        file_url: input.fileUrl ?? null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapSubmission(data as Record<string, unknown>);
}

export async function gradeSubmission(id: string, graderId: string, score: number, feedback?: string): Promise<void> {
  const { error } = await supabase
    .from("self_paced_submissions")
    .update({ score, feedback: feedback ?? null, status: "graded", graded_by: graderId, graded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// --- Progress ---
export async function listProgress(userId: string, weekIds: string[]): Promise<SelfPacedProgress[]> {
  if (weekIds.length === 0) return [];
  const { data, error } = await supabase
    .from("self_paced_progress")
    .select("*")
    .eq("user_id", userId)
    .in("week_id", weekIds);
  if (error) throw error;
  return (data ?? []).map((r) => mapProgress(r as Record<string, unknown>));
}

export async function upsertProgress(userId: string, weekId: string, status: SelfPacedProgress["status"], score?: number): Promise<void> {
  const { error } = await supabase
    .from("self_paced_progress")
    .upsert(
      {
        user_id: userId,
        week_id: weekId,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        score: score ?? null,
      },
      { onConflict: "user_id,week_id" },
    );
  if (error) throw error;
}

// --- Completion check ---
export async function computeWeekCompletion(userId: string, week: SelfPacedWeek): Promise<{ completed: boolean; percent: number }> {
  const activities = await listActivities(week.id);
  if (activities.length === 0) return { completed: true, percent: 100 };
  const subs = await Promise.all(activities.map((a) => listSubmissions(a.id)));
  const userSubs = subs.map((list) => list.find((s) => s.userId === userId));
  const graded = userSubs.filter((s) => s && s.status === "graded").length;
  const percent = Math.round((graded / activities.length) * 100);
  return { completed: percent >= week.completionRequiresPercent, percent };
}