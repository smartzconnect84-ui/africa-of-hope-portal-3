import { supabase } from "@/integrations/supabase/client";

export interface EntranceQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correct: string;
  points: number;
}

export interface EntranceResult {
  ref: string;
  name: string;
  contact: string;
  programme: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passMark: number;
  takenAt: string;
  quizId: string;
  quizTitle: string;
}

export const ENTRANCE_PASS_KEY = "aoh-entrance-pass";
export const ENTRANCE_HISTORY_KEY = "aoh-entrance-history";
export const ENTRANCE_SETTINGS_KEY = "aoh-entrance-settings";
export const ENTRANCE_REQUIRE_KEY = "aoh-entrance-require-pass";

export interface EntranceSettings {
  requirePass: boolean;
  passMark: number;
  timeMinutes: number;
  maxAttempts: number;
}

export const DEFAULT_ENTRANCE_SETTINGS: EntranceSettings = {
  requirePass: true,
  passMark: 60,
  timeMinutes: 15,
  maxAttempts: 3,
};

export function loadEntranceSettings(): EntranceSettings {
  try {
    const raw = localStorage.getItem(ENTRANCE_SETTINGS_KEY);
    if (!raw) return DEFAULT_ENTRANCE_SETTINGS;
    const p = JSON.parse(raw) as Partial<EntranceSettings>;
    return {
      requirePass: p.requirePass ?? true,
      passMark: typeof p.passMark === "number" ? p.passMark : 60,
      timeMinutes: typeof p.timeMinutes === "number" ? p.timeMinutes : 15,
      maxAttempts: typeof p.maxAttempts === "number" ? p.maxAttempts : 3,
    };
  } catch {
    return DEFAULT_ENTRANCE_SETTINGS;
  }
}

export function saveEntranceSettings(s: EntranceSettings) {
  try {
    localStorage.setItem(ENTRANCE_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* optional */
  }
}

export function loadRequirePass(): boolean {
  try {
    const raw = localStorage.getItem(ENTRANCE_REQUIRE_KEY);
    if (raw != null) return JSON.parse(raw) as boolean;
  } catch {
    /* fall through */
  }
  return loadEntranceSettings().requirePass;
}

export interface EntrancePassRow {
  name: string;
  contact: string;
  programme: string;
  reference: string;
  percent: number;
  passed: boolean;
  takenAt: string;
}

export function loadEntrancePasses(): EntrancePassRow[] {
  return loadEntranceHistory().map((r) => ({
    name: r.name,
    contact: r.contact,
    programme: r.programme,
    reference: r.ref,
    percent: r.percent,
    passed: r.passed,
    takenAt: r.takenAt,
  }));
}

/* Seeded active aptitude test — always available even before backend migration. */
export const SEEDED_ENTRANCE_QUESTIONS: EntranceQuestion[] = [
  { id: "q1", prompt: "Choose the correctly spelt word.", options: [{ id: "a", text: "Recieve" }, { id: "b", text: "Receive" }, { id: "c", text: "Receeve" }, { id: "d", text: "Receave" }], correct: "b", points: 1 },
  { id: "q2", prompt: "What is 15% of 40,000?", options: [{ id: "a", text: "4,000" }, { id: "b", text: "5,000" }, { id: "c", text: "6,000" }, { id: "d", text: "7,500" }], correct: "c", points: 1 },
  { id: "q3", prompt: "A class starts at 8:30 AM and runs 2 hours 45 minutes. When does it end?", options: [{ id: "a", text: "11:15 AM" }, { id: "b", text: "10:45 AM" }, { id: "c", text: "11:30 AM" }, { id: "d", text: "11:00 AM" }], correct: "a", points: 1 },
  { id: "q4", prompt: "Which sentence is most professional for a customer?", options: [{ id: "a", text: "Come back later, I am busy." }, { id: "b", text: "Good morning, how may I help you?" }, { id: "c", text: "What do you want again?" }, { id: "d", text: "Hurry up and talk." }], correct: "b", points: 1 },
  { id: "q5", prompt: "Find the next number: 3, 6, 12, 24, …", options: [{ id: "a", text: "36" }, { id: "b", text: "30" }, { id: "c", text: "48" }, { id: "d", text: "44" }], correct: "c", points: 1 },
  { id: "q6", prompt: "You sell goods for L$12,000 that cost L$9,000. What is the profit?", options: [{ id: "a", text: "L$2,000" }, { id: "b", text: "L$3,000" }, { id: "c", text: "L$9,000" }, { id: "d", text: "L$21,000" }], correct: "b", points: 1 },
  { id: "q7", prompt: "A patient refuses medicine. What do you do first?", options: [{ id: "a", text: "Force them to take it" }, { id: "b", text: "Walk away and ignore them" }, { id: "c", text: "Listen calmly and call the nurse in charge" }, { id: "d", text: "Give double dose later" }], correct: "c", points: 1 },
  { id: "q8", prompt: "A computer freezes before you save. What do you try first?", options: [{ id: "a", text: "Unplug everything at once" }, { id: "b", text: "Wait, then try Ctrl+S and restart calmly" }, { id: "c", text: "Hit the screen" }, { id: "d", text: "Delete all files" }], correct: "b", points: 1 },
  { id: "q9", prompt: "Which is a correct record for a small business?", options: [{ id: "a", text: "Money in and money out, written daily" }, { id: "b", text: "Only big sales, from memory" }, { id: "c", text: "No records needed" }, { id: "d", text: "Records once a year" }], correct: "a", points: 1 },
  { id: "q10", prompt: "Training is 3 days a week. Which shows commitment?", options: [{ id: "a", text: "Attend only when free" }, { id: "b", text: "Attend all 3 chosen days and arrive early" }, { id: "c", text: "Send a friend in your place" }, { id: "d", text: "Skip practicals" }], correct: "b", points: 1 },
  { id: "q11", prompt: "Read: “Fees may be paid in instalments.” What does it mean?", options: [{ id: "a", text: "Pay everything only at graduation" }, { id: "b", text: "Pay in parts over time" }, { id: "c", text: "No fees at all" }, { id: "d", text: "Fees double every month" }], correct: "b", points: 1 },
  { id: "q12", prompt: "You disagree with a classmate during group work. Best response?", options: [{ id: "a", text: "Shout until they agree" }, { id: "b", text: "Listen, explain your view calmly, agree on a plan" }, { id: "c", text: "Leave the group silently" }, { id: "d", text: "Report them before talking" }], correct: "b", points: 1 },
];

export function gradeEntrance(questions: EntranceQuestion[], answers: Record<string, string>, passMark: number, meta: { name: string; contact: string; programme: string; quizId: string; quizTitle: string }): EntranceResult {
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  const score = questions.reduce((s, q) => s + (answers[q.id] === q.correct ? q.points : 0), 0);
  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const ref = `AOH-ET-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  return { ref, name: meta.name, contact: meta.contact, programme: meta.programme, score, maxScore, percent, passed: percent >= passMark, passMark, takenAt: new Date().toISOString(), quizId: meta.quizId, quizTitle: meta.quizTitle };
}

export function loadEntranceHistory(): EntranceResult[] {
  try {
    const raw = localStorage.getItem(ENTRANCE_HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as EntranceResult[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveEntranceResult(r: EntranceResult): EntranceResult[] {
  const hist = [r, ...loadEntranceHistory()].slice(0, 20);
  try {
    localStorage.setItem(ENTRANCE_HISTORY_KEY, JSON.stringify(hist));
    if (r.passed) localStorage.setItem(ENTRANCE_PASS_KEY, JSON.stringify(r));
  } catch {
    /* optional */
  }
  return hist;
}

export function loadEntrancePass(): EntranceResult | null {
  try {
    const raw = localStorage.getItem(ENTRANCE_PASS_KEY);
    return raw ? (JSON.parse(raw) as EntranceResult) : null;
  } catch {
    return null;
  }
}

export function clearEntrancePass() {
  try {
    localStorage.removeItem(ENTRANCE_PASS_KEY);
  } catch {
    /* optional */
  }
}

/** Backend: published entrance quizzes (works after migration; fails silently before). */
export async function fetchEntranceQuizzes(): Promise<{ id: string; title: string; description: string; passMark: number; timeLimitMinutes: number | null; questionCount: number }[]> {
  try {
    const { data, error } = await supabase.from("quizzes").select("id,title,description,pass_mark,time_limit_minutes,question_count,status,is_entrance").eq("status", "published").eq("is_entrance", true).order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => ({
      id: String((r as Record<string, unknown>).id),
      title: String((r as Record<string, unknown>).title ?? "Entrance test"),
      description: String((r as Record<string, unknown>).description ?? ""),
      passMark: Number((r as Record<string, unknown>).pass_mark ?? 60),
      timeLimitMinutes: (r as Record<string, unknown>).time_limit_minutes == null ? null : Number((r as Record<string, unknown>).time_limit_minutes),
      questionCount: Number((r as Record<string, unknown>).question_count ?? 0),
    }));
  } catch {
    return [];
  }
}

/** Backend: recent entrance results for staff (works after migration). */
export async function fetchEntranceResults(): Promise<{ id: string; name: string; contact: string; programme: string; quizTitle: string; percent: number; passed: boolean; ref: string; createdAt: string }[]> {
  try {
    const { data, error } = await supabase.from("entrance_test_results").select("id,name,contact,programme,quiz_title,percent,passed,ref,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) return [];
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return { id: String(row.id), name: String(row.name ?? ""), contact: String(row.contact ?? ""), programme: String(row.programme ?? ""), quizTitle: String(row.quiz_title ?? ""), percent: Number(row.percent ?? 0), passed: Boolean(row.passed), ref: String(row.ref ?? ""), createdAt: String(row.created_at ?? "") };
    });
  } catch {
    return [];
  }
}

export async function saveEntranceResultBackend(r: EntranceResult): Promise<void> {
  try {
    await supabase.from("entrance_test_results").insert({ quiz_id: r.quizId === "seeded-aptitude" ? null : r.quizId, quiz_title: r.quizTitle, name: r.name, contact: r.contact, programme: r.programme, score: r.score, max_score: r.maxScore, percent: r.percent, passed: r.passed, ref: r.ref });
  } catch {
    /* backend optional until migration applied */
  }
}
