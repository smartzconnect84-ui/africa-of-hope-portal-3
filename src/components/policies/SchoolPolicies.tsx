import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, ChevronDown, FileText, Pencil, Plus, ShieldCheck, WifiOff } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { usePermission } from "../../hooks/usePermission";
import { SectionHeader, EmptyState, panelClass } from "../Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  acceptPolicyRemote, getMyAcceptances, listAllPoliciesAdmin, listPolicies,
  savePolicyRemote, type PolicyAcceptance, type SchoolPolicy,
} from "@/lib/schoolPolicies";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function PolicyReader({ p, accepted, onAccept, accepting }: {
  p: SchoolPolicy; accepted: PolicyAcceptance | null; onAccept: () => void; accepting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const upToDate = !!accepted && accepted.acceptedVersion >= p.version;
  return (
    <div className={cn(panelClass, "overflow-hidden")}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{p.title}</span>
            {upToDate
              ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Accepted v{p.version}</span>
              : accepted
                ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">New version — please re-accept</span>
                : p.requiresAcceptance
                  ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Acceptance required</span>
                  : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">For information</span>}
          </span>
          <span className="mt-1 block text-xs text-slate-500">{p.category} · v{p.version} · Effective {p.effectiveDate}</span>
          <span className="mt-1 block text-sm text-slate-600">{p.summary}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-emerald-900/10 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{p.body}</p>
          {p.requiresAcceptance && !upToDate && (
            <Button size="sm" className="mt-3 bg-emerald-700 hover:bg-emerald-800" disabled={accepting} onClick={onAccept}>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> {accepting ? "Recording…" : `I have read and accept v${p.version}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function PoliciesReader({ filterAcceptanceOnly = false }: { filterAcceptanceOnly?: boolean }) {
  const { currentUser } = useApp();
  const [policies, setPolicies] = useState<SchoolPolicy[]>([]);
  const [accept, setAccept] = useState<Record<string, PolicyAcceptance>>({});
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listPolicies().then((r) => { setPolicies(r.data); setLive(r.live); });
    if (currentUser) getMyAcceptances(currentUser.id).then(setAccept);
  }, [currentUser?.id]);

  const required = useMemo(() => policies.filter((p) => !filterAcceptanceOnly || p.requiresAcceptance), [policies, filterAcceptanceOnly]);
  const done = required.filter((p) => p.requiresAcceptance && accept[p.id]?.acceptedVersion >= p.version).length;
  const totalReq = required.filter((p) => p.requiresAcceptance).length;

  const acceptOne = async (p: SchoolPolicy) => {
    if (!currentUser) return;
    setBusy(p.id);
    const err = await acceptPolicyRemote(p.id, currentUser.id, p.version, p.slug);
    setBusy(null);
    if (err) toast.error(err);
    else {
      setAccept((a) => ({ ...a, [p.id]: { policyId: p.id, userId: currentUser.id, acceptedVersion: p.version, acceptedAt: new Date().toISOString() } }));
      toast.success(`Accepted: ${p.title}`);
    }
  };

  const acceptAll = async () => {
    if (!currentUser) return;
    for (const p of required) {
      if (!p.requiresAcceptance) continue;
      if (accept[p.id]?.acceptedVersion >= p.version) continue;
      await acceptPolicyRemote(p.id, currentUser.id, p.version, p.slug);
    }
    if (currentUser) setAccept(await getMyAcceptances(currentUser.id));
    toast.success("All policies accepted");
  };

  return (
    <div className="space-y-4">
      {!live && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <WifiOff className="h-3.5 w-3.5" /> Showing built-in policy text — apply the latest migration to edit live.
        </p>
      )}
      {totalReq > 0 && currentUser && (
        <div className={cn(panelClass, "flex flex-wrap items-center justify-between gap-3 p-4")}>
          <p className="text-sm text-slate-700"><strong>{done}/{totalReq}</strong> required policies accepted</p>
          {done < totalReq && <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={acceptAll}><BookOpenCheck className="mr-1.5 h-3.5 w-3.5" /> Accept all</Button>}
        </div>
      )}
      {required.length === 0 && <EmptyState icon={FileText} title="No policies published yet" />}
      {required.map((p) => (
        <PolicyReader key={p.id} p={p} accepted={accept[p.id] ?? null} accepting={busy === p.id} onAccept={() => acceptOne(p)} />
      ))}
    </div>
  );
}

const EMPTY: SchoolPolicy = {
  id: "", slug: "", title: "", category: "General", summary: "", body: "",
  version: 1, effectiveDate: new Date().toISOString().slice(0, 10),
  isPublished: true, requiresAcceptance: true, sort: 0,
};

export default function SchoolPoliciesManager() {
  const canManage = usePermission("settings.manage");
  const [policies, setPolicies] = useState<SchoolPolicy[]>([]);
  const [live, setLive] = useState(true);
  const [editing, setEditing] = useState<SchoolPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => listAllPoliciesAdmin().then((r) => { setPolicies(r.data); setLive(r.live); });
  useEffect(() => { reload(); }, []);

  if (!canManage) {
    return (
      <div className="space-y-4">
        <SectionHeader title="School Policies" subtitle="Read each policy and record your acceptance" />
        <PoliciesReader />
      </div>
    );
  }

  const save = async () => {
    if (!editing || !editing.title.trim() || !editing.slug.trim()) { toast.error("Title and slug are required."); return; }
    setSaving(true);
    const err = await savePolicyRemote(editing);
    setSaving(false);
    if (err) toast.error(err);
    else { toast.success(live ? "Policy published live" : "Saved locally — apply migration to publish"); setEditing(null); reload(); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="School Policies"
        subtitle={live ? "Stored in Supabase · visible on the public site instantly" : "Built-in text — apply migration to edit live"}
        action={<Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setEditing({ ...EMPTY, slug: `policy-${Date.now().toString(36)}`, sort: policies.length * 10 + 10 })}><Plus className="mr-1.5 h-3.5 w-3.5" /> New policy</Button>}
      />
      <div className="grid gap-3">
        {policies.map((p) => (
          <div key={p.id} className={cn(panelClass, "flex flex-wrap items-center gap-3 p-4")}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{p.title}</p>
              <p className="text-xs text-slate-500">{p.category} · v{p.version} · {p.isPublished ? "Published" : "Hidden"} · {p.requiresAcceptance ? "Acceptance required" : "Info only"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
          </div>
        ))}
      </div>

      <SectionHeader title="Student view preview" subtitle="Exactly what students see, including acceptance tracking" />
      <PoliciesReader />

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={() => setEditing(null)}>
          <div className={cn("max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5", panelClass)} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">{policies.some((p) => p.id === editing.id) ? "Edit policy" : "New policy"}</h3>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Version</Label><Input type="number" value={editing.version} onChange={(e) => setEditing({ ...editing, version: Number(e.target.value) || 1 })} /></div>
                <div className="space-y-1.5"><Label>Effective date</Label><Input type="date" value={editing.effectiveDate} onChange={(e) => setEditing({ ...editing, effectiveDate: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Summary</Label><Textarea rows={2} value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Full text</Label><Textarea rows={10} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={editing.isPublished} onCheckedChange={(v) => setEditing({ ...editing, isPublished: Boolean(v) })} /> Published on public site
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={editing.requiresAcceptance} onCheckedChange={(v) => setEditing({ ...editing, requiresAcceptance: Boolean(v) })} /> Requires student acceptance
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save & publish"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
