import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, ListChecks, CheckSquare, ToggleLeft, Type,
  Pencil, BarChart3,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { usePermission } from "../../hooks/usePermission";
import type { Quiz, QuizOption, QuizQuestion, QuizQuestionType, QuizShowAnswers, QuizStatus } from "../../types";
import {
  createQuestion, createQuiz, deleteQuestion, deleteQuiz, fetchManageableQuizzes, fetchQuizQuestions,
  type QuestionDraft, type QuizDraft, updateQuestion, updateQuiz,
} from "../../lib/quizzes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, Reveal, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import QuizResultsTable from "./QuizResultsTable";

const QUESTION_TYPES: { value: QuizQuestionType; label: string; icon: typeof ListChecks }[] = [
  { value: "single", label: "Multiple choice", icon: ListChecks },
  { value: "multi", label: "Multi-select", icon: CheckSquare },
  { value: "true_false", label: "True / False", icon: ToggleLeft },
  { value: "short", label: "Short answer", icon: Type },
];

const SHOW_ANSWERS: { value: QuizShowAnswers; label: string }[] = [
  { value: "after_submit", label: "Right after a student submits" },
  { value: "after_close", label: "Only once the quiz closes" },
  { value: "never", label: "Never show answers" },
];

function uid() {
  return crypto.randomUUID();
}

/** A question card's editable state. `id` is a real DB id once saved, or a `new:` prefix before. */
interface DraftQuestion {
  id: string;
  isNew: boolean;
  type: QuizQuestionType;
  prompt: string;
  options: QuizOption[];
  correct: (string | boolean)[];
  points: number;
  explanation: string;
}

function toDraft(q: QuizQuestion): DraftQuestion {
  return { id: q.id, isNew: false, type: q.type, prompt: q.prompt, options: q.options, correct: q.correct, points: q.points, explanation: q.explanation };
}

function blankQuestion(type: QuizQuestionType): DraftQuestion {
  if (type === "single" || type === "multi") {
    const a = uid();
    const b = uid();
    return { id: `new:${uid()}`, isNew: true, type, prompt: "", options: [{ id: a, text: "" }, { id: b, text: "" }], correct: [], points: 10, explanation: "" };
  }
  if (type === "true_false") {
    return { id: `new:${uid()}`, isNew: true, type, prompt: "", options: [], correct: [true], points: 10, explanation: "" };
  }
  return { id: `new:${uid()}`, isNew: true, type, prompt: "", options: [], correct: [""], points: 10, explanation: "" };
}

function toDraftQuiz(q?: Quiz): QuizDraft {
  if (!q) {
    return {
      title: "", description: "", programId: null, cohortId: null, status: "draft",
      timeLimitMinutes: 20, maxAttempts: 1, passMark: 50, shuffleQuestions: false,
      shuffleOptions: false, showAnswers: "after_submit", opensAt: null, closesAt: null,
    };
  }
  return {
    title: q.title, description: q.description, programId: q.programId, cohortId: q.cohortId,
    status: q.status, timeLimitMinutes: q.timeLimitMinutes, maxAttempts: q.maxAttempts, passMark: q.passMark,
    shuffleQuestions: q.shuffleQuestions, shuffleOptions: q.shuffleOptions, showAnswers: q.showAnswers,
    opensAt: q.opensAt, closesAt: q.closesAt,
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function QuestionCard({
  draft, index, total, onChange, onDelete, onMove,
}: {
  draft: DraftQuestion;
  index: number;
  total: number;
  onChange: (next: DraftQuestion) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = QUESTION_TYPES.find((t) => t.value === draft.type)!;
  const Icon = meta.icon;

  function setOptionText(optId: string, text: string) {
    onChange({ ...draft, options: draft.options.map((o) => (o.id === optId ? { ...o, text } : o)) });
  }
  function addOption() {
    if (draft.options.length >= 10) return;
    onChange({ ...draft, options: [...draft.options, { id: uid(), text: "" }] });
  }
  function removeOption(optId: string) {
    if (draft.options.length <= 2) return;
    onChange({
      ...draft,
      options: draft.options.filter((o) => o.id !== optId),
      correct: draft.correct.filter((c) => c !== optId),
    });
  }
  function toggleCorrectSingle(optId: string) {
    onChange({ ...draft, correct: [optId] });
  }
  function toggleCorrectMulti(optId: string) {
    const has = draft.correct.includes(optId);
    onChange({ ...draft, correct: has ? draft.correct.filter((c) => c !== optId) : [...draft.correct, optId] });
  }

  return (
    <div className={cn(panelClass, "space-y-3 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Question {index + 1} · {meta.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Textarea
        rows={2}
        placeholder="Question prompt"
        value={draft.prompt}
        onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
      />

      {(draft.type === "single" || draft.type === "multi") && (
        <div className="space-y-2">
          {draft.options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (draft.type === "single" ? toggleCorrectSingle(o.id) : toggleCorrectMulti(o.id))}
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                  draft.correct.includes(o.id)
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 text-transparent hover:border-emerald-400",
                )}
                title="Mark as correct"
              >
                ✓
              </button>
              <Input value={o.text} placeholder="Option text" onChange={(e) => setOptionText(o.id, e.target.value)} />
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={draft.options.length <= 2} onClick={() => removeOption(o.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={draft.options.length >= 10}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add option
          </Button>
          <p className="text-[11px] text-slate-500">
            Tap the circle to mark the correct {draft.type === "multi" ? "answers" : "answer"}.
          </p>
        </div>
      )}

      {draft.type === "true_false" && (
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange({ ...draft, correct: [v] })}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
                draft.correct[0] === v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600",
              )}
            >
              {v ? "True" : "False"}
            </button>
          ))}
        </div>
      )}

      {draft.type === "short" && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-500">Accepted answers (any one matches, case/space-insensitive)</Label>
          {draft.correct.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={String(c)}
                onChange={(e) => {
                  const next = [...draft.correct];
                  next[i] = e.target.value;
                  onChange({ ...draft, correct: next });
                }}
              />
              <Button
                type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                disabled={draft.correct.length <= 1}
                onClick={() => onChange({ ...draft, correct: draft.correct.filter((_, idx) => idx !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...draft, correct: [...draft.correct, ""] })} disabled={draft.correct.length >= 20}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add accepted answer
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Points</Label>
          <Input type="number" min={1} max={100} value={draft.points} onChange={(e) => onChange({ ...draft, points: Number(e.target.value) || 1 })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Explanation (shown after review)</Label>
          <Input value={draft.explanation} onChange={(e) => onChange({ ...draft, explanation: e.target.value })} placeholder="Optional" />
        </div>
      </div>
    </div>
  );
}

function QuizEditor({ quiz, onClose, onSaved }: { quiz: Quiz | null; onClose: () => void; onSaved: () => void }) {
  const { state, currentUser } = useApp();
  const canManageAll = usePermission("quizzes.manage_all");
  const [settings, setSettings] = useState<QuizDraft>(() => toDraftQuiz(quiz ?? undefined));
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!quiz);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!quiz) return;
    let active = true;
    fetchQuizQuestions(quiz.id)
      .then((qs) => { if (active) setQuestions(qs.map(toDraft)); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load questions"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quiz]);

  const cohorts = useMemo(
    () => (canManageAll ? state.cohorts : state.cohorts.filter((c) => c.teacherId === currentUser?.id)),
    [state.cohorts, canManageAll, currentUser?.id],
  );

  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 0), 0);

  function addQuestion(type: QuizQuestionType) {
    setQuestions((qs) => [...qs, blankQuestion(type)]);
  }
  function updateAt(index: number, next: DraftQuestion) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? next : q)));
  }
  function removeAt(index: number) {
    const q = questions[index];
    if (!q.isNew) setRemoved((r) => [...r, q.id]);
    setQuestions((qs) => qs.filter((_, i) => i !== index));
  }
  function moveAt(index: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const next = [...qs];
      const j = index + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function validate(): string | null {
    if (!settings.title.trim()) return "Give the quiz a title.";
    if (!settings.programId && !settings.cohortId) return "Pick a programme or a cohort.";
    if (questions.length === 0) return "Add at least one question.";
    for (const q of questions) {
      if (!q.prompt.trim()) return "Every question needs a prompt.";
      if ((q.type === "single" || q.type === "multi") && q.correct.length === 0) return "Mark a correct answer for every multiple-choice question.";
      if ((q.type === "single" || q.type === "multi") && q.options.some((o) => !o.text.trim())) return "Fill in every option.";
      if (q.type === "short" && q.correct.some((c) => !String(c).trim())) return "Fill in every accepted answer.";
    }
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const savedQuiz = quiz ? await updateQuiz(quiz.id, settings) : await createQuiz(settings);
      for (const id of removed) await deleteQuestion(id);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const draft: QuestionDraft = {
          position: i, type: q.type, prompt: q.prompt, options: q.options, correct: q.correct,
          points: Number(q.points) || 1, explanation: q.explanation,
        };
        if (q.isNew) await createQuestion(savedQuiz.id, draft);
        else await updateQuestion(q.id, savedQuiz.id, draft);
      }
      toast.success(quiz ? "Quiz updated" : "Quiz created");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the quiz");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title={quiz ? "Edit quiz" : "New quiz"} subtitle="Build questions, then publish when ready." />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save quiz"}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_372px]">
        <div className="space-y-3">
          {loading ? (
            <EmptyState title="Loading questions…" />
          ) : questions.length === 0 ? (
            <EmptyState icon={ListChecks} title="No questions yet" hint="Use the buttons below to add your first question." />
          ) : (
            questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                draft={q}
                index={i}
                total={questions.length}
                onChange={(next) => updateAt(i, next)}
                onDelete={() => removeAt(i)}
                onMove={(dir) => moveAt(i, dir)}
              />
            ))
          )}
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <Button key={t.value} type="button" variant="outline" size="sm" onClick={() => addQuestion(t.value)}>
                <t.icon className="mr-1.5 h-3.5 w-3.5" /> {t.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={cn(panelClass, "space-y-3 p-4")}>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Title</Label>
              <Input value={settings.title} onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Description</Label>
              <Textarea rows={2} value={settings.description} onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Programme</Label>
                <Select
                  value={settings.programId ?? "none"}
                  onValueChange={(v) => setSettings((s) => ({ ...s, programId: v === "none" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {state.programs.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Cohort</Label>
                <Select
                  value={settings.cohortId ?? "none"}
                  onValueChange={(v) => setSettings((s) => ({ ...s, cohortId: v === "none" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Time limit (minutes)</Label>
                <Input
                  type="number" min={0}
                  value={settings.timeLimitMinutes ?? ""}
                  placeholder="Untimed"
                  onChange={(e) => setSettings((s) => ({ ...s, timeLimitMinutes: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Attempts allowed</Label>
                <Input type="number" min={1} max={20} value={settings.maxAttempts} onChange={(e) => setSettings((s) => ({ ...s, maxAttempts: Number(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Pass mark (%)</Label>
              <Input type="number" min={0} max={100} value={settings.passMark} onChange={(e) => setSettings((s) => ({ ...s, passMark: Number(e.target.value) || 0 }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Opens</Label>
                <Input type="datetime-local" value={toLocalInput(settings.opensAt)} onChange={(e) => setSettings((s) => ({ ...s, opensAt: fromLocalInput(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Closes</Label>
                <Input type="datetime-local" value={toLocalInput(settings.closesAt)} onChange={(e) => setSettings((s) => ({ ...s, closesAt: fromLocalInput(e.target.value) }))} />
              </div>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm text-slate-700">
              Shuffle question order
              <input type="checkbox" checked={settings.shuffleQuestions} onChange={(e) => setSettings((s) => ({ ...s, shuffleQuestions: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm text-slate-700">
              Shuffle answer order
              <input type="checkbox" checked={settings.shuffleOptions} onChange={(e) => setSettings((s) => ({ ...s, shuffleOptions: e.target.checked }))} />
            </label>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Show answers</Label>
              <Select value={settings.showAnswers} onValueChange={(v) => setSettings((s) => ({ ...s, showAnswers: v as QuizShowAnswers }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHOW_ANSWERS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={settings.status} onValueChange={(v) => setSettings((s) => ({ ...s, status: v as QuizStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-slate-500">A student's highest-scoring attempt counts, when attempts &gt; 1.</p>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-300">Questions</p>
              <p className="text-lg font-semibold">{questions.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-300">Total points</p>
              <p className="text-lg font-semibold">{totalPoints}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-300">Pass mark</p>
              <p className="text-lg font-semibold">{settings.passMark}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusTone(status: QuizStatus): string {
  if (status === "published") return "bg-emerald-100 text-emerald-800";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-800";
}

export default function QuizBuilder() {
  const { state } = useApp();
  const canViewResults = usePermission("quizzes.view_results");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Quiz | "new" | null>(null);
  const [resultsFor, setResultsFor] = useState<Quiz | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setQuizzes(await fetchManageableQuizzes());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load quizzes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleDelete(q: Quiz) {
    if (!confirm(`Delete "${q.title}"? This also removes its questions and attempts.`)) return;
    try {
      await deleteQuiz(q.id);
      toast.success("Quiz deleted");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the quiz");
    }
  }

  const programName = (id: string | null) => state.programs.find((p) => p.id === id)?.title;
  const cohortName = (id: string | null) => state.cohorts.find((c) => c.id === id)?.name;

  if (resultsFor) {
    return <QuizResultsTable quiz={resultsFor} onBack={() => setResultsFor(null)} />;
  }

  if (editing) {
    return (
      <QuizEditor
        quiz={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />
    );
  }

  return (
    <Reveal className="space-y-5">
      <SectionHeader
        title="Quizzes"
        subtitle="Build timed, auto-graded quizzes for your programmes and cohorts."
        action={<Button onClick={() => setEditing("new")}><Plus className="mr-1.5 h-4 w-4" /> New quiz</Button>}
      />
      {loading ? (
        <EmptyState title="Loading quizzes…" />
      ) : quizzes.length === 0 ? (
        <EmptyState icon={ListChecks} title="No quizzes yet" hint="Create your first quiz to get started." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => (
            <div key={q.id} className={cn(panelClass, "space-y-3 p-4")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{q.title}</p>
                  <p className="text-xs text-slate-500">
                    {programName(q.programId) ?? cohortName(q.cohortId) ?? "No scope set"}
                  </p>
                </div>
                <Badge className={cn("shrink-0", statusTone(q.status))}>{q.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{q.questionCount} question{q.questionCount === 1 ? "" : "s"}</span>
                <span>{q.totalPoints} pts</span>
                <span>{q.timeLimitMinutes ? `${q.timeLimitMinutes} min` : "Untimed"}</span>
                <span>Pass {q.passMark}%</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(q)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                {canViewResults && (
                  <Button size="sm" variant="outline" onClick={() => setResultsFor(q)}>
                    <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Results
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => handleDelete(q)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}
