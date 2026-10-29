import { useEffect, useState } from "react";
import { Loader2, Send, History, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";

type OutboxRow = { id: string; title: string; body: string; audience: string; status: string; created_at: string };

const SENDERS = ["admin", "super_admin", "registrar"];

function newDraftKey() {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function senderRole(role: string) {
  const r = role.toLowerCase();
  return SENDERS.includes(r) || r.includes("admin");
}

/**
 * Admin-only OneSignal composer + send history.
 * Mount this inside the existing admin/operations hub (staff-only route).
 * All sends go through the authorized `onesignal-send` Edge Function;
 * RLS + server role checks block students and broadcast abuse.
 */
export default function OneSignalAdminPanel() {
  const { currentUser } = useApp();
  const role = String(currentUser?.role ?? "").toLowerCase();
  const allowed = senderRole(role);
  const canBroadcast = allowed;

  const [title, setTitle] = useState("AFRICA OF HOPE — Announcement");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("/");
  const [audience, setAudience] = useState("students");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<OutboxRow[]>([]);
  // Stable per-draft idempotency key: retries of the same send reuse it so the
  // server can deduplicate; only a new compose generates a new key.
  const [draftKey, setDraftKey] = useState(newDraftKey);

  const loadHistory = async () => {
    try {
      const { data } = await supabase.from("notification_outbox").select("id,title,body,audience,status,created_at").order("created_at", { ascending: false }).limit(25);
      setHistory(((data ?? []) as unknown) as OutboxRow[]);
    } catch { /* best-effort */ }
  };
  useEffect(() => { if (allowed) void loadHistory(); }, [allowed]);

  if (!allowed) return null;

  const send = async () => {
    setBusy(true); setNotice("");
    try {
      if (!title.trim() || !message.trim()) { setNotice("Title and message are required."); return; }
      if ((audience === "all" || audience === "all_users") && !canBroadcast) { setNotice("Institution-wide sends require an administrator or registrar."); return; }
      if (!window.confirm(`Send push to "${audience}" now?\n\n${title}\n${message.slice(0, 140)}`)) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setNotice("Your session expired. Sign in again."); return; }
      const res = await supabase.functions.invoke("onesignal-send", {
        body: {
          title: title.trim(), message: message.trim(), url: url.startsWith("/") ? url : "/",
          audience, idempotency_key: draftKey,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if ((res as any)?.error) throw new Error((res as any).error.message || "Send failed");
      setNotice("Accepted by OneSignal and queued. Delivery depends on each device (browser, OS, network). In-app records were stored for direct recipients.");
      setMessage("");
      setDraftKey(newDraftKey());
      await loadHistory();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Send failed. Check configuration and retry.");
    } finally { setBusy(false); }
  };

  return (
    <section aria-label="Push notifications (admin)" className="rounded-xl border p-4 space-y-3 text-sm">
      <h3 className="font-bold flex items-center gap-2"><Send size={15} /> Push notifications</h3>
      <p className="text-muted-foreground">Institution-wide delivery is admin/registrar-only. Accepted ≠ delivered ≠ read — per-device delivery is reported by OneSignal and affected by OS/battery/network.</p>
      <label className="grid gap-1">Title<input className="rounded border px-2 py-1.5" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
      <label className="grid gap-1">Message<textarea className="rounded border px-2 py-1.5 min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="Concise, professional. No scores, passwords or private details." /></label>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="grid gap-1">Destination (in-app path)<input className="rounded border px-2 py-1.5" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/#announcements" /></label>
        <label className="grid gap-1">Audience
          <select className="rounded border px-2 py-1.5" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="students">Students</option>
            <option value="teachers">Instructors</option>
            <option value="staff">Support staff</option>
            <option value="admins">Administrators</option>
            {(canBroadcast) && <option value="all">All subscribed users (confirm)</option>}
          </select>
        </label>
      </div>
      {(audience === "all") && <p className="flex gap-1.5 text-amber-700"><TriangleAlert size={14} className="mt-0.5" /> Broadcast to every subscribed device. Double-check wording and destination before confirming.</p>}
      <Button onClick={send} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : "Send push now"}</Button>
      {notice && <p role="status" className="rounded bg-muted px-2 py-1.5">{notice}</p>}
      <div>
        <h4 className="font-semibold flex items-center gap-1.5"><History size={14} /> Recent sends</h4>
        <ul className="mt-1 divide-y text-xs">
          {history.map((h) => (
            <li key={h.id} className="py-1.5 flex justify-between gap-2">
              <span><strong>{h.title}</strong> · {h.audience} · {new Date(h.created_at).toLocaleString()}</span>
              <span className={h.status === "sent" ? "text-green-700" : h.status === "failed" ? "text-red-700" : ""}>{h.status}</span>
            </li>
          ))}
          {!history.length && <li className="py-1.5 text-muted-foreground">No sends yet.</li>}
        </ul>
      </div>
    </section>
  );
}
