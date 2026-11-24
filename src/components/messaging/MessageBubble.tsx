import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  FileText,
  Forward,
  MoreHorizontal,
  Pause,
  Pencil,
  Pin,
  Play,
  Reply,
  Star,
  Trash2,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { formatVoiceTime, useSignedUrl, type Message } from "@/lib/messaging";
import type { User } from "@/types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"];

function VoiceNote({ url, seconds }: { url: string; seconds: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const update = () => setProgress(element.duration ? element.currentTime / element.duration : 0);
    const done = () => {
      setPlaying(false);
      setProgress(0);
    };
    element.addEventListener("timeupdate", update);
    element.addEventListener("ended", done);
    return () => {
      element.removeEventListener("timeupdate", update);
      element.removeEventListener("ended", done);
    };
  }, [url]);

  return (
    <div className="flex min-w-[190px] items-center gap-2 py-1">
      <button
        type="button"
        onClick={() => {
          const element = audio.current;
          if (!element) return;
          if (element.paused) {
            void element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          } else {
            element.pause();
            setPlaying(false);
          }
        }}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70 text-[#075e54] shadow-sm ring-1 ring-black/5"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center gap-[2px]" aria-hidden>
          {Array.from({ length: 26 }).map((_, index) => {
            const height = 6 + ((index * 7) % 15);
            const played = progress * 26 > index;
            return (
              <span
                key={index}
                style={{ height }}
                className={cn("w-[2px] rounded-full", played ? "bg-[#075e54]" : "bg-slate-400/60")}
              />
            );
          })}
        </div>
        <p className="text-[10px] opacity-70">{formatVoiceTime(seconds)}</p>
      </div>
      <audio ref={audio} src={url} preload="metadata" className="hidden" />
    </div>
  );
}

function AttachmentBody({ message }: { message: Message }) {
  const attachment = message.attachment;
  const url = useSignedUrl(attachment?.path ?? null);
  if (!attachment) return null;

  if (!url) {
    return (
      <div className="flex h-32 w-52 items-center justify-center rounded-lg bg-black/5 text-[11px] italic opacity-70">
        Loading {attachment.name}…
      </div>
    );
  }
  if (attachment.type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block" title={attachment.name}>
        <img
          src={url}
          alt={attachment.name}
          loading="lazy"
          className="max-h-[320px] w-auto max-w-full rounded-lg object-cover"
        />
      </a>
    );
  }
  if (attachment.type === "voice") {
    return <VoiceNote url={url} seconds={attachment.duration} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 rounded-lg bg-black/5 px-2.5 py-2 hover:bg-black/10"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/70">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block max-w-[190px] truncate text-[12px] font-medium">{attachment.name}</span>
        <span className="block text-[10px] opacity-60">Tap to download</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-60" />
    </a>
  );
}

function highlight(text: string, query?: string): ReactNode {
  const needle = query?.trim();
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={index} className="rounded bg-amber-200/80 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export interface BubbleActions {
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onStar: (message: Message) => void;
  onPin: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onCopy: (message: Message) => void;
  onForward: (message: Message) => void;
}

export default function MessageBubble({
  message,
  mine,
  showSender,
  showAvatar,
  sender,
  meId,
  replyTo,
  replySender,
  query,
  actions,
}: {
  message: Message;
  mine: boolean;
  /** First message of a run from this sender — draws the tail and name. */
  showSender: boolean;
  showAvatar: boolean;
  sender?: User;
  meId: string;
  replyTo?: Message | null;
  replySender?: string;
  query?: string;
  actions: BubbleActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const deleted = !!message.deleted_at;

  return (
    <div className={cn("group flex w-full gap-1.5", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <div className="w-7 shrink-0 self-end">
          {showAvatar && sender && (
            <UserAvatar user={{ name: sender.name, avatarUrl: sender.avatarUrl }} className="h-7 w-7 text-[10px]" />
          )}
        </div>
      )}

      <div className={cn("relative max-w-[86%] sm:max-w-[75%]", mine ? "items-end" : "items-start")}>
        {/* hover toolbar */}
        {!deleted && (
          <div
            className={cn(
              "absolute -top-8 z-20 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 shadow-md transition sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:focus-within:pointer-events-auto sm:focus-within:opacity-100",
              mine ? "right-0" : "left-0",
            )}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => actions.onReact(message, emoji)}
                aria-label={`React with ${emoji}`}
                className="grid h-7 w-7 place-items-center rounded-full text-[15px] transition hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => actions.onReply(message)}
              aria-label="Reply"
              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        )}

        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="Close message actions"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className={cn(
                "absolute -top-8 z-40 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-[12px] text-slate-700 shadow-xl",
                mine ? "right-8" : "left-8",
              )}
            >
              {[
                { label: "Reply", icon: Reply, run: () => actions.onReply(message) },
                { label: "Copy text", icon: Copy, run: () => actions.onCopy(message) },
                ...(message.body.trim()
                  ? [{ label: "Forward", icon: Forward, run: () => actions.onForward(message) }]
                  : []),
                { label: message.starred ? "Remove star" : "Star message", icon: Star, run: () => actions.onStar(message) },
                { label: message.pinned ? "Unpin" : "Pin message", icon: Pin, run: () => actions.onPin(message) },
                ...(mine
                  ? [
                      { label: "Edit", icon: Pencil, run: () => actions.onEdit(message) },
                      { label: "Delete", icon: Trash2, run: () => actions.onDelete(message) },
                    ]
                  : []),
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    item.run();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  <item.icon className="h-3.5 w-3.5 text-slate-500" />
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div
          className={cn(
            "relative w-fit max-w-full rounded-lg px-2.5 py-1.5 text-[13.5px] shadow-sm",
            mine ? "ml-auto bg-[#d9fdd3] text-slate-800" : "bg-white text-slate-800",
            showSender ? (mine ? "rounded-tr-none" : "rounded-tl-none") : "",
          )}
        >
          {showSender && !mine && sender && (
            <p className="mb-0.5 text-[11.5px] font-semibold text-[#0a7c68]">{sender.name}</p>
          )}

          {replyTo && !deleted && (
            <div className="mb-1 rounded-md border-l-[3px] border-[#25d366] bg-black/5 px-2 py-1">
              <p className="text-[10.5px] font-semibold text-[#0a7c68]">
                {replyTo.sender_id === meId ? "You" : replySender ?? sender?.name ?? "Member"}
              </p>
              <p className="line-clamp-2 text-[11px] text-slate-600">
                {replyTo.deleted_at ? "Message deleted" : replyTo.body || "Attachment"}
              </p>
            </div>
          )}

          {message.pinned && (
            <span className="mr-1 inline-flex align-middle text-[10px] text-slate-500" title="Pinned message">
              <Pin className="h-3 w-3" />
            </span>
          )}

          {deleted ? (
            <p className="flex items-center gap-1 py-0.5 text-[12px] italic text-slate-500">
              <Trash2 className="h-3 w-3" /> This message was deleted
            </p>
          ) : (
            <>
              {message.attachment && (
                <div className={cn(message.body.trim() && "mb-1")}>
                  <AttachmentBody message={message} />
                </div>
              )}
              {message.body.trim() && (
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                  {highlight(message.body, query)}
                </p>
              )}
            </>
          )}

          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-500">
            {message.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-label="Starred" />}
            {message.edited_at && <span className="italic">edited</span>}
            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {mine &&
              (message.pending ? (
                <Clock className="h-3 w-3 text-slate-400" aria-label="Sending" />
              ) : message.seen_at ? (
                <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label="Read" />
              ) : (
                <Check className="h-3.5 w-3.5 text-slate-500" aria-label="Sent" />
              ))}
          </div>
        </div>

        {message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
            {message.reactions.map((reaction) => {
              const reacted = reaction.user_ids.includes(meId);
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => actions.onReact(message, reaction.emoji)}
                  aria-label={`${reaction.emoji} reaction, ${reaction.user_ids.length}`}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] shadow-sm transition",
                    reacted
                      ? "border-[#25d366] bg-[#e7f8ef] text-[#075e54]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-semibold">{reaction.user_ids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
