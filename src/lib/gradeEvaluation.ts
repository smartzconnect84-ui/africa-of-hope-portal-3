import { supabase } from "@/integrations/supabase/client";

/**
 * Grade Evaluation (renamed from Gradebook).
 * Unified setup control for Quizzes + Assignments + Exam/Final.
 * Table: public.grade_evaluation_settings (id = 1)
 * Legacy alias view: public.gradebook_settings
 */
export type GradeAssessmentKind = "quiz" | "assignment" | "exam";

export interface GradeEvaluationSettings {
  quizzesWeight: number;
  assignmentsWeight: number;
  examsWeight: number;
  passMark: number;
  distinctionMark: number;
  published: boolean;
}

export const DEFAULT_GRADE_EVALUATION: GradeEvaluationSettings = {
  quizzesWeight: 30,
  assignmentsWeight: 30,
  examsWeight: 40,
  passMark: 50,
  distinctionMark: 80,
  published: false,
};

const LS_KEY = "aoh-grade-evaluation-settings";

export function loadGradeEvaluationLocal(): GradeEvaluationSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_GRADE_EVALUATION;
    const p = JSON.parse(raw) as Partial<GradeEvaluationSettings>;
    return {
      quizzesWeight: num(p.quizzesWeight, 30),
      assignmentsWeight: num(p.assignmentsWeight, 30),
      examsWeight: num(p.examsWeight, 40),
      passMark: num(p.passMark, 50),
      distinctionMark: num(p.distinctionMark, 80),
      published: Boolean(p.published),
    };
  } catch {
    return DEFAULT_GRADE_EVALUATION;
  }
}

function num(v: unknown, fb: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

export function saveGradeEvaluationLocal(s: GradeEvaluationSettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* optional */
  }
}

export const GRADE_EVAL_KEY = LS_KEY;
export type GradeEvalSettings = GradeEvaluationSettings;
export const DEFAULT_GRADE_EVAL_SETTINGS: GradeEvaluationSettings = DEFAULT_GRADE_EVALUATION;
export const loadGradeEvalSettings = loadGradeEvaluationLocal;
export const saveGradeEvalSettings = saveGradeEvaluationLocal;

export function validateGradeEvalSettings(s: GradeEvaluationSettings): string | null {
  const total = weightsTotal(s);
  if (Math.abs(total - 100) > 0.01) return `Weights must total 100% (now ${total}%).`;
  if (s.passMark < 0 || s.passMark > 100) return "Pass mark must be between 0 and 100.";
  if (s.distinctionMark < 0 || s.distinctionMark > 100) return "Distinction mark must be between 0 and 100.";
  if (s.distinctionMark < s.passMark) return "Distinction mark must be at or above pass mark.";
  return null;
}

export function weightsTotal(s: GradeEvaluationSettings) {
  return s.quizzesWeight + s.assignmentsWeight + s.examsWeight;
}

export function gradeBand(avg: number | null, s: GradeEvaluationSettings): string {
  if (avg == null || !Number.isFinite(avg)) return "—";
  if (avg >= s.distinctionMark) return "Distinction";
  if (avg >= s.passMark) return "Pass";
  return "Fail";
}

export async function loadGradeEvaluationRemote(): Promise<GradeEvaluationSettings | null> {
  try {
    const { data, error } = await supabase
      .from("grade_evaluation_settings")
      .select("quizzes_weight,assignments_weight,exams_weight,pass_mark,distinction_mark,published")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as Record<string, unknown>;
    return {
      quizzesWeight: Number(r.quizzes_weight ?? 30),
      assignmentsWeight: Number(r.assignments_weight ?? 30),
      examsWeight: Number(r.exams_weight ?? 40),
      passMark: Number(r.pass_mark ?? 50),
      distinctionMark: Number(r.distinction_mark ?? 80),
      published: Boolean(r.published),
    };
  } catch {
    return null;
  }
}

export async function saveGradeEvaluationRemote(s: GradeEvaluationSettings) {
  const { error } = await supabase.from("grade_evaluation_settings").upsert(
    {
      id: 1,
      quizzes_weight: s.quizzesWeight,
      assignments_weight: s.assignmentsWeight,
      exams_weight: s.examsWeight,
      pass_mark: s.passMark,
      distinction_mark: s.distinctionMark,
      published: s.published,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export interface GradeAssessment {
  id: string;
  kind: GradeAssessmentKind;
  title: string;
  maxMarks: number;
  weight: number;
  dueDate: string;
  published: boolean;
  createdAt: string;
}

const LS_ASSESS = "aoh-grade-assessments";

export function loadAssessmentsLocal(): GradeAssessment[] {
  try {
    const raw = localStorage.getItem(LS_ASSESS);
    const arr = raw ? (JSON.parse(raw) as GradeAssessment[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAssessmentsLocal(list: GradeAssessment[]) {
  try {
    localStorage.setItem(LS_ASSESS, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* optional */
  }
}

export async function loadAssessmentsRemote(): Promise<GradeAssessment[]> {
  try {
    const { data, error } = await supabase
      .from("grade_assessments")
      .select("id,kind,title,max_marks,weight,due_date,published,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      kind: (String(r.kind) as GradeAssessmentKind) || "assignment",
      title: String(r.title ?? ""),
      maxMarks: Number(r.max_marks ?? 100),
      weight: Number(r.weight ?? 0),
      dueDate: String(r.due_date ?? ""),
      published: Boolean(r.published),
      createdAt: String(r.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}
