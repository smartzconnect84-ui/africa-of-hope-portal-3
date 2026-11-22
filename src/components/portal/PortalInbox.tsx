import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { DirectMessageDialog } from "../DirectoryMessaging";
import { useConversations, type ChatConversation } from "@/lib/chat";
import type { User } from "@/types";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Top-bar messages bell: unread direct messages, with a live thread dialog. */
export default function PortalInbox() {
  const { state, currentUser } = useApp();
  const meId = currentUser?.id;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [peer, setPeer] = useState<User | null>(null);
  const [tick, setTick] = useState(0);

  // The bell only polls while it is open, plus once per new live message.
  useEffect(() => {
    const onLive = () => setTick((n) => n + 1);
    window.addEventListener("aoh:live", onLive);
    return () => window.removeEventListener("aoh:live", onLive);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 10000);
    return () => window.clearInterval(timer);
  }, [open]);

  const people = useMemo(() => state.users.filter((u) => u.id !== meId), [state.users, meId]);
  const { conversations, loading } = useConversations(meId, people, tick);

  const direct = useMemo<ChatConversation[]>(
    () => conversations.filter((c): c is ChatConversation => c.kind === "dm" && !!c.peerId),
    [conversations],
  );
  const unread = useMemo(() => direct.reduce((n, c) => n + c.unread, 0), [direct]);
  const byId = useMemo(() => new Map(state.users.map((u) => [u.id, u])), [state.users]);

  const q = query.trim().toLowerCase();
  const matches = q
    ? people.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q)).slice(0, 5)
    : [];

  const openChat = (user: User) => {
    setPeer(user);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setTick((n) => n + 1);
          setOpen((o) => !o);
        }}
        aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
        aria-expanded={open}
        title="Messages — direct messages and group chat"
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
          <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Messages</p>
              {loading && <span className="ml-auto text-[11px] text-slate-400">Syncing…</span>}
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
            <div className="max-h-[50vh] overflow-y-auto overscroll-contain p-1.5">
              {matches.length > 0 && (
                <div className="mb-1">
                  {matches.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => openChat(u)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[11px] font-bold text-amber-400">
                        {initialsOf(u.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">New conversation · {u.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {direct.length === 0 && matches.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">
                  {loading
                    ? "Loading your conversations…"
                    : "No direct messages yet. Search above to start one, or open Messages for group chat."}
                </p>
              ) : (
                direct.map((c) => {
                  const user = c.peerId ? byId.get(c.peerId) : undefined;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={!user}
                      onClick={() => user && openChat(user)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50 disabled:opacity-60",
                        c.unread > 0 && "bg-red-50/70",
                      )}
                    >
                      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[11px] font-bold text-amber-400">
                        {initialsOf(c.name)}
                        {c.unread > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">{c.name}</span>
                          {c.unread > 0 && (
                            <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {c.unread > 9 ? "9+" : `${c.unread} new`}
                            </span>
                          )}
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
      <DirectMessageDialog
        meId={meId ?? null}
        meName={currentUser?.name ?? "Me"}
        peer={peer}
        onClose={() => {
          setPeer(null);
          setTick((n) => n + 1);
        }}
      />
    </div>
  );
}
