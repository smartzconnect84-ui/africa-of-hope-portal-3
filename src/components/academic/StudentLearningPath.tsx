import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  FileText,
  Layers3,
  Loader2,
  Lock,
  PlayCircle,
  Repeat,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit, type StudentProgressRow, type TrainingMaterial } from "@/lib/academics";
import { fetchMyQuizAttempts, fetchVisibleQuizzes, groupAttemptsByQuiz, summarizeAttempts } from "@/lib/quizzes";
import type { Quiz, QuizAttemptSummary } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SetupError, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import QuizPlayer from "../quiz/QuizPlayer";
import QuizResult from "../quiz/QuizResult";
import MaterialPreviewDialog from "./MaterialPreviewDialog";
import ClassworkDialog from "./ClassworkDialog";

const unitTypeLabel: Record<LearningUnit["unit_type"], string> = { chapter: "Chapter", module: "Module", topic: "Topic" };

type Chip = { label: string; className: string };

/** A unit's derived state, computed once from its own fields plus the student's progress rows and the current time. */
function unitState(unit: LearningUnit, progressByUnit: Map<string, StudentProgressRow>, now: number) {
  const completed = progressByUnit.get(unit.id)?.status === "completed";
  const locked = !!unit.available_from && new Date(unit.available_from).getTime() > now;
  const overdue = !completed && !!unit.due_at && new Date(unit.due_at).getTime() < now;
  return { completed, locked, overdue };
}

function unitChip(unit: LearningUnit, completed: boolean, locked: boolean, overdue: boolean, isNext: boolean): Chip {
  if (completed) return { label: "Completed", className: "bg-emerald-100 text-emerald-800" };
  if (locked) return { label: `Locked until ${new Date(unit.available_from as string).toLocaleDateString()}`, className: "bg-slate-100 text-slate-700" };
  if (overdue) return { label: "Overdue", className: "bg-rose-100 text-rose-700" };
  if (isNext) return { label: "Up next", className: "bg-amber-100 text-amber-800" };
  return { label: "Available now", className: "bg-sky-100 text-sky-800" };
}

/**
 * G1/G2/G7: the student's learning path — lessons grouped by course and
 * ordered by position, with sequencing (locked / up next / overdue /
 * completed), in-app material preview, a timed classwork flow (confirm,
 * start, submit) and the existing QuizPlayer for in-lesson quizzes (itself
 * respecting attempt limits and open/close windows).
 */
export default function StudentLearningPath({
  reloadKey,
  units,
  materials,
}: {
  reloadKey: number;
  units: LearningUnit[];
  materials: TrainingMaterial[];
}) {
  const { state, currentUser, refresh } = useApp();
  const userId = currentUser?.id;
  const cohortKey = currentUser?.cohortIds.join(",") ?? "";
  const [progress, setProgress] = useState<StudentProgressRow[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [busyUnit, setBusyUnit] = useState("");
  const [preview, setPreview] = useState<TrainingMaterial | null>(null);
  const [classwork, setClasswork] = useState<{ unit: LearningUnit; assignmentId: string; resuming: boolean } | null>(null);
  const [playingQuiz, setPlayingQuiz] = useState<string | null>(null);
  const [reviewingAttempt, setReviewingAttempt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError("");
    try {
      const [progressRows, attemptRows, quizRows] = await Promise.all([
        academicApi.myProgress(currentUser?.cohortIds),
        fetchMyQuizAttempts(),
        fetchVisibleQuizzes(),
      ]);
      setProgress(progressRows); setAttempts(attemptRows); setQuizzes(quizRows);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); setFirstLoadDone(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cohortKey]);
  useEffect(() => { void load(); }, [load, reloadKey]);

  const progressByUnit = useMemo(() => new Map(progress.map((row) => [row.learning_unit_id, row])), [progress]);
  const attemptsByQuiz = useMemo(() => groupAttemptsByQuiz(attempts), [attempts]);
  const quizzesById = useMemo(() => new Map(quizzes.map((q) => [q.id, q])), [quizzes]);

  const groups = useMemo(() => {
    const map = new Map<string, LearningUnit[]>();
    for (const unit of units) {
      const key = unit.cohort_id ?? unit.program_id;
      const list = map.get(key) ?? [];
      list.push(unit);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [units]);

  const nextUnitIds = useMemo(() => {
    const next = new Set<string>();
    const now = Date.now();
    for (const list of groups.values()) {
      for (const unit of list) {
        const { completed, locked } = unitState(unit, progressByUnit, now);
        if (!completed && !locked) { next.add(unit.id); break; }
      }
    }
    return next;
  }, [groups, progressByUnit]);

  const markComplete = async (unit: LearningUnit) => {
    setBusyUnit(unit.id);
    try {
      await academicApi.recordProgress(unit.id, "completed");
      toast.success(`"${unit.title}" marked complete.`);
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusyUnit(""); }
  };

  const classworkSubmission = (assignmentId: string) =>
    state.submissions.find((s) => s.assignmentId === assignmentId && s.studentId === currentUser?.id);

  if (playingQuiz) {
    return (
      <QuizPlayer
        quizId={playingQuiz}
        onExit={() => setPlayingQuiz(null)}
        onDone={(attemptId) => { setPlayingQuiz(null); setReviewingAttempt(attemptId); void load(); }}
      />
    );
  }
  if (reviewingAttempt) {
    const attempt = attempts.find((a) => a.attemptId === reviewingAttempt);
    const quiz = attempt ? quizzesById.get(attempt.quizId) : undefined;
    return (
      <QuizResult
        attemptId={reviewingAttempt}
        attemptsAllowed={quiz?.maxAttempts}
        onBack={() => setReviewingAttempt(null)}
        onRetake={quiz ? () => { setReviewingAttempt(null); setPlayingQuiz(quiz.id); } : undefined}
      />
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      {error && <SetupError message={error} retry={() => void load()} />}
      {!error && !firstLoadDone && loading && (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" aria-label="Loading your learning path" />
      )}
      {!error && firstLoadDone && units.length === 0 && (
        <EmptyState icon={Layers3} title="No approved lessons yet" hint="Your teacher's approved topics will appear here, in order." />
      )}
      {!error && firstLoadDone && units.length > 0 && Array.from(groups.entries()).map(([groupId, list]) => {
        const cohort = state.cohorts.find((c) => c.id === groupId);
        const program = state.programs.find((p) => p.id === (cohort?.programId ?? groupId));
        const cohortEnded = cohort ? new Date(cohort.endDate).getTime() < now : false;
        return (
          <div key={groupId} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{cohort?.name ?? program?.title ?? "Course"}</h3>
            {cohortEnded && (
              <p className="text-xs font-medium text-rose-700">This course's schedule has ended — lessons can no longer be marked complete or submitted.</p>
            )}
            {list.map((unit) => {
              const { completed, locked, overdue } = unitState(unit, progressByUnit, now);
              const chip = unitChip(unit, completed, locked, overdue, nextUnitIds.has(unit.id));
              const unitMaterials = materials.filter((m) => m.learning_unit_id === unit.id || (!m.learning_unit_id && (m.cohort_id === unit.cohort_id || m.program_id === unit.program_id)));
              const quizAttempts = unit.quiz_id ? attemptsByQuiz.get(unit.quiz_id) ?? [] : [];
              const quiz = unit.quiz_id ? quizzesById.get(unit.quiz_id) : undefined;
              const quizSummary = quiz ? summarizeAttempts(quizAttempts, quiz.maxAttempts) : null;
              const quizNotYetOpen = quiz?.opensAt ? new Date(quiz.opensAt).getTime() > now : false;
              const quizClosedNow = quiz?.closesAt ? new Date(quiz.closesAt).getTime() < now : false;
              const submission = unit.classwork_assignment_id ? classworkSubmission(unit.classwork_assignment_id) : undefined;
              const assignment = unit.classwork_assignment_id ? state.assignments.find((a) => a.id === unit.classwork_assignment_id) : undefined;

              return (
                <div key={unit.id} className={cn(panelClass, "p-5")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{unitTypeLabel[unit.unit_type]} {unit.position}</p>
                      <h4 className="mt-1 font-semibold text-slate-900">{unit.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{unit.summary}</p>
                      {unit.due_at && <p className="mt-1 text-xs text-slate-500">Due {new Date(unit.due_at).toLocaleString()}</p>}
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", chip.className)}>
                      {locked && <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />}
                      {chip.label}
                    </span>
                  </div>

                  {unitMaterials.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {unitMaterials.map((material) => (
                        <button key={material.id} type="button" onClick={() => setPreview(material)} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-emerald-200">
                          <FileText className="h-4 w-4 shrink-0 text-emerald-700" />
                          <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{material.title}</span><span className="text-[11px] text-slate-500">{material.material_type}</span></span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {unit.quiz_id && quiz && quizSummary && (
                      quizSummary.inProgress ? (
                        <Button size="sm" className="bg-amber-400 text-amber-950 hover:bg-amber-500" disabled={locked || cohortEnded} onClick={() => setPlayingQuiz(unit.quiz_id as string)}>
                          <PlayCircle className="mr-1.5 h-4 w-4" />Resume quiz
                        </Button>
                      ) : quizSummary.exhausted ? null : quizNotYetOpen || quizClosedNow ? (
                        <Button size="sm" variant="outline" disabled>{quizNotYetOpen ? "Quiz not open yet" : "Quiz closed"}</Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={locked || cohortEnded} onClick={() => setPlayingQuiz(unit.quiz_id as string)}>
                          <PlayCircle className="mr-1.5 h-4 w-4" />{quizSummary.attemptsUsed > 0 ? "Retake quiz" : "Start quiz"}
                        </Button>
                      )
                    )}
                    {quizSummary?.best && (
                      <Button size="sm" variant="ghost" onClick={() => setReviewingAttempt(quizSummary.best!.attemptId)}>
                        <Badge className={cn("mr-1.5", quizSummary.best.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>{quizSummary.best.percent}%</Badge>
                        Quiz result
                      </Button>
                    )}
                    {unit.classwork_assignment_id && (
                      !submission || submission.status === "Missing" ? (
                        <Button size="sm" variant="outline" disabled={locked || cohortEnded} onClick={() => setClasswork({ unit, assignmentId: unit.classwork_assignment_id as string, resuming: false })}>
                          <Clock className="mr-1.5 h-4 w-4" />Start classwork
                        </Button>
                      ) : submission.status === "In Progress" ? (
                        <Button size="sm" className="bg-amber-400 text-amber-950 hover:bg-amber-500" disabled={cohortEnded} onClick={() => setClasswork({ unit, assignmentId: unit.classwork_assignment_id as string, resuming: true })}>
                          <Clock className="mr-1.5 h-4 w-4" />Resume classwork
                        </Button>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", submission.status === "Graded" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800")}>
                          {submission.status === "Graded" ? `Graded ${submission.marks ?? 0}/${assignment?.maxMarks ?? 100}` : submission.isLate ? "Submitted · Late" : "Submitted"}
                        </span>
                      )
                    )}
                    {!completed && (
                      <Button size="sm" variant="outline" disabled={locked || cohortEnded || busyUnit === unit.id} onClick={() => void markComplete(unit)}>
                        {busyUnit === unit.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}Mark complete
                      </Button>
                    )}
                    {quizAttempts.length > 0 && <span className="flex items-center gap-1 text-[11px] text-slate-500"><Repeat className="h-3 w-3" />{quizAttempts.length} quiz attempt{quizAttempts.length === 1 ? "" : "s"}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <MaterialPreviewDialog material={preview} open={!!preview} onOpenChange={(open) => !open && setPreview(null)} />
      {classwork && currentUser && (
        <ClassworkDialog
          onOpenChange={(open) => {
            if (open) return;
            setClasswork(null);
            // A started timer makes the next open a resume, so pick up the new In Progress row.
            void refresh();
          }}
          assignmentId={classwork.assignmentId}
          studentId={currentUser.id}
          unitTitle={classwork.unit.title}
          resuming={classwork.resuming}
          timeLimitMinutes={state.assignments.find((a) => a.id === classwork.assignmentId)?.timeLimitMinutes ?? null}
          onSubmitted={() => { setClasswork(null); void refresh(); void load(); }}
        />
      )}
    </div>
  );
}
