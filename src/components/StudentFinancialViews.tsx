import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote, Receipt, Printer, Plus, CalendarDays, Award, Percent, Megaphone,
  Clock, Check, AlertTriangle, Download, BookOpen, FileQuestion,
} from "lucide-react";
import { useApp, formatCurrency, letterGrade } from "../context/AppContext";
import { usePermission } from "../hooks/usePermission";
import type { AnnouncementCategory, FeeCategory, Quiz, QuizAttemptSummary } from "../types";
import { fetchMyQuizAttempts, fetchVisibleQuizzes } from "../lib/quizzes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "./Navigation";
import ProgramCover from "./ProgramCover";
import { cn } from "@/lib/utils";

const FEE_CATEGORIES: FeeCategory[] = ["Registration", "Tuition", "Exam", "Certificate"];
const ANN_CATEGORIES: AnnouncementCategory[] = ["Urgent", "Academic", "Financial"];
const ANN_TONE: Record<AnnouncementCategory, string> = {
  Urgent: "bg-rose-100 text-rose-700",
  Academic: "bg-emerald-100 text-emerald-800",
  Financial: "bg-amber-100 text-amber-800",
};

function attRate(records: { status: string }[]): number {
  if (records.length === 0) return 0;
  const attended = records.filter((r) => r.status !== "Absent").length;
  return Math.round((attended / records.length) * 100);
}

function Ring({ value }: { value: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24">
      <circle cx="40" cy="40" r={r} strokeWidth="9" className="fill-none stroke-emerald-100" />
      <circle
        cx="40"
        cy="40"
        r={r}
        strokeWidth="9"
        strokeLinecap="round"
        className="fill-none stroke-emerald-600"
        strokeDasharray={c}
        strokeDashoffset={c - (value / 100) * c}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" className="fill-slate-900 text-[15px] font-semibold">
        {value}%
      </text>
    </svg>
  );
}

/** Compact "quizzes waiting for you" count, used on the student dashboard. Fails silently if the quiz tables aren't migrated yet. */
function useOpenQuizCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([fetchVisibleQuizzes(), fetchMyQuizAttempts()])
      .then(([quizzes, attempts]: [Quiz[], QuizAttemptSummary[]]) => {
        if (!active) return;
        const done = new Set(
          attempts.filter((a) => a.status !== "in_progress").map((a) => a.quizId),
        );
        const attemptsByQuiz = new Map<string, number>();
        for (const a of attempts) attemptsByQuiz.set(a.quizId, (attemptsByQuiz.get(a.quizId) ?? 0) + 1);
        const now = Date.now();
        const open = quizzes.filter((q) => {
          if (q.opensAt && new Date(q.opensAt).getTime() > now) return false;
          if (q.closesAt && new Date(q.closesAt).getTime() < now) return false;
          if ((attemptsByQuiz.get(q.id) ?? 0) >= q.maxAttempts && !done.has(q.id)) return false;
          return !done.has(q.id) || (attemptsByQuiz.get(q.id) ?? 0) < q.maxAttempts;
        });
        setCount(open.length);
      })
      .catch(() => { if (active) setCount(null); });
    return () => { active = false; };
  }, []);
  return count;
}

export function StudentPortal() {
  const { state, currentUser } = useApp();
  const openQuizCount = useOpenQuizCount();
  if (!currentUser) return null;

  const cohort = state.cohorts.find((c) => c.id === currentUser.cohortIds[0]);
  const program = state.programs.find((p) => p.id === currentUser.programIds[0]);
  const att = state.attendance.filter((r) => r.studentId === currentUser.id);
  const rate = attRate(att);
  const paid = state.fees.filter((f) => f.studentId === currentUser.id).reduce((s, f) => s + f.amount, 0);
  const due = currentUser.programIds.reduce(
    (t, pid) => t + (state.programs.find((p) => p.id === pid)?.tuition ?? 0),
    0,
  );
  const myAssignments = state.assignments.filter((a) => currentUser.cohortIds.includes(a.cohortId));

  return (
    <div className="space-y-5">
      <SectionHeader
        title={`Welcome back, ${currentUser.name.split(" ")[0]}`}
        subtitle={`${program?.title ?? "Program pending"} / ${currentUser.status}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Percent} label="Attendance" value={`${rate}%`} hint={`${att.length} sessions recorded`} />
        <StatCard icon={Banknote} label="Balance due" value={formatCurrency(Math.max(due - paid, 0))} tone="amber" hint={`${formatCurrency(paid)} paid`} />
        <StatCard icon={BookOpen} label="Assignments" value={myAssignments.length} tone="slate" />
        <StatCard icon={Award} label="Certificates" value={state.certificates.filter((c) => c.studentId === currentUser.id).length} tone="emerald" />
        <StatCard icon={FileQuestion} label="Quizzes open" value={openQuizCount ?? "—"} tone="amber" hint="Available right now" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className={cn(panelClass, "flex flex-col items-center justify-center p-6")}>
          <Ring value={rate} />
          <p className="mt-3 text-sm font-medium text-slate-700">Attendance standing</p>
          <p className="text-xs text-slate-500">Late arrivals count toward attendance</p>
        </Reveal>

        <Reveal delay={0.05} className={cn(panelClass, "p-5 lg:col-span-2")}>
          <SectionHeader title="Enrollment details" subtitle="Your active batch and training venue" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cohort</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{cohort?.name ?? "Awaiting placement"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Venue</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{cohort?.room ?? "To be assigned"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Schedule</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                <CalendarDays className="h-4 w-4 text-emerald-700" />
                {cohort ? `${cohort.startDate} to ${cohort.endDate}` : "-"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Credential</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{program?.certification ?? "-"}</p>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.1} className={cn(panelClass, "overflow-hidden p-5")}>
        {program && <ProgramCover program={program} className="-mx-5 -mt-5 mb-5 h-40 sm:h-48" />}
        <SectionHeader title="Curriculum outline" subtitle={program?.title ?? "Program"} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(program?.modules ?? []).map((m) => (
            <div key={m.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-800/10 text-xs font-semibold text-emerald-800">
                {m.weeks}w
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800">{m.title}</span>
                <span className="block text-xs text-slate-500">{m.summary}</span>
              </span>
            </div>
          ))}
          {(program?.modules ?? []).length === 0 && (
            <EmptyState icon={BookOpen} title="No modules listed" hint="Your program outline will appear once published." />
          )}
        </div>
      </Reveal>
    </div>
  );
}

/** Small read-only list of the student's own quiz results, shown under Assignments. */
function QuizResultsSummary() {
  const { state } = useApp();
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchMyQuizAttempts(), fetchVisibleQuizzes()])
      .then(([a, q]) => { if (active) { setAttempts(a); setQuizzes(q); } })
      .catch(() => { /* quizzes may not be migrated yet; show nothing rather than an error */ })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const graded = attempts
    .filter((a) => a.status !== "in_progress")
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
    .slice(0, 6);

  if (!loaded || graded.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader title="Quiz results" subtitle="Your most recent graded quiz attempts" />
      <div className="grid gap-3 md:grid-cols-2">
        {graded.map((a) => {
          const quiz = quizzes.find((q) => q.id === a.quizId);
          return (
            <div key={a.attemptId} className={cn(panelClass, "flex items-center justify-between gap-3 p-4")}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{quiz?.title ?? "Quiz"}</p>
                <p className="text-xs text-slate-500">
                  {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"} · Attempt {a.attemptNo}
                  {state.cohorts.find((c) => c.id === quiz?.cohortId)?.name ? ` · ${state.cohorts.find((c) => c.id === quiz?.cohortId)?.name}` : ""}
                </p>
              </div>
              <Badge className={a.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>
                {a.percent ?? 0}%
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StudentAssignments() {
  const { state, currentUser } = useApp();
  if (!currentUser) return null;
  const myCohortIds = currentUser.cohortIds;

  const rows = state.assignments
    .filter((a) => myCohortIds.includes(a.cohortId))
    .map((a) => {
      const sub = state.submissions.find((s) => s.assignmentId === a.id && s.studentId === currentUser.id);
      const cohort = state.cohorts.find((c) => c.id === a.cohortId);
      return { a, sub, cohort };
    });

  return (
    <div className="space-y-5">
      <SectionHeader title="Assignments" subtitle="Briefs, submission status and graded feedback" />
      {rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No assignments yet" hint="Your instructors have not published any briefs." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ a, sub, cohort }) => {
            const status = sub?.status ?? "Missing";
            const tone =
              status === "Graded" ? "bg-emerald-100 text-emerald-800" :
              status === "Submitted" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600";
            return (
              <Reveal key={a.id} className={cn(panelClass, "p-5")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{a.title}</h3>
                    <p className="text-xs text-slate-500">{cohort?.name}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone)}>{status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{a.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Clock className="h-4 w-4 text-amber-500" /> Due {a.dueDate}
                  </span>
                  {sub?.marks != null ? (
                    <span className="font-semibold text-emerald-800">
                      {sub.marks}/{a.maxMarks} ({letterGrade(sub.marks)})
                    </span>
                  ) : (
                    <span className="text-slate-400">Awaiting marks</span>
                  )}
                </div>
                {sub?.feedback && (
                  <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">{sub.feedback}</p>
                )}
              </Reveal>
            );
          })}
        </div>
      )}
      <QuizResultsSummary />
    </div>
  );
}

const emptyTxn: { studentId: string; category: FeeCategory; amount: string; method: string; reference: string } = {
  studentId: "",
  category: "Tuition",
  amount: "",
  method: "Bank Transfer",
  reference: "",
};

export function FeeRegister() {
  const { state, currentUser, addFeeTransaction } = useApp();
  const isStaff = usePermission("fees.manage");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTxn);
  const [receipt, setReceipt] = useState<string | null>(null);

  const students = state.users.filter((u) => u.role === "Student");
  const scoped = isStaff
    ? state.fees
    : state.fees.filter((f) => f.studentId === currentUser?.id);

  const collected = state.fees.reduce((s, f) => s + f.amount, 0);
  const expected = students
    .filter((u) => u.status !== "Pending Approval")
    .reduce(
      (s, st) =>
        s + st.programIds.reduce((t, pid) => t + (state.programs.find((p) => p.id === pid)?.tuition ?? 0), 0),
      0,
    );

  const submit = () => {
    if (!form.studentId || !form.amount) {
      toast.error("Select a student and enter an amount");
      return;
    }
    addFeeTransaction({
      studentId: form.studentId,
      category: form.category,
      amount: Number(form.amount),
      date: new Date().toISOString().slice(0, 10),
      method: form.method,
      reference: form.reference || `AOH-${form.category.slice(0, 3).toUpperCase()}-${Math.floor(10000 + Math.random() * 89999)}`,
    });
    toast.success("Payment recorded to the ledger");
    setForm(emptyTxn);
    setOpen(false);
  };

  const selectedTxn = state.fees.find((f) => f.id === receipt) ?? null;
  const receiptStudent = selectedTxn ? state.users.find((u) => u.id === selectedTxn.studentId) : null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title={isStaff ? "Finance Ledger" : "Fees & Receipts"}
        subtitle={isStaff ? "Track tuition income, log payments and print receipts" : "Your payment history and printable receipts"}
        action={
          isStaff && (
            <Button onClick={() => setOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="mr-1 h-4 w-4" /> Log payment
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Banknote} label={isStaff ? "Total collected" : "Total paid"} value={formatCurrency(isStaff ? collected : scoped.reduce((s, f) => s + f.amount, 0))} />
        {isStaff ? (
          <>
            <StatCard icon={Percent} label="Outstanding" value={formatCurrency(Math.max(expected - collected, 0))} tone="amber" />
            <StatCard icon={Receipt} label="Transactions" value={state.fees.length} tone="slate" />
            <StatCard icon={CalendarDays} label="This cycle" value={formatCurrency(state.fees.filter((f) => f.date >= "2025-01-01").reduce((s, f) => s + f.amount, 0))} tone="emerald" />
          </>
        ) : (
          <>
            <StatCard icon={Percent} label="Balance due" value={formatCurrency(Math.max((currentUser?.programIds.reduce((t, pid) => t + (state.programs.find((p) => p.id === pid)?.tuition ?? 0), 0) ?? 0) - scoped.reduce((s, f) => s + f.amount, 0), 0))} tone="amber" />
            <StatCard icon={Receipt} label="Receipts" value={scoped.length} tone="slate" />
            <StatCard icon={Award} label="Status" value={scoped.length > 0 ? "In good standing" : "No payments"} tone="emerald" />
          </>
        )}
      </div>

      <div className={cn(panelClass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                {isStaff && <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Student</th>}
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Method</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reference</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {scoped.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 7 : 6} className="p-6">
                    <EmptyState icon={Receipt} title="No transactions recorded" hint="Payments logged at the finance desk appear here." />
                  </td>
                </tr>
              )}
              {scoped.slice().reverse().map((f) => (
                <tr key={f.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-sm text-slate-700">{f.date}</td>
                  {isStaff && (
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {state.users.find((u) => u.id === f.studentId)?.name ?? "-"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm">
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">{f.category}</Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700">{f.method}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{f.reference}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-900">{formatCurrency(f.amount)}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" onClick={() => setReceipt(f.id)}>
                      <Printer className="mr-1 h-3.5 w-3.5" /> Receipt
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log a payment</DialogTitle>
            <DialogDescription>Record a fee payment into the institutional ledger.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FeeCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="250" />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Auto-generated if empty" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} className="bg-emerald-700 hover:bg-emerald-800">Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment receipt</DialogTitle>
            <DialogDescription>Official acknowledgement of payment received.</DialogDescription>
          </DialogHeader>
          {selectedTxn && (
            <div className="print-area rounded-2xl border border-emerald-900/10 bg-white p-5">
              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-emerald-900">AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES</p>
                  <p className="text-[11px] text-slate-500">Institutional Training Academy</p>
                </div>
                <Receipt className="h-6 w-6 text-amber-500" />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Student</dt><dd className="font-medium text-slate-800">{receiptStudent?.name}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Category</dt><dd className="font-medium text-slate-800">{selectedTxn.category}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Date</dt><dd className="font-medium text-slate-800">{selectedTxn.date}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="font-medium text-slate-800">{selectedTxn.method}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Reference</dt><dd className="font-medium text-slate-800">{selectedTxn.reference}</dd></div>
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
                  <dt className="font-semibold text-slate-700">Amount paid</dt>
                  <dd className="font-bold text-emerald-800">{formatCurrency(selectedTxn.amount)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-center text-[10px] text-slate-400">System generated. No signature required.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
            <Button onClick={() => window.print()} className="bg-emerald-700 hover:bg-emerald-800">
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const emptyAnnouncement = { title: "", body: "", category: "Academic" as AnnouncementCategory };

export function AnnouncementBoard() {
  const { state, currentUser, addAnnouncement } = useApp();
  const canPost = usePermission("announcements.manage");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyAnnouncement);
  const [filter, setFilter] = useState<"All" | AnnouncementCategory>("All");

  const list = useMemo(
    () => state.announcements.filter((a) => filter === "All" || a.category === filter),
    [state.announcements, filter],
  );

  const submit = () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    addAnnouncement({
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      author: currentUser?.name ?? "Administration",
    });
    toast.success("Bulletin published");
    setForm(emptyAnnouncement);
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Bulletin Board"
        subtitle="Official notices from the administration and faculty"
        action={
          canPost && (
            <Button onClick={() => setOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="mr-1 h-4 w-4" /> New bulletin
            </Button>
          )
        }
      />

      <div className="flex gap-1.5">
        {(["All", ...ANN_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              filter === c ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length === 0 && <EmptyState icon={Megaphone} title="No bulletins in this category" hint="Check back later for new notices." />}
        {list.map((a) => (
          <Reveal key={a.id} className={cn(panelClass, "p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-emerald-800/10">
                  {a.category === "Urgent" ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : a.category === "Financial" ? <Banknote className="h-4 w-4 text-amber-600" /> : <Check className="h-4 w-4 text-emerald-700" />}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{a.title}</h3>
                  <p className="text-[11px] text-slate-500">{a.author} / {a.date}</p>
                </div>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", ANN_TONE[a.category])}>{a.category}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{a.body}</p>
          </Reveal>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish a bulletin</DialogTitle>
            <DialogDescription>Broadcast a notice to every portal user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Examination timetable released" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as AnnouncementCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANN_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the notice here" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} className="bg-emerald-700 hover:bg-emerald-800">
              <Download className="mr-1 h-4 w-4" /> Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
