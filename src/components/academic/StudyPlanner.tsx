import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

interface Slot { id: string; programId: string; day: number; start: string; end: string; note: string; }

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const COLORS = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"];

/** Personal weekly study plan per course. A slot can never overlap a slot of another course. */
export default function StudyPlanner() {
  const { state, currentUser } = useApp();
  const storageKey = `aoh-study-plan-v1-${currentUser?.id ?? "guest"}`;
  const [slots, setSlots] = useState<Slot[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as Slot[]; } catch { return []; }
  });
  const myPrograms = useMemo(() => {
    const ids = currentUser?.programIds ?? [];
    return state.programs.filter((p) => ids.includes(p.id));
  }, [state.programs, currentUser]);
  const [programId, setProgramId] = useState("");
  const [day, setDay] = useState("0");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:00");
  const [note, setNote] = useState("");

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(slots)); }, [slots, storageKey]);

  const courseId = programId || myPrograms[0]?.id || "";
  const titleOf = (id: string) => state.programs.find((p) => p.id === id)?.title ?? "Course";
  const colorOf = (id: string) => COLORS[Math.max(0, myPrograms.findIndex((p) => p.id === id)) % COLORS.length];

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!courseId) return toast.error("Choose a course");
    if (end <= start) return toast.error("End time must be after start time");
    const d = Number(day);
    const clash = slots.find((s) => s.day === d && s.start < end && start < s.end);
    if (clash) {
      return toast.error(`Overlaps ${titleOf(clash.programId)} (${clash.start}–${clash.end}). Pick a free time.`);
    }
    setSlots((prev) => [...prev, { id: `slot-${Date.now()}`, programId: courseId, day: d, start, end, note: note.trim() }]);
    setNote("");
    toast.success("Study slot added");
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="My Study Plan" subtitle="Plan weekly study time for each course — slots can't overlap another course" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form onSubmit={add} className={cn(panelClass, "h-fit space-y-3 p-4")}>
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setProgramId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {myPrograms.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>From</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <Input placeholder="Focus (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={myPrograms.length === 0} className="w-full bg-emerald-700 hover:bg-emerald-800"><Plus className="mr-1 h-4 w-4" /> Add study slot</Button>
          {myPrograms.length === 0 && <p className="text-xs text-slate-500">Enrol in a course to plan study time.</p>}
        </form>
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.length === 0 && <div className="sm:col-span-2"><EmptyState icon={CalendarClock} title="No study slots yet" hint="Add a slot for each course to build your weekly timetable." /></div>}
          {DAYS.map((d, i) => {
            const list = slots.filter((s) => s.day === i).sort((a, b) => a.start.localeCompare(b.start));
            if (list.length === 0) return null;
            return (
              <div key={d} className={cn(panelClass, "min-w-0 p-3")}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{d}</p>
                <div className="mt-2 space-y-2">
                  {list.map((s) => (
                    <div key={s.id} className={cn("flex items-start gap-2 rounded-xl p-2.5", colorOf(s.programId))}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{titleOf(s.programId)}</p>
                        <p className="text-xs">{s.start}–{s.end}{s.note ? ` · ${s.note}` : ""}</p>
                      </div>
                      <button type="button" aria-label="Remove slot" className="shrink-0 rounded-lg p-1.5 hover:bg-white/60" onClick={() => setSlots((prev) => prev.filter((x) => x.id !== s.id))}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
