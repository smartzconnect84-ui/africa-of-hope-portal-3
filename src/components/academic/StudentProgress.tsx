import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type MyCourseStatus } from "@/lib/academics";
import { EmptyState, SetupError, Status, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

function windowLabel(status: MyCourseStatus): string {
  if (status.window === "upcoming") return `Starts ${new Date(status.start_date).toLocaleDateString()}`;
  if (status.window === "ended") return "Course window ended";
  return status.days_remaining === 1 ? "1 day remaining" : `${status.days_remaining} days remaining`;
}

/**
 * G3/G4/G5: per-course status cards built entirely from `my_course_status`
 * — attendance vs the programme's required percentage, missed classes,
 * lesson progress, the course window (upcoming/active/ended), the next
 * topic, overdue items, upcoming deadlines and the weighted grade
 * breakdown (quiz + classwork components).
 */
export default function StudentProgress({ reloadKey }: { reloadKey: number }) {
  const { currentUser } = useApp();
  const userId = currentUser?.id;
  const [rows, setRows] = useState<MyCourseStatus[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError("");
    try { setRows(await academicApi.myCourseStatus()); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); setFirstLoadDone(true); }
  }, [userId]);
  useEffect(() => { void load(); }, [load, reloadKey]);

  if (error) return <SetupError message={error} retry={() => void load()} />;
  if (!firstLoadDone && loading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" aria-label="Loading your progress" />;
  if (rows.length === 0) return <EmptyState icon={GraduationCap} title="No course progress yet" hint="Submit a course plan to begin tracking progress and attendance." />;

  return (
    <div className="space-y-4">
      {rows.map((status) => (
        <div key={status.cohort_id} className={cn(panelClass, "p-5")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{status.program_title}</p>
              <h3 className="mt-1 font-semibold text-slate-900">{status.cohort_name}</h3>
              <p className="mt-1 text-xs text-slate-500">{windowLabel(status)}</p>
            </div>
            <Status value={status.completion_status} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Lesson progress</span>
                <span>{status.units_completed}/{status.units_total} · {Math.round(status.progress_percent)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, status.progress_percent)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Attendance</span>
                <span>{status.attendance_percent === null ? "No classes held yet" : `${Math.round(status.attendance_percent)}% (needs ${status.required_attendance_percent}%)`}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={cn("h-full rounded-full", status.attendance_ok ? "bg-emerald-600" : "bg-rose-500")} style={{ width: `${Math.min(100, status.attendance_percent ?? 0)}%` }} />
              </div>
            </div>
          </div>

          {!status.attendance_ok && status.sessions_held > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Attendance is below the {status.required_attendance_percent}% required for this course. You have missed {status.sessions_missed} of {status.sessions_held} classes held so far.</p>
            </div>
          )}

          {status.missed.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">Missed classes</p>
              <ul className="mt-1 space-y-1">
                {status.missed.map((item) => (
                  <li key={item.session_id} className="flex items-center gap-2 text-xs text-slate-600">
                    <ClipboardCheck className="h-3 w-3 shrink-0 text-rose-500" />{item.title} · {new Date(item.session_date).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {status.next_unit && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Next topic</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{status.next_unit.title}</p>
              </div>
            )}
            {status.overdue_units.length > 0 && (
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs font-semibold text-rose-700">Overdue</p>
                <ul className="mt-1 space-y-0.5">
                  {status.overdue_units.map((item) => <li key={item.id} className="text-sm text-rose-800">{item.title}</li>)}
                </ul>
              </div>
            )}
          </div>

          {status.upcoming_deadlines.length > 0 && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CalendarClock className="h-3.5 w-3.5" />Upcoming deadlines (next 14 days)</p>
              <ul className="mt-1 space-y-1">
                {status.upcoming_deadlines.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="text-xs text-slate-600">{item.title} · {new Date(item.due_at).toLocaleDateString()}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <p className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Grade breakdown</span>
              <span className="text-sm text-slate-800">{status.grade.course_grade === null ? "Not graded yet" : `${status.grade.course_grade}%`}</span>
            </p>
            {status.grade.components.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-xs">
                  <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Component</th><th className="py-1 pr-2 font-medium">Weight</th><th className="py-1 font-medium">Score</th></tr></thead>
                  <tbody>
                    {status.grade.components.map((component) => (
                      <tr key={`${component.type}-${component.id}`} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 text-slate-700">{component.title}</td>
                        <td className="py-1.5 pr-2 text-slate-500">{component.grade_weight}%</td>
                        <td className="py-1.5 text-slate-700">{component.percent === null ? "Pending" : `${component.percent}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
