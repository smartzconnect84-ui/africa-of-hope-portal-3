import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, Flag, Check } from "lucide-react";
import type { QuizAttemptPayload, QuizSubmitResult } from "../../types";
import { saveQuizAnswer, startQuizAttempt, submitQuizAttempt } from "../../lib/quizzes";
import { useAssistantVisibility } from "../../context/AssistantVisibility";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY = 700;

function localKey(attemptId: string) {
  return `aoh-quiz:${attemptId}`;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isAnswered(a: unknown): boolean {
  if (a === undefined || a === null) return false;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === "string") return a.trim().length > 0;
  return true;
}

export default function QuizPlayer({
  quizId,
  onDone,
  onExit,
}: {
  quizId: string;
  /** Called once the attempt is finally graded (submitted, auto-submitted or timed out). */
  onDone: (attemptId: string, result: QuizSubmitResult) => void;
  /** Called when the student backs out before the attempt is in any resolved state (rare: load failure). */
  onExit: () => void;
}) {
  const { setHidden } = useAssistantVisibility();
  const [payload, setPayload] = useState<QuizAttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const submittedRef = useRef(false);

  useEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);

  useEffect(() => {
    let active = true;
    startQuizAttempt(quizId)
      .then((p) => {
        if (!active) return;
        setPayload(p);
        setClockOffsetMs(new Date(p.serverNow).getTime() - Date.now());
        let merged = { ...p.answers };
        try {
          const raw = localStorage.getItem(localKey(p.attemptId));
          if (raw) merged = { ...merged, ...JSON.parse(raw) };
        } catch {
          /* ignore corrupt local cache */
        }
        setAnswers(merged);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Could not start this quiz");
        onExit();
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const serverNowMs = now + clockOffsetMs;
  const deadlineMs = payload?.deadlineAt ? new Date(payload.deadlineAt).getTime() : null;
  const remainingMs = deadlineMs !== null ? deadlineMs - serverNowMs : null;

  const finishAttempt = useCallback(
    async (localAnswers: Record<string, unknown>) => {
      if (!payload || submittedRef.current) return;
      submittedRef.current = true;
      try {
        const result = await submitQuizAttempt(payload.attemptId, localAnswers);
        try { localStorage.removeItem(localKey(payload.attemptId)); } catch { /* ignore */ }
        onDone(payload.attemptId, result);
      } catch (e) {
        submittedRef.current = false;
        toast.error(e instanceof Error ? e.message : "Could not submit the quiz");
      }
    },
    [payload, onDone],
  );

  // Auto-submit at 0:00. The timer keeps running even if the tab loses focus.
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && payload && !submittedRef.current) {
      finishAttempt(answers);
    }
  }, [remainingMs, payload, answers, finishAttempt]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && payload) {
        setNow(Date.now());
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [payload]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (payload && payload.status === "in_progress" && !submittedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [payload]);

  function queueSave(questionId: string, value: unknown, nextAnswers: Record<string, unknown>) {
    if (!payload) return;
    try { localStorage.setItem(localKey(payload.attemptId), JSON.stringify(nextAnswers)); } catch { /* ignore */ }
    if (timers.current[questionId]) clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await saveQuizAnswer(payload.attemptId, questionId, value);
        if (res.timeUp) {
          toast.info("Time is up — submitting your answers.");
          finishAttempt(nextAnswers);
          return;
        }
        if (res.serverNow) setClockOffsetMs(new Date(res.serverNow).getTime() - Date.now());
        setSavedAt(Date.now());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save your answer");
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DELAY);
  }

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      queueSave(questionId, value, next);
      return next;
    });
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  const answeredCount = useMemo(
    () => (payload ? payload.questions.filter((q) => isAnswered(answers[q.id])).length : 0),
    [payload, answers],
  );

  if (loading || !payload) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#f6f8f7]">
        <p className="text-sm text-slate-500">Loading quiz…</p>
      </div>
    );
  }

  const question = payload.questions[index];
  const total = payload.questions.length;
  const unanswered = payload.questions.filter((q) => !isAnswered(answers[q.id]));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f6f8f7] p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{payload.quiz.title}</p>
              <p className="text-xs text-slate-500">Attempt {payload.attemptNo} of {payload.quiz.maxAttempts}</p>
            </div>
            {remainingMs !== null && (
              <div className="flex items-center gap-2 rounded-xl bg-[#022c22] px-3.5 py-2 text-amber-300">
                <Clock className="h-4 w-4" />
                <div>
                  <p className="font-mono text-lg font-bold leading-none">{formatClock(remainingMs)}</p>
                  <p className="text-[10px] leading-none text-emerald-200">time left</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
            </div>
            <span className="whitespace-nowrap text-xs text-slate-500">{answeredCount} of {total} answered</span>
            <span className={cn("whitespace-nowrap text-xs font-medium", saving ? "text-slate-400" : "text-emerald-700")}>
              {saving ? "Saving…" : savedAt ? "Saved" : ""}
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold leading-snug text-slate-900">{question.prompt}</h2>
              <Button type="button" size="icon" variant="ghost" className={cn("shrink-0", flagged.has(question.id) && "text-amber-500")} onClick={() => toggleFlag(question.id)}>
                <Flag className="h-4 w-4" />
              </Button>
            </div>

            {question.type === "single" && (
              <div role="radiogroup" className="space-y-2.5">
                {question.options.map((o, i) => (
                  <button
                    key={o.id} type="button" role="radio" aria-checked={answers[question.id] === o.id}
                    onClick={() => setAnswer(question.id, o.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm",
                      answers[question.id] === o.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-300",
                    )}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-bold", answers[question.id] === o.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-500")}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {o.text}
                  </button>
                ))}
              </div>
            )}

            {question.type === "multi" && (
              <div className="space-y-2.5">
                {question.options.map((o, i) => {
                  const picked = Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(o.id);
                  return (
                    <button
                      key={o.id} type="button"
                      onClick={() => {
                        const current = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
                        const next = picked ? current.filter((x) => x !== o.id) : [...current, o.id];
                        setAnswer(question.id, next);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm",
                        picked ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-300",
                      )}
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-bold", picked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-500")}>
                        {picked ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(65 + i)}
                      </span>
                      {o.text}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === "true_false" && (
              <div className="flex gap-3">
                {[true, false].map((v) => (
                  <button
                    key={String(v)} type="button" onClick={() => setAnswer(question.id, v)}
                    className={cn(
                      "flex-1 rounded-xl border px-4 py-3 text-sm font-medium",
                      answers[question.id] === v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-emerald-300",
                    )}
                  >
                    {v ? "True" : "False"}
                  </button>
                ))}
              </div>
            )}

            {question.type === "short" && (
              <input
                type="text" maxLength={500}
                value={typeof answers[question.id] === "string" ? (answers[question.id] as string) : ""}
                onChange={(e) => setAnswer(question.id, e.target.value)}
                placeholder="Type your answer"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            )}

            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>Previous</Button>
              {index < total - 1 ? (
                <Button onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>Next</Button>
              ) : (
                <Button className="bg-amber-400 text-amber-950 hover:bg-amber-500" onClick={() => setConfirmOpen(true)}>Submit quiz</Button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Questions</p>
            <p className="mb-3 text-xs text-slate-500">Jump to any question. Your answers are saved as you go.</p>
            <div className="grid grid-cols-5 gap-2">
              {payload.questions.map((q, i) => {
                const answered = isAnswered(answers[q.id]);
                const current = i === index;
                return (
                  <button
                    key={q.id} type="button" onClick={() => setIndex(i)}
                    className={cn(
                      "relative grid h-11 place-items-center rounded-xl border text-sm font-bold",
                      current ? "border-emerald-700 bg-emerald-700 text-white" : answered ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500",
                    )}
                  >
                    {i + 1}
                    {flagged.has(q.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded border border-emerald-200 bg-emerald-50" />Answered</span>
              <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded border border-slate-200" />Not answered</span>
              <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded border border-emerald-700 bg-emerald-700" />Current</span>
              <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-full bg-amber-500" />Flagged</span>
            </div>
            <Button className="mt-4 w-full bg-amber-400 text-amber-950 hover:bg-amber-500" onClick={() => setConfirmOpen(true)}>Submit quiz</Button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Submit your quiz?</h2>
            <p className="mt-2 text-sm text-slate-600">
              You've answered <b className="text-slate-900">{answeredCount} of {total}</b> questions.
              You can't change your answers after you submit.
            </p>
            {unanswered.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Not answered</span>
                  <span className="flex gap-1.5">
                    {unanswered.map((q) => (
                      <button key={q.id} type="button" className="h-7 w-8 rounded-lg border border-slate-200 bg-white text-xs font-semibold" onClick={() => { setIndex(payload.questions.findIndex((x) => x.id === q.id)); setConfirmOpen(false); }}>
                        {payload.questions.findIndex((x) => x.id === q.id) + 1}
                      </button>
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep working</Button>
              <Button
                className="bg-amber-400 text-amber-950 hover:bg-amber-500"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  await finishAttempt(answers);
                  setSubmitting(false);
                  setConfirmOpen(false);
                }}
              >
                {submitting ? "Submitting…" : "Submit quiz"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
