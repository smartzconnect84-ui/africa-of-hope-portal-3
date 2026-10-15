import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Users, Award, Banknote, CircleDollarSign, Search, Plus, Check, X, BookOpen,
  Boxes, CalendarDays, ClipboardCheck, BadgeCheck, UserCheck, UserX, GraduationCap,
  Percent, Mail, Phone, BadgeAlert,
} from "lucide-react";
import { useApp, formatCurrency, letterGrade } from "../context/AppContext";
import type { AttendanceStatus, User } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "./Navigation";
import { cn } from "@/lib/utils";
import ProgramCover from "./ProgramCover";

const TH =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const TD = "px-3 py-2 text-sm text-slate-700";
const PIE = ["#047857", "#f59e0b", "#0f172a", "#0ea5e9"];
const SEG: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-600 text-white",
  Absent: "bg-rose-600 text-white",
  Late: "bg-amber-500 text-amber-950",
};
const ATT: AttendanceStatus[] = ["Present", "Late", "Absent"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Active: "bg-emerald-100 text-emerald-800",
    Suspended: "bg-rose-100 text-rose-700",
    "Pending Approval": "bg-amber-100 text-amber-800",
    Valid: "bg-emerald-100 text-emerald-800",
    Revoked: "bg-rose-100 text-rose-700",
    Graded: "bg-emerald-100 text-emerald-800",
    Submitted: "bg-sky-100 text-sky-800",
    Missing: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", map[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

export function AdminDashboard() {
  const { state, approveApplicant, rejectApplicant } = useApp();
  const students = state.users.filter((u) => u.role === "Student");
  const active = students.filter((u) => u.status === "Active");
  const pending = students.filter((u) => u.status === "Pending Approval");
  const collected = state.fees.reduce((s, f) => s + f.amount, 0);
  const expected = active.reduce(
    (s, st) =>
      s +
      st.programIds.reduce(
        (t, pid) => t + (state.programs.find((p) => p.id === pid)?.tuition ?? 0),
        0,
      ),
    0,
  );
  const outstanding = Math.max(expected - collected, 0);

  const enrollData = state.programs.map((p) => ({
    name: p.title.split(" ").slice(0, 2).join(" "),
    students: active.filter((u) => u.programIds.includes(p.id)).length,
  }));
  const revData = (["Registration", "Tuition", "Exam", "Certificate"] as const)
    .map((c) => ({
      name: c,
      value: state.fees.filter((f) => f.category === c).reduce((s, f) => s + f.amount, 0),
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Institutional Command Centre"
        subtitle="Enrollment, finance and compliance signals across every active cohort."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Active students" value={active.length} hint={`${students.length} total on register`} />
        <StatCard icon={Boxes} label="Active cohorts" value={state.cohorts.length} tone="slate" hint={`${state.programs.length} programs in catalogue`} />
        <StatCard icon={Banknote} label="Fees collected" value={formatCurrency(collected)} tone="emerald" hint={`${formatCurrency(outstanding)} outstanding`} />
        <StatCard icon={Award} label="Certificates issued" value={state.certificates.filter((c) => c.status === "Valid").length} tone="amber" hint={`${pending.length} applications awaiting review`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className={cn(panelClass, "p-5 lg:col-span-2")}>
          <SectionHeader title="Enrollment by program" subtitle="Active students per certification track" />
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrollData} margin={{ left: -18 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="#94a3b8" />
                <Tooltip cursor={{ fill: "rgba(4,120,87,0.06)" }} />
                <Bar dataKey="students" fill="#047857" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.05} className={cn(panelClass, "p-5")}>
          <SectionHeader title="Revenue mix" subtitle="Fee income by category" />
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={3}>
                  {revData.map((d, i) => (
                    <Cell key={d.name} fill={PIE[i % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {revData.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                  {d.name}
                </span>
                <span className="font-medium text-slate-800">{formatCurrency(d.value)}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={0.1} className={cn(panelClass, "p-5")}>
        <SectionHeader
          title="Registration approval queue"
          subtitle="Public applications awaiting registrar review"
          action={<Badge className="bg-amber-100 text-amber-800">{pending.length} pending</Badge>}
        />
        <div className="mt-4 space-y-2">
          {pending.length === 0 ? (
            <EmptyState icon={UserCheck} title="No pending applications" hint="New public registrations will appear here." />
          ) : (
            pending.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-800 text-xs font-semibold text-amber-400">
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {u.email} / {u.programIds.map((p) => state.programs.find((x) => x.id === p)?.title).join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { approveApplicant(u.id); toast.success(`${u.name} approved`); }} className="bg-emerald-700 hover:bg-emerald-800">
                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { rejectApplicant(u.id); toast.error(`${u.name} declined`); }} className="text-rose-600">
                    <X className="mr-1 h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Reveal>
    </div>
  );
}

export function StudentDirectory() {
  const { state, toggleStudentStatus, approveApplicant, rejectApplicant } = useApp();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<User | null>(null);

  const students = state.users.filter((u) => u.role === "Student");
  const filtered = students.filter(
    (u) =>
      (status === "All" || u.status === status) &&
      (u.name.toLowerCase().includes(q.toLowerCase()) ||
        u.email.toLowerCase().includes(q.toLowerCase())),
  );

  const dossier = useMemo(() => {
    if (!selected) return null;
    const att = state.attendance.filter((r) => r.studentId === selected.id);
    const attended = att.filter((r) => r.status !== "Absent").length;
    return {
      rate: att.length ? Math.round((attended / att.length) * 100) : 0,
      paid: state.fees.filter((f) => f.studentId === selected.id).reduce((s, f) => s + f.amount, 0),
      due: selected.programIds.reduce(
        (t, pid) => t + (state.programs.find((p) => p.id === pid)?.tuition ?? 0),
        0,
      ),
      certs: state.certificates.filter((c) => c.studentId === selected.id),
    };
  }, [selected, state]);

  return (
    <div className="space-y-5">
      <SectionHeader title="Student Directory" subtitle="Every learner on the institutional register" />
      <div className={cn(panelClass, "p-4")}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-9" />
          </div>
          <div className="flex gap-1.5">
            {["All", "Active", "Pending Approval", "Suspended"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  status === s ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn(panelClass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <th className={TH}>Student</th>
                <th className={TH}>Contact</th>
                <th className={TH}>Programs</th>
                <th className={TH}>Joined</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6">
                    <EmptyState icon={Users} title="No students match this filter" hint="Adjust the search or status filter." />
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-emerald-50/40">
                  <td className={TD}>
                    <button type="button" onClick={() => setSelected(u)} className="flex items-center gap-3 text-left">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-950 text-[11px] font-semibold text-amber-400">
                        {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <span className="font-medium text-slate-800">{u.name}</span>
                    </button>
                  </td>
                  <td className={TD}>
                    <span className="block text-slate-600">{u.email}</span>
                    <span className="block text-[11px] text-slate-400">{u.phone}</span>
                  </td>
                  <td className={TD}>
                    {u.programIds.map((p) => state.programs.find((x) => x.id === p)?.title).filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className={TD}>{u.joinedDate}</td>
                  <td className={TD}>{statusBadge(u.status)}</td>
                  <td className={TD}>
                    <div className="flex gap-1.5">
                      {u.status === "Pending Approval" ? (
                        <>
                          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => { approveApplicant(u.id); toast.success(`${u.name} approved`); }}>Approve</Button>
                          <Button size="sm" variant="outline" className="text-rose-600" onClick={() => { rejectApplicant(u.id); toast.error(`${u.name} declined`); }}>Decline</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { toggleStudentStatus(u.id); toast.success(`${u.name} status updated`); }}>
                          {u.status === "Active" ? "Suspend" : "Reinstate"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>Full learner dossier and compliance record</DialogDescription>
          </DialogHeader>
          {selected && dossier && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(selected.status)}
                {selected.programIds.map((p) => (
                  <Badge key={p} variant="secondary" className="bg-emerald-50 text-emerald-800">
                    {state.programs.find((x) => x.id === p)?.title}
                  </Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-emerald-700" /> {selected.email}</p>
                <p className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-emerald-700" /> {selected.phone}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <Percent className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-1 text-lg font-semibold text-slate-900">{dossier.rate}%</p>
                  <p className="text-[11px] text-slate-500">Attendance</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <Banknote className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(dossier.paid)}</p>
                  <p className="text-[11px] text-slate-500">Paid of {formatCurrency(dossier.due)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <Award className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-1 text-lg font-semibold text-slate-900">{dossier.certs.length}</p>
                  <p className="text-[11px] text-slate-500">Certificates</p>
                </div>
              </div>
              {selected.note && (
                <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">{selected.note}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const emptyProgram = {
  title: "",
  category: "",
  durationWeeks: "",
  tuition: "",
  certification: "Certificate of Completion",
  description: "",
  entryRequirements: "",
  modulesRaw: "",
};

export function ProgramBuilder() {
  const { state, addProgram } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyProgram);

  const submit = () => {
    if (!form.title.trim() || !form.category.trim()) {
      toast.error("Program title and category are required");
      return;
    }
    addProgram({
      title: form.title.trim(),
      category: form.category.trim(),
      durationWeeks: Number(form.durationWeeks) || 8,
      tuition: Number(form.tuition) || 0,
      certification: form.certification,
      description: form.description,
      entryRequirements: form.entryRequirements,
      modulesRaw: form.modulesRaw,
    });
    toast.success("Program published to the catalogue");
    setForm(emptyProgram);
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Program Builder"
        subtitle="Design certification tracks, modules and tuition schedules"
        action={
          <Button onClick={() => setOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
            <Plus className="mr-1 h-4 w-4" /> New program
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {state.programs.map((p) => (
          <Reveal key={p.id} className={cn(panelClass, "flex flex-col overflow-hidden")}>
            <ProgramCover program={p} editable className="h-44" />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
                  <Badge variant="secondary" className="mt-1.5 bg-emerald-50 text-emerald-800">{p.category}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-emerald-800">{formatCurrency(p.tuition)}</p>
                  <p className="text-[11px] text-slate-500">{p.durationWeeks} weeks</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{p.description}</p>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                {p.modules.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-800/10 text-[11px] font-semibold text-emerald-800">
                      {m.weeks}w
                    </span>
                    <span>
                      <span className="block font-medium text-slate-800">{m.title}</span>
                      <span className="block text-xs text-slate-500">{m.summary}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <GraduationCap className="h-4 w-4 text-amber-500" /> {p.certification}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish a new program</DialogTitle>
            <DialogDescription>Define the track, tuition and module outline.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Program title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Data Analytics with Python" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Software & Technology" />
            </div>
            <div className="space-y-1.5">
              <Label>Certification</Label>
              <Input value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (weeks)</Label>
              <Input type="number" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })} placeholder="16" />
            </div>
            <div className="space-y-1.5">
              <Label>Tuition (USD)</Label>
              <Input type="number" value={form.tuition} onChange={(e) => setForm({ ...form, tuition: e.target.value })} placeholder="600" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What graduates will be able to do" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Entry requirements</Label>
              <Input value={form.entryRequirements} onChange={(e) => setForm({ ...form, entryRequirements: e.target.value })} placeholder="Secondary certificate, aptitude interview" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Modules (one per line: Title | Weeks | Summary)</Label>
              <Textarea value={form.modulesRaw} onChange={(e) => setForm({ ...form, modulesRaw: e.target.value })} rows={3} placeholder="Foundations | 4 | Core concepts and tooling" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} className="bg-emerald-700 hover:bg-emerald-800">Publish program</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const emptyCohort = { name: "", programId: "", teacherId: "", startDate: "", endDate: "", room: "" };

export function CohortCoordinator() {
  const { state, addCohort } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCohort);
  const [roster, setRoster] = useState<string[]>([]);
  const teachers = state.users.filter((u) => u.role === "Teacher");

  const toggleStudent = (id: string) =>
    setRoster((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const submit = () => {
    if (!form.name.trim() || !form.programId || !form.teacherId) {
      toast.error("Cohort name, program and instructor are required");
      return;
    }
    addCohort({
      name: form.name.trim(),
      programId: form.programId,
      teacherId: form.teacherId,
      startDate: form.startDate || new Date().toISOString().slice(0, 10),
      endDate: form.endDate || new Date().toISOString().slice(0, 10),
      room: form.room || "Unassigned",
      studentIds: roster,
    });
    const teacher = state.users.find((u) => u.id === form.teacherId);
    toast.success(`Cohort created and assigned to ${teacher?.name ?? "instructor"}`);
    setForm(emptyCohort);
    setRoster([]);
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Cohort Coordinator"
        subtitle="Batch learners, assign instructors and schedule training rooms"
        action={
          <Button onClick={() => setOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
            <Plus className="mr-1 h-4 w-4" /> New cohort
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {state.cohorts.map((c) => {
          const program = state.programs.find((p) => p.id === c.programId);
          const teacher = state.users.find((u) => u.id === c.teacherId);
          return (
            <Reveal key={c.id} className={cn(panelClass, "p-5")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-500">{program?.title}</p>
                </div>
                <Badge className="bg-emerald-800 text-amber-400">{c.studentIds.length} enrolled</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p className="flex items-center gap-2 text-slate-600"><BadgeCheck className="h-4 w-4 text-emerald-700" /> {teacher?.name ?? "Unassigned"}</p>
                <p className="flex items-center gap-2 text-slate-600"><Boxes className="h-4 w-4 text-emerald-700" /> {c.room}</p>
                <p className="flex items-center gap-2 text-slate-600"><CalendarDays className="h-4 w-4 text-emerald-700" /> {c.startDate}</p>
                <p className="flex items-center gap-2 text-slate-600"><CalendarDays className="h-4 w-4 text-amber-500" /> {c.endDate}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                {c.studentIds.map((sid) => {
                  const stu = state.users.find((u) => u.id === sid);
                  return (
                    <span key={sid} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600">
                      {stu?.name ?? sid}
                    </span>
                  );
                })}
              </div>
            </Reveal>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a cohort</DialogTitle>
            <DialogDescription>Assign a program, instructor and student roster.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Cohort name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2025 Q3 Data Analytics, Evening Batch" />
            </div>
            <div className="space-y-1.5">
              <Label>Program</Label>
              <Select value={form.programId} onValueChange={(v) => setForm({ ...form, programId: v })}>
                <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  {state.programs.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Instructor</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Training room</Label>
              <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Innovation Lab B" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Roster ({roster.length} selected)</Label>
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto rounded-xl border border-slate-100 p-2">
                {state.users
                  .filter((u) => u.role === "Student" && u.status !== "Suspended")
                  .map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-emerald-50">
                      <Checkbox checked={roster.includes(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                      <span className="text-sm text-slate-700">{s.name}</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} className="bg-emerald-700 hover:bg-emerald-800">Create cohort</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TeacherDashboard() {
  const { state, currentUser } = useApp();
  const cohorts = state.cohorts.filter((c) => c.teacherId === currentUser?.id);
  const studentIds = new Set(cohorts.flatMap((c) => c.studentIds));
  const mySubs = state.submissions.filter((s) => studentIds.has(s.studentId) && state.assignments.some((a) => a.id === s.assignmentId && cohorts.some((c) => c.id === a.cohortId)));
  const pendingGrading = mySubs.filter((s) => s.status === "Submitted").length;

  return (
    <div className="space-y-5">
      <SectionHeader title={`Welcome, ${currentUser?.name.split(" ")[0] ?? "Instructor"}`} subtitle="Your teaching load, rosters and grading queue at a glance." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Boxes} label="My cohorts" value={cohorts.length} hint={currentUser?.title} />
        <StatCard icon={Users} label="Students taught" value={studentIds.size} tone="slate" />
        <StatCard icon={ClipboardCheck} label="Avg attendance" value={`${avgAttendance(state.attendance, cohorts.map((c) => c.id))}%`} tone="emerald" />
        <StatCard icon={BadgeAlert} label="Awaiting grading" value={pendingGrading} tone="amber" hint="Submissions without marks" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cohorts.map((c) => {
          const program = state.programs.find((p) => p.id === c.programId);
          const rate = avgAttendance(state.attendance.filter((r) => r.cohortId === c.id), []);
          return (
            <Reveal key={c.id} className={cn(panelClass, "p-5")}>
              <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
              <p className="text-xs text-slate-500">{program?.title} / {c.room}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p className="text-slate-600"><span className="block text-lg font-semibold text-emerald-800">{c.studentIds.length}</span>Enrolled</p>
                <p className="text-slate-600"><span className="block text-lg font-semibold text-emerald-800">{rate}%</span>Attendance</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-amber-400" style={{ width: `${rate}%` }} />
              </div>
            </Reveal>
          );
        })}
        {cohorts.length === 0 && <EmptyState icon={BookOpen} title="No cohorts assigned yet" hint="Ask a school admin to assign you a batch." />}
      </div>
    </div>
  );
}

function avgAttendance(records: { status: AttendanceStatus }[], _ids: string[]): number {
  if (records.length === 0) return 0;
  const attended = records.filter((r) => r.status !== "Absent").length;
  return Math.round((attended / records.length) * 100);
}

export function AttendanceSheet() {
  const { state, currentUser, markAttendance } = useApp();
  const cohorts = state.cohorts.filter((c) => c.teacherId === currentUser?.id);
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  const cohort = cohorts.find((c) => c.id === cohortId);

  useEffect(() => {
    if (!cohort) {
      setStatuses({});
      return;
    }
    const map: Record<string, AttendanceStatus> = {};
    cohort.studentIds.forEach((sid) => {
      const rec = state.attendance.find((r) => r.cohortId === cohort.id && r.date === date && r.studentId === sid);
      map[sid] = rec?.status ?? "Present";
    });
    setStatuses(map);
  }, [cohort, date, state.attendance]);

  const save = () => {
    if (!cohort) return;
    markAttendance(cohort.id, date, statuses);
    toast.success("Attendance register saved");
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Attendance Sheet"
        subtitle="Record daily attendance for your assigned cohorts"
        action={
          cohort && (
            <Button onClick={save} className="bg-emerald-700 hover:bg-emerald-800">
              <Check className="mr-1 h-4 w-4" /> Save register
            </Button>
          )
        }
      />
      {cohorts.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No cohorts to mark" hint="You have not been assigned a batch yet." />
      ) : (
        <div className={cn(panelClass, "p-4")}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label>Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Session date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (!cohort) return;
                const all: Record<string, AttendanceStatus> = {};
                cohort.studentIds.forEach((sid) => { all[sid] = "Present"; });
                setStatuses(all);
              }}
            >
              Mark all present
            </Button>
          </div>

          {cohort && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TH}>Student</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cohort.studentIds.map((sid) => {
                    const stu = state.users.find((u) => u.id === sid);
                    return (
                      <tr key={sid} className="border-b border-slate-50 last:border-0">
                        <td className={TD}>{stu?.name ?? sid}</td>
                        <td className={TD}>
                          <div className="flex gap-1.5">
                            {ATT.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setStatuses((p) => ({ ...p, [sid]: s }))}
                                className={cn(
                                  "rounded-full px-3 py-1 text-[11px] font-medium transition",
                                  statuses[sid] === s ? SEG[s] : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Gradebook() {
  const { state, currentUser, gradeSubmission } = useApp();
  const cohorts = state.cohorts.filter((c) => c.teacherId === currentUser?.id);
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [assignmentId, setAssignmentId] = useState("");
  const [draft, setDraft] = useState<Record<string, { marks: string; feedback: string }>>({});

  const cohort = cohorts.find((c) => c.id === cohortId);
  const assignments = state.assignments.filter((a) => a.cohortId === cohortId);

  useEffect(() => {
    const first = state.assignments.find((a) => a.cohortId === cohortId);
    setAssignmentId(first?.id ?? "");
  }, [cohortId, state.assignments]);

  useEffect(() => {
    if (!cohort) return;
    const map: Record<string, { marks: string; feedback: string }> = {};
    cohort.studentIds.forEach((sid) => {
      const sub = state.submissions.find((s) => s.assignmentId === assignmentId && s.studentId === sid);
      map[sid] = { marks: sub?.marks != null ? String(sub.marks) : "", feedback: sub?.feedback ?? "" };
    });
    setDraft(map);
  }, [cohort, assignmentId, state.submissions]);

  const assignment = assignments.find((a) => a.id === assignmentId);

  const saveRow = (sid: string) => {
    const row = draft[sid];
    const marks = Number(row?.marks);
    if (Number.isNaN(marks) || marks < 0 || marks > (assignment?.maxMarks ?? 100)) {
      toast.error(`Enter a valid score (0 to ${assignment?.maxMarks ?? 100})`);
      return;
    }
    gradeSubmission(assignmentId, sid, marks, row?.feedback ?? "");
    toast.success("Grade recorded");
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Gradebook" subtitle="Score submissions and record feedback for your cohorts" />
      {cohorts.length === 0 ? (
        <EmptyState icon={BookOpen} title="No cohorts assigned" hint="Grading unlocks once you are assigned a batch." />
      ) : (
        <div className={cn(panelClass, "p-4")}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Assignment</Label>
              <Select value={assignmentId} onValueChange={setAssignmentId} disabled={assignments.length === 0}>
                <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (<SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {cohort && assignment ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TH}>Student</th>
                    <th className={TH}>Score (/{assignment.maxMarks})</th>
                    <th className={TH}>Feedback</th>
                    <th className={TH}>Grade</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {cohort.studentIds.map((sid) => {
                    const stu = state.users.find((u) => u.id === sid);
                    const row = draft[sid] ?? { marks: "", feedback: "" };
                    const sub = state.submissions.find((s) => s.assignmentId === assignmentId && s.studentId === sid);
                    return (
                      <tr key={sid} className="border-b border-slate-50 last:border-0">
                        <td className={TD}>
                          <span className="block font-medium text-slate-800">{stu?.name ?? sid}</span>
                          {sub && <span className="mt-0.5 block">{statusBadge(sub.status)}</span>}
                        </td>
                        <td className={TD}>
                          <Input
                            type="number"
                            className="h-9 w-24"
                            value={row.marks}
                            onChange={(e) => setDraft((p) => ({ ...p, [sid]: { ...row, marks: e.target.value } }))}
                          />
                        </td>
                        <td className={TD}>
                          <Input
                            className="h-9"
                            value={row.feedback}
                            placeholder="Comment"
                            onChange={(e) => setDraft((p) => ({ ...p, [sid]: { ...row, feedback: e.target.value } }))}
                          />
                        </td>
                        <td className={TD}>
                          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                            {letterGrade(row.marks === "" ? null : Number(row.marks))}
                          </span>
                        </td>
                        <td className={TD}>
                          <Button size="sm" variant="outline" onClick={() => saveRow(sid)}>Save</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState icon={BookOpen} title="No assignment selected" hint="Create an assignment for this cohort to start grading." />
            </div>
          )}
        </div>
      )}
    </div>
  );
}