import { supabase } from "@/integrations/supabase/client";
import type {
  PlayerQuestion,
  Quiz,
  QuizAttemptPayload,
  QuizAttemptStatus,
  QuizAttemptSummary,
  QuizOption,
  QuizQuestion,
  QuizQuestionType,
  QuizReview,
  QuizReviewQuestion,
  QuizShowAnswers,
  QuizStatus,
  QuizSubmitResult,
} from "../types";

type Row = Record<string, unknown>;

const txt = (v: unknown, fallback = ""): string => (v === null || v === undefined ? fallback : String(v));
const num = (v: unknown, fallback = 0): number => (v === null || v === undefined ? fallback : Number(v));
const bool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);
const orNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/**
 * Friendly text for the error states a caller is expected to show the user.
 * `attempts_exhausted`/`quiz_closed`/`time_up`/etc. are the error codes the
 * SQL RPCs in supabase/migrations/20261014020000_quizzes_assistant.sql raise
 * with `errcode = 'P0001'`; a missing table/function means the migration
 * has not been applied yet.
 */
export function explainQuizError(message: string): string {
  const m = message || "";
  if (/attempts_exhausted/i.test(m)) return "You have used all the attempts allowed for this quiz.";
  if (/quiz_closed/i.test(m)) return "This quiz is not open right now.";
  if (/not_visible/i.test(m)) return "This quiz is not available to you.";
  if (/not_found/i.test(m)) return "That quiz could not be found.";
  if (/time_up/i.test(m)) return "Time is up — your quiz was submitted automatically.";
  if (/not_submitted/i.test(m)) return "Submit the quiz before you can review it.";
  if (/review_unavailable/i.test(m)) return "Answers are not available for review yet.";
  if (/invalid_answer/i.test(m)) return "That answer is not valid for this question.";
  if (/forbidden|permission denied|not_authenticated/i.test(m))
    return "You do not have permission to do that.";
  if (/relation .* does not exist|function .* does not exist/i.test(m))
    return "Quizzes are not set up yet. Ask an administrator to apply the latest database migration.";
  return m || "Something went wrong. Please try again.";
}

function asError(error: { message: string } | null): never | void {
  if (error) throw new Error(explainQuizError(error.message));
}

// ─────────────────────────────── Builder (teacher/admin) ───────────────────────────────

function mapQuiz(r: Row): Quiz {
  return {
    id: txt(r.id),
    title: txt(r.title),
    description: txt(r.description),
    programId: orNull(r.program_id),
    cohortId: orNull(r.cohort_id),
    createdBy: orNull(r.created_by),
    status: txt(r.status, "draft") as QuizStatus,
    timeLimitMinutes: r.time_limit_minutes === null || r.time_limit_minutes === undefined ? null : num(r.time_limit_minutes),
    maxAttempts: num(r.max_attempts, 1),
    passMark: num(r.pass_mark, 50),
    shuffleQuestions: bool(r.shuffle_questions),
    shuffleOptions: bool(r.shuffle_options),
    showAnswers: txt(r.show_answers, "after_submit") as QuizShowAnswers,
    opensAt: orNull(r.opens_at),
    closesAt: orNull(r.closes_at),
    questionCount: num(r.question_count, 0),
    totalPoints: num(r.total_points, 0),
    createdAt: txt(r.created_at),
    updatedAt: txt(r.updated_at),
  };
}

function mapOptions(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => ({ id: txt((o as Row).id), text: txt((o as Row).text) }));
}

function mapCorrect(raw: unknown): (string | boolean)[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => (typeof v === "boolean" ? v : String(v)));
}

function mapQuestion(r: Row): QuizQuestion {
  return {
    id: txt(r.id),
    quizId: txt(r.quiz_id),
    position: num(r.position, 0),
    type: txt(r.type, "single") as QuizQuestionType,
    prompt: txt(r.prompt),
    options: mapOptions(r.options),
    correct: mapCorrect(r.correct),
    points: num(r.points, 1),
    explanation: txt(r.explanation),
  };
}

export interface QuizDraft {
  title: string;
  description: string;
  programId: string | null;
  cohortId: string | null;
  status: QuizStatus;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  passMark: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswers: QuizShowAnswers;
  opensAt: string | null;
  closesAt: string | null;
}

function quizRow(d: QuizDraft) {
  return {
    title: d.title,
    description: d.description,
    program_id: d.programId,
    cohort_id: d.cohortId,
    status: d.status,
    time_limit_minutes: d.timeLimitMinutes,
    max_attempts: d.maxAttempts,
    pass_mark: d.passMark,
    shuffle_questions: d.shuffleQuestions,
    shuffle_options: d.shuffleOptions,
    show_answers: d.showAnswers,
    opens_at: d.opensAt,
    closes_at: d.closesAt,
  };
}

/** Quizzes the caller may manage (teacher: own/own-cohort; admin: all), via RLS. */
export async function fetchManageableQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase.from("quizzes").select("*").order("created_at", { ascending: false });
  asError(error);
  return (data ?? []).map(mapQuiz);
}

/**
 * Quizzes visible to a student, same underlying query as `fetchManageableQuizzes`
 * — the `quizzes` table RLS policy (`quiz_visible_to_me`) already restricts a
 * student session to only published quizzes in their own cohort/programme.
 */
export const fetchVisibleQuizzes = fetchManageableQuizzes;

export async function fetchQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  asError(error);
  return (data ?? []).map(mapQuestion);
}

export async function createQuiz(draft: QuizDraft): Promise<Quiz> {
  const { data, error } = await supabase.from("quizzes").insert(quizRow(draft)).select("*").single();
  asError(error);
  return mapQuiz(data as Row);
}

export async function updateQuiz(id: string, draft: QuizDraft): Promise<Quiz> {
  const { data, error } = await supabase.from("quizzes").update(quizRow(draft)).eq("id", id).select("*").single();
  asError(error);
  return mapQuiz(data as Row);
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  asError(error);
}

export interface QuestionDraft {
  position: number;
  type: QuizQuestionType;
  prompt: string;
  options: QuizOption[];
  correct: (string | boolean)[];
  points: number;
  explanation: string;
}

function questionRow(quizId: string, d: QuestionDraft) {
  return {
    quiz_id: quizId,
    position: d.position,
    type: d.type,
    prompt: d.prompt,
    options: d.type === "single" || d.type === "multi" ? d.options : [],
    correct: d.correct,
    points: d.points,
    explanation: d.explanation,
  };
}

export async function createQuestion(quizId: string, draft: QuestionDraft): Promise<QuizQuestion> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .insert(questionRow(quizId, draft))
    .select("*")
    .single();
  asError(error);
  return mapQuestion(data as Row);
}

export async function updateQuestion(id: string, quizId: string, draft: QuestionDraft): Promise<QuizQuestion> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .update(questionRow(quizId, draft))
    .eq("id", id)
    .select("*")
    .single();
  asError(error);
  return mapQuestion(data as Row);
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
  asError(error);
}

/** Persists a new question order after a drag-and-drop reorder in the builder. */
export async function reorderQuestions(items: { id: string; position: number }[]): Promise<void> {
  for (const item of items) {
    const { error } = await supabase.from("quiz_questions").update({ position: item.position }).eq("id", item.id);
    asError(error);
  }
}

// ─────────────────────────────── Student flows ───────────────────────────────

function mapPlayerQuestion(r: Row): PlayerQuestion {
  return {
    id: txt(r.id),
    type: txt(r.type, "single") as QuizQuestionType,
    prompt: txt(r.prompt),
    points: num(r.points, 1),
    options: mapOptions(r.options),
  };
}

function mapAttemptPayload(raw: unknown): QuizAttemptPayload {
  const r = (raw ?? {}) as Row;
  const quiz = (r.quiz ?? {}) as Row;
  return {
    attemptId: txt(r.attempt_id),
    attemptNo: num(r.attempt_no, 1),
    status: txt(r.status, "in_progress") as QuizAttemptStatus,
    deadlineAt: orNull(r.deadline_at),
    serverNow: txt(r.server_now, new Date().toISOString()),
    quiz: {
      id: txt(quiz.id),
      title: txt(quiz.title),
      description: txt(quiz.description),
      timeLimitMinutes:
        quiz.time_limit_minutes === null || quiz.time_limit_minutes === undefined
          ? null
          : num(quiz.time_limit_minutes),
      totalPoints: num(quiz.total_points, 0),
      maxAttempts: num(quiz.max_attempts, 1),
      passMark: num(quiz.pass_mark, 50),
    },
    questions: Array.isArray(r.questions) ? (r.questions as Row[]).map(mapPlayerQuestion) : [],
    answers: (r.answers as Record<string, unknown>) ?? {},
  };
}

function mapSubmitResult(raw: unknown): QuizSubmitResult {
  const r = (raw ?? {}) as Row;
  return {
    score: num(r.score, 0),
    maxScore: num(r.max_score, 0),
    percent: num(r.percent, 0),
    passed: bool(r.passed),
    status: txt(r.status, "submitted") as QuizAttemptStatus,
    submittedAt: orNull(r.submitted_at),
    reviewAvailable: bool(r.review_available),
  };
}

/** Starts (or resumes) the caller's attempt. Throws a friendly error on `attempts_exhausted` / `quiz_closed`. */
export async function startQuizAttempt(quizId: string): Promise<QuizAttemptPayload> {
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
  asError(error);
  return mapAttemptPayload(data);
}

/** Debounced autosave target. Returns `{ timeUp: true }` instead of saving once the deadline has passed. */
export async function saveQuizAnswer(
  attemptId: string,
  questionId: string,
  answer: unknown,
): Promise<{ timeUp: boolean; savedAt?: string; serverNow?: string }> {
  const { data, error } = await supabase.rpc("save_quiz_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_answer: answer,
  });
  asError(error);
  const r = (data ?? {}) as Row;
  if (txt(r.status) === "time_up") return { timeUp: true };
  return { timeUp: false, savedAt: orNull(r.saved_at) ?? undefined, serverNow: orNull(r.server_now) ?? undefined };
}

export async function submitQuizAttempt(
  attemptId: string,
  answers?: Record<string, unknown>,
): Promise<QuizSubmitResult> {
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_attempt_id: attemptId,
    p_answers: answers ?? null,
  });
  asError(error);
  return mapSubmitResult(data);
}

function mapReviewQuestion(r: Row): QuizReviewQuestion {
  return {
    id: txt(r.id),
    type: txt(r.type, "single") as QuizQuestionType,
    prompt: txt(r.prompt),
    points: num(r.points, 1),
    options: mapOptions(r.options),
    correct: mapCorrect(r.correct),
    explanation: txt(r.explanation),
    answer: r.answer ?? null,
    awardedPoints: num(r.awarded_points, 0),
    isCorrect: bool(r.is_correct),
    overridden: bool(r.overridden),
  };
}

export async function getQuizReview(attemptId: string): Promise<QuizReview> {
  const { data, error } = await supabase.rpc("get_quiz_review", { p_attempt_id: attemptId });
  asError(error);
  const r = (data ?? {}) as Row;
  return {
    attemptId: txt(r.attempt_id, attemptId),
    quizId: txt(r.quiz_id),
    quizTitle: txt(r.quiz_title),
    attemptNo: num(r.attempt_no, 1),
    score: num(r.score, 0),
    maxScore: num(r.max_score, 0),
    percent: num(r.percent, 0),
    passed: bool(r.passed),
    startedAt: txt(r.started_at),
    submittedAt: orNull(r.submitted_at),
    questions: Array.isArray(r.questions) ? (r.questions as Row[]).map(mapReviewQuestion) : [],
  };
}

export async function finalizeExpiredQuizAttempts(quizId?: string): Promise<number> {
  const { data, error } = await supabase.rpc("finalize_expired_quiz_attempts", { p_quiz_id: quizId ?? null });
  asError(error);
  return num(data, 0);
}

export async function adjustQuizAnswerPoints(
  attemptId: string,
  questionId: string,
  points: number,
): Promise<{ score: number; percent: number; passed: boolean }> {
  const { data, error } = await supabase.rpc("adjust_quiz_answer_points", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_points: points,
  });
  asError(error);
  const r = (data ?? {}) as Row;
  return { score: num(r.score, 0), percent: num(r.percent, 0), passed: bool(r.passed) };
}

export async function regradeQuiz(quizId: string): Promise<number> {
  const { data, error } = await supabase.rpc("regrade_quiz", { p_quiz_id: quizId });
  asError(error);
  return num(data, 0);
}

// ─────────────────────────────── Results table (teacher/admin) ───────────────────────────────

function mapAttemptSummary(r: Row): QuizAttemptSummary {
  return {
    attemptId: txt(r.id),
    quizId: txt(r.quiz_id),
    studentId: txt(r.student_id),
    attemptNo: num(r.attempt_no, 1),
    status: txt(r.status, "in_progress") as QuizAttemptStatus,
    startedAt: txt(r.started_at),
    submittedAt: orNull(r.submitted_at),
    deadlineAt: orNull(r.deadline_at),
    score: r.score === null || r.score === undefined ? null : num(r.score),
    maxScore: r.max_score === null || r.max_score === undefined ? null : num(r.max_score),
    percent: r.percent === null || r.percent === undefined ? null : num(r.percent),
    passed: r.passed === null || r.passed === undefined ? null : bool(r.passed),
  };
}

/** Every attempt for one quiz, for the teacher/admin results table. */
export async function fetchQuizAttempts(quizId: string): Promise<QuizAttemptSummary[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .order("started_at", { ascending: false });
  asError(error);
  return (data ?? []).map(mapAttemptSummary);
}

/** All of the signed-in student's own attempts (any quiz) — for "my quiz results". */
export async function fetchMyQuizAttempts(): Promise<QuizAttemptSummary[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .order("started_at", { ascending: false });
  asError(error);
  return (data ?? []).map(mapAttemptSummary);
}

/** Groups a flat list of attempts (any quizzes) by quiz id, preserving input order within each group. */
export function groupAttemptsByQuiz(attempts: QuizAttemptSummary[]): Map<string, QuizAttemptSummary[]> {
  const map = new Map<string, QuizAttemptSummary[]>();
  for (const a of attempts) {
    const list = map.get(a.quizId) ?? [];
    list.push(a);
    map.set(a.quizId, list);
  }
  return map;
}

export interface AttemptsSummary {
  mine: QuizAttemptSummary[];
  inProgress: QuizAttemptSummary | null;
  graded: QuizAttemptSummary[];
  best: QuizAttemptSummary | null;
  attemptsUsed: number;
  exhausted: boolean;
}

/** Summarizes one quiz's attempts (newest first) against its attempt limit. Never mutates `attempts`. */
export function summarizeAttempts(attempts: QuizAttemptSummary[], maxAttempts: number): AttemptsSummary {
  const mine = [...attempts].sort((a, b) => b.attemptNo - a.attemptNo);
  const inProgress = mine.find((a) => a.status === "in_progress") ?? null;
  const graded = mine.filter((a) => a.status !== "in_progress");
  const best = graded.reduce<QuizAttemptSummary | null>((acc, a) => (acc && (acc.percent ?? -1) >= (a.percent ?? -1) ? acc : a), null);
  const attemptsUsed = mine.length;
  const exhausted = attemptsUsed >= maxAttempts && !inProgress;
  return { mine, inProgress, graded, best, attemptsUsed, exhausted };
}
