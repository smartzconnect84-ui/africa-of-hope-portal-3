import { useState } from "react";
import { GraduationCap, Lightbulb, ListChecks, MessageCircleQuestion, CheckCircle2 } from "lucide-react";

const cardCls = "rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900";

const PREP_TIPS = [
  { title: "Know your programme", body: "Say the programme name, why you chose it, and what work you want to do after. One clear sentence beats a long speech." },
  { title: "Bring your documents", body: "Come with an ID, your last school result or certificate, and your application reference if you applied online." },
  { title: "Dress neatly, arrive early", body: "Plan to arrive 30 minutes early. Greet the panel, sit upright, and keep your phone silent." },
  { title: "Be honest about fees", body: "Know the fee for your programme and how you plan to pay (instalments are allowed). Honesty about money never disqualifies you." },
  { title: "Ask one good question", body: "End with a question, e.g. “When do classes start?” or “What materials should I bring on the first day?” It shows you are serious." },
];

const GENERAL_QS = [
  "Tell us about yourself in one minute.",
  "Why did you choose Africa of Hope?",
  "Why this programme and not another one?",
  "What work do you want to do after you finish?",
  "How will you pay your fees — at once or in instalments?",
  "What will you do if a class clashes with work or family duties?",
  "Tell us about a time you finished something difficult.",
  "Do you have any questions for us?",
];

const TRACK_QS: { track: string; questions: string[] }[] = [
  {
    track: "Nursing Assistant & Health",
    questions: [
      "Why do you want to care for sick people?",
      "A patient refuses medicine — what do you do first?",
      "How do you keep a patient's information private?",
      "What would you do if you saw blood and felt faint during practicals?",
    ],
  },
  {
    track: "Computer Studies & IT",
    questions: [
      "What can you already do on a computer or phone?",
      "A program freezes before you save — what do you try first?",
      "How would you explain the internet to a market trader?",
      "How many hours a week can you practise typing and assignments?",
    ],
  },
  {
    track: "Business, Tailoring & Vocational",
    questions: [
      "What small business would you start with L$10,000 and why?",
      "A customer says your work is bad — how do you respond?",
      "How do you keep records of money in and money out?",
      "Where will you do your practical hours?",
    ],
  },
];

const CHECKLIST = [
  "I can say my programme name and why I chose it",
  "I know the fee and my payment plan",
  "I practised answering out loud (not only in my head)",
  "I prepared one question to ask the panel",
  "I know the training-days rule: 3 days a week",
  "My documents are in a bag, ready to carry",
];

const CHECK_KEY = "aoh-prep-checklist";

function loadCheck(): boolean[] {
  try {
    const raw = localStorage.getItem(CHECK_KEY);
    const arr = raw ? (JSON.parse(raw) as boolean[]) : [];
    return CHECKLIST.map((_, i) => !!arr[i]);
  } catch {
    return CHECKLIST.map(() => false);
  }
}

export default function EntrancePrepPack() {
  const [checked, setChecked] = useState<boolean[]>(loadCheck);
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (i: number) => {
    const next = checked.map((c, j) => (j === i ? !c : c));
    setChecked(next);
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify(next));
    } catch {
      /* storage optional */
    }
  };

  const done = checked.filter(Boolean).length;
  const pct = Math.round((done / CHECKLIST.length) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className={cardCls}>
          <h3 className="flex items-center gap-2 font-bold text-emerald-950">
            <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" /> 5 tips for interview day
          </h3>
          <ul className="mt-3 space-y-3">
            {PREP_TIPS.map((t, i) => (
              <li key={t.title} className="flex gap-3 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-800 text-xs font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong className="text-emerald-950">{t.title}.</strong>{" "}
                  <span className="text-slate-600">{t.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cardCls}>
          <h3 className="flex items-center gap-2 font-bold text-emerald-950">
            <ListChecks className="h-5 w-5 text-emerald-700" aria-hidden="true" /> My readiness checklist
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {done} of {CHECKLIST.length} ready ({pct}%). Saved on this device.
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Interview readiness">
            <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-3 space-y-2">
            {CHECKLIST.map((c, i) => (
              <li key={c}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${checked[i] ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-white hover:border-emerald-900/20"}`}>
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => toggle(i)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-800"
                  />
                  <span className={checked[i] ? "text-emerald-950 line-through decoration-emerald-300" : "text-slate-700"}>{c}</span>
                  {checked[i] ? <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> : null}
                </label>
              </li>
            ))}
          </ul>
          {pct === 100 ? (
            <p role="status" className="mt-3 rounded-xl bg-emerald-800 p-3 text-center text-sm font-semibold text-white">
              You are ready — good luck at your interview!
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-6">
        <div className={cardCls}>
          <h3 className="flex items-center gap-2 font-bold text-emerald-950">
            <MessageCircleQuestion className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Questions every applicant is asked
          </h3>
          <p className="mt-1 text-sm text-slate-600">Practise these out loud with a friend or in front of a mirror.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {GENERAL_QS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
        <div className={cardCls}>
          <h3 className="flex items-center gap-2 font-bold text-emerald-950">
            <GraduationCap className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Questions by programme
          </h3>
          <div className="mt-3 space-y-2">
            {TRACK_QS.map((t) => {
              const isOpen = open === t.track;
              return (
                <div key={t.track} className="overflow-hidden rounded-xl border border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : t.track)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 bg-slate-50/60 px-4 py-3 text-left text-sm font-bold text-emerald-950 hover:bg-emerald-50"
                  >
                    {t.track}
                    <span aria-hidden="true" className="text-emerald-700">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen ? (
                    <ul className="space-y-1.5 px-4 py-3 text-sm text-slate-700">
                      {t.questions.map((q) => (
                        <li key={q} className="flex gap-2">
                          <span aria-hidden="true" className="text-emerald-700">•</span> {q}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">
            <span className={labelCls}>Good to know</span>
            There are no trick questions and no written exam to fear. The panel wants to see that you are serious,
            can attend 3 training days a week, and have a plan for your fees.
          </p>
        </div>
      </div>
    </div>
  );
}
