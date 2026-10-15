import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileQuestion, Clock, Repeat, CheckCircle2, PlayCircle } from "lucide-react";
import type { Quiz, QuizAttemptSummary } from "../../types";
import { fetchVisibleQuizzes, fetchMyQuizAttempts, groupAttemptsByQuiz, summarizeAttempts } from "../../lib/quizzes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import QuizPlayer from "./QuizPlayer";
import QuizResult from "./QuizResult";

function windowLabel(quiz: Quiz): string | null {
  const now = Date.now();
  if (quiz.opensAt && new Date(quiz.opensAt).getTime() > now) {
    return `Opens ${new Date(quiz.opensAt).toLocaleString()}`;
  }
  if (quiz.closesAt && new Date(quiz.closesAt).getTime() < now) {
    return `Closed ${new Date(quiz.closesAt).toLocaleDateString()}`;
  }
  if (quiz.closesAt) {
    return `Closes ${new Date(quiz.closesAt).toLocaleString()}`;
  }
  return null;
}

export default function StudentQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [q, a] = await Promise.all([fetchVisibleQuizzes(), fetchMyQuizAttempts()]);
      setQuizzes(q);
      setAttempts(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load quizzes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const byQuiz = useMemo(() => groupAttemptsByQuiz(attempts), [attempts]);

  if (playing) {
    return (
      <QuizPlayer
        quizId={playing}
        onExit={() => setPlaying(null)}
        onDone={(attemptId) => { setPlaying(null); setReviewing(attemptId); load(); }}
      />
    );
  }

  if (reviewing) {
    const quizId = attempts.find((a) => a.attemptId === reviewing)?.quizId;
    const quiz = quizzes.find((q) => q.id === quizId);
    return (
      <QuizResult
        attemptId={reviewing}
        attemptsAllowed={quiz?.maxAttempts}
        onBack={() => setReviewing(null)}
        onRetake={quiz ? () => { setReviewing(null); setPlaying(quiz.id); } : undefined}
      />
    );
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading quizzes…</p>;
  }

  if (quizzes.length === 0) {
    return <EmptyState icon={FileQuestion} title="No quizzes yet" hint="Your teacher hasn't published any quizzes for your cohort yet." />;
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Quizzes" subtitle="Timed checks for your cohort. Submit before the clock runs out." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => {
          const { inProgress, best, attemptsUsed, exhausted } = summarizeAttempts(byQuiz.get(quiz.id) ?? [], quiz.maxAttempts);
          const win = windowLabel(quiz);
          const closedNow = quiz.closesAt ? new Date(quiz.closesAt).getTime() < Date.now() : false;
          const notYetOpen = quiz.opensAt ? new Date(quiz.opensAt).getTime() > Date.now() : false;

          return (
            <div key={quiz.id} className={cn(panelClass, "flex flex-col gap-3 p-5")}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{quiz.title}</p>
                {best && (
                  <Badge className={best.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>
                    {best.percent}%
                  </Badge>
                )}
              </div>
              {quiz.description && <p className="line-clamp-2 text-sm text-slate-500">{quiz.description}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{quiz.timeLimitMinutes} min</span>
                <span className="flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{attemptsUsed}/{quiz.maxAttempts} attempts</span>
                <span>{quiz.questionCount} questions · {quiz.totalPoints} pts</span>
              </div>
              {win && <p className="text-xs font-medium text-amber-700">{win}</p>}

              <div className="mt-1 flex items-center gap-2">
                {inProgress ? (
                  <Button size="sm" className="bg-amber-400 text-amber-950 hover:bg-amber-500" onClick={() => setPlaying(quiz.id)}>
                    <PlayCircle className="mr-1.5 h-4 w-4" />Resume
                  </Button>
                ) : exhausted ? (
                  best && (
                    <Button size="sm" variant="outline" onClick={() => setReviewing(best.attemptId)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />View result
                    </Button>
                  )
                ) : notYetOpen || closedNow ? (
                  <Button size="sm" variant="outline" disabled>{notYetOpen ? "Not open yet" : "Closed"}</Button>
                ) : (
                  <Button size="sm" onClick={() => setPlaying(quiz.id)}>
                    <PlayCircle className="mr-1.5 h-4 w-4" />{attemptsUsed > 0 ? "Retake" : "Start quiz"}
                  </Button>
                )}
                {best && !exhausted && (
                  <Button size="sm" variant="ghost" onClick={() => setReviewing(best.attemptId)}>View last result</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
