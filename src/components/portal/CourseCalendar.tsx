import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Trash2,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, panelClass, SectionHeader } from "@/components/Navigation";
import { ProfileTrigger } from "@/components/portal/ProfileViewer";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/portalOps";

const PLAN_KEY = "aoh-course-plan-v1";

interface PlanEntry {
  id: string;
  date: string;
  title: string;
  note: string;
  programId: string;
  cohortId: string;
  createdById: string;
  createdByName: string;
}

function loadPlan(): PlanEntry[] {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? (rows as PlanEntry[]) : [];
  } catch {
    return [];
  }
}

function savePlan(rows: PlanEntry[]) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(rows));
  } catch {
    /* storage unavailable */
  }
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Live course-planning calendar. Students see the schedule of the cohorts they
 * belong to; teachers see the cohorts they instruct; administrators see
 * everything and can plan sessions on any date.
 */
export default function CourseCalendar() {
  const { state, currentUser } = useApp();
  const [plan, setPlan] = useState<PlanEntry[]>(() => loadPlan());
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(() => dayKey());
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [programId, setProgramId] = useState("");
  const [cohortId, setCohortId] = useState("");

  if (!currentUser) return null;
  const isStaff = currentUser.role !== "Student";

  const myCohorts = useMemo(
    () =>
      state.cohorts.filter((cohort) => {
        if (currentUser.role === "Teacher") return cohort.teacherId === currentUser.id;
        if (currentUser.role === "Student") return cohort.studentIds?.includes(currentUser.id);
        return true;
      }),
    [state.cohorts, currentUser.id, currentUser.role],
  );

  const cohortIds = useMemo(() => new Set(myCohorts.map((c) => c.id)), [myCohorts]);

  const events = useMemo(() => {
    const rows: { date: string; label: string; kind: "start" | "end" | "plan"; cohortId?: string; id: string }[] = [];
    myCohorts.forEach((cohort) => {
      if (cohort.startDate) {
        rows.push({ id: `${cohort.id}-start`, date: cohort.startDate.slice(0, 10), label: `${cohort.name} starts`, kind: "start", cohortId: cohort.id });
      }
      if (cohort.endDate) {
        rows.push({ id: `${cohort.id}-end`, date: cohort.endDate.slice(0, 10), label: `${cohort.name} ends`, kind: "end", cohortId: cohort.id });
      }
    });
    plan
      .filter((entry) => !entry.cohortId || cohortIds.has(entry.cohortId))
      .forEach((entry) => {
        rows.push({ id: entry.id, date: entry.date, label: entry.title, kind: "plan", cohortId: entry.cohortId });
      });
    return rows;
  }, [myCohorts, plan, cohortIds]);

  const byDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    events.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
    }
    return cells;
  }, [cursor]);

  const dayEvents = byDate.get(selected) ?? [];
  const upcoming = [...events]
    .filter((event) => event.date >= dayKey())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  function addEntry() {
    if (!title.trim()) {
      toast.error("Give the session a title.");
      return;
    }
    const entry: PlanEntry = {
      id: `plan-${Date.now().toString(36)}`,
      date: selected,
      title: title.trim(),
      note: note.trim(),
      programId,
      cohortId,
      createdById: currentUser!.id,
      createdByName: currentUser!.name,
    };
    const next = [...plan, entry];
    setPlan(next);
    savePlan(next);
    setTitle("");
    setNote("");
    toast.success(`Added to ${selected}.`);
  }

  function removeEntry(id: string) {
    const next = plan.filter((entry) => entry.id !== id);
    setPlan(next);
    savePlan(next);
    toast.success("Plan entry removed.");
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Course planning calendar"
        description={
          isStaff
            ? "Plan sessions for your cohorts and keep the schedule visible to students."
            : "Your live course schedule: cohort start and end dates plus everything your instructors plan."
        }
      />

      <div className={cn(panelClass, "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="min-w-[9rem] text-center text-lg font-semibold">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => { const now = new Date(); setCursor(now); setSelected(iso(now)); }}>
            <CalendarDays className="mr-2 h-4 w-4" /> Today
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-1">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, index) =>
            cell === null ? (
              <div key={`empty-${index}`} />
            ) : (
              <button
                key={cell}
                onClick={() => setSelected(cell)}
                className={cn(
                  "relative min-h-[4.5rem] rounded-lg border p-1.5 text-left text-xs transition",
                  selected === cell ? "border-primary bg-primary/5" : "hover:border-primary/40",
                  cell === dayKey() && "ring-1 ring-primary",
                )}
              >
                <span className="font-semibold">{Number(cell.slice(-2))}</span>
                {(byDate.get(cell) ?? []).slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    className={cn(
                      "mt-1 block truncate rounded px-1 text-[10px]",
                      event.kind === "plan"
                        ? "bg-sky-500/15 text-sky-700"
                        : event.kind === "start"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-amber-500/15 text-amber-700",
                    )}
                  >
                    {event.label}
                  </span>
                ))}
                {(byDate.get(cell) ?? []).length > 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{(byDate.get(cell) ?? []).length - 2} more
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(panelClass, "p-5")}>
          <h3 className="font-semibold">{selected}</h3>
          {dayEvents.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing planned for this date.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dayEvents.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-2 rounded-lg border p-2 text-sm">
                  <div>
                    <p className="font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.kind === "plan" ? "Planned session" : `Cohort ${event.kind}`}
                    </p>
                  </div>
                  {event.kind === "plan" && isStaff && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeEntry(event.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(panelClass, "p-5")}>
          <h3 className="font-semibold">Upcoming</h3>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" description="Cohort dates and planned sessions appear here." />
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="truncate">{event.label}</span>
                  <Badge variant="secondary">{event.date}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isStaff && (
        <div className={cn(panelClass, "space-y-3 p-5")}>
          <h3 className="flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" /> Plan a session on {selected}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="plan-title">Title</Label>
              <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lesson 4 — Practical bookkeeping" />
            </div>
            <div>
              <Label htmlFor="plan-cohort">Cohort</Label>
              <select
                id="plan-cohort"
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No specific cohort</option>
                {myCohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="plan-program">Course</Label>
              <select
                id="plan-program"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Any course</option>
                {state.programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.title}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="plan-note">Note</Label>
              <Textarea id="plan-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Room, materials or instructions" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users2 className="h-4 w-4" /> Visible to students in the selected cohort
            </p>
            <Button onClick={addEntry}>Add to calendar</Button>
          </div>
        </div>
      )}

      <div className={cn(panelClass, "p-5")}>
        <h3 className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4" /> My cohorts
        </h3>
        {myCohorts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No cohorts assigned yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {myCohorts.map((cohort) => {
              const program = state.programs.find((p) => p.id === cohort.programId);
              const teacher = state.users.find((u) => u.id === cohort.teacherId);
              return (
                <li key={cohort.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{cohort.name}</p>
                  <p className="text-xs text-muted-foreground">{program?.title ?? "Programme removed"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cohort.startDate || "—"} → {cohort.endDate || "—"}
                    {cohort.room ? ` · ${cohort.room}` : ""}
                  </p>
                  {teacher && (
                    <p className="mt-1 text-xs">
                      Instructor: <ProfileTrigger user={teacher}>{teacher.name}</ProfileTrigger>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
