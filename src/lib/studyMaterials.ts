import { supabase } from "@/integrations/supabase/client";

export interface FileSubmission {
  id: string;
  submitter_id: string;
  file_path: string;
  file_name: string;
  category: string;
  size_bytes: number | null;
  status: "pending" | "approved" | "rejected";
  target_audience: string;
  target_id: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface StudyMaterial {
  id: string;
  submission_id: string | null;
  title: string;
  description: string | null;
  file_path: string | null;
  file_url: string | null;
  material_type: string;
  program_id: string | null;
  cohort_id: string | null;
  audience: string;
  published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SelfPacedPlan {
  id: string;
  user_id: string;
  program_id: string;
  schedule: unknown[];
  status: string;
  created_at: string;
}

function mapSubmission(row: Record<string, unknown>): FileSubmission {
  return {
    id: String(row.id),
    submitter_id: String(row.submitter_id),
    file_path: String(row.file_path),
    file_name: String(row.file_name),
    category: String(row.category ?? "Other"),
    size_bytes: row.size_bytes == null ? null : Number(row.size_bytes),
    status: (row.status as FileSubmission["status"]) ?? "pending",
    target_audience: String(row.target_audience ?? "all"),
    target_id: row.target_id ? String(row.target_id) : null,
    reviewer_id: row.reviewer_id ? String(row.reviewer_id) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    review_notes: row.review_notes ? String(row.review_notes) : null,
    created_at: String(row.created_at),
  };
}

function mapMaterial(row: Record<string, unknown>): StudyMaterial {
  return {
    id: String(row.id),
    submission_id: row.submission_id ? String(row.submission_id) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    file_path: row.file_path ? String(row.file_path) : null,
    file_url: row.file_url ? String(row.file_url) : null,
    material_type: String(row.material_type ?? "study_material"),
    program_id: row.program_id ? String(row.program_id) : null,
    cohort_id: row.cohort_id ? String(row.cohort_id) : null,
    audience: String(row.audience ?? "all"),
    published: row.published === true,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
  };
}

export async function submitFileForReview(input: {
  submitterId: string;
  filePath: string;
  fileName: string;
  category?: string;
  sizeBytes?: number;
  targetAudience?: string;
  targetId?: string | null;
}): Promise<FileSubmission> {
  const { data, error } = await supabase
    .from("file_submissions")
    .insert({
      submitter_id: input.submitterId,
      file_path: input.filePath,
      file_name: input.fileName,
      category: input.category ?? "Other",
      size_bytes: input.sizeBytes ?? null,
      target_audience: input.targetAudience ?? "all",
      target_id: input.targetId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSubmission(data as Record<string, unknown>);
}

export async function listSubmissions(filter?: { status?: string; submitterId?: string }): Promise<FileSubmission[]> {
  let q = supabase.from("file_submissions").select("*").order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.submitterId) q = q.eq("submitter_id", filter.submitterId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapSubmission(r as Record<string, unknown>));
}

export async function reviewSubmission(
  id: string,
  reviewerId: string,
  status: "approved" | "rejected",
  notes?: string,
): Promise<FileSubmission> {
  const { data, error } = await supabase
    .from("file_submissions")
    .update({ status, reviewer_id: reviewerId, reviewed_at: new Date().toISOString(), review_notes: notes ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapSubmission(data as Record<string, unknown>);
}

export async function publishApprovedSubmission(submission: FileSubmission, input: {
  title: string;
  materialType: string;
  programId?: string | null;
  cohortId?: string | null;
  audience?: string;
  createdBy: string;
}): Promise<StudyMaterial> {
  const { data, error } = await supabase
    .from("study_materials")
    .insert({
      submission_id: submission.id,
      title: input.title,
      file_path: submission.file_path,
      material_type: input.materialType,
      program_id: input.programId ?? null,
      cohort_id: input.cohortId ?? null,
      audience: input.audience ?? submission.target_audience,
      published: true,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapMaterial(data as Record<string, unknown>);
}

export async function listStudyMaterials(filter?: { programId?: string; audience?: string; publishedOnly?: boolean }): Promise<StudyMaterial[]> {
  let q = supabase.from("study_materials").select("*").order("created_at", { ascending: false });
  if (filter?.programId) q = q.eq("program_id", filter.programId);
  if (filter?.audience) q = q.eq("audience", filter.audience);
  if (filter?.publishedOnly) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapMaterial(r as Record<string, unknown>));
}

export async function createSelfPacedPlan(userId: string, programId: string, schedule: unknown[] = []): Promise<SelfPacedPlan> {
  const { data, error } = await supabase
    .from("self_paced_plans")
    .upsert({ user_id: userId, program_id: programId, schedule, status: "active" }, { onConflict: "user_id,program_id" })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    program_id: String(row.program_id),
    schedule: Array.isArray(row.schedule) ? row.schedule : [],
    status: String(row.status ?? "active"),
    created_at: String(row.created_at),
  };
}

export async function listSelfPacedPlans(userId: string): Promise<SelfPacedPlan[]> {
  const { data, error } = await supabase.from("self_paced_plans").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      program_id: String(row.program_id),
      schedule: Array.isArray(row.schedule) ? row.schedule : [],
      status: String(row.status ?? "active"),
      created_at: String(row.created_at),
    };
  });
}

export async function materialUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 10);
  if (error || !data) throw new Error(error?.message ?? "Could not open file");
  return data.signedUrl;
}