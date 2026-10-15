import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw, Send, XCircle } from "lucide-react";
import {
  emailOutboxApi, type EmailOutboxCounts, type EmailOutboxRow, type EmailOutboxStatus,
} from "@/lib/emailOutbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";

const STATUS_TONE: Record<EmailOutboxStatus, string> = {
  queued: "bg-slate-100 text-slate-700",
  sending: "bg-sky-100 text-sky-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-700",
  skipped: "bg-amber-100 text-amber-800",
};

export default function EmailOutboxPanel() {
  const { reloadKey } = useApp();
  const [rows, setRows] = useState<EmailOutboxRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusCounts, setStatusCounts] = useState<EmailOutboxCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [recent, status] = await Promise.all([
        emailOutboxApi.recent(50),
        emailOutboxApi.status().catch((): { configured: boolean; counts?: EmailOutboxCounts } => ({ configured: false })),
      ]);
      setRows(recent);
      setConfigured(status.configured);
      setStatusCounts(status.counts ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [reloadKey]);

  // The status endpoint's counts cover every email ever queued; `rows` is
  // capped at the 50 most recent, so counting from `rows` alone would be
  // wrong once there are more than 50. Fall back to the row-derived counts
  // only if the status endpoint didn't return any (e.g. provider not
  // configured yet).
  const counts = statusCounts ?? emailOutboxApi.countsByStatus(rows);

  const sendNow = async () => {
    setSending(true);
    try {
      const result = await emailOutboxApi.sendQueuedNow();
      setConfigured(result.configured);
      toast.success(result.configured ? `Sent ${result.sent ?? 0} email(s).` : "Provider key not set yet; emails stay queued.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const retryFailed = async () => {
    setRetrying(true);
    try {
      const count = await emailOutboxApi.retryFailed();
      toast.success(count > 0 ? `${count} email(s) moved back to queued.` : "No failed emails to retry.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Email delivery"
        subtitle="Outbound notification, receipt and rejection emails."
        action={
          <div className="flex gap-2">
            <Button variant="outline" disabled={retrying} onClick={() => void retryFailed()}>
              <RefreshCw className="mr-1 h-4 w-4" /> {retrying ? "Retrying…" : "Retry failed"}
            </Button>
            <Button disabled={sending} onClick={() => void sendNow()} className="bg-emerald-700 hover:bg-emerald-800">
              <Send className="mr-1 h-4 w-4" /> {sending ? "Sending…" : "Send queued now"}
            </Button>
          </div>
        }
      />

      <div className={cn(panelClass, "flex items-start gap-3 p-4")}>
        {configured ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {configured ? "Email provider configured" : "Waiting for provider key — emails are queued"}
          </p>
          <p className="text-xs text-slate-500">
            {configured
              ? "Resend is configured. Queued emails are sent automatically."
              : "Add RESEND_API_KEY and EMAIL_FROM to the send-email function to start delivering. Emails keep queuing safely until then."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={Clock} label="Queued" value={counts.queued ?? 0} tone="slate" />
        <StatCard icon={Mail} label="Sending" value={counts.sending ?? 0} />
        <StatCard icon={CheckCircle2} label="Sent" value={counts.sent ?? 0} />
        <StatCard icon={XCircle} label="Failed" value={counts.failed ?? 0} tone="rose" />
        <StatCard icon={AlertTriangle} label="Skipped" value={counts.skipped ?? 0} tone="amber" />
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Mail} title="No emails yet" hint="Emails appear here once notifications, receipts or rejections are generated." />
      ) : (
        <Reveal className={cn(panelClass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Template</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Attempts</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-sm text-slate-700">{r.toName ? `${r.toName} <${r.toEmail}>` : r.toEmail}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.template}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-sm text-slate-700">{r.subject}</td>
                    <td className="px-3 py-2">
                      <Badge className={cn("capitalize", STATUS_TONE[r.status])}>{r.status}</Badge>
                      {r.status === "failed" && r.lastError && <p className="mt-1 max-w-xs truncate text-[11px] text-rose-600">{r.lastError}</p>}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{r.attempts}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}
    </div>
  );
}
