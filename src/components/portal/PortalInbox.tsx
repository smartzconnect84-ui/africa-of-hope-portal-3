import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { conversationTime, useInbox } from "@/lib/messaging";
import { useUnreadDMs } from "@/lib/directMessages";
import UserAvatar from "../UserAvatar";
import { cn } from "@/lib/utils";

/**
 * Header messages shortcut. It is a summary of the real inbox, not a second
 * messenger: choosing a conversation opens it in the Messages workspace, where
 * history, search, replies, attachments and group chat all live.
 */
export default function PortalInbox() {
  const { state, currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  // The badge runs a single unread count so every portal page stays light; the
  // full inbox is only fetched while the panel is actually open.
  const { unread: directUnread, refresh: refreshUnread } = useUnreadDMs(currentUser?.id);
  const { conversations } = useInbox(open ? currentUser?.id || undefined : undefined, state.users, tick);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 15000);
    return () => window.clearInterval(timer);
  }, [open]);

  const unread = useMemo(() => {
    const inList = conversations.reduce((total, conversation) => total + conversation.unread, 0);
    return Math.max(inList, directUnread);
  }, [conversations, directUnread]);
  const recent = useMemo(() => conversations.slice(0, 7), [conversations]);

  function openMessages(target?: { peerId?: string; groupId?: string }) {
    try {
      if (target?.peerId || target?.groupId) {
        sessionStorage.setItem("aoh-messages-target", JSON.stringify(target));
      }
    } catch {
      /* storage may be blocked; the event still carries the target */
    }
    window.dispatchEvent(new CustomEvent("aoh-open-messages", { detail: target ?? {} }));
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setTick((value) => value + 1);
          refreshUnread();
          setOpen((value) => !value);
        }}
        aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
        aria-expanded={open}
        title="Messages"
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
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close messages"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Messages</p>
              <span className="text-[11px] text-slate-400">{unread > 0 ? `${unread} unread` : "All read"}</span>
            </div>

            <div className="max-h-[46vh] overflow-y-auto p-1.5">
              {recent.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs leading-relaxed text-slate-500">
                  No messages yet. Open Messages to write to a member or start a group.
                </p>
              ) : (
                recent.map((conversation) => (
                  <button
                    key={conversation.key}
                    type="button"
                    onClick={() =>
                      openMessages(
                        conversation.kind === "dm"
                          ? { peerId: conversation.peerId }
                          : { groupId: conversation.groupId },
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-emerald-50",
                      conversation.unread > 0 && "bg-emerald-50/50",
                    )}
                  >
                    <UserAvatar
                      user={{ name: conversation.name, avatarUrl: conversation.avatarUrl }}
                      className="h-9 w-9 text-[11px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-slate-800">{conversation.name}</span>
                        <span className="shrink-0 text-[10.5px] text-slate-400">
                          {conversationTime(conversation.lastAt)}
                        </span>
                      </span>
                      <span className="block truncate text-[11.5px] text-slate-500">
                        {conversation.lastBody || "No messages yet"}
                      </span>
                    </span>
                    {conversation.unread > 0 && (
                      <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold text-white">
                        {conversation.unread > 99 ? "99+" : conversation.unread}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => openMessages()}
              className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-3 py-2.5 text-[12.5px] font-semibold text-[#075e54] hover:bg-emerald-50"
            >
              Open Messages <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
