import { useMemo, useState } from "react";
import { BookCheck, CheckCircle2, Send, ShieldCheck, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/AppContext";
import {
  acknowledgePolicy,
  dispatchPolicies,
  hasAcknowledged,
  listPolicyDispatches,
  policiesSentTo,
  useOpsVersion,
} from "@/lib/portalOps";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

/**
 * School policies that can be forwarded to applicants and students.
 * The full policy text is authored in the CMS (School policies); this is the
 * dispatch catalogue that references those documents by a stable id.
 */
export const POLICY_CATALOGUE = [
  { id: "admissions", title: "Admissions policy", summary: "Entry requirements, aptitude screening and enrolment steps." },
  { id: "fees", title: "Fees, payment & refunds", summary: "Instalments, deadlines and the refund window." },
  { id: "attendance", title: "Attendance & punctuality", summary: "Sign-in rules, absence reporting and the 80% attendance mark." },
  { id: "conduct", title: "Student code of conduct", summary: "Classroom behaviour, academic honesty and disciplinary steps." },
  { id: "safeguarding", title: "Safeguarding & child protection", summary: "Reporting channels and staff obligations." },
  { id: "it-use", title: "Acceptable IT & data use", summary: "Device use, portal credentials and data protection." },
] as const;

const policyTitle = (id: string) => POLICY_CATALOGUE.find((p) => p.id === id)?.title ?? id;

/**
 * Item 8 — forward school policies to new students/applicants and let each
 * recipient acknowledge them from their own portal.
 */
export default function PolicyDesk() {
  const { state, currentUser } = useApp();
  useOpsVersion();
  const isStaff = !!currentUser && ["Admin", "Administrator", "Teacher", "Staff"].includes(currentUser.role);

  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(["admissions", "attendance"]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [note, setNote] = useState("Please read and acknowledge before your first class.");
  const [saving, setSaving] = useState(false);

  const audience = useMemo(
    () => state.users.filter((u) => u.role === "Student"),
    [state.users],
  );
  const dispatches = useMemo(() => listPolicyDispatches(), [state.users]);
  const mine = useMemo(
    () => (currentUser ? policiesSentTo(currentUser.id) : []),
    [currentUser, state.users],
  );

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  async function send() {
    if (!currentUser) return;
    if (selectedPolicies.length === 0) return toast.error("Choose at least one policy.");
    if (recipients.length === 0) return toast.error("Choose at least one recipient.");
    setSaving(true);
    try {
      dispatchPolicies({
        policyIds: selectedPolicies,
        recipientIds: recipients,
        note: note.trim(),
        sentById: currentUser.id,
        sentByName: currentUser.name,
      });
      toast.success(`Sent ${selectedPolicies.length} policy document(s) to ${recipients.length} recipient(s).`);
      setRecipients([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="School policies"
        description="Forward the policy pack to new applicants and students, and track who has acknowledged it."
        icon={<BookCheck className="h-5 w-5" />}
      />

      {!isStaff && currentUser && (
        <section className={cn(panelClass, "p-5")}>
          <h2 className="text-sm font-semibold text-slate-900">Policies sent to you</h2>
          {mine.length === 0 ? (
            <EmptyState title="Nothing to acknowledge" description="The school has not forwarded a policy pack to you yet." />
          ) : (
            <div className="mt-3 space-y-3">
              {mine.map((d) => (
                <article key={d.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Sent by {d.sentByName} · {new Date(d.sentAt).toLocaleDateString()}
                    </p>
                    <Badge variant="outline">
                      {d.policyIds.filter((id) => hasAcknowledged(id, currentUser.id)).length}/{d.policyIds.length} acknowledged
                    </Badge>
                  </div>
                  {d.note && <p className="mt-1 text-xs text-slate-600">{d.note}</p>}
                  <ul className="mt-3 space-y-2">
                    {d.policyIds.map((id) => {
                      const acked = hasAcknowledged(id, currentUser.id);
                      return (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="text-sm text-slate-800">{policyTitle(id)}</span>
                          {acked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 rounded-xl"
                              onClick={() => {
                                acknowledgePolicy(id, { id: currentUser.id, name: currentUser.name });
                                toast.success(`Acknowledged ${policyTitle(id)}.`);
                              }}
                            >
                              I have read this
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {isStaff && (
        <>
          <section className={cn(panelClass, "p-5")}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Send className="h-4 w-4" /> Forward the policy pack
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</Label>
                <div className="mt-2 space-y-2">
                  {POLICY_CATALOGUE.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={selectedPolicies.includes(p.id)}
                        onChange={() => setSelectedPolicies((s) => toggle(s, p.id))}
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{p.title}</span>
                        <span className="block text-xs text-slate-500">{p.summary}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Users2 className="h-3.5 w-3.5" /> Recipients ({recipients.length})
                </Label>
                <div className="mt-2 max-h-64 space-y-1.5 overflow-auto rounded-lg border border-slate-200 p-2">
                  {audience.length === 0 && <p className="p-2 text-xs text-slate-500">No student accounts yet.</p>}
                  {audience.map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={recipients.includes(u.id)}
                        onChange={() => setRecipients((r) => toggle(r, u.id))}
                      />
                      <span className="text-sm text-slate-800">{u.name}</span>
                      <span className="text-[11px] text-slate-400">{u.status}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="policy-note" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note</Label>
                  <Textarea id="policy-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                </div>
                <Button className="mt-3 w-full rounded-xl" disabled={saving} onClick={send}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Send policy pack
                </Button>
              </div>
            </div>
          </section>

          <section className={cn(panelClass, "p-5")}>
            <h2 className="text-sm font-semibold text-slate-900">Dispatch history</h2>
            {dispatches.length === 0 ? (
              <EmptyState title="No policy packs sent" description="Forward the pack above to start tracking acknowledgement." />
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Sent</th>
                      <th className="px-3 py-2">By</th>
                      <th className="px-3 py-2">Documents</th>
                      <th className="px-3 py-2">Recipients</th>
                      <th className="px-3 py-2">Acknowledged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatches.map((d) => {
                      const total = d.recipientIds.length * d.policyIds.length;
                      const done = d.recipientIds.reduce(
                        (n, uid) => n + d.policyIds.filter((pid) => hasAcknowledged(pid, uid)).length,
                        0,
                      );
                      return (
                        <tr key={d.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">{new Date(d.sentAt).toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-700">{d.sentByName}</td>
                          <td className="px-3 py-2 text-slate-700">{d.policyIds.length}</td>
                          <td className="px-3 py-2 text-slate-700">{d.recipientIds.length}</td>
                          <td className="px-3 py-2">
                            <Badge variant={done === total && total > 0 ? "default" : "outline"}>
                              {done}/{total}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
