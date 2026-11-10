import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BadgeCheck, ClipboardList, ShieldCheck, Timer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ENTRANCE_SETTINGS,
  SEEDED_ENTRANCE_QUESTIONS,
  fetchEntranceQuizzes,
  gradeEntrance,
  loadEntranceHistory,
  loadEntrancePass,
  loadEntranceSettings,
  saveEntranceResult,
  saveEntranceResultBackend,
  type EntranceResult,
} from "@/lib/entranceTest";

const cardCls = "rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";

function fmtClock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export default function EntranceTest({ compact = false }: { compact?: boolean }) {
  const settings = useMemo(loadEntranceSettings, []);
  const [backendQuizzes, setBackendQuizzes] = useState<{ id: string; title: string; description: string; passMark: number; timeLimitMinutes: number | null; questionCount: number }[]>([]);
  const [stage, setStage] = useState<"intro" | "form" | "test" | "done">("intro");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [programme, setProgramme] = useState("");
  const [formError, setFormError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<EntranceResult | null>(null);
  const [history, setHistory] = useState<EntranceResult[]>([]);
  const [attemptsUsed, setAttemptsUsed] = useState(0);

  useEffect(() => {
    setHistory(loadEntranceHistory());
    fetchEntranceQuizzes().then(setBackendQuizzes).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (stage !== "test") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const timeMs = deadline - now;
  const questions = SEEDED_ENTRANCE_QUESTIONS;
  const passMark = settings.passMark ?? DEFAULT_ENTRANCE_SETTINGS.passMark;
  const timeMinutes = settings.timeMinutes ?? DEFAULT_ENTRANCE_SETTINGS.timeMinutes;

  useEffect(() => {
    if (stage === "test" && deadline > 0 && now >= deadline) {
      finish(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, stage]);

  function startForm() {
    const pass = loadEntrancePass();
    setAttemptsUsed(loadEntranceHistory().length);
    if (pass?.passed) {
      setResult(pass);
      setStage("done");
      return;
    }
    setStage("form");
  }

  function begin() {
    if (!name.trim()) { setFormError("Enter your full name — e.g. “Mary Kollie”."); return; }
    if (!contact.trim() || contact.trim().length < 5) { setFormError("Enter a phone number or email where we can reach you."); return; }
    if (!programme.trim()) { setFormError("Enter the programme you are applying for — e.g. “Nursing Assistant”."); return; }
    if (attemptsUsed >= (settings.maxAttempts ?? 3) && loadEntranceHistory().length >= (settings.maxAttempts ?? 3)) {
      setFormError(`You have used all ${settings.maxAttempts ?? 3} attempts on this device. Visit the school office for help.`);
      return;
    }
    setFormError("");
    setAnswers({});
    setIndex(0);
    setDeadline(Date.now() + timeMinutes * 60 * 1000);
    setNow(Date.now());
    setStage("test");
  }

  function finish(auto = false) {
    const r = gradeEntrance(questions, answers, passMark, {
      name: name.trim() || result?.name || "Applicant",
      contact: contact.trim(),
      programme: programme.trim(),
      quizId: "seeded-aptitude",
      quizTitle: backendQuizzes[0]?.title ?? "Africa of Hope Entrance Aptitude Test",
    });
    const hist = saveEntranceResult(r);
    setHistory(hist);
    setAttemptsUsed(hist.length);
    setResult(r);
    setStage("done");
    saveEntranceResultBackend(r);
    if (auto) return;
  }

  const answered = Object.keys(answers).length;
  const q = questions[index];

  if (stage === "done" && result) {
    return (
      <div className={cardCls}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          {result.passed ? <BadgeCheck className="h-5 w-5 text-emerald-700" /> : <XCircle className="h-5 w-5 text-rose-600" />}
          {result.passed ? "You passed — save your reference" : "Not yet passed — try again"}
        </h3>
        <div role="status" className={`mt-3 rounded-xl p-4 text-center ${result.passed ? "bg-emerald-800 text-white" : "bg-rose-50 text-rose-900 ring-1 ring-rose-100"}`}>
          <p className="text-2xl font-bold">{result.percent}%</p>
          <p className="text-xs opacity-90">{result.score} of {result.maxScore} correct · Pass mark {result.passMark}% · Ref {result.ref}</p>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {result.passed
            ? `Well done, ${result.name}. Show reference ${result.ref} when you apply — staff verify it before approving your admission.`
            : `You need ${result.passMark}% to pass. Revise the prep pack and retake the test (${Math.max(0, (settings.maxAttempts ?? 3) - history.length)} attempts left on this device).`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.passed ? null : <Button type="button" onClick={() => { setStage("form"); setResult(null); }} className="bg-emerald-800 hover:bg-emerald-700">Retake test</Button>}
          <Button type="button" variant="outline" onClick={() => { setStage("intro"); setResult(null); }}>Back to admissions</Button>
        </div>
        {history.length > 1 ? (
          <p className="mt-3 text-xs text-slate-500">Attempts on this device: {history.length} of {settings.maxAttempts ?? 3}.</p>
        ) : null}
      </div>
    );
  }

  if (stage === "test" && q) {
    return (
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700"><Timer className="h-4 w-4" /> Entrance test · {fmtClock(timeMs)} left</p>
          <p className="text-xs text-slate-500">{answered} of {questions.length} answered</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={questions.length} aria-label="Questions answered">
          <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${Math.round((answered / questions.length) * 100)}%` }} />
        </div>
        {timeMs < 2 * 60 * 1000 ? (
          <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Less than 2 minutes left — your test submits automatically at 00:00.</p>
        ) : null}
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold text-slate-500">Question {index + 1} of {questions.length}</p>
          <p className="mt-1 font-semibold text-emerald-950">{q.prompt}</p>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label={q.prompt}>
            {q.options.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${answers[q.id] === o.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-900/30"}`}>
                <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} className="h-4 w-4 accent-emerald-800" />
                <span className="font-semibold text-emerald-900">{o.id.toUpperCase()}.</span> <span className="text-slate-700">{o.text}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>Back</Button>
          {index < questions.length - 1 ? (
            <Button type="button" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} className="bg-emerald-800 hover:bg-emerald-700">Next</Button>
          ) : (
            <Button type="button" onClick={() => finish(false)} className="bg-amber-400 text-emerald-950 hover:bg-amber-300">
              Submit test ({answered}/{questions.length})
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {questions.map((qq, i) => (
            <button key={qq.id} type="button" onClick={() => setIndex(i)} aria-label={`Go to question ${i + 1}${answers[qq.id] ? " (answered)" : ""}`} className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold ${i === index ? "bg-emerald-800 text-white" : answers[qq.id] ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-500"}`}>{i + 1}</button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "form") {
    return (
      <div className={cardCls}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950"><ClipboardList className="h-5 w-5 text-emerald-700" /> Your details for the test record</h3>
        <p className="mt-1 text-sm text-slate-600">Use the same name and phone number as your application so staff can match your pass.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="et-name">Full name</Label><Input id="et-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mary Kollie" autoComplete="name" aria-invalid={!!formError && !name.trim()} /></div>
          <div><Label htmlFor="et-contact">Phone or email</Label><Input id="et-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. 0776 123 456" autoComplete="tel" aria-invalid={!!formError && contact.trim().length < 5} /></div>
        </div>
        <div className="mt-3"><Label htmlFor="et-prog">Programme you want</Label><Input id="et-prog" value={programme} onChange={(e) => setProgramme(e.target.value)} placeholder="e.g. Nursing Assistant" aria-invalid={!!formError && !programme.trim()} /></div>
        {formError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{formError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={begin} className="bg-emerald-800 hover:bg-emerald-700">Start {timeMinutes}-minute test</Button>
          <Button type="button" variant="outline" onClick={() => setStage("intro")}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <h3 className="flex items-center gap-2 font-bold text-emerald-950"><ShieldCheck className="h-5 w-5 text-emerald-700" /> Step 1 of admission: pass the entrance test</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Every new applicant must take this active online aptitude test <strong>before</strong> starting any course or training.
        {settings.requirePass ? <> You need <strong>{passMark}%</strong> to pass — staff check your pass before approving admission.</> : <> Take it now to help staff place you.</>}
      </p>
      <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><AlarmClock className="h-4 w-4 text-emerald-700" /> {timeMinutes} minutes, {questions.length} questions, auto-submits at 00:00.</li>
        <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><BadgeCheck className="h-4 w-4 text-emerald-700" /> Instant marking with a pass reference for your application.</li>
        <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><ShieldCheck className="h-4 w-4 text-emerald-700" /> {settings.maxAttempts ?? 3} attempts per device; cheating or impersonation voids admission.</li>
      </ul>
      {backendQuizzes.length > 0 ? (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">Backend entrance papers open now: {backendQuizzes.map((b) => b.title).join(" · ")}. Signed-in applicants take them under Quizzes; guests take the standard paper below — both count.</p>
      ) : null}
      <div className={`mt-4 flex flex-wrap gap-2 ${compact ? "" : ""}`}>
        <Button type="button" onClick={startForm} className="bg-amber-400 text-emerald-950 hover:bg-amber-300">Take the entrance test now</Button>
        <a href="#prep-pack" className="inline-flex h-10 items-center rounded-xl border border-emerald-900/15 px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-50">Revise with the prep pack first</a>
      </div>
    </div>
  );
}
