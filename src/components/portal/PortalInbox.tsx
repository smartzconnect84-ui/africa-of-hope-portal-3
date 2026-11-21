import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { DirectMessageDialog, UserProfileDialog } from "../DirectoryMessaging";
import { useChatThread } from "@/lib/chat";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { getLastSeen } from "@/lib/presence";

interface Convo {
  peerId: string;
  lastBody: string;
  lastAt: string;
  unread: number;
  total: number;
}

function scanInbox(meId: string): Convo[] {
  const convos = new Map<string, Convo>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("aoh-dm-") || k.endsWith(":typing")) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(k) ?? "[]") as Array<{
          id: string; sender_id: string; receiver_id: string; body: string; created_at: string; seen_at: string | null;
        }>;
        if (!Array.isArray(arr)) continue;
        for (const m of arr) {
          if (m.sender_id !== meId && m.receiver_id !== meId) continue;
          const peerId = m.sender_id === meId ? m.receiver_id : m.sender_id;
          const prev = convos.get(peerId);
          const unread = m.receiver_id === meId && !m.seen_at ? 1 : 0;
          if (!prev) {
            convos.set(peerId, { peerId, lastBody: m.body ?? "", lastAt: m.created_at ?? "", unread, total: 1 });
          } else {
            prev.total += 1;
            prev.unread += unread;
            if ((m.created_at ?? "") >= prev.lastAt) {
              prev.lastBody = m.body ?? "";
              prev.lastAt = m.created_at ?? "";
            }
          }
        }
      } catch { /* skip corrupt key */ }
    }
  } catch { /* storage blocked */ }
  return [...convos.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Top-bar messages bell: unread DMs, receive & reply inline. */
export default function PortalInbox() {
  const { state, currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [peer, setPeer] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [threadUser, setThreadUser] = useState<User | null>(null);

  const { messages, send } = useChatThread(currentUser?.id, threadUser ? { kind: "dm", id: threadUser.id } : null);

  const refresh = () => {
    if (!currentUser) { setConvos([]); return; }
    setConvos(scanInbox(currentUser.id));
  };

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 4000);
    const onStorage = () => refresh();
    const onFocus = () => refresh();
    const onLive = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("aoh:dm-changed", onLive);
    window.addEventListener("aoh:live", onLive);
    return () => { window.clearInterval(t); window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); window.removeEventListener("aoh:dm-changed", onLive); window.removeEventListener("aoh:live", onLive); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const unread = useMemo(() => convos.reduce((n, c) => n + c.unread, 0), [convos]);
  const byId = useMemo(() => new Map(state.users.map((u) => [u.id, u])), [state.users]);

  // Chat thread handled via the shared chat hooks so unread counts and realtime
  // delivery are identical for DM and group conversations.

  const q = query.trim().toLowerCase();
  const matches = q
    ? state.users.filter((u) => u.id !== currentUser?.id && (`${u.name} ${u.email}`.toLowerCase().includes(q))).slice(0, 5)
    : [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { refresh(); setOpen((o) => !o); }}
        aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
        aria-expanded={open}
        title="Messages — direct + class discussions"
        className="relative grid h-10 w-10 place-items-center rounded-xl text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      >
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Messages</p>
            </div>
            <div className="p-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people to message…"
                aria-label="Search people to message"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {matches.length > 0 && (
                <div className="mb-1">
                  {matches.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                        onClick={() => { setPeer(u); setOpen(false); setQuery(""); setThreadUser(u); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[11px] font-bold text-amber-400">
                        {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">New conversation · {u.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {convos.length === 0 && matches.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">
                  No direct messages yet. Search above to start one, or open Class Discussions for cohort Q&amp;A.
                </p>
              ) : (
                convos.map((c) => {
                  const u = byId.get(c.peerId);
                  const name = u?.name ?? "Member";
                  return (
                    <button
                      key={c.peerId}
                      type="button"
                      onClick={() => { if (u) { setPeer(u); setOpen(false); } }}
                      className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50", c.unread > 0 && "bg-red-50/70")}
                    >
                      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[11px] font-bold text-amber-400">
                        {name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        {c.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">{name}</span>
                          {c.unread > 0 && <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unread} new</span>}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">{c.lastBody || "—"}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
      <DirectMessageDialog meId={currentUser?.id ?? null} meName={currentUser?.name ?? "Me"} peer={peer} onClose={() => { setPeer(null); refresh(); setThreadUser(null); }} />
    <UserProfileDialog user={threadUser} online={false} onMessage={(u) => { setThreadUser(null); setPeer(u); }} onClose={() => setThreadUser(null)} />
    </div>
  );
}
