import { useEffect, useMemo, useState } from "react";
import { isInstructorRole } from "@/lib/roleDisplay";
import { CalendarDays, Clock, MapPin, Pencil, Plus, Printer, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, SectionHeader } from "../Navigation";
import { cn } from "@/lib/utils";

const LS_KEY = "aoh-timetable-slots";

interface Slot {
  id: string;
  cohort_id: string;
  day_of_week: number;
  title: string;
  teacher_id: string;
  room: string;
  starts_at: string;
  ends_at: string;
  notes: string;
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function loadLocal(): Slot[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? (p as Slot[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(rows: Slot[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {
    /* storage full — ignore */
  }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);
}

const emptyForm = { title: "", day_of_week: "1", teacher_id: "", room: "", starts_at: "08:00", ends_at: "09:00", notes: "" };

export default function CohortTimetable() {
  const { state, currentUser } = useApp();
  const isStudent = currentUser?.role === "Student";
  const canEdit = !!currentUser && !isStudent;

  const visibleCohorts = useMemo(() => {
    if (!currentUser) return [];
    if (isStudent) return state.cohorts.filter((c) => c.studentIds.includes(currentUser.id));
    if (isInstructorRole(currentUser.role)) return state.cohorts.filter((c) => c.teacherId === currentUser.id);
    return state.cohorts;
  }, [state.cohorts, currentUser, isStudent]);

  const [cohortId, setCohortId] = useState(visibleCohorts[0]?.id ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cohortId && visibleCohorts[0]) setCohortId(visibleCohorts[0].id);
  }, [visibleCohorts, cohortId]);

  useEffect(() => {
    if (!cohortId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const local = loadLocal().filter((s) => s.cohort_id === cohortId);
      try {
        const { data, error } = await supabase
          .from("cohort_timetable_slots")
          .select("id,cohort_id,day_of_week,title,teacher_id,room,starts_at,ends_at,notes")
          .eq("cohort_id", cohortId)
          .order("day_of_week", { ascending: true })
          .order("starts_at", { ascending: true });
        if (error) throw error;
        const remote = (data ?? []) as unknown as Slot[];
        // merge: remote wins, keep local-only drafts (local ids)
        const remoteIds = new Set(remote.map((r) => String(r.id)));
        const drafts = local.filter((l) => !remoteIds.has(l.id) && l.id.startsWith("local-"));
        setSlots([...remote, ...drafts]);
      } catch {
        setSlots(local);
      } finally {
        setLoading(false);
      }
    })();
  }, [cohortId]);

  const teachers = useMemo(() => state.users.filter((u) => u.role !== "Student"), [state.users]);

  const teacherName = (id: string) => {
    if (!id) return "TBA";
    return state.users.find((u) => u.id === id)?.name ?? id;
  };

  const grouped = useMemo(() => {
    const map = new Map<number, Slot[]>();
    WEEK_ORDER.forEach((d) => map.set(d, []));
    slots.forEach((s) => {
      const list = map.get(s.day_of_week) ?? [];
      list.push(s);
      map.set(s.day_of_week, list);
    });
    map.forEach((list) => list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    return map;
  }, [slots]);

  const totalPeriods = slots.length;
  const weeklyMinutes = slots.reduce((sum, s) => sum + Math.max(0, toMinutes(s.ends_at) - toMinutes(s.starts_at)), 0);
  const staffCount = new Set(slots.map((s) => s.teacher_id).filter(Boolean)).size;

  function openAdd(day?: number) {
    setEditingId(null);
    setForm({ ...emptyForm, day_of_week: String(day ?? 1), room: visibleCohorts.find((c) => c.id === cohortId)?.room ?? "" });
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(slot: Slot) {
    setEditingId(slot.id);
    setForm({
      title: slot.title,
      day_of_week: String(slot.day_of_week),
      teacher_id: slot.teacher_id || "__tba__",
      room: slot.room,
      starts_at: slot.starts_at.slice(0, 5),
      ends_at: slot.ends_at.slice(0, 5),
      notes: slot.notes ?? "",
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    const title = form.title.trim();
    const room = form.room.trim();
    const day = Number(form.day_of_week);
    const teacherId = form.teacher_id === "__tba__" ? "" : form.teacher_id;
    if (!cohortId) {
      setFormError("Select a cohort first.");
      return;
    }
    if (title.length < 2) {
      setFormError("Enter a subject or class title (at least 2 characters).");
      return;
    }
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      setFormError("Choose a valid day of the week.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(form.starts_at) || !/^\d{2}:\d{2}$/.test(form.ends_at)) {
      setFormError("Start and end times must be in HH:MM format.");
      return;
    }
    if (toMinutes(form.starts_at) >= toMinutes(form.ends_at)) {
      setFormError("End time must be after start time.");
      return;
    }
    if (!room) {
      setFormError("Enter the room or venue for this class.");
      return;
    }
    const clash = slots.find(
      (s) => s.day_of_week === day && s.id !== editingId && overlaps(form.starts_at, form.ends_at, s.starts_at.slice(0, 5), s.ends_at.slice(0, 5)),
    );
    if (clash) {
      setFormError(`${DAY_LABELS[day]} already has "${clash.title}" from ${clash.starts_at.slice(0, 5)} to ${clash.ends_at.slice(0, 5)}. Pick a non-overlapping time.`);
      return;
    }
    setFormError("");
    setSaving(true);
    const payload = {
      cohort_id: cohortId,
      day_of_week: day,
      title,
      teacher_id: teacherId,
      room,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      notes: form.notes.trim(),
    };
    try {
      if (editingId && !editingId.startsWith("local-")) {
        const { error } = await supabase.from("cohort_timetable_slots").update(payload).eq("id", editingId);
        if (error) throw error;
        setSlots((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...payload } : s)));
      } else if (editingId && editingId.startsWith("local-")) {
        setSlots((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...payload } : s)));
        saveLocal(loadLocal().map((s) => (s.id === editingId ? { ...s, ...payload } : s)));
      } else {
        const { data, error } = await supabase.from("cohort_timetable_slots").insert(payload).select("id").single();
        if (error) throw error;
        const id = (data as unknown as { id: string } | null)?.id ?? `local-${Date.now()}`;
        const row: Slot = { id, ...payload };
        setSlots((prev) => [...prev, row]);
        if (id.startsWith("local-")) saveLocal([...loadLocal(), row]);
      }
      toast.success(editingId ? "Timetable slot updated." : "Class added to timetable.");
      setDialogOpen(false);
    } catch (err) {
      // Offline-tolerant: keep a local copy so staff work is not lost
      const draft: Slot = { id: editingId ?? `local-${Date.now()}`, ...payload };
      if (editingId) {
        setSlots((prev) => prev.map((s) => (s.id === editingId ? draft : s)));
        saveLocal(loadLocal().map((s) => (s.id === editingId ? draft : s)));
      } else {
        setSlots((prev) => [...prev, draft]);
        saveLocal([...loadLocal(), draft]);
      }
      toast.success("Saved on this device — it will sync when the connection returns.");
      setDialogOpen(false);
      if (err instanceof Error && !/network|fetch|connection/i.test(err.message)) {
        setFormError(err.message);
        setDialogOpen(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const slot = slots.find((s) => s.id === id);
    if (!slot || !window.confirm(`Remove "${slot.title}" on ${DAY_LABELS[slot.day_of_week]} ${slot.starts_at.slice(0, 5)}–${slot.ends_at.slice(0, 5)}?`)) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
    saveLocal(loadLocal().filter((s) => s.id !== id));
    if (!id.startsWith("local-")) {
      try {
        const { error } = await supabase.from("cohort_timetable_slots").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove slot on server; local copy removed.");
        return;
      }
    }
    toast.success("Slot removed.");
  }

  const cohort = visibleCohorts.find((c) => c.id === cohortId);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Cohort timetable"
        subtitle={cohort ? `${cohort.name} · weekly classes with rooms, Teachers-Instructors and times` : "Weekly class timetable per cohort"}
        action={
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button onClick={() => openAdd()} className="bg-emerald-800 hover:bg-emerald-700" disabled={!cohortId}>
                <Plus data-icon="inline-start" /> Add class
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" /> Print
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-950">{totalPeriods}</p>
          <p className="text-xs font-medium text-slate-500">Periods / week</p>
        </div>
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-950">{Math.floor(weeklyMinutes / 60)}h{weeklyMinutes % 60 ? ` ${weeklyMinutes % 60}m` : ""}</p>
          <p className="text-xs font-medium text-slate-500">Teaching time</p>
        </div>
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-950">{staffCount}</p>
          <p className="text-xs font-medium text-slate-500">Teachers-Instructors</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-[240px] max-w-sm flex-1 space-y-1.5">
          <Label htmlFor="tt-cohort">Cohort</Label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger id="tt-cohort"><SelectValue placeholder="Select cohort" /></SelectTrigger>
            <SelectContent>
              {visibleCohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {cohort && (
          <p className="text-xs text-slate-500">
            Default room {cohort.room || "TBC"} · {cohort.startDate} to {cohort.endDate}
          </p>
        )}
      </div>

      {!cohortId ? (
        <EmptyState icon={CalendarDays} title="No cohort selected" hint="Choose a cohort to view its weekly timetable." />
      ) : loading ? (
        <p role="status" className="text-sm text-slate-500">Loading timetable…</p>
      ) : totalPeriods === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes scheduled yet"
          hint={canEdit ? "Add the first class for this cohort — set the day, time, Teachers-Instructors and room." : "The timetable for this cohort has not been published yet. Check back soon."}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {WEEK_ORDER.map((day) => {
            const list = grouped.get(day) ?? [];
            return (
              <section key={day} aria-label={DAY_LABELS[day]} className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-emerald-950">{DAY_LABELS[day]}</h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {list.length} {list.length === 1 ? "class" : "classes"}
                    </span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => openAdd(day)} aria-label={`Add class on ${DAY_LABELS[day]}`}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {list.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">No classes.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {list.map((s) => (
                      <li key={s.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{s.title}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-emerald-700" />{s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}</span>
                              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-emerald-700" />{s.room || "Room TBC"}</span>
                              <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-emerald-700" />{teacherName(s.teacher_id)}</span>
                            </p>
                            {s.notes && <p className="mt-1 text-xs text-slate-500">{s.notes}</p>}
                          </div>
                          {canEdit && (
                            <div className="flex shrink-0 gap-1">
                              <Button size="icon" variant="ghost" aria-label={`Edit ${s.title}`} onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" aria-label={`Remove ${s.title}`} onClick={() => void handleDelete(s.id)}>
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !saving) setDialogOpen(false); }}>
        <DialogContent className={cn("max-w-lg")}>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit class" : "Add class"}</DialogTitle>
            <DialogDescription>Set the day, time, Teachers-Instructors and room. Overlapping classes on the same day are blocked.</DialogDescription>
          </DialogHeader>
          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{formError}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tt-title">Subject / class title</Label>
              <Input id="tt-title" value={form.title} maxLength={200} placeholder="e.g. Anatomy lecture" onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} aria-invalid={!!formError} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-day">Day</Label>
              <Select value={form.day_of_week} onValueChange={(v) => setForm((p) => ({ ...p, day_of_week: v }))}>
                <SelectTrigger id="tt-day"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEK_ORDER.map((d) => (
                    <SelectItem key={d} value={String(d)}>{DAY_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-teacher">Teachers-Instructors</Label>
              <Select value={form.teacher_id || "__tba__"} onValueChange={(v) => setForm((p) => ({ ...p, teacher_id: v }))}>
                <SelectTrigger id="tt-teacher"><SelectValue placeholder="Select Teachers-Instructors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__tba__">Room booking / TBA</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-start">Starts</Label>
              <Input id="tt-start" type="time" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-end">Ends</Label>
              <Input id="tt-end" type="time" value={form.ends_at} onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tt-room">Room</Label>
              <Input id="tt-room" value={form.room} maxLength={80} placeholder="e.g. Hall A" onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tt-notes">Notes (optional)</Label>
              <Textarea id="tt-notes" value={form.notes} maxLength={500} placeholder="Bring lab coat, etc." onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void handleSave()} className="bg-emerald-800 hover:bg-emerald-700">
              {saving ? "Saving…" : editingId ? "Save changes" : "Add class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
