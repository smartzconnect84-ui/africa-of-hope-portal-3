import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/context/AppContext";
import { EmptyState, SectionHeader, StatCard, panelClass } from "../Navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/** f12: staff dashboard — completion rates, overdue work and at-risk students per cohort. */
export default function TeacherInsights() {
  const { state, currentUser } = useApp();
  const isAdmin = currentUser?.role === "Super Admin" || currentUser?.role === "School Admin";
  const cohorts = useMemo(
    () => (isAdmin ? state.cohorts : state.cohorts.filter((c) => c.teacherId === currentUser?.id)),
    [state.cohorts, isAdmin, currentUser?.id],
  );
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const active = cohorts.find((c) => c.id === cohortId) ?? cohorts[0];

  const perCohort = useMemo(
    () =>
      cohorts.map((c) => {
        const studentIds = c.studentIds;
        const records = state.attendance.filter((r) => r.cohortId === c.id);
        const attended = records.filter((r) => r.status !== "Absent").length;
        const assignments = state.assignments.filter((a) => a.cohortId === c.id);
        const subs = state.submissions.filter((s) => assignments.some((a) => a.id === s.assignmentId));
        const graded = subs.filter((s) => s.status === "Graded" && s.marks !== null);
        const avgScore =
          graded.length > 0
            ? Math.round(graded.reduce((sum, s) => sum + (s.marks ?? 0), 0) / graded.length)
            : 0;
        const today = new Date().toISOString().slice(0, 10);
        let overdue = 0;
        for (const a of assignments) {
          if (a.dueDate >= today) continue;
          for (const sid of studentIds) {
            const sub = subs.find((s) => s.assignmentId === a.id && s.studentId === sid);
            if (!sub || sub.status === "Missing" || (!sub.submittedAt && sub.status !== "Graded")) overdue += 1;
          }
        }
        const totalSlots = assignments.length * studentIds.length;
        const handedIn = subs.filter((s) => s.submittedAt || s.status === "Graded" || s.status === "Submitted").length;
        return {
          id: c.id,
          name: c.name,
          enrolled: studentIds.length,
          attendance: pct(attended, records.length),
          completion: pct(handedIn, totalSlots),
          avgScore,
          overdue,
        };
      }),
    [cohorts, state.attendance, state.assignments, state.submissions],
  );

  const atRisk = useMemo(() => {
    if (!active) return [];
    const assignments = state.assignments.filter((a) => a.cohortId === active.id);
    const today = new Date().toISOString().slice(0, 10);
    return active.studentIds
      .map((sid) => {
        const user = state.users.find((u) => u.id === sid);
        const recs = state.attendance.filter((r) => r.cohortId === active.id && r.studentId === sid);
        const absent = recs.filter((r) => r.status === "Absent").length;
        const absentRate = pct(absent, recs.length);
        let missing = 0;
        let late = 0;
        for (const a of assignments) {
          const sub = state.submissions.find((s) => s.assignmentId === a.id && s.studentId === sid);
          if (!sub || sub.status === "Missing" || !sub.submittedAt) {
            if (a.dueDate < today) missing += 1;
          } else if (sub.isLate) late += 1;
        }
        const scores = state.submissions.filter(
          (s) => s.studentId === sid && s.marks !== null && assignments.some((a) => a.id === s.assignmentId),
        );
        const avg = scores.length > 0 ? Math.round(scores.reduce((t, s) => t + (s.marks ?? 0), 0) / scores.length) : null;
        const reasons: string[] = [];
        if (absentRate >= 30 && recs.length > 0) reasons.push(`${absentRate}% absent`);
        if (missing >= 2) reasons.push(`${missing} overdue`);
        else if (missing === 1) reasons.push("1 overdue");
        if (avg !== null && avg < 50) reasons.push(`avg ${avg}`);
        return { sid, name: user?.name ?? "Student", avg, missing, late, absentRate, reasons };
      })
      .filter((r) => r.reasons.length > 0)
      .sort((a, b) => b.missing - a.missing || b.absentRate - a.absentRate);
  }, [active, state.assignments, state.attendance, state.submissions, state.users]);

  const totals = useMemo(() => {
    const enrolled = perCohort.reduce((t, c) => t + c.enrolled, 0);
    const overdue = perCohort.reduce((t, c) => t + c.overdue, 0);
    const avgCompletion =
      perCohort.length > 0 ? Math.round(perCohort.reduce((t, c) => t + c.completion, 0) / perCohort.length) : 0;
    return { enrolled, overdue, avgCompletion, atRisk: atRisk.length };
  }, [perCohort, atRisk]);

  if (cohorts.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Progress insights" subtitle="Completion, overdue work and at-risk students per cohort." />
        <EmptyState icon={TrendingUp} title="No cohorts to analyse" hint="Ask a school admin to assign you a batch." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Progress insights"
        subtitle="Completion rates, overdue work and at-risk students across your cohorts."
        action={
          <Select value={active?.id ?? ""} onValueChange={setCohortId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select cohort" /></SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Students tracked" value={totals.enrolled} hint={`${cohorts.length} cohort${cohorts.length === 1 ? "" : "s"}`} />
        <StatCard icon={CheckCircle2} label="Avg completion" value={`${totals.avgCompletion}%`} hint="Handed-in work vs assigned" />
        <StatCard icon={Clock3} label="Overdue items" value={totals.overdue} tone="amber" hint="Past due without hand-in" />
        <StatCard icon={AlertTriangle} label="At-risk students" value={totals.atRisk} tone="rose" hint={active ? `In ${active.name}` : undefined} />
      </div>

      <div className={cn(panelClass, "p-5")}>
        <h3 className="text-sm font-semibold text-slate-900">Completion & attendance by cohort</h3>
        <p className="mt-0.5 text-xs text-slate-500">Share this view in staff meetings to agree follow-ups.</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perCohort} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip formatter={(v: unknown) => `${Number(v)}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completion" name="Completion" fill="#047857" radius={[6, 6, 0, 0]} />
              <Bar dataKey="attendance" name="Attendance" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cn(panelClass, "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">At-risk students{active ? ` — ${active.name}` : ""}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Absent 30%+, 1+ overdue item, or average below 50.</p>
          </div>
          {atRisk.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const lines = atRisk.map((s) => `• ${s.name} — ${s.reasons.join(", ")}`).join("\n");
                const text = encodeURIComponent(`At-risk follow-ups (${active?.name ?? ""}):\n${lines}`);
                window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
              }}
            >
              Share via WhatsApp
            </Button>
          )}
        </div>
        {atRisk.length === 0 ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No at-risk students in this cohort. Well done.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {atRisk.map((s) => (
              <li key={s.sid} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{s.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {s.avg === null ? "No grades yet" : `Avg ${s.avg}`} · {s.absentRate}% absent · {s.missing} overdue{s.late > 0 ? ` · ${s.late} late` : ""}
                  </span>
                </span>
                {s.reasons.map((r) => (
                  <Badge key={r} variant="secondary" className="bg-rose-50 text-rose-700">{r}</Badge>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
