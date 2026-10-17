import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BellPlus, CalendarDays, ClipboardCheck, FileText, GraduationCap, Trash2, Video } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type ClassSession, type LearningUnit } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

interface Reminder { id: string; title: string; date: string; note: string; }
interface CalEvent { key: string; date: string; time: string; title: string; kind: "Class" | "Lesson due" | "Assignment" | "Reminder"; detail: string; }

const REMINDER_KEY = "aoh-calendar-reminders-v1";

function loadReminders(): Reminder[] {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) ?? "[]") as Reminder[]; } catch { return []; }
}

/** F7: one student calendar — live class sessions + lesson due dates + assignment deadlines + personal reminders. */
export default function StudentCalendar() {
  const { state, currentUser } = useApp();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders)); }, [reminders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      try {
        const [s, u] = await Promise.all([
          academicApi.sessions(currentUser.cohortIds).catch(() => [] as ClassSession[]),
          academicApi.units(currentUser.programIds, currentUser.cohortIds).catch(() => [] as LearningUnit[]),
        ]);
        if (!cancelled) { setSessions(s); setUnits(u); }
      } catch { /* calendar still shows assignments + reminders */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const events = useMemo<CalEvent[]>(() => {
    const list: CalEvent[] = [];
    for (const s of sessions) {
      list.push({ key: `session-${s.id}`, date: s.session_date, time: s.starts_at.slice(0, 5), title: s.title, kind: "Class", detail: `${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)} · ${s.room || "Room TBA"}${s.attendance_required ? " · attendance required" : ""}` });
    }
    for (const u of units) {
      if (u.due_at) list.push({ key: `unit-${u.id}`, date: u.due_at.slice(0, 10), time: u.due_at.slice(11, 16) || "23:59", title: u.title, kind: "Lesson due", detail: u.unit_type });
    }
    const myAssignments = state.assignments.filter((a) => !currentUser?.cohortIds.length || currentUser.cohortIds.includes(a.cohortId));
    for (const a of myAssignments) {
      list.push({ key: `assign-${a.id}`, date: a.dueDate, time: "23:59", title: a.title, kind: "Assignment", detail: `${a.maxMarks} marks` });
    }
    for (const r of reminders) {
      list.push({ key: `rem-${r.id}`, date: r.date, time: "08:00", title: r.title, kind: "Reminder", detail: r.note || "Personal reminder" });
    }
    list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    return filter === "all" ? list : list.filter((e) => e.kind === filter);
  }, [sessions, units, state.assignments, reminders, filter, currentUser]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()];
  }, [events]);

  const upcoming = events.filter((e) => `${e.date}T${e.time}` >= new Date().toISOString().slice(0, 16));
  const kindIcon = (kind: CalEvent["kind"]) => kind === "Class" ? Video : kind === "Lesson due" ? FileText : kind === "Assignment" ? ClipboardCheck : BellPlus;

  const addReminder = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setReminders((prev) => [...prev, { id: `rem-${Date.now()}`, title: title.trim(), date, note: note.trim() }]);
    setTitle(""); setDate(""); setNote(""); setShowForm(false);
  };

  const shareWhatsApp = (event: CalEvent) => {
    const text = encodeURIComponent(`Reminder: ${event.title} on ${event.date} at ${event.time}. ${event.detail}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className={cn(panelClass, "p-5 h-fit")}>
        <SectionHeader title="Study calendar" subtitle="Classes, due dates & reminders" />
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xl font-bold text-emerald-800">{upcoming.length}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Upcoming</p></div>
          <div className="rounded-xl bg-sky-50 p-3"><p className="text-xl font-bold text-sky-800">{sessions.length}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Classes</p></div>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="mt-3"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            <SelectItem value="Class">Classes only</SelectItem>
            <SelectItem value="Lesson due">Lessons only</SelectItem>
            <SelectItem value="Assignment">Assignments only</SelectItem>
            <SelectItem value="Reminder">My reminders</SelectItem>
          </SelectContent>
        </Select>
        <Button className="mt-3 w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => setShowForm((v) => !v)}><BellPlus className="mr-1 h-4 w-4" /> Add reminder</Button>
        {showForm && (
          <form onSubmit={addReminder} className="mt-3 space-y-2 rounded-xl border border-slate-150 p-3">
            <Input placeholder="Reminder title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Textarea rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" size="sm" className="w-full bg-emerald-700 hover:bg-emerald-800">Save reminder</Button>
          </form>
        )}
      </div>
      <div className={cn(panelClass, "p-5 sm:p-6")}>
        {grouped.length === 0 && <EmptyState icon={CalendarDays} title="Nothing scheduled" hint="Approved classes, lesson due dates and assignment deadlines will appear here." />}
        <div className="space-y-4">
          {grouped.map(([day, rows]) => (
            <div key={day}>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
              <div className="mt-2 space-y-2">
                {rows.map((event) => {
                  const Icon = kindIcon(event.kind);
                  const past = `${event.date}T${event.time}` < new Date().toISOString().slice(0, 16);
                  return (
                    <div key={event.key} className={cn("flex items-start gap-3 rounded-xl border p-3", past ? "border-slate-100 bg-slate-50/60 opacity-70" : "border-slate-150 bg-white")}>
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", event.kind === "Class" ? "bg-emerald-100 text-emerald-700" : event.kind === "Assignment" ? "bg-amber-100 text-amber-700" : event.kind === "Lesson due" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")}><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                        <p className="text-xs text-slate-500">{event.time} · {event.kind} · {event.detail}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="outline" onClick={() => shareWhatsApp(event)}>WhatsApp</Button>
                        {event.kind === "Reminder" && (
                          <Button size="sm" variant="ghost" onClick={() => setReminders((prev) => prev.filter((r) => `rem-${r.id}` !== event.key))}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {upcoming.length > 0 && (
          <p className="mt-4 flex items-center gap-1 text-xs text-slate-500"><GraduationCap className="h-3.5 w-3.5" /> Next up: {upcoming[0].title} — {upcoming[0].date} at {upcoming[0].time}</p>
        )}
      </div>
    </div>
  );
}
