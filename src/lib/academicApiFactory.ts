export type AcademicApiClient = typeof import("../integrations/supabase/client.ts")["supabase"];
type AcademicRowsQuery = ReturnType<ReturnType<AcademicApiClient["from"]>["select"]>;

export type ApprovalStatus = "draft" | "pending" | "submitted" | "approved" | "rejected" | "revision_requested";

export interface ScheduleSlot {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  room?: string | null;
}

export interface EnrollmentPreview {
  allowed: boolean;
  conflicts: string[];
  warnings: string[];
  weekly_hours: number;
}

export interface CourseEnrollment {
  id: string;
  student_id: string;
  cohort_id: string;
  status: ApprovalStatus | "active" | "completed" | "withdrawn";
  requested_at: string;
  approved_at?: string | null;
  progress_percent: number;
  completion_status: string;
  workload_warnings: string[];
  revision_note?: string | null;
  cohort?: { id: string; name: string; start_date: string; end_date: string; room: string; program_id: string };
}

export interface CoursePlan {
  id: string;
  cohort_id: string;
  teacher_id: string;
  title: string;
  overview: string;
  objectives: string[];
  training_plan: string;
  status: ApprovalStatus;
  revision_note?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
}

export interface ClassSession {
  id: string;
  cohort_id: string;
  course_plan_id?: string | null;
  title: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  room?: string | null;
  attendance_required: boolean;
  status: ApprovalStatus | "cancelled" | "completed";
}

export interface LearningUnit {
  id: string;
  program_id: string;
  cohort_id?: string | null;
  course_plan_id?: string | null;
  title: string;
  summary: string;
  unit_type: "chapter" | "module" | "topic";
  position: number;
  available_from?: string | null;
  due_at?: string | null;
  status: ApprovalStatus;
  quiz_id?: string | null;
  classwork_assignment_id?: string | null;
}

export interface TrainingMaterial {
  id: string;
  program_id: string;
  cohort_id?: string | null;
  learning_unit_id?: string | null;
  created_by: string;
  title: string;
  description: string;
  material_type: string;
  file_path?: string | null;
  external_url?: string | null;
  mime_type?: string | null;
  status: ApprovalStatus;
  revision_note?: string | null;
  created_at: string;
}

export interface PortalNotification {
  id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at: string;
  read_at?: string | null;
}

export interface ApprovalItem {
  entity_type: "enrollment" | "course_plan" | "class_session" | "learning_unit" | "training_material";
  entity_id: string;
  title: string;
  owner_name: string;
  status: ApprovalStatus;
  submitted_at: string;
  context: Record<string, unknown>;
}

export function explainAcademicError(error: { message: string; details?: string | null } | null): string | null {
  if (!error) return null;
  if (/does not exist|schema cache|could not find/i.test(error.message)) {
    return "Academic planning is not active yet. Apply the latest Supabase migration, then refresh this page.";
  }
  if (error.message === "enrollment_not_allowed" && error.details) {
    try {
      const detail = JSON.parse(error.details) as { conflicts?: string[]; warnings?: string[] };
      return [...(detail.conflicts ?? []), ...(detail.warnings ?? [])].join(" ") || "This course cannot be added to your plan.";
    } catch { return "This course cannot be added to your plan."; }
  }
  const friendly: Record<string, string> = {
    class_session_schedule_conflict: "This class overlaps another approved session for the teacher or cohort.",
    invalid_lesson_assessment_settings: "Check the lesson position, time limits, and grade weights.",
    approved_learning_unit_requires_published_quiz: "Publish the linked quiz in Quiz Builder before lesson approval.",
    decision_note_required: "Add a decision note for a rejection or revision request.",
    active_student_required: "Only an approved active student can submit a course plan.",
    course_window_closed: "This course's class schedule has ended. Progress and classwork can no longer be recorded.",
    unit_not_available: "This lesson isn't available yet. Check back once it opens.",
    classwork_already_submitted: "You already submitted this classwork.",
    classwork_empty: "Add a response or attach a file before you submit.",
    available_after_due: "\"Available from\" must be before the lesson's due date.",
  };
  if (friendly[error.message]) return friendly[error.message];
  return error.message;
}

export type ClassworkStatus = "In Progress" | "Submitted" | "Graded" | "Missing";

export interface ClassworkStart {
  submission_id: string;
  started_at: string;
  deadline_at: string | null;
  time_limit_minutes: number | null;
  status: ClassworkStatus;
  /** Server clock at the call, for client clock-skew correction. */
  server_now?: string;
}

export interface ClassworkSubmitResult {
  submission_id: string;
  status: ClassworkStatus;
  is_late: boolean;
  submitted_at: string;
}

export interface StudentProgressRow {
  id: string;
  student_id: string;
  cohort_id: string;
  learning_unit_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percent: number;
  completed_at?: string | null;
  updated_at?: string | null;
}

export interface RecordProgressResult {
  progress_percent: number;
  completion_status: string;
}

export interface GradeComponent {
  type: "assignment" | "quiz";
  id: string;
  title: string;
  grade_weight: number;
  percent: number | null;
}

export interface CourseGradeSummary {
  student_id: string;
  cohort_id: string;
  course_grade: number | null;
  total_weight: number;
  assessed_weight: number;
  components: GradeComponent[];
}

export interface MissedSession {
  session_id: string;
  title: string;
  session_date: string;
}

export interface UpcomingDeadline {
  kind: "classwork" | "quiz" | "unit";
  id: string;
  title: string;
  due_at: string;
}

export interface OverdueUnit {
  id: string;
  title: string;
  due_at: string;
}

export interface NextUnit {
  id: string;
  title: string;
  unit_type: LearningUnit["unit_type"];
  position: number;
  available_from?: string | null;
  due_at?: string | null;
}

export interface MyCourseStatus {
  cohort_id: string;
  cohort_name: string;
  program_id: string;
  program_title: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  window: "upcoming" | "active" | "ended";
  required_attendance_percent: number;
  completion_pass_mark: number;
  sessions_held: number;
  sessions_attended: number;
  sessions_missed: number;
  attendance_percent: number | null;
  attendance_ok: boolean;
  missed: MissedSession[];
  units_total: number;
  units_completed: number;
  progress_percent: number;
  completion_status: string;
  next_unit: NextUnit | null;
  overdue_units: OverdueUnit[];
  upcoming_deadlines: UpcomingDeadline[];
  grade: CourseGradeSummary;
}

export const MAX_TRAINING_MATERIAL_BYTES = 25 * 1024 * 1024;

export const SUPPORTED_TRAINING_MATERIAL_MIME_TYPES = new Set([
  "application/pdf", "text/plain", "application/zip", "application/x-zip-compressed",
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/heic",
  "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a",
  "application/msword", "application/vnd.ms-powerpoint", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function safeTrainingMaterialName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100);
}

// Shared by training materials and classwork attachments: both live in a bucket scoped by
// an owning record id (cohort or assignment) and the uploading user's id.
export function trainingMaterialPath(scopeId: string, uploaderId: string, name: string, timestamp: number): string {
  return `${scopeId}/${uploaderId}/${timestamp}-${safeTrainingMaterialName(name)}`;
}

export const TRAINING_MATERIAL_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,image/*,audio/*,video/*";

export function createAcademicApi(client: AcademicApiClient, now: () => number = Date.now) {
  async function rows<T>(table: string, query?: (request: AcademicRowsQuery) => AcademicRowsQuery): Promise<T[]> {
    let request = client.from(table).select("*");
    if (query) request = query(request);
    const { data, error } = await request;
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return (data ?? []) as T[];
  }

  async function uploadValidated(
    bucket: string,
    scopeId: string,
    uploaderId: string,
    file: File,
    tooLargeMessage: string,
  ): Promise<{ path: string; mime: string }> {
    if (file.size > MAX_TRAINING_MATERIAL_BYTES) throw new Error(tooLargeMessage);
    if (!SUPPORTED_TRAINING_MATERIAL_MIME_TYPES.has(file.type)) throw new Error("This file format is not supported. Use PDF, Office, image, audio, video, text, or ZIP files.");
    const path = trainingMaterialPath(scopeId, uploaderId, file.name, now());
    const { error } = await client.storage.from(bucket).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(explainAcademicError(error) ?? error.message);
    return { path, mime: file.type || "application/octet-stream" };
  }

  return {
  enrollments(studentId?: string) {
    return rows<CourseEnrollment>("course_enrollments", (q) =>
      studentId ? q.eq("student_id", studentId).order("requested_at", { ascending: false }) : q.order("requested_at", { ascending: false }),
    );
  },
  plans(teacherId?: string) {
    return rows<CoursePlan>("teacher_course_plans", (q) =>
      teacherId ? q.eq("teacher_id", teacherId).order("updated_at", { ascending: false }) : q.order("updated_at", { ascending: false }),
    );
  },
  sessions(cohortIds?: string[]) {
    return rows<ClassSession>("class_sessions", (q) => {
      let next = q.order("session_date").order("starts_at");
      if (cohortIds?.length) next = next.in("cohort_id", cohortIds);
      return next;
    });
  },
  units(programIds?: string[], cohortIds?: string[]) {
    return rows<LearningUnit>("learning_units", (q) => {
      let next = q.order("position");
      if (programIds?.length && cohortIds?.length) next = next.or(`program_id.in.(${programIds.join(",")}),cohort_id.in.(${cohortIds.join(",")})`);
      else if (programIds?.length) next = next.in("program_id", programIds);
      else if (cohortIds?.length) next = next.in("cohort_id", cohortIds);
      return next;
    });
  },
  materials(programIds?: string[], cohortIds?: string[]) {
    return rows<TrainingMaterial>("training_materials", (q) => {
      let next = q.order("created_at", { ascending: false });
      if (programIds?.length && cohortIds?.length) next = next.or(`program_id.in.(${programIds.join(",")}),cohort_id.in.(${cohortIds.join(",")})`);
      else if (programIds?.length) next = next.in("program_id", programIds);
      else if (cohortIds?.length) next = next.in("cohort_id", cohortIds);
      return next;
    });
  },
  notifications(userId: string) {
    return rows<PortalNotification>("notifications", (q) => q.eq("recipient_id", userId).order("created_at", { ascending: false }).limit(50));
  },
  approvalQueue() {
    return rows<ApprovalItem>("academic_approval_queue", (q) => q.order("submitted_at"));
  },
  async previewEnrollment(cohortId: string): Promise<EnrollmentPreview> {
    const { data, error } = await client.rpc("preview_course_enrollment", { p_cohort_id: cohortId });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return (data ?? { allowed: false, conflicts: [], warnings: [], weekly_hours: 0 }) as EnrollmentPreview;
  },
  async submitEnrollment(cohortId: string): Promise<EnrollmentPreview & { enrollment_id?: string }> {
    const { data, error } = await client.rpc("submit_course_enrollment", { p_cohort_id: cohortId });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as EnrollmentPreview & { enrollment_id?: string };
  },
  async createPlan(payload: Omit<CoursePlan, "id" | "status" | "revision_note" | "submitted_at" | "approved_at">) {
    const { data, error } = await client.from("teacher_course_plans").insert({ ...payload, status: "draft" }).select().single();
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as CoursePlan;
  },
  async createSession(payload: Omit<ClassSession, "id" | "status">) {
    const { data, error } = await client.from("class_sessions").insert({ ...payload, status: "draft" }).select().single();
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as ClassSession;
  },
  async createUnitWithAssessments(
    payload: Omit<LearningUnit, "id" | "status" | "quiz_id" | "classwork_assignment_id">,
    assessment: { classworkMinutes: number; classworkWeight: number; quizMinutes: number; quizWeight: number },
  ) {
    const { data, error } = await client.rpc("create_academic_lesson_bundle", {
      p_program_id: payload.program_id,
      p_cohort_id: payload.cohort_id,
      p_course_plan_id: payload.course_plan_id,
      p_title: payload.title,
      p_summary: payload.summary,
      p_unit_type: payload.unit_type,
      p_position: payload.position,
      p_due_at: payload.due_at,
      p_classwork_minutes: assessment.classworkMinutes,
      p_classwork_weight: assessment.classworkWeight,
      p_quiz_minutes: assessment.quizMinutes,
      p_quiz_weight: assessment.quizWeight,
      p_available_from: payload.available_from ?? null,
    });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as LearningUnit;
  },
  async uploadMaterial(file: File, cohortId: string, teacherId: string): Promise<{ path: string; mime: string }> {
    return uploadValidated("training-materials", cohortId, teacherId, file, "Training materials must be 25 MB or smaller.");
  },
  async deleteMaterialUpload(path: string) {
    const { error } = await client.storage.from("training-materials").remove([path]);
    if (error) throw new Error(explainAcademicError(error) ?? error.message);
  },
  async createMaterial(payload: Omit<TrainingMaterial, "id" | "status" | "revision_note" | "created_at">) {
    const { data, error } = await client.from("training_materials").insert({ ...payload, status: "submitted", submitted_at: new Date(now()).toISOString() }).select().single();
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as TrainingMaterial;
  },
  async submit(entityType: "course_plan" | "class_session" | "learning_unit" | "training_material", entityId: string) {
    const { data, error } = await client.rpc("submit_academic_item", { p_entity_type: entityType, p_entity_id: entityId });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data;
  },
  async revise(entityType: "course_plan" | "class_session" | "learning_unit" | "training_material", entityId: string, changes: Record<string, unknown>) {
    const table = {
      course_plan: "teacher_course_plans",
      class_session: "class_sessions",
      learning_unit: "learning_units",
      training_material: "training_materials",
    }[entityType];
    const { data, error } = await client.from(table).update(changes).eq("id", entityId).in("status", ["draft", "revision_requested"]).select().single();
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data;
  },
  async review(entityType: string, entityId: string, decision: "approved" | "rejected" | "revision_requested", note: string) {
    const { data, error } = await client.rpc("review_academic_submission", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_decision: decision,
      p_note: note,
    });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data;
  },
  async materialUrl(path: string) {
    const { data, error } = await client.storage.from("training-materials").createSignedUrl(path, 600);
    if (error || !data) throw new Error(explainAcademicError(error) ?? "Could not open this material.");
    return data.signedUrl;
  },
  async markNotificationRead(id: string) {
    const { error } = await client.from("notifications").update({ read_at: new Date(now()).toISOString() }).eq("id", id);
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
  },
  myProgress(cohortIds?: string[]) {
    return rows<StudentProgressRow>("student_learning_progress", (q) => (cohortIds?.length ? q.in("cohort_id", cohortIds) : q));
  },
  async recordProgress(unitId: string, status: "in_progress" | "completed"): Promise<RecordProgressResult> {
    const { data, error } = await client.rpc("record_learning_progress", { p_unit_id: unitId, p_status: status });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as RecordProgressResult;
  },
  async myCourseStatus(): Promise<MyCourseStatus[]> {
    const { data, error } = await client.rpc("my_course_status");
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return (data ?? []) as MyCourseStatus[];
  },
  async startClasswork(assignmentId: string): Promise<ClassworkStart> {
    const { data, error } = await client.rpc("start_classwork", { p_assignment_id: assignmentId });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as ClassworkStart;
  },
  async submitClasswork(assignmentId: string, responseText: string, attachmentPath: string | null): Promise<ClassworkSubmitResult> {
    const { data, error } = await client.rpc("submit_classwork", {
      p_assignment_id: assignmentId,
      p_response_text: responseText,
      p_attachment_path: attachmentPath,
    });
    const message = explainAcademicError(error);
    if (message) throw new Error(message);
    return data as ClassworkSubmitResult;
  },
  async uploadClassworkAttachment(assignmentId: string, studentId: string, file: File): Promise<{ path: string; mime: string }> {
    return uploadValidated("classwork-submissions", assignmentId, studentId, file, "Classwork attachments must be 25 MB or smaller.");
  },
  };
}
