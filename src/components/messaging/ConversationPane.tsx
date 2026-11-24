import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Pin, Search, Star, Users, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import {
  attachmentTypeFor,
  chatErrorText,
  dayLabel,
  loadDraft,
  previewLabel,
  saveDraft,
  threadCacheKey,
  uploadChatFile,
  useMessageThread,
  type Conversation,
  type Message,
  type MessageAttachment,
  type ThreadRef,
} from "@/lib/messaging";
import MessageBubble, { type BubbleActions } from "./MessageBubble";
import Composer from "./Composer";
import type { User } from "@/types";

const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <g fill="none" stroke="#075e54" stroke-width="1.4" opacity="0.09" stroke-linecap="round">
      <circle cx="22" cy="24" r="7"/><path d="M18 58h9M22.5 53.5v9"/>
      <path d="M74 18c5 4 9 4 14 0"/><circle cx="96" cy="34" r="4"/>
      <path d="M58 52l7 7-7 7-7-7z"/><path d="M20 92c6-8 12-8 18 0"/>
      <path d="M86 84h12M92 78v12"/><circle cx="52" cy="100" r="4"/>
      <path d="M104 60c-4 6-9 6-13 0"/>
    </g>
  </svg>`,
)}")`;

type Row =
  | { type: "day"; key: string; label: string }
  | {
      type: "message";
      key: string;
      message: Message;
      showSender: boolean;
      showAvatar: boolean;
      replyTo: Message | null;
    };

const GAP_MS = 5 * 60 * 1000;

export default function ConversationPane({
  conversation,
  meId,
  users,
  onlineIds,
  onBack,
  onOpenInfo,
  onForward,
  onActivity,
}: {
  conversation: Conversation;
  meId: string;
  users: User[];
  onlineIds: string[];
  onBack: () => void;
  onOpenInfo: () => void;
  onForward: (message: Message) => void;
  onActivity: () => void;
}) {
  const target: ThreadRef | null =
    conversation.kind === "dm" && conversation.peerId
      ? { kind: "dm", peerId: conversation.peerId }
      : conversation.groupId
        ? { kind: "group", groupId: conversation.groupId }
        : null;
  const cacheKey = target ? threadCacheKey(meId, target) : "";

  const thread = useMessageThread(meId, target);
  const [draft, setDraft] = useState(() => (meId && cacheKey ? loadDraft(meId, cacheKey) : ""));
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const peer = conversation.peerId ? byId.get(conversation.peerId) : undefined;
  const online =
    conversation.kind === "dm" && conversation.peerId ? onlineIds.includes(conversation.peerId) : false;
  const groupOnline = (conversation.memberIds ?? []).filter((id) => onlineIds.includes(id)).length;

  useEffect(() => {
    setDraft(meId ? loadDraft(meId, cacheKey) : "");
    setReplyTo(null);
    setEditing(null);
    setQuery("");
    setSearchOpen(false);
    setStarredOnly(false);
    setLocalError(null);
  }, [cacheKey, meId]);

  const messages = thread.messages;

  // Read receipts land as soon as the conversation is on screen.
  useEffect(() => {
    if (!messages.length || document.hidden) return;
    if (!messages.some((message) => message.sender_id !== meId && !message.seen_at)) return;
    void thread.markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, messages[messages.length - 1]?.id, meId]);

  useEffect(() => {
    if (searchOpen) return;
    bottom.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, cacheKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (starredOnly && !message.starred) return false;
      if (!needle) return true;
      return (
        message.body.toLowerCase().includes(needle) ||
        (message.attachment?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [messages, query, starredOnly]);

  const rows = useMemo<Row[]>(() => {
    const byMessage = new Map(messages.map((message) => [message.id, message]));
    const output: Row[] = [];
    let lastDay = "";
    filtered.forEach((message, index) => {
      const day = dayLabel(message.created_at);
      if (day !== lastDay) {
        output.push({ type: "day", key: `day-${day}-${index}`, label: day });
        lastDay = day;
      }
      const previous = filtered[index - 1];
      const next = filtered[index + 1];
      const sameRun =
        previous &&
        previous.sender_id === message.sender_id &&
        +new Date(message.created_at) - +new Date(previous.created_at) < GAP_MS &&
        dayLabel(previous.created_at) === day;
      const nextSameRun =
        next &&
        next.sender_id === message.sender_id &&
        +new Date(next.created_at) - +new Date(message.created_at) < GAP_MS &&
        dayLabel(next.created_at) === day;
      output.push({
        type: "message",
        key: message.id,
        message,
        showSender: !sameRun,
        showAvatar: !nextSameRun,
        replyTo: message.reply_to ? byMessage.get(message.reply_to) ?? null : null,
      });
    });
    return output;
  }, [filtered, messages]);

  const pinned = useMemo(() => messages.filter((message) => message.pinned && !message.deleted_at), [messages]);
  const searchCount = query.trim() || starredOnly ? filtered.length : null;

  function jumpTo(id: string) {
    const element = document.getElementById(`msg-${id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 1800);
  }

  async function submit({ body }: { body: string }) {
    if (editing) {
      await thread.edit(editing.id, body);
      setEditing(null);
      setDraft("");
      if (meId) saveDraft(meId, cacheKey, "");
      onActivity();
      return;
    }
    const ok = await thread.send({ body, replyTo: replyTo?.id ?? null });
    if (ok) {
      setReplyTo(null);
      onActivity();
    } else {
      setDraft(body);
    }
  }

  async function attach(file: File, caption: string, seconds?: number) {
    if (!target) return;
    setUploading(true);
    setLocalError(null);
    try {
      const type = attachmentTypeFor(file);
      const uploaded = await uploadChatFile({
        meId,
        peerId: target.kind === "dm" ? target.peerId : undefined,
        groupId: target.kind === "group" ? target.groupId : undefined,
        file,
        fileName: file.name,
        type,
      });
      const attachment: MessageAttachment = {
        path: uploaded.path,
        type,
        name: uploaded.name,
        duration: type === "voice" ? Math.round(seconds ?? 0) : null,
      };
      const ok = await thread.send({ body: caption, attachment, replyTo: replyTo?.id ?? null });
      if (!ok) setLocalError("The file uploaded, but the message could not be sent. Try again.");
      else {
        setReplyTo(null);
        setDraft("");
        if (meId) saveDraft(meId, cacheKey, "");
        onActivity();
      }
    } catch (err) {
      setLocalError(chatErrorText(err, "The attachment could not be uploaded."));
    } finally {
      setUploading(false);
    }
  }

  const actions: BubbleActions = {
    onReply: (message) => {
      setEditing(null);
      setReplyTo(message);
    },
    onEdit: (message) => {
      setReplyTo(null);
      setEditing(message);
    },
    onDelete: (message) => {
      void thread.remove(message.id).then(onActivity);
    },
    onStar: (message) => {
      void thread.toggleStar(message.id).then(onActivity);
    },
    onPin: (message) => {
      void thread.togglePin(message.id).then(onActivity);
    },
    onReact: (message, emoji) => {
      void thread.react(message, emoji);
    },
    onCopy: (message) => {
      const text = message.body || message.attachment?.name || "";
      if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
    },
    onForward: (message) => onForward(message),
  };

  const subtitle =
    conversation.kind === "group" ? (
      <span className="flex items-center gap-1.5">
        <Users className="h-3 w-3" />
        {conversation.memberCount ?? conversation.memberIds?.length ?? 0} members
        <span className="opacity-40">·</span>
        {groupOnline} online
      </span>
    ) : online ? (
      <span className="text-[#075e54]">online</span>
    ) : peer?.lastSeenAt ? (
      `last seen ${new Date(peer.lastSeenAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
    ) : (
      peer?.role ?? "Direct message"
    );

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col bg-[#efeae2]">
      <header className="z-10 flex items-center gap-2 border-b border-black/5 bg-[#f0f2f5] px-2 py-2 sm:px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-black/5 md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={onOpenInfo} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <UserAvatar
            user={{ name: conversation.name, avatarUrl: conversation.avatarUrl }}
            className="h-10 w-10 text-[12px]"
          />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-slate-900">{conversation.name}</span>
            <span className="block truncate text-[11.5px] text-slate-500">
              {thread.peerTyping && conversation.kind === "dm" ? (
                <span className="font-medium text-[#25d366]">typing…</span>
              ) : (
                subtitle
              )}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen((open) => !open)}
          aria-label="Search this conversation"
          aria-pressed={searchOpen}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-black/5",
            searchOpen && "bg-black/5",
          )}
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="Conversation info"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-black/5"
        >
          <Info className="h-[18px] w-[18px]" />
        </button>
      </header>

      {searchOpen && (
        <div className="z-10 flex flex-wrap items-center gap-2 border-b border-black/5 bg-white px-3 py-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in conversation"
              aria-label="Search in conversation"
              autoFocus
              className="h-8 w-full rounded-lg bg-slate-100 pl-8 pr-2 text-[12.5px] outline-none focus:ring-2 focus:ring-[#25d366]/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setStarredOnly((value) => !value)}
            aria-pressed={starredOnly}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
              starredOnly ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", starredOnly && "fill-amber-500 text-amber-600")} /> Starred
          </button>
          {searchCount !== null && (
            <span className="text-[11px] text-slate-500">
              {searchCount} {searchCount === 1 ? "message" : "messages"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setQuery("");
              setStarredOnly(false);
            }}
            aria-label="Close search"
            className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pinned.length > 0 && !searchOpen && (
        <button
          type="button"
          onClick={() => jumpTo(pinned[pinned.length - 1].id)}
          className="z-10 flex items-center gap-2 border-b border-black/5 bg-white/90 px-3 py-1.5 text-left hover:bg-white"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-[#0a7c68]" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-600">
            <span className="font-semibold text-slate-800">Pinned</span> · {previewLabel(pinned[pinned.length - 1])}
          </span>
          <span className="shrink-0 text-[10px] font-semibold text-[#0a7c68]">
            {pinned.length} {pinned.length === 1 ? "pin" : "pins"}
          </span>
        </button>
      )}

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-6"
        style={{
          backgroundImage: conversation.backgroundUrl ? `url(${conversation.backgroundUrl})` : WALLPAPER,
          backgroundSize: conversation.backgroundUrl ? "cover" : "120px 120px",
          backgroundPosition: "center",
        }}
      >
        {thread.loading && messages.length === 0 && (
          <div className="mx-auto mt-6 w-full max-w-3xl space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className={cn("flex", row % 2 ? "justify-end" : "justify-start")}>
                <span className="h-12 w-48 animate-pulse rounded-lg bg-white/70" />
              </div>
            ))}
          </div>
        )}

        {!thread.loading && rows.length === 0 && (
          <div className="mx-auto mt-8 max-w-sm rounded-xl bg-white/85 px-5 py-6 text-center shadow-sm">
            <UserAvatar
              user={{ name: conversation.name, avatarUrl: conversation.avatarUrl }}
              className="mx-auto h-14 w-14 text-base"
            />
            <p className="mt-3 text-[13px] font-semibold text-slate-800">
              {query || starredOnly ? "No messages match" : `Start the conversation with ${conversation.name.split(" ")[0]}`}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
              {query || starredOnly
                ? "Try a different word, or clear the search to see the whole thread."
                : conversation.kind === "group"
                  ? "Messages here are visible to everyone in the group."
                  : "Messages are private between the two of you, on every device you sign in to."}
            </p>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl space-y-1.5">
          {rows.map((row) =>
            row.type === "day" ? (
              <div key={row.key} className="flex justify-center py-2">
                <span className="rounded-md bg-white/90 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-slate-500 shadow-sm">
                  {row.label}
                </span>
              </div>
            ) : (
              <div
                key={row.key}
                id={`msg-${row.message.id}`}
                className={cn(
                  "rounded-lg transition",
                  flashId === row.message.id && "ring-2 ring-amber-400/70",
                )}
              >
                <MessageBubble
                  message={row.message}
                  mine={row.message.sender_id === meId}
                  showSender={row.showSender}
                  showAvatar={row.showAvatar}
                  sender={byId.get(row.message.sender_id)}
                  meId={meId}
                  replyTo={row.replyTo}
                  replySender={row.replyTo ? byId.get(row.replyTo.sender_id)?.name : undefined}
                  query={query}
                  actions={actions}
                />
              </div>
            ),
          )}

          {thread.peerTyping && (
            <div className="flex justify-start pl-9">
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: `${dot * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottom} className="h-1" />
        </div>
      </div>

      <Composer
        meId={meId}
        threadKey={cacheKey}
        initialDraft={draft}
        onDraftChange={(value) => {
          setDraft(value);
          if (meId) saveDraft(meId, cacheKey, value);
        }}
        onSend={(payload) => void submit(payload)}
        onTyping={thread.sendTyping}
        onAttach={(file, caption, seconds) => void attach(file, caption, seconds)}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => {
          setEditing(null);
          setDraft("");
        }}
        sending={thread.sending}
        uploading={uploading}
        error={localError ?? thread.error}
      />
    </section>
  );
}
