import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { StudyPlanRequest, SupportPledge, SupportStatus } from "@/lib/engagement";

interface LooseClient {
  from(table: string): {
    update(row: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<{ error: { message?: string } | null }>;
    };
    delete(): {
      eq(column: string, value: string): PromiseLike<{ error: { message?: string } | null }>;
    };
  };
}
const remote = supabase as unknown as LooseClient;

const LOCAL_KEYS = { support: "aoh-support-pledges-v1", plans: "aoh-study-plans-v1" } as const;
const STATUSES: SupportStatus[] = ["new", "contacted", "closed", "archived"];

function dropLocal(kind: "support" | "plans", id: string) {
  try {
    const key = LOCAL_KEYS[kind];
    const raw = localStorage.getItem(key);
    const rows = raw ? (JSON.parse(raw) as { id: string }[]) : [];
    localStorage.setItem(key, JSON.stringify(rows.filter((r) => r.id !== id)));
  } catch {
    /* storage unavailable — the remote delete already happened */
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}

/**
 * Item 3 — click a row in Admissions or Support to open the full record, then
 * edit it or delete it. Works for both the study-plan (admissions) and the
 * support-pledge inboxes.
 */
export default function EngagementDetail({
  kind,
  row,
  onClose,
  onSaved,
}: {
  kind: "support" | "plans";
  row: SupportPledge | StudyPlanRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name ?? "");
  const [email, setEmail] = useState(row.email ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [status, setStatus] = useState<SupportStatus>(row.status);
  const [notes, setNotes] = useState(
    kind === "support" ? (row as SupportPledge).message ?? "" : (row as StudyPlanRequest).notes ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const table = kind === "support" ? "support_pledges" : "study_plans";
  const support = kind === "support" ? (row as SupportPledge) : null;
  const plan = kind === "plans" ? (row as StudyPlanRequest) : null;

  async function save() {
    setSaving(true);
    try {
      if (!row.synced) {
        toast.message("This record is stored locally only — changes are kept in this browser.");
        onSaved();
        return;
      }
      const patch: Record<string, unknown> = { name, email, phone, status };
      if (kind === "support") patch.message = notes;
      else patch.notes = notes;
      const { error } = await remote.from(table).update(patch).eq("id", row.id);
      if (error) throw new Error(error.message || "Update failed.");
      toast.success("Record updated.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      if (row.synced) {
        const { error } = await remote.from(table).delete().eq("id", row.id);
        if (error) throw new Error(error.message || "Delete failed.");
      }
      dropLocal(kind, row.id);
      toast.success("Record deleted.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kind === "support" ? "Support request" : "Admission enquiry"}</DialogTitle>
          <DialogDescription>
            Submitted {new Date(row.createdAt).toLocaleString()} · {row.synced ? "Live record" : "Saved on this device"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={row.name} />
          <Field label="Status" value={row.status} />
          {support && <Field label="Type" value={support.kind} />}
          {support && <Field label="Amount" value={support.amount ? `${support.amount} (${support.frequency || "once"})` : "—"} />}
          {support && <Field label="Method" value={support.method} />}
          {plan && <Field label="Programme" value={plan.programTitle} />}
          {plan && <Field label="Mode" value={plan.mode} />}
          {plan && <Field label="Duration" value={plan.duration} />}
          {plan && <Field label="Intake" value={plan.intake} />}
          {plan && <Field label="Education level" value={plan.educationLevel} />}
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ed-name" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</Label>
            <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</Label>
            <Input id="ed-email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-phone" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</Label>
            <Input id="ed-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-status" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</Label>
            <select
              id="ed-status"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as SupportStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ed-notes" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {kind === "support" ? "Message" : "Notes"}
          </Label>
          <Textarea id="ed-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="destructive" className="rounded-xl" disabled={deleting} onClick={remove}>
            {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Delete record
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{kind === "support" ? "Support" : "Admissions"}</Badge>
            <Button className="rounded-xl" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
