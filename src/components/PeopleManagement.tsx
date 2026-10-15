import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Search,
  Plus,
  Check,
  X,
  Mail,
  Phone,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { usePermissions } from "../hooks/usePermission";
import { ROLES, STAFF_ROLES } from "../lib/permissions";
import type { Role, User } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, SectionHeader, panelClass } from "./Navigation";
import { cn } from "@/lib/utils";

const TH = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const TD = "px-3 py-2 text-sm text-slate-700";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Active: "bg-emerald-100 text-emerald-800",
    Suspended: "bg-rose-100 text-rose-700",
    "Pending Approval": "bg-amber-100 text-amber-800",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", map[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type Tab = "staff" | "students" | "applicants";

export default function PeopleManagement() {
  const { currentUser } = useApp();
  const { isSuperAdmin, can } = usePermissions();
  const [tab, setTab] = useState<Tab>("staff");

  const canSeeStaff = can("staff.manage") || can("people.view");
  const canSeeStudents = can("students.manage") || can("people.view");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Staff & Students"
        subtitle="Everyone with an account on the portal, in one directory."
      />

      <div className="flex gap-1.5 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
        {([
          ["staff", "Staff"],
          ["students", "Students"],
          ["applicants", "Applicants"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-component-id={`people-tab-${key}`}
            className={cn(
              "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
              tab === key ? "bg-emerald-800 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "staff" && (canSeeStaff ? <StaffTab currentUser={currentUser} isSuperAdmin={isSuperAdmin} /> : <NoAccess />)}
      {tab === "students" && (canSeeStudents ? <StudentsTab /> : <NoAccess />)}
      {tab === "applicants" && (canSeeStudents ? <ApplicantsTab /> : <NoAccess />)}
    </div>
  );
}

function NoAccess() {
  return <EmptyState icon={UserX} title="No access" hint="You don't have permission to view this list." />;
}

/* ----------------------------- Staff tab ----------------------------- */

function StaffTab({ currentUser, isSuperAdmin }: { currentUser: User | null; isSuperAdmin: boolean }) {
  const { state, adminUsers } = useApp();
  const { can } = usePermissions();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"All" | Role>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = can("staff.manage");
  const staff = state.users.filter((u) => STAFF_ROLES.includes(u.role));
  const filtered = staff.filter(
    (u) =>
      (role === "All" || u.role === role) &&
      (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())),
  );

  const roleOptions: Role[] = STAFF_ROLES.filter((r) => isSuperAdmin || r !== "Super Admin");

  async function run(id: string, action: string, body: Record<string, unknown>) {
    setBusyId(id);
    await adminUsers(action, { user_id: id, ...body });
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className={cn(panelClass, "p-4")}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff by name or email" className="pl-9" />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as "All" | Role)}>
            <SelectTrigger className="w-44" data-component-id="people-filter-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All roles</SelectItem>
              {STAFF_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={() => setAddOpen(true)} className="bg-emerald-700 hover:bg-emerald-800" data-component-id="people-add-staff">
              <Plus className="mr-1.5 h-4 w-4" /> Add staff member
            </Button>
          )}
        </div>
      </div>

      <div className={cn(panelClass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Contact</th>
                <th className={TH}>Role</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6">
                    <EmptyState icon={Users} title="No staff match this filter" hint="Adjust the search or role filter." />
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isSuperAdminTarget = u.role === "Super Admin";
                const lockedByRank = isSuperAdminTarget && !isSuperAdmin;
                const rowSlug = slug(u.name);
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-emerald-50/40">
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-950 text-[11px] font-semibold text-amber-400">
                          {initials(u.name)}
                        </span>
                        <div>
                          <p className="font-medium text-slate-800">{u.name}</p>
                          {u.title && <p className="text-[11px] text-slate-500">{u.title}</p>}
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <span className="block text-slate-600">{u.email}</span>
                      <span className="block text-[11px] text-slate-400">{u.phone}</span>
                    </td>
                    <td className={TD}>
                      {canManage && !isSelf && !lockedByRank ? (
                        <Select
                          value={u.role}
                          onValueChange={(v) => run(u.id, "update", { role: v })}
                        >
                          <SelectTrigger className="h-8 w-40" data-component-id={`people-edit-role-${rowSlug}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {u.role}
                        </Badge>
                      )}
                    </td>
                    <td className={TD}>{statusBadge(u.status)}</td>
                    <td className={TD}>
                      {canManage && !isSelf && !lockedByRank ? (
                        <StaffActions
                          user={u}
                          busy={busyId === u.id}
                          rowSlug={rowSlug}
                          onSuspend={() => run(u.id, "update", { status: u.status === "Active" ? "Suspended" : "Active" })}
                          onResetEmail={() => run(u.id, "reset_password", { mode: "email" })}
                          onDelete={() => run(u.id, "delete", {})}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">{isSelf ? "This is you" : "Locked"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && <AddStaffDialog open={addOpen} onOpenChange={setAddOpen} isSuperAdmin={isSuperAdmin} />}
    </div>
  );
}

function StaffActions({
  user,
  busy,
  rowSlug,
  onSuspend,
  onResetEmail,
  onDelete,
}: {
  user: User;
  busy: boolean;
  rowSlug: string;
  onSuspend: () => void;
  onResetEmail: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onSuspend}
        data-component-id={user.status === "Active" ? `people-suspend-${rowSlug}` : `people-activate-${rowSlug}`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.status === "Active" ? (
          <>
            <UserX className="mr-1 h-3.5 w-3.5" /> Suspend
          </>
        ) : (
          <>
            <UserCheck className="mr-1 h-3.5 w-3.5" /> Activate
          </>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" data-component-id={`people-reset-${rowSlug}`}>
            <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onResetEmail} data-component-id={`people-resend-${rowSlug}`}>
            <Mail className="mr-2 h-3.5 w-3.5" /> Email a reset link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="text-rose-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their account. If they have fee or certificate records, suspend them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddStaffDialog({
  open,
  onOpenChange,
  isSuperAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuperAdmin: boolean;
}) {
  const { adminUsers } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<Role>("Teacher");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const roleOptions = ROLES.filter((r) => r !== "Student" && (isSuperAdmin || r !== "Super Admin"));

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setRole("Teacher");
    setPassword("");
  }

  async function submit() {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSubmitting(true);
    const err = await adminUsers("create", {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      title: title.trim(),
      role,
      password: password.trim() || undefined,
    });
    setSubmitting(false);
    if (!err) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg" data-component-id="add-staff-close">
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
          <DialogDescription>Create a staff account and assign a role.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-component-id="add-staff-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" data-component-id="add-staff-email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} data-component-id="add-staff-phone" />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Registrar" />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Role</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {roleOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  data-component-id={`add-staff-role-${slug(r)}`}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
                    role === r ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Password (optional)</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="text"
              placeholder="Leave blank to email a set-password link"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-component-id="add-staff-cancel">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="bg-emerald-700 hover:bg-emerald-800" data-component-id="add-staff-submit">
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Students tab ---------------------------- */

function StudentsTab() {
  const { state, toggleStudentStatus, adminUsers } = useApp();
  const { can } = usePermissions();
  const [q, setQ] = useState("");
  const [program, setProgram] = useState("All");
  const [status, setStatus] = useState("All");
  const [assignFor, setAssignFor] = useState<User | null>(null);

  const canManage = can("students.manage");
  const students = state.users.filter((u) => u.role === "Student" && u.status !== "Pending Approval");
  const filtered = students.filter(
    (u) =>
      (program === "All" || u.programIds.includes(program)) &&
      (status === "All" || u.status === status) &&
      (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className={cn(panelClass, "p-4")}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" className="pl-9" />
          </div>
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="w-48" data-component-id="students-filter-program">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All programmes</SelectItem>
              {state.programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" data-component-id="students-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["All", "Active", "Suspended"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={cn(panelClass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <th className={TH}>Student</th>
                <th className={TH}>Contact</th>
                <th className={TH}>Programmes</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6">
                    <EmptyState icon={Users} title="No students match this filter" hint="Adjust the search or filters." />
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const rowSlug = slug(u.name);
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-emerald-50/40">
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-950 text-[11px] font-semibold text-amber-400">
                          {initials(u.name)}
                        </span>
                        <span className="font-medium text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className={TD}>
                      <span className="block text-slate-600">{u.email}</span>
                      <span className="block text-[11px] text-slate-400">{u.phone}</span>
                    </td>
                    <td className={TD}>
                      {u.programIds.map((p) => state.programs.find((x) => x.id === p)?.title).filter(Boolean).join(", ") || "-"}
                    </td>
                    <td className={TD}>{statusBadge(u.status)}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAssignFor(u)}
                            data-component-id={`students-cohort-${rowSlug}`}
                          >
                            Assign
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { toggleStudentStatus(u.id); toast.success(`${u.name} status updated`); }}
                            data-component-id={u.status === "Active" ? `students-suspend-${rowSlug}` : `students-reactivate-${rowSlug}`}
                          >
                            {u.status === "Active" ? "Suspend" : "Reinstate"}
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => adminUsers("reset_password", { user_id: u.id, mode: "email" })}
                            data-component-id={`students-reset-${rowSlug}`}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {assignFor && <AssignDialog user={assignFor} onOpenChange={(o) => !o && setAssignFor(null)} />}
    </div>
  );
}

function AssignDialog({ user, onOpenChange }: { user: User; onOpenChange: (open: boolean) => void }) {
  const { state, assignStudent } = useApp();
  const [programIds, setProgramIds] = useState<string[]>(user.programIds);
  const [cohortIds, setCohortIds] = useState<string[]>(user.cohortIds);
  const [saving, setSaving] = useState(false);

  const availableCohorts = state.cohorts.filter((c) => programIds.includes(c.programId));

  function toggleProgram(id: string) {
    setProgramIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      setCohortIds((cur) => cur.filter((cid) => next.includes(state.cohorts.find((c) => c.id === cid)?.programId ?? "")));
      return next;
    });
  }

  function toggleCohort(id: string) {
    setCohortIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    const err = await assignStudent(user.id, programIds, cohortIds);
    setSaving(false);
    if (!err) onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {user.name}</DialogTitle>
          <DialogDescription>Choose programmes, then the cohorts within them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Programmes</Label>
            <div className="space-y-1.5">
              {state.programs.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                  <Checkbox checked={programIds.includes(p.id)} onCheckedChange={() => toggleProgram(p.id)} />
                  {p.title}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Cohorts</Label>
            {availableCohorts.length === 0 ? (
              <p className="text-xs text-slate-500">Choose a programme to see its cohorts.</p>
            ) : (
              <div className="space-y-1.5">
                {availableCohorts.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                    <Checkbox checked={cohortIds.includes(c.id)} onCheckedChange={() => toggleCohort(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Applicants tab ---------------------------- */

function ApplicantsTab() {
  const { state, approveApplicant, rejectApplicant } = useApp();
  const pending = state.users.filter((u) => u.role === "Student" && u.status === "Pending Approval");
  const [assignFor, setAssignFor] = useState<User | null>(null);

  async function approve(u: User) {
    await approveApplicant(u.id);
    toast.success(`${u.name} approved`);
  }

  return (
    <div className="space-y-4">
      <div className={cn(panelClass, "p-4")}>
        {pending.length === 0 ? (
          <EmptyState icon={UserCheck} title="No pending applications" hint="New public registrations will appear here." />
        ) : (
          <div className="space-y-2">
            {pending.map((u) => {
              const rowSlug = slug(u.name);
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-800 text-xs font-semibold text-amber-400">
                      {initials(u.name)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.name}</p>
                      <p className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Mail className="h-3 w-3" /> {u.email}
                        <Phone className="h-3 w-3" /> {u.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAssignFor(u)} data-component-id={`students-cohort-${rowSlug}`}>
                      Assign first
                    </Button>
                    <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => approve(u)} data-component-id={`students-approve-${rowSlug}`}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600"
                      onClick={() => { rejectApplicant(u.id); toast.error(`${u.name} declined`); }}
                      data-component-id={`students-reject-${rowSlug}`}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {assignFor && <AssignDialog user={assignFor} onOpenChange={(o) => !o && setAssignFor(null)} />}
    </div>
  );
}
