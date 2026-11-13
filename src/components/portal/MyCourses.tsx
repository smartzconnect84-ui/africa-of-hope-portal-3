import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, GraduationCap, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { clearedForProgram, monthsForWeeks, requiresAptitude } from "@/lib/portalOps";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

const overlaps = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) => {
  const aStart = new Date(a.startDate).getTime();
  const aEnd = new Date(a.endDate).getTime();
  const bStart = new Date(b.startDate).getTime();
  const bEnd = new Date(b.endDate).getTime();
  if ([aStart, aEnd, bStart, bEnd].some((n) => Number.isNaN(n))) return false;
  return aStart <= bEnd && bStart <= aEnd;
};

/**
 * Item 8 — an applicant keeps the same account and adds further courses from
 * their portal. A course is only added when its cohort schedule does not clash
 * with the cohorts they already sit in, so no existing timetable is disturbed.
 */
export default function MyCourses() {
  const { state, currentUser, assignStudent } = useApp();
  const [busyId, setBusyId] = useState("");

  const enrolled = useMemo(
    () => state.programs.filter((p) => currentUser?.programIds.includes(p.id)),
    [state.programs, currentUser],
  );

  const myCohorts = useMemo(
    () => state.cohorts.filter((c) => currentUser?.cohortIds.includes(c.id)),
    [state.cohorts, currentUser],
  );

  const available = useMemo(
    () => state.programs.filter((p) => !currentUser?.programIds.includes(p.id)),
    [state.programs, currentUser],
  );

  if (!currentUser) return null;

  async function addCourse(programId: string) {
    if (!currentUser) return;
    const program = state.programs.find((p) => p.id === programId);
    if (!program) return;
    setBusyId(programId);
    try {
      const candidates = state.cohorts.filter((c) => c.programId === programId);
      const free = candidates.find((c) => !myCohorts.some((mine) => overlaps(mine, c)));
      if (candidates.length > 0 && !free) {
        toast.error(
          `Every ${program.title} cohort clashes with your current timetable. Ask the registrar to open a non-conflicting class.`,
        );
        return;
      }
      const nextCohorts = free ? [...currentUser.cohortIds, free.id] : currentUser.cohortIds;
      const error = await assignStudent(currentUser.id, [...currentUser.programIds, programId], nextCohorts);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(
        free
          ? `Added ${program.title} — you joined ${free.name}.`
          : `Added ${program.title}. The registrar will assign your class.`,
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My courses"
        description="Your enrolled programmes and the classes you attend. Add another course without disturbing your current schedule."
        icon={<BookOpen className="h-5 w-5" />}
      />

      <section className={cn(panelClass, "p-5")}>
        <h2 className="text-sm font-semibold text-slate-900">Enrolled ({enrolled.length})</h2>
        {enrolled.length === 0 ? (
          <EmptyState title="No course yet" description="Add a course below to join a class." />
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {enrolled.map((p) => {
              const months = monthsForWeeks(p.durationWeeks);
              const gated = requiresAptitude(p);
              const cleared = clearedForProgram(currentUser.id, p.id);
              const cohorts = state.cohorts.filter(
                (c) => c.programId === p.id && currentUser.cohortIds.includes(c.id),
              );
              return (
                <article key={p.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{p.title}</h3>
                      <p className="text-xs text-slate-500">
                        {months} month{months === 1 ? "" : "s"} · {p.category}
                      </p>
                    </div>
                    <Badge variant="outline">Enrolled</Badge>
                  </div>
                  {cohorts.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {cohorts.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                          {c.name} · {c.startDate} → {c.endDate}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Awaiting class assignment by the registrar.
                    </p>
                  )}
                  {gated && (
                    <p
                      className={cn(
                        "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                        cleared ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {cleared ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {cleared ? "Entrance test passed — lessons unlocked" : "Entrance test (60%) required before lessons"}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={cn(panelClass, "p-5")}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <GraduationCap className="h-4 w-4" /> Add another course
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Your existing classes stay untouched — a course is only added when its cohort does not overlap your timetable.
        </p>
        {available.length === 0 ? (
          <EmptyState title="You are enrolled in every programme" description="New programmes appear here as the school publishes them." />
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {available.map((p) => {
              const candidates = state.cohorts.filter((c) => c.programId === p.id);
              const clash = candidates.length > 0 && !candidates.some((c) => !myCohorts.some((m) => overlaps(m, c)));
              return (
                <article key={p.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{p.title}</h3>
                      <p className="text-xs text-slate-500">
                        {monthsForWeeks(p.durationWeeks)} months · {p.deliveryModes?.join(", ") || "flexible delivery"}
                      </p>
                    </div>
                    <Badge variant="outline">{requiresAptitude(p) ? "Test required" : "Open entry"}</Badge>
                  </div>
                  {clash && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> Schedule clashes with your current classes
                    </p>
                  )}
                  <Button
                    className="mt-3 w-full rounded-xl"
                    variant={clash ? "outline" : "default"}
                    disabled={clash || busyId === p.id}
                    onClick={() => addCourse(p.id)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> {busyId === p.id ? "Adding…" : "Add this course"}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
