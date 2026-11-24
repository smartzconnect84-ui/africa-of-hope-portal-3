import { useMemo, useState } from "react";
import { MessageSquarePlus, Search, Users, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { displayRole } from "@/lib/roleDisplay";
import { cn } from "@/lib/utils";
import { conversationTime, type Conversation } from "@/lib/messaging";
import type { User } from "@/types";

type Filter = "all" | "unread" | "groups";

export default function ChatList({
  conversations,
  activeKey,
  onSelect,
  onNewChat,
  onNewGroup,
  canCreateGroup,
  currentUser,
  loading,
  error,
  onlineIds,
}: {
  conversations: Conversation[];
  activeKey: string | null;
  onSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  canCreateGroup: boolean;
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  onlineIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const unreadTotal = conversations.reduce((total, c) => total + c.unread, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === "unread" && conversation.unread === 0) return false;
      if (filter === "groups" && conversation.kind !== "group") return false;
      if (!q) return true;
      return (
        conversation.name.toLowerCase().includes(q) ||
        (conversation.lastBody ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, query]);

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unreadTotal },
    { id: "groups", label: "Groups" },
  ];

  return (
    <aside className="flex h-full w-full flex-col bg-white md:w-[340px] md:shrink-0 lg:w-[380px] xl:w-[400px]">
      <header className="bg-[#075e54] px-3 pb-3 pt-2 text-white">
        <div className="flex items-center gap-2">
          <UserAvatar
            user={{ name: currentUser?.name ?? "Me", avatarUrl: currentUser?.avatarUrl }}
            className="h-9 w-9 text-[11px] ring-2 ring-white/30"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight">Messages</h1>
            <p className="truncate text-[11px] text-emerald-100/90">
              {unreadTotal > 0 ? `${unreadTotal} unread` : "Everything is read"}
            </p>
          </div>
          <button
            type="button"
            onClick={onNewChat}
            title="New message"
            aria-label="Start a new message"
            className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onNewGroup}
            disabled={!canCreateGroup}
            title={canCreateGroup ? "New group" : "Group chat storage is not set up yet"}
            aria-label="Create a new group"
            className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Users className="h-5 w-5" />
          </button>
        </div>
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg bg-white pl-9 pr-8 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-400/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-1.5 border-b border-slate-100 bg-white px-2.5 py-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition",
              filter === item.id
                ? "bg-[#e7f8ef] text-[#075e54] ring-1 ring-[#075e54]/15"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {item.label}
            {!!item.count && (
              <span className="rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold text-white">
                {item.count > 99 ? "99+" : item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mx-2.5 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && conversations.length === 0 && (
          <div className="space-y-1 p-2" aria-label="Loading conversations">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                <span className="h-11 w-11 animate-pulse rounded-full bg-slate-100" />
                <span className="flex-1 space-y-1.5">
                  <span className="block h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
                  <span className="block h-2 w-3/4 animate-pulse rounded bg-slate-50" />
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <MessageSquarePlus className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-slate-700">
              {query || filter !== "all" ? "Nothing matches that filter" : "No conversations yet"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {query || filter !== "all"
                ? "Try another name, or clear the filter to see every chat."
                : "Start a private chat with a member, or create a group for a cohort or a team."}
            </p>
            <button
              type="button"
              onClick={onNewChat}
              className="mt-3 rounded-full bg-[#075e54] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#054d45]"
            >
              New message
            </button>
          </div>
        )}

        <ul className="py-1">
          {visible.map((conversation) => {
            const active = conversation.key === activeKey;
            const online =
              conversation.online || (conversation.peerId ? onlineIds.includes(conversation.peerId) : false);
            return (
              <li key={conversation.key}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                    active ? "bg-[#f0f2f5]" : "hover:bg-slate-50",
                  )}
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      user={{ name: conversation.name, avatarUrl: conversation.avatarUrl }}
                      className="h-11 w-11 text-[13px]"
                    />
                    {conversation.kind === "group" ? (
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#075e54] text-white ring-2 ring-white">
                        <Users className="h-2.5 w-2.5" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                          online ? "bg-[#25d366]" : "bg-slate-300",
                        )}
                        aria-label={online ? "Online" : "Offline"}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-slate-900">
                        {conversation.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px]",
                          conversation.unread > 0 ? "font-semibold text-[#25d366]" : "text-slate-400",
                        )}
                      >
                        {conversationTime(conversation.lastAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500">
                        {conversation.kind === "group" && conversation.lastBody ? conversation.lastBody : conversation.lastBody || "No messages yet"}
                      </span>
                      {conversation.unread > 0 && (
                        <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold text-white">
                          {conversation.unread > 99 ? "99+" : conversation.unread}
                        </span>
                      )}
                    </span>
                    {conversation.kind === "dm" && conversation.role && (
                      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wide text-slate-400">
                        {displayRole(conversation.role)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="border-t border-slate-100 px-3 py-2 text-[10px] leading-snug text-slate-400">
        Messages are private to you and the people in the conversation.
      </footer>
    </aside>
  );
}
