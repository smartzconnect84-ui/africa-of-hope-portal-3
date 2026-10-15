import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote, Check, Clock, Loader2, Phone, Plus, Settings2, Trash2, X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { usePermission } from "@/hooks/usePermission";
import {
  paymentsApi, PAYMENT_PROVIDER_LABELS,
  type PaymentChannel, type PaymentChannelInput, type PaymentProvider, type PaymentSubmission, type PaymentSubmissionStatus,
} from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import { money } from "./paymentFormat";
import PaymentStatusBadge from "./PaymentStatusBadge";

const STATUS_FILTERS: Array<{ value: PaymentSubmissionStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function SubmissionsTab() {
  const { state, reloadKey } = useApp();
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<PaymentSubmissionStatus | "all">("pending");
  const [review, setReview] = useState<{ submission: PaymentSubmission; decision: "confirm" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [ledgerAmountUsd, setLedgerAmountUsd] = useState("");
  const [busy, setBusy] = useState(false);

  const studentName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "Unknown student";

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setSubmissions(await paymentsApi.allSubmissions());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [reloadKey]);

  const visible = useMemo(() => {
    const rows = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);
    return rows.slice().sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [submissions, filter]);

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  // The fee ledger has no currency column — it only ever carries a USD
  // amount — so confirming an LRD submission needs a USD amount to credit.
  const needsLedgerAmount = review?.decision === "confirm" && review.submission.currency === "LRD";

  const openReview = (submission: PaymentSubmission, decision: "confirm" | "reject") => {
    setReview({ submission, decision });
    setNote("");
    setLedgerAmountUsd("");
  };

  const submitReview = async () => {
    if (!review) return;
    if (review.decision === "reject" && !note.trim()) { toast.error("Add a note explaining the rejection."); return; }
    if (needsLedgerAmount && !(Number(ledgerAmountUsd) > 0)) {
      toast.error("Enter the USD amount to credit to the fee ledger.");
      return;
    }
    setBusy(true);
    try {
      const result = await paymentsApi.review(
        review.submission.id,
        review.decision,
        note,
        needsLedgerAmount ? Number(ledgerAmountUsd) : undefined,
      );
      toast.success(review.decision === "confirm" ? `Payment confirmed. Receipt ${result.receipt_number ?? ""}` : "Payment rejected.");
      setReview(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Clock} label="Pending review" value={pendingCount} tone="amber" />
        <StatCard icon={Check} label="Confirmed" value={submissions.filter((s) => s.status === "confirmed").length} />
        <StatCard icon={X} label="Rejected" value={submissions.filter((s) => s.status === "rejected").length} tone="rose" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium", filter === f.value ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600")}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Banknote} title="Nothing here" hint="Reported payments will appear in this list." />
      ) : (
        <div className="space-y-3">
          {visible.map((s) => {
            return (
              <Reveal key={s.id} className={cn(panelClass, "p-4")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{studentName(s.studentId)}</p>
                      <PaymentStatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-emerald-800">{money(s.amount, s.currency)} · {s.category}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" /> {s.payerPhone} · {PAYMENT_PROVIDER_LABELS[s.provider]}</p>
                    <p className="text-xs text-slate-500">Ref {s.transactionReference} · Paid {s.paidOn}</p>
                    {s.note && <p className="mt-1 text-xs text-slate-500">Note: {s.note}</p>}
                    {s.status === "rejected" && s.reviewNote && <p className="mt-1 text-xs text-rose-700">Rejection reason: {s.reviewNote}</p>}
                    {s.status === "confirmed" && s.receiptNumber && <p className="mt-1 text-xs text-emerald-700">Receipt {s.receiptNumber}</p>}
                  </div>
                  {s.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => openReview(s, "confirm")}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-600" onClick={() => openReview(s, "reject")}>
                        <X className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{review?.decision === "confirm" ? "Confirm payment" : "Reject payment"}</DialogTitle>
            <DialogDescription>
              {review?.decision === "confirm"
                ? "This issues a receipt and records the fee transaction."
                : "A note is required so the student knows what to fix."}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="text-slate-400">Student:</span> {studentName(review.submission.studentId)}</p>
              <p><span className="text-slate-400">Amount:</span> {money(review.submission.amount, review.submission.currency)}</p>
              <p><span className="text-slate-400">Reference:</span> {review.submission.transactionReference}</p>
            </div>
          )}
          {needsLedgerAmount && (
            <div className="space-y-1.5">
              <Label htmlFor="review-ledger-amount">USD amount credited to the fee ledger</Label>
              <Input
                id="review-ledger-amount"
                type="number"
                min="0"
                step="0.01"
                value={ledgerAmountUsd}
                onChange={(e) => setLedgerAmountUsd(e.target.value)}
                placeholder="e.g. 50.00"
              />
              <p className="text-xs text-slate-400">The fee ledger only tracks USD; enter the USD equivalent of this LRD payment.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="review-note">Note {review?.decision === "reject" && "(required)"}</Label>
            <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={review?.decision === "reject" ? "e.g. Reference does not match our records." : "Optional"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void submitReview()} className={review?.decision === "confirm" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700"}>
              {busy ? "Saving…" : review?.decision === "confirm" ? "Confirm payment" : "Reject payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const emptyChannelForm: PaymentChannelInput = {
  provider: "mtn_momo", label: "", accountName: "", accountNumber: "", instructions: "", active: true, sort: 0,
};

function ChannelsTab() {
  const { reloadKey } = useApp();
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentChannel | null>(null);
  const [form, setForm] = useState<PaymentChannelInput>(emptyChannelForm);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setChannels(await paymentsApi.allChannels());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [reloadKey]);

  const startCreate = () => { setEditing(null); setForm(emptyChannelForm); setOpen(true); };
  const startEdit = (c: PaymentChannel) => {
    setEditing(c);
    setForm({ provider: c.provider, label: c.label, accountName: c.accountName, accountNumber: c.accountNumber, instructions: c.instructions, active: c.active, sort: c.sort });
    setOpen(true);
  };

  const save = async () => {
    if (!form.label.trim() || !form.accountName.trim() || !form.accountNumber.trim()) {
      toast.error("Label, account name and account number are required.");
      return;
    }
    setBusy(true);
    try {
      if (editing) await paymentsApi.updateChannel(editing.id, form);
      else await paymentsApi.createChannel(form);
      toast.success(editing ? "Channel updated." : "Channel added.");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c: PaymentChannel) => {
    try {
      await paymentsApi.setChannelActive(c.id, !c.active);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (c: PaymentChannel) => {
    if (!window.confirm(`Remove the ${PAYMENT_PROVIDER_LABELS[c.provider]} channel "${c.label}"?`)) return;
    try {
      await paymentsApi.deleteChannel(c.id);
      toast.success("Channel removed.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Payment channels"
        subtitle="MTN MoMo and Orange Money accounts students can pay into."
        action={<Button onClick={startCreate} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="mr-1 h-4 w-4" /> New channel</Button>}
      />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : channels.length === 0 ? (
        <EmptyState icon={Settings2} title="No channels yet" hint="Add an MTN MoMo or Orange Money account." />
      ) : (
        <div className="space-y-2">
          {channels.map((c) => (
            <div key={c.id} className={cn(panelClass, "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">{PAYMENT_PROVIDER_LABELS[c.provider]}</Badge>
                  <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                  {!c.active && <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>}
                </div>
                <p className="text-xs text-slate-500">{c.accountName} · {c.accountNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.active} onCheckedChange={() => void toggleActive(c)} />
                <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                <Button size="icon" variant="ghost" aria-label="Delete channel" className="text-rose-600" onClick={() => void remove(c)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit channel" : "New payment channel"}</DialogTitle>
            <DialogDescription>Students see active channels on the Pay fees screen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="channel-provider">Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v as PaymentProvider }))}>
                <SelectTrigger id="channel-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel-label">Label</Label>
              <Input id="channel-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Main tuition account" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="channel-account-name">Account name</Label>
                <Input id="channel-account-name" value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="channel-account-number">Account number</Label>
                <Input id="channel-account-number" value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel-instructions">Instructions (optional)</Label>
              <Textarea id="channel-instructions" rows={2} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} placeholder="Use the student's full name as the payment reference." />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">Active</p>
              <Switch checked={!!form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void save()} className="bg-emerald-700 hover:bg-emerald-800">{busy ? "Saving…" : "Save channel"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PaymentsReview() {
  const canConfirm = usePermission("payments.confirm");
  const canManageFees = usePermission("fees.manage");

  if (!canConfirm && !canManageFees) {
    return <EmptyState icon={Banknote} title="No access" hint="You don't have permission to review payments." />;
  }

  if (!canConfirm) {
    // fees.manage only: channel setup, no submission review authority.
    return (
      <div className="space-y-5">
        <SectionHeader title="Payment channels" subtitle="Manage mobile money accounts students can pay into." />
        <ChannelsTab />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Payment confirmations" subtitle="Review reported mobile money payments and manage payment channels." />
      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions"><SubmissionsTab /></TabsContent>
        <TabsContent value="channels"><ChannelsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
