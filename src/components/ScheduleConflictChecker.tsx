import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { detectScheduleConflicts, type CourseSchedule } from "@/lib/scheduleConflicts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panelClass, SectionHeader, EmptyState } from "./Navigation";

export default function ScheduleConflictChecker() {
  const { state, currentUser } = useApp();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const enrolled: CourseSchedule[] = useMemo(() => {
    if (!currentUser) return [];
    return state.programs
      .filter((p) => currentUser.programIds?.includes(p.id))
      .map((p) => ({ courseId: p.id, courseTitle: p.title, mode: "online" as const, trainingDays: [] }));
  }, [state.programs, currentUser]);

  const candidate: CourseSchedule = {
    courseId: "candidate",
    courseTitle: "New course",
    mode: "online",
    trainingDays: selectedDays,
  };

  const result = detectScheduleConflicts(candidate, enrolled);

  const toggle = (d: string) =>
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SectionHeader title="Schedule conflict checker" subtitle="Pick training days for a new course to check against your enrolled courses." />
      <section className={panelClass + " p-4 sm:p-6"}>
        <Label>Select training days</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${selectedDays.includes(d) ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 text-slate-700"}`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {selectedDays.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No days selected" hint="Select training days to check for conflicts." />
          ) : result.hasConflict ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Conflict detected</span>
              </div>
              {result.conflictingCourses.map((c) => (
                <p key={c.courseId} className="text-sm text-slate-700">
                  {c.courseTitle} shares: {c.sharedDays.join(", ")}
                </p>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">No conflicts with your enrolled courses.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}