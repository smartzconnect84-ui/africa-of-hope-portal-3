import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  initOneSignal, isOneSignalConfigured, oneSignalOptIn, oneSignalOptOut,
  oneSignalLogin, oneSignalSetTags, oneSignalStatus, oneSignalHowLockScreenWorks,
} from "@/lib/onesignal";
import { useApp } from "@/context/AppContext";

function safeMsg(e: unknown) { return e instanceof Error ? e.message : "Request failed"; }

/**
 * OneSignal subscription card. Renders inside portal dashboards for every role.
 * - Loads lazily, never blocks render, never auto-prompts.
 * - After sign-in links Supabase user id + trusted role/course tags.
 */
export default function OneSignalPanel({ compact = false }: { compact?: boolean }) {
  const { currentUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<{ subscribed: boolean; permission: string } | null>(null);
  const configured = isOneSignalConfigured();

  const refresh = async () => {
    try {
      const s = await oneSignalStatus();
      setStatus({ subscribed: s.subscribed, permission: String(s.permission) });
    } catch { /* best-effort */ }
  };

  useEffect(() => {
    void initOneSignal().then(() => void refresh());
    // Link identity once per sign-in with trusted role + course tags.
    if (currentUser?.id) {
      const tags: Record<string, string> = { role: roleTag(currentUser.role) };
      for (const pid of (currentUser.programIds ?? []).slice(0, 8)) tags[`course_${pid}`] = "enrolled";
      void oneSignalLogin(currentUser.id, tags).then(() => void oneSignalSetTags(tags)).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const enable = async () => {
    setBusy(true); setNotice("");
    try {
      const r = await oneSignalOptIn();
      setNotice(r.message);
      await refresh();
    } catch (e) { setNotice(safeMsg(e)); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setNotice("");
    try {
      await oneSignalOptOut();
      setNotice("Push disabled on this device. Portal messages and in-app history still work.");
      await refresh();
    } catch (e) { setNotice(safeMsg(e)); }
    finally { setBusy(false); }
  };

  if (!configured) {
    if (compact) return null;
    return (
      <section aria-label="Phone notifications" className="rounded-xl border border-dashed p-4 text-sm opacity-90">
        <p className="font-semibold flex items-center gap-2"><Smartphone size={16} /> Phone notifications (not configured)</p>
        <p className="mt-1 text-muted-foreground">An administrator needs to add the OneSignal App ID. In-app messages and deadline reminders below still work.</p>
      </section>
    );
  }

  const on = !!status?.subscribed;
  return (
    <section aria-label="Phone notifications" className="rounded-xl border p-4 text-sm space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold flex items-center gap-2">
          {on ? <BellRing size={16} className="text-green-700" /> : <BellOff size={16} />}
          Phone push {on ? "enabled" : "off"} <span className="font-normal text-muted-foreground">· {status?.permission ?? "…"}</span>
        </p>
        <div className="flex gap-2">
          {on
            ? <Button size="sm" variant="outline" onClick={disable} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={14} /> : "Turn off"}</Button>
            : <Button size="sm" onClick={enable} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={14} /> : "Enable notifications"}</Button>}
        </div>
      </div>
      <p className="text-muted-foreground flex gap-1.5 items-start"><ShieldCheck size={14} className="mt-0.5 shrink-0" />{oneSignalHowLockScreenWorks()}</p>
      {!compact && <Button size="sm" variant="ghost" onClick={() => void refresh()}>Refresh status</Button>}
      {notice && <p role="status" className="rounded bg-muted px-2 py-1.5">{notice}</p>}
    </section>
  );
}

function roleTag(role: unknown): string {
  const r = String(role ?? "").toLowerCase();
  if (r.includes("teacher") || r.includes("instruct")) return "teachers";
  if (r.includes("admin") || r.includes("registrar")) return "admins";
  if (r.includes("support") || r.includes("admission") || r.includes("staff")) return "staff";
  return "students";
}
