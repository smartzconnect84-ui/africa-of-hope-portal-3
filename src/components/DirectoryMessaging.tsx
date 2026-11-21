import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, MessageCircle, Send } from "lucide-react";
import type { User } from "@/types";
import { accountId } from "@/lib/identifiers";
import { useChatThread } from "@/lib/chat";
import { formatLastSeen, getLastSeen } from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UserAvatar from "./UserAvatar";
import { cn } from "@/lib/utils";

export function PresenceDot({ online, className = "" }: { online: boolean; className?: string }) {
  return (
    <span
      title={online ? "Online now" : "Offline"}
      aria-label={online ? "Online now" : "Offline"}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white",
        online ? "bg-emerald-500" : "bg-slate-300",
        className,
      )}
    />
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function UserProfileDialog({
  user,
  online,
  onClose,
  onMessage,
}: {
  user: User | null;
  online: boolean;
  onClose: () => void;
  onMessage: (u: User) => void;
}) {
  const lastSeen = user ? getLastSeen(user.id) : null;
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-700" />
                Member profile
              </DialogTitle>
              <DialogDescription>Account details and live availability.</DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-4">
              <div className="relative">
                {user.avatarUrl ? (
                  <UserAvatar user={user} className="h-16 w-16 text-lg" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-950 text-lg font-semibold text-amber-400">
                    {initials(user.name)}
                  </span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot online={online} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-slate-900">{user.name}</p>
                <p className="break-all font-mono text-[11px] text-emerald-800">ID: {accountId(user)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {online ? (
                    <span className="font-semibold text-emerald-700">● Active now</span>
                  ) : (
                    <span>Last active {formatLastSeen(lastSeen)}</span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-700/15">
                    {user.role}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {user.status}
                  </span>
                  {user.title && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      {user.title}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="break-all">{user.email}</p>
              {user.phone && <p>{user.phone}</p>}
              {user.bio && <p className="text-[13px]">{user.bio}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => onMessage(user)} className="bg-emerald-700 hover:bg-emerald-800">
                <MessageCircle className="mr-1.5 h-4 w-4" /> Message
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DirectMessageDialog({
  meId,
  meName,
  peer,
  onClose,
}: {
  meId: string | null;
  meName: string;
  peer: User | null;
  onClose: () => void;
}) {
  const thread = peer ? { kind: "dm" as const, id: peer.id } : null;
  const { messages, peerTyping, send, sendTyping, markSeen } = useChatThread(meId, thread);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<number>(0);

  useEffect(() => {
    if (peer) {
      setDraft("");
      setError(null);
      void markSeen();
    }
  }, [peer?.id, markSeen, peer]);

  useEffect(() => {
    if (peer && messages.length) void markSeen();
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, peer, markSeen]);

  function onType(v: string) {
    setDraft(v);
    const now = Date.now();
    if (now - typingRef.current > 1500) {
      typingRef.current = now;
      sendTyping();
    }
  }

  async function onSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const ok = await send({ body: draft.trim() });
    setSending(false);
    if (!ok) setError("Message could not be delivered. It is saved on this device and will retry automatically.");
    else {
      setError(null);
      setDraft("");
    }
  }

  return (
    <Dialog open={!!peer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        {peer && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-700" />
                <span className="truncate">Chat with {peer.name}</span>
              </DialogTitle>
              <DialogDescription>
                1:1 conversation · messages deliver instantly on this device and live to everyone online
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-48 max-h-[46vh] flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3" aria-live="polite">
              {messages.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">
                  No messages yet. Say hello to {peer.name.split(" ")[0]}.
                </p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === meId;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        mine ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", mine ? "text-emerald-100" : "text-slate-400")}>
                        {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {mine &&
                          (m.seen_at ? (
                            <span title={`Seen`} className="inline-flex items-center gap-0.5">
                              <CheckCheck className="h-3 w-3" /> Seen
                            </span>
                          ) : (
                            <span title="Sent" className="inline-flex items-center">
                              <Check className="h-3 w-3" />
                            </span>
                          ))}
                      </p>
                    </div>
                  </div>
                );
              })}
              {peerTyping && <p className="text-xs italic text-slate-400">{peer.name.split(" ")[0]} is typing…</p>}
              <div ref={bottomRef} />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
                placeholder={`Message ${peer.name.split(" ")[0]}… (Enter to send)`}
                rows={2}
                aria-label={`Message ${peer.name}`}
              />
              <Button onClick={() => void onSend()} disabled={sending || !draft.trim()} className="bg-emerald-700 hover:bg-emerald-800">
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message to {peer.name}</span>
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Signed in as {meName}. Read receipts update live when both sides are online.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
