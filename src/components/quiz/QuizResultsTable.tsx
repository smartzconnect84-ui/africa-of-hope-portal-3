import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, RefreshCw, Save } from "lucide-react";
import { useApp } from "../../context/AppContext";
import type { Quiz, QuizAttemptSummary, QuizReview } from "../../types";
import {
  adjustQuizAnswerPoints, fetchQuizAttempts, getQuizReview, regradeQuiz,
} from "../../lib/quizzes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

const TH = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const TD = "px-3 py-2 text-sm text-slate-700";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function durationLabel(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function QuizResultsTable({ quiz, onBack }: { quiz: Quiz; onBack: () => void }) {
  const { state } = useApp();
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [regrading, setRegrading] = useState(false);
  const [reviewing, setReviewing] = useState<QuizReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      setAttempts(await fetchQuizAttempts(quiz.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load results");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [quiz.id]);

  const studentName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "Unknown student";

  const best = useMemo(() => {
    const byStudent = new Map<string, QuizAttemptSummary[]>();
    for (const a of attempts) {
      const list = byStudent.get(a.studentId) ?? [];
      list.push(a);
      byStudent.set(a.studentId, list);
    }
    return Array.from(byStudent.entries()).map(([studentId, list]) => {
      const graded = list.filter((a) => a.status !== "in_progress" && a.percent !== null);
      const bestAttempt = graded.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0] ?? list[0];
      return { studentId, attempts: list.length, best: bestAttempt };
    });
  }, [attempts]);

  async function openReview(attemptId: string) {
    setReviewLoading(true);
    try {
      setReviewing(await getQuizReview(attemptId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load this attempt");
    } finally {
      setReviewLoading(false);
    }
  }

  async function saveOverride(questionId: string) {
    if (!reviewing) return;
    const raw = overrides[questionId];
    if (raw === undefined) return;
    const points = Number(raw);
    if (!Number.isFinite(points)) { toast.error("Enter a number"); return; }
    try {
      await adjustQuizAnswerPoints(reviewing.attemptId, questionId, points);
      toast.success("Points updated");
      await openReview(reviewing.attemptId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update points");
    }
  }

  async function handleRegrade() {
    setRegrading(true);
    try {
      const n = await regradeQuiz(quiz.id);
      toast.success(`Regraded ${n} attempt${n === 1 ? "" : "s"}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regrade");
    } finally {
      setRegrading(false);
    }
  }

  function exportCsv() {
    const rows = [["Student", "Attempts", "Best score", "Max", "Percent", "Status"]];
    for (const row of best) {
      rows.push([
        studentName(row.studentId),
        String(row.attempts),
        String(row.best?.score ?? ""),
        String(row.best?.maxScore ?? ""),
        String(row.best?.percent ?? ""),
        row.best?.status ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quiz.title.replace(/[^a-z0-9]+/gi, "-")}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (reviewing) {
    const owner = attempts.find((a) => a.attemptId === reviewing.attemptId);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title={`${owner ? studentName(owner.studentId) : "Student"}'s attempt`}
            subtitle={`${reviewing.quizTitle} · Score ${reviewing.score}/${reviewing.maxScore} (${reviewing.percent}%)`}
          />
          <Button variant="outline" onClick={() => setReviewing(null)}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
        </div>
        <div className="space-y-3">
          {reviewing.questions.map((q, i) => (
            <div key={q.id} className={cn(panelClass, "space-y-2 p-4")}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">Q{i + 1}. {q.prompt}</p>
                <Badge className={q.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>
                  {q.awardedPoints}/{q.points} pts
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Answer: {Array.isArray(q.answer) ? q.answer.join(", ") : String(q.answer ?? "—")}
              </p>
              {q.type === "short" && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number" min={0} max={q.points} className="h-8 w-24"
                    placeholder={String(q.awardedPoints)}
                    value={overrides[q.id] ?? ""}
                    onChange={(e) => setOverrides((o) => ({ ...o, [q.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" onClick={() => saveOverride(q.id)}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Override points
                  </Button>
                  {q.overridden && <Badge className="bg-amber-100 text-amber-800">Overridden</Badge>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeader title={`Results · ${quiz.title}`} subtitle="One row per student; their best attempt counts." />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" /> Export CSV</Button>
          <Button variant="outline" onClick={handleRegrade} disabled={regrading}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", regrading && "animate-spin")} /> Regrade all
          </Button>
        </div>
      </div>

      {loading ? (
        <EmptyState title="Loading results…" />
      ) : best.length === 0 ? (
        <EmptyState title="No attempts yet" hint="Results appear once students start taking this quiz." />
      ) : (
        <div className={cn(panelClass, "overflow-x-auto")}>
          <table className="w-full">
            <thead className="border-b border-emerald-900/10">
              <tr>
                <th className={TH}>Student</th>
                <th className={TH}>Attempts</th>
                <th className={TH}>Best score</th>
                <th className={TH}>Status</th>
                <th className={TH}>Duration</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/5">
              {best.map((row) => (
                <tr key={row.studentId}>
                  <td className={TD}>{studentName(row.studentId)}</td>
                  <td className={TD}>{row.attempts}</td>
                  <td className={TD}>
                    {row.best?.percent !== null && row.best?.percent !== undefined
                      ? `${row.best.score}/${row.best.maxScore} (${row.best.percent}%)`
                      : "In progress"}
                  </td>
                  <td className={TD}>
                    <Badge className={row.best?.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>
                      {row.best?.status === "in_progress" ? "In progress" : row.best?.passed ? "Passed" : "Failed"}
                    </Badge>
                  </td>
                  <td className={TD}>{row.best ? durationLabel(row.best.startedAt, row.best.submittedAt) : "—"}</td>
                  <td className={TD}>
                    {row.best && row.best.status !== "in_progress" && (
                      <Button size="sm" variant="outline" onClick={() => openReview(row.best!.attemptId)} disabled={reviewLoading}>
                        Review
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500">Last updated: {fmtDate(new Date().toISOString())}</p>
    </div>
  );
}
