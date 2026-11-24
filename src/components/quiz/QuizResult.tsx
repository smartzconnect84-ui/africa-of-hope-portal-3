import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Minus, Clock, Calendar, RotateCcw, ArrowLeft } from "lucide-react";
import type { QuizReview, QuizReviewQuestion } from "../../types";
import { getQuizReview } from "../../lib/quizzes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmptyState } from "../Navigation";

function Ring({ value }: { value: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24">
      <circle cx="40" cy="40" r={r} strokeWidth="9" className="fill-none stroke-emerald-100" />
      <circle
        cx="40" cy="40" r={r} strokeWidth="9" strokeLinecap="round"
        className={cn("fill-none", value >= 50 ? "stroke-emerald-600" : "stroke-rose-500")}
        strokeDasharray={c}
        strokeDashoffset={c - (Math.min(100, Math.max(0, value)) / 100) * c}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" className="fill-slate-900 text-[15px] font-semibold">
        {Math.round(value)}%
      </text>
    </svg>
  );
}

function questionKind(q: QuizReviewQuestion): "correct" | "partial" | "incorrect" {
  if (q.awardedPoints >= q.points && q.points > 0) return "correct";
  if (q.awardedPoints > 0) return "partial";
  return "incorrect";
}

function durationLabel(startIso: string, endIso: string | null): string {
  if (!endIso) return "—";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

function answerLabel(q: QuizReviewQuestion): string {
  const a = q.answer;
  if (a === undefined || a === null || a === "") return "No answer";
  if (q.type === "true_false") return a ? "True" : "False";
  if (q.type === "short") return String(a);
  const ids = Array.isArray(a) ? a : [a];
  const labels = ids.map((id) => q.options.find((o) => o.id === id)?.text ?? String(id));
  return labels.join(", ") || "No answer";
}

type Filter = "all" | "incorrect" | "partial";

export default function QuizResult({
  attemptId,
  attemptsAllowed,
  onRetake,
  onBack,
}: {
  attemptId: string;
  attemptsAllowed?: number;
  onRetake?: () => void;
  onBack: () => void;
}) {
  const [review, setReview] = useState<QuizReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;
    getQuizReview(attemptId)
      .then((r) => { if (active) setReview(r); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load this result"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attemptId]);

  const counts = useMemo(() => {
    if (!review) return { correct: 0, partial: 0, incorrect: 0 };
    return review.questions.reduce(
      (acc, q) => {
        const kind = questionKind(q);
        acc[kind] += 1;
        return acc;
      },
      { correct: 0, partial: 0, incorrect: 0 },
    );
  }, [review]);

  const visibleQuestions = useMemo(() => {
    if (!review) return [];
    if (filter === "all") return review.questions;
    return review.questions.filter((q) => questionKind(q) === filter);
  }, [review, filter]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading result…</p>;
  }

  if (!review) {
    return <EmptyState icon={X} title="Result not available" hint="This attempt could not be loaded." />;
  }

  const canRetake = Boolean(onRetake) && (attemptsAllowed === undefined || review.attemptNo < attemptsAllowed);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to quizzes</Button>

      <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-5">
          <Ring value={review.percent} />
          <div>
            <p className="text-lg font-semibold text-slate-900">{review.quizTitle}</p>
            <Badge className={review.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>
              {review.passed ? "Passed" : "Did not pass"}
            </Badge>
            <p className="mt-1 text-sm text-slate-500">Score {review.score} / {review.maxScore}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:mt-0 sm:min-w-[260px]">
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2"><span className="text-emerald-800">Correct</span><b className="text-emerald-900">{counts.correct}</b></div>
          <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2"><span className="text-amber-800">Partly correct</span><b className="text-amber-900">{counts.partial}</b></div>
          <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2"><span className="text-rose-800">Incorrect</span><b className="text-rose-900">{counts.incorrect}</b></div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-slate-600"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Time taken</span><b>{durationLabel(review.startedAt, review.submittedAt)}</b></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />
          Submitted {review.submittedAt ? new Date(review.submittedAt).toLocaleString() : "—"} · Attempt {review.attemptNo}{attemptsAllowed ? ` of ${attemptsAllowed}` : ""}
        </span>
        {canRetake && (
          <Button size="sm" variant="outline" onClick={onRetake}><RotateCcw className="mr-1.5 h-4 w-4" />Retake quiz</Button>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          {(["all", "incorrect", "partial"] as Filter[]).map((f) => (
            <button
              key={f} type="button" onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                filter === f ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {f === "all" ? "All" : f === "incorrect" ? "Incorrect" : "Partly correct"}
            </button>
          ))}
        </div>

        {visibleQuestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nothing to show for this filter.</p>
        ) : (
          <div className="space-y-3">
            {visibleQuestions.map((q, i) => {
              const kind = questionKind(q);
              return (
                <div key={q.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{i + 1}. {q.prompt}</p>
                    <span className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      kind === "correct" ? "bg-emerald-100 text-emerald-800" : kind === "partial" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700",
                    )}>
                      {kind === "correct" ? <Check className="h-3 w-3" /> : kind === "partial" ? <Minus className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {q.awardedPoints}/{q.points}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Your answer: <span className="font-medium text-slate-800">{answerLabel(q)}</span></p>
                  {kind !== "correct" && q.correct.length > 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      Correct answer: <span className="font-medium text-emerald-700">
                        {q.type === "short"
                          ? q.correct.join(" or ")
                          : q.type === "true_false"
                            ? (q.correct[0] ? "True" : "False")
                            : (q.correct as string[]).map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(", ")}
                      </span>
                    </p>
                  )}
                  {q.explanation && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{q.explanation}</p>}
                  {q.overridden && <Badge className="mt-2 bg-indigo-100 text-indigo-700">Points adjusted by teacher</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
