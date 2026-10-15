import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote, Clock, Copy, Loader2, Printer, Receipt, Send,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  paymentsApi, PAYMENT_PROVIDER_LABELS,
  type PaymentChannel, type PaymentSubmission,
} from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import { money } from "./paymentFormat";
import PaymentStatusBadge from "./PaymentStatusBadge";

const CATEGORIES = ["Tuition", "Registration", "Exam", "Certificate"];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  channelId: "", amount: "", currency: "USD" as "USD" | "LRD", category: "Tuition",
  payerPhone: "", transactionReference: "", paidOn: today(), note: "",
};

export default function StudentPayments() {
  const { currentUser, reloadKey } = useApp();
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const load = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError("");
    try {
      const [c, s] = await Promise.all([paymentsApi.channels(), paymentsApi.mySubmissions(currentUser.id)]);
      setChannels(c);
      setSubmissions(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [currentUser?.id, reloadKey]);

  const selectedChannel = channels.find((c) => c.id === form.channelId) ?? null;

  const copyNumber = async (number: string) => {
    try {
      await navigator.clipboard.writeText(number);
      toast.success("Account number copied.");
    } catch {
      toast.error("Could not copy. Select and copy the number manually.");
    }
  };

  const submit = async () => {
    if (!currentUser) return;
    if (!form.channelId || !selectedChannel) { toast.error("Choose how you paid."); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter the amount you paid."); return; }
    setBusy(true);
    try {
      await paymentsApi.submit({
        channelId: form.channelId,
        amount: Number(form.amount),
        currency: form.currency,
        category: form.category,
        payerPhone: form.payerPhone,
        transactionReference: form.transactionReference,
        paidOn: form.paidOn,
        note: form.note,
      });
      toast.success("Payment reported. The finance office will confirm it shortly.");
      setForm({ ...emptyForm, paidOn: today() });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const receipt = useMemo(() => submissions.find((s) => s.id === receiptId) ?? null, [submissions, receiptId]);

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const confirmedTotal = submissions.filter((s) => s.status === "confirmed").reduce((sum, s) => sum + (s.ledgerAmountUsd ?? (s.currency === "USD" ? s.amount : 0)), 0);

  return (
    <div className="space-y-5">
      <SectionHeader title="Pay fees" subtitle="Report a mobile money payment and track its confirmation." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Banknote} label="Confirmed (USD)" value={money(confirmedTotal, "USD")} />
        <StatCard icon={Clock} label="Awaiting review" value={pendingCount} tone="amber" />
        <StatCard icon={Receipt} label="Reports filed" value={submissions.length} tone="slate" />
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

      <Reveal className={cn(panelClass, "p-5")}>
        <SectionHeader title="Payment channels" subtitle="Send to one of these numbers, then report the transaction below." />
        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : channels.length === 0 ? (
          <EmptyState icon={Banknote} title="No payment channels configured" hint="Ask the finance office to set up MTN MoMo or Orange Money." />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {channels.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">{PAYMENT_PROVIDER_LABELS[c.provider]}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{c.accountName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-sm text-slate-700">{c.accountNumber}</p>
                  <Button size="icon" variant="ghost" aria-label="Copy number" onClick={() => void copyNumber(c.accountNumber)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {c.instructions && <p className="mt-2 text-xs text-slate-500">{c.instructions}</p>}
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal delay={0.05} className={cn(panelClass, "p-5")}>
        <SectionHeader title="Report a payment" subtitle="Enter the transaction ID from your mobile money confirmation message." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-channel">Payment channel</Label>
            <Select value={form.channelId} onValueChange={(v) => setForm((f) => ({ ...f, channelId: v }))}>
              <SelectTrigger id="pay-channel"><SelectValue placeholder="Select how you paid" /></SelectTrigger>
              <SelectContent>
                {channels.map((c) => <SelectItem key={c.id} value={c.id}>{PAYMENT_PROVIDER_LABELS[c.provider]} · {c.accountNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input id="pay-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-currency">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v as "USD" | "LRD" }))}>
              <SelectTrigger id="pay-currency"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="LRD">LRD</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-category">Fee category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger id="pay-category"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-paid-on">Date paid</Label>
            <Input id="pay-paid-on" type="date" value={form.paidOn} onChange={(e) => setForm((f) => ({ ...f, paidOn: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-phone">Phone used to pay</Label>
            <Input id="pay-phone" value={form.payerPhone} onChange={(e) => setForm((f) => ({ ...f, payerPhone: e.target.value }))} placeholder="+231 77 667 9963" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-reference">Transaction ID</Label>
            <Input id="pay-reference" value={form.transactionReference} onChange={(e) => setForm((f) => ({ ...f, transactionReference: e.target.value }))} placeholder="From the confirmation SMS" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-note">Note (optional)</Label>
            <Textarea id="pay-note" rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <Button disabled={busy} onClick={() => void submit()} className="mt-4 w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto">
          <Send className="mr-1 h-4 w-4" /> {busy ? "Reporting…" : "Report payment"}
        </Button>
      </Reveal>

      <Reveal delay={0.1} className="space-y-3">
        <SectionHeader title="Payment history" subtitle="Status of everything you've reported." />
        {submissions.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments reported yet" hint="Reported payments will appear here." />
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => {
              return (
                <div key={s.id} className={cn(panelClass, "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between")}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{money(s.amount, s.currency)} · {s.category}</p>
                    <p className="text-xs text-slate-500">{PAYMENT_PROVIDER_LABELS[s.provider]} · {s.transactionReference} · {s.paidOn}</p>
                    {s.status === "rejected" && s.reviewNote && <p className="mt-1 text-xs text-rose-700">Reason: {s.reviewNote}</p>}
                    {s.status === "confirmed" && s.receiptNumber && <p className="mt-1 text-xs text-emerald-700">Receipt {s.receiptNumber}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentStatusBadge status={s.status} />
                    {s.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => setReceiptId(s.id)}><Printer className="mr-1 h-3.5 w-3.5" /> Receipt</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      <Dialog open={!!receiptId} onOpenChange={(o) => !o && setReceiptId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment receipt</DialogTitle>
            <DialogDescription>Official acknowledgement of a confirmed payment.</DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="print-area rounded-2xl border border-emerald-900/10 bg-white p-5">
              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-emerald-900">AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES</p>
                  <p className="text-[11px] text-slate-500">Institutional Training Academy</p>
                </div>
                <Receipt className="h-6 w-6 text-amber-500" />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Student</dt><dd className="font-medium text-slate-800">{currentUser?.name}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Receipt no.</dt><dd className="font-medium text-slate-800">{receipt.receiptNumber ?? "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Category</dt><dd className="font-medium text-slate-800">{receipt.category}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Date paid</dt><dd className="font-medium text-slate-800">{receipt.paidOn}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="font-medium text-slate-800">{PAYMENT_PROVIDER_LABELS[receipt.provider]}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Transaction ID</dt><dd className="font-medium text-slate-800">{receipt.transactionReference}</dd></div>
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
                  <dt className="font-semibold text-slate-700">Amount paid</dt>
                  <dd className="font-bold text-emerald-800">{money(receipt.amount, receipt.currency)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-center text-[10px] text-slate-400">System generated. No signature required.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptId(null)}>Close</Button>
            <Button onClick={() => window.print()} className="bg-emerald-700 hover:bg-emerald-800"><Printer className="mr-1 h-4 w-4" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
