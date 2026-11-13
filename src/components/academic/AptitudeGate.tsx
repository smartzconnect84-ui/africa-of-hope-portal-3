import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { panelClass } from "@/components/Navigation";
import { cn } from "@/lib/utils";
import { SEEDED_ENTRANCE_QUESTIONS } from "@/lib/entranceTest";
import {
  APTITUDE_PASS_MARK,
  aptitudeResult,
  monthsForWeeks,
  recordAptitude,
} from "@/lib/portalOps";

interface GateProgram {
  id: string;
  title: string;
  durationWeeks: number;
}

interface GateUser {
  id: string;
  name?: string;
}

/**
 * Blocks lesson access until the applicant scores at least 60% on the entrance
 * test. The pass is stored per student and programme, so it only has to be
 * taken once per enrolled track.
 */
export function AptitudeGate({
  program,
  user,
  onCleared,
}: {
  program: GateProgram;
  user: GateUser;
  onCleared?: () => void;
}) {
  const questions = SEEDED_ENTRANCE_QUESTIONS;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ percent: number; passed: boolean } | null>(null);

  const existing = useMemo(() => aptitudeResult(user.id, program.id), [user.id, program.id]);
  const answered = Object.keys(answers).length;
  const months = monthsForWeeks(program.durationWeeks);

  function grade() {
    const correct = questions.filter((q) => answers[q.id] === q.correct).length;
    const percent = Math.round((correct / Math.max(1, questions.length)) * 100);
    const passed = percent >= APTITUDE_PASS_MARK;
    recordAptitude({
      userId: user.id,
      programId: program.id,
      percent,
      passed,
      takenAt: new Date().toISOString(),
      reference: `APT-${Date.now().toString(36).toUpperCase()}`,
    });
    setSubmitted(true);
    setResult({ percent, passed });
    toast[passed ? "success" : "error"](
      passed
        ? `You scored ${percent}% — lessons unlocked.`
        : `You scored ${percent}%. A score of ${APTITUDE_PASS_MARK}% is required.`,
    );
  }

  if (result?.passed) {
    return (
      <div className={cn(panelClass, "mx-auto max-w-2xl p-8 text-center")}>
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-semibold">Entrance test passed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You scored {result.percent}% on the {program.title} entrance test, meeting the{" "}
          {APTITUDE_PASS_MARK}% requirement. Your lessons are now available.
        </p>
        <Button className="mt-6" onClick={onCleared}>
          Start lessons
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className={cn(panelClass, "border-amber-500/40 p-6")}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="rounded-full bg-amber-500/10 p-3">
            <Lock className="h-6 w-6 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Entrance test required</h2>
              <Badge variant="outline">{months}-month track</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Students enrolled on 1, 3 and 6 month courses must pass this aptitude test with{" "}
              <strong>{APTITUDE_PASS_MARK}% or higher</strong> before lessons unlock. You can retake it
              as many times as you need.
            </p>
            {existing && !existing.passed && (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Previous attempt: {existing.percent}% — below the pass mark.
              </p>
            )}
          </div>
        </div>
      </div>

      {submitted && result && !result.passed && (
        <div className={cn(panelClass, "border-destructive/40 p-4")}>
          <p className="text-sm">
            <strong>Not yet passed.</strong> You scored {result.percent}%. Review the questions below
            and try again — you need {APTITUDE_PASS_MARK}%.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <fieldset key={question.id} className={cn(panelClass, "p-5")}>
            <legend className="sr-only">Question {index + 1}</legend>
            <p className="mb-3 font-medium">
              {index + 1}. {question.prompt}
            </p>
            <div className="space-y-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition",
                      selected ? "border-primary bg-primary/5" : "hover:border-primary/40",
                    )}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      value={option.id}
                      checked={selected}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [question.id]: option.id }))
                      }
                      className="h-4 w-4"
                    />
                    <span>{option.text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className={cn(panelClass, "flex flex-wrap items-center justify-between gap-3 p-4")}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          {answered} of {questions.length} answered
        </p>
        <Button onClick={grade} disabled={answered < questions.length}>
          Submit for grading
        </Button>
      </div>
    </div>
  );
}

export default AptitudeGate;
