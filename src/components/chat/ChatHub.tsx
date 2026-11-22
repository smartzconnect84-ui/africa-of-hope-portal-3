import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  File as FileIcon,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  attachmentTypeFor,
  chatErrorMessage,
  createChatGroup,
  formatVoiceTime,
  uploadChatFile,
  useChatThread,
  useConversations,
  useSignedUrl,
  useVoiceRecorder,
  type ChatConversation,
  type ChatGroup,
  type ChatMessage,
} from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

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

function ConversationRow({
  conv,
  active,
  onClick,
}: {
  conv: ChatConversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50",
        active && "bg-emerald-100",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-emerald-800 text-amber-400">{initialsOf(conv.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{conv.name}</span>
          {conv.kind === "group" && <Users className="h-3 w-3 shrink-0 text-slate-400" />}
        </span>
        <span className="block truncate text-[11px] text-slate-500">{conv.lastBody || "No messages yet"}</span>
      </span>
      {conv.unread > 0 ? (
        <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {conv.unread > 99 ? "99+" : conv.unread}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Private attachments are addressed by storage path. The signed URL is minted
 * in this component (one hook per message) instead of inside the message loop.
 */
function AttachmentView({ message }: { message: ChatMessage }) {
  const url = useSignedUrl(message.attachment_path);
  const name = message.attachment_name || "attachment";

  if (!url) {
    return <p className="text-[11px] italic opacity-70">Preparing {name}…</p>;
  }
  if (message.attachment_type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="max-h-64 w-auto max-w-full rounded-xl object-contain"
        />
      </a>
    );
  }
  if (message.attachment_type === "voice") {
    return (
      <div className="space-y-0.5">
        <audio controls src={url} className="max-w-[260px]" />
        <p className="text-[11px] opacity-70">{formatVoiceTime(message.duration_seconds)}</p>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2"
    >
      <FileIcon className="h-4 w-4 shrink-0" /> {name}
    </a>
  );
}

function Bubble({ mine, message }: { mine: boolean; message: ChatMessage }) {
  const time = new Date(message.created_at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] space-y-1.5 rounded-2xl px-3 py-2 shadow-sm",
          mine ? "bg-emerald-700 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200",
        )}
      >
        {message.attachment_path && <AttachmentView message={message} />}
        {message.body.trim() && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
        <p
          className={cn(
            "flex items-center justify-end gap-1 text-[11px]",
            mine ? "text-emerald-100" : "text-slate-400",
          )}
        >
          {time}
          {mine && message.seen_at && (
            <span className="inline-flex items-center gap-0.5" title="Seen">
              <Check className="h-3 w-3" /> Seen
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function NewGroupDialog({
  open,
  onClose,
  people,
  meId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  people: User[];
  meId: string | null;
  onCreated: (group: ChatGroup) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDesc("");
    setSelected([]);
    setError(null);
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      setError("The group needs a name.");
      return;
    }
    if (!meId) {
      setError("Sign in to create a group.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const group = await createChatGroup({
        name,
        description: desc,
        createdBy: meId,
        memberIds: selected,
      });
      onCreated(group);
      onClose();
    } catch (err) {
      setError(chatErrorMessage(err, "The group could not be created."));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Pick the people you want in the group. They are added straight away and see it in their Messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project squad"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Description (optional)</Label>
            <Input
              id="group-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What this group is for"
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Members ({selected.length} selected)</Label>
            <div className="max-h-[240px] space-y-1 overflow-y-auto">
              {people.length === 0 && (
                <p className="px-1 py-3 text-xs text-slate-500">No other portal members are visible yet.</p>
              )}
              {people.map((u) => {
                const on = selected.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setSelected((s) => (s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id]))
                    }
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition",
                      on && "bg-emerald-50",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-800 text-[11px] font-bold text-amber-400">
                      {initialsOf(u.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800">{u.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{u.role}</span>
                    </span>
                    {on && <Check className="h-4 w-4 shrink-0 text-emerald-700" />}
                  </button>
                );
              })}
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
              {saving ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewMessageDialog({
  open,
  onClose,
  people,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  people: User[];
  onPick: (user: User) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  if (!open) return null;
  const q = query.trim().toLowerCase();
  const matches = q
    ? people.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q))
    : people;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Start a private conversation with a portal member.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search members"
            className="pl-9"
          />
        </div>
        <div className="max-h-[320px] space-y-1 overflow-y-auto">
          {matches.length === 0 && (
            <p className="px-1 py-6 text-center text-xs text-slate-500">No members match that search.</p>
          )}
          {matches.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onPick(u);
                onClose();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[11px] font-bold text-amber-400">
                {initialsOf(u.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{u.role}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatHub() {
  const { state, currentUser } = useApp();
  const meId = currentUser?.id ?? null;

  const people = useMemo(
    () =>
      state.users
        .filter((u) => u.id !== meId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.users, meId],
  );

  const [tick, setTick] = useState(0);
  const { conversations, loading, error: listError } = useConversations(
    meId ?? undefined,
    people,
    tick,
  );

  const [view, setView] = useState<"conversations" | "thread">("conversations");
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingAt = useRef(0);

  const target = useMemo(() => {
    if (!active) return null;
    if (active.kind === "dm") return active.peerId ? { kind: "dm" as const, id: active.peerId } : null;
    return active.groupId ? { kind: "group" as const, id: active.groupId } : null;
  }, [active]);

  const thread = useChatThread(meId ?? undefined, target);
  const recorder = useVoiceRecorder();

  const openConversation = (conv: ChatConversation) => {
    setActive(conv);
    setView("thread");
    setDraft("");
    setUploadError(null);
  };

  const openDm = (user: User) =>
    openConversation({
      key: `dm:${user.id}`,
      kind: "dm",
      peerId: user.id,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      lastBody: "",
      lastAt: new Date().toISOString(),
      unread: 0,
    });

  const handleGroupCreated = (group: ChatGroup) => {
    openConversation({
      key: `group:${group.id}`,
      kind: "group",
      groupId: group.id,
      name: group.name,
      lastBody: group.description || "No messages yet",
      lastAt: group.created_at,
      unread: 0,
      memberCount: group.memberIds.length,
    });
    setTick((t) => t + 1);
  };

  // Read receipts: only once the thread has actually loaded messages.
  useEffect(() => {
    if (!target || thread.messages.length === 0) return;
    if (!thread.messages.some((m) => m.sender_id !== meId)) return;
    let cancelled = false;
    void thread.markSeen().then(() => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, thread.messages.length, meId]);

  // Keep the newest message in view, like every other chat client.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [target, thread.messages.length]);

  async function sendText() {
    const body = draft.trim();
    if (!body || !target) return;
    setDraft("");
    setUploadError(null);
    const ok = await thread.send({ body });
    if (!ok) setDraft(body);
    else setTick((t) => t + 1);
  }

  function onDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (now - typingAt.current > 1500) {
      typingAt.current = now;
      thread.sendTyping();
    }
  }

  async function sendAttachment(file: File, seconds = 0) {
    if (!meId || !target) return;
    const type = attachmentTypeFor(file);
    setUploading(true);
    setUploadError(null);
    try {
      const { path, name } = await uploadChatFile({
        meId,
        peerId: target.kind === "dm" ? target.id : undefined,
        groupId: target.kind === "group" ? target.id : undefined,
        file,
        fileName: file.name,
        type,
      });
      const ok = await thread.send({
        attachment_path: path,
        attachment_type: type,
        attachment_name: name,
        duration_seconds: type === "voice" ? Math.round(seconds) : null,
      });
      if (!ok) setUploadError("The attachment was uploaded but the message could not be sent.");
      else setTick((t) => t + 1);
    } catch (err) {
      setUploadError(chatErrorMessage(err, "The attachment could not be uploaded."));
    } finally {
      setUploading(false);
    }
  }

  async function toggleRecording() {
    if (!recorder.recording) {
      setUploadError(null);
      await recorder.start();
      return;
    }
    const result = await recorder.stop();
    if (!result) {
      setUploadError("Nothing was recorded. Try again and speak after the timer starts.");
      return;
    }
    const extension = result.mime.includes("mp4") ? "m4a" : result.mime.includes("ogg") ? "ogg" : "webm";
    const file = new File([result.blob], `voice-${Date.now()}.${extension}`, { type: result.mime });
    await sendAttachment(file, result.seconds);
  }

  const error = uploadError ?? thread.error ?? listError;

  if (!meId) {
    return (
      <div className="rounded-xl border border-emerald-900/10 bg-white p-10 text-center text-sm text-slate-500">
        Sign in to send and receive messages.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-full max-h-[calc(100dvh-4rem)] min-h-[420px] gap-3">
        {/* Conversation list */}
        <div
          className={cn(
            "flex-col overflow-hidden border border-emerald-900/10 bg-white",
            // Phones show one pane at a time: the list is the landing view, and
            // it only yields to the thread once a conversation is open.
            view === "thread" ? "hidden md:flex md:w-[320px]" : "flex w-full md:w-[320px]",
          )}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <MessageCircle className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-slate-800">Messages</span>
            {loading && <span className="ml-auto text-[11px] text-slate-400">Syncing…</span>}
          </div>
          <div className="flex gap-1 p-1.5">
            <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={() => setNewDmOpen(true)}>
              <MessageCircle className="mr-1 h-4 w-4" /> New message
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={() => setGroupOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New group
            </Button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5">
            {conversations.length === 0 && !loading && (
              <p className="px-3 py-8 text-center text-xs text-slate-500">
                No conversations yet. Start a private chat or create a group.
              </p>
            )}
            {conversations.map((conv) => (
              <ConversationRow
                key={conv.key}
                conv={conv}
                active={active?.key === conv.key}
                onClick={() => openConversation(conv)}
              />
            ))}
          </div>
        </div>

        {/* Thread / composer */}
        {view === "thread" && active && target ? (
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden border border-emerald-900/10 bg-slate-50">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => setView("conversations")} aria-label="Back to conversations">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-800 text-amber-400">{initialsOf(active.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{active.name}</p>
                <p className="text-[11px] text-slate-500">
                  {active.kind === "group"
                    ? `${active.memberCount ?? 0} member${(active.memberCount ?? 0) === 1 ? "" : "s"}`
                    : active.role || "Direct message"}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3" aria-live="polite">
              {thread.loading && thread.messages.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">Loading messages…</p>
              )}
              {!thread.loading && thread.messages.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">No messages yet. Say hello!</p>
              )}
              {thread.messages.map((message) => (
                <Bubble key={message.id} mine={message.sender_id === meId} message={message} />
              ))}
              {thread.peerTyping && <p className="text-xs italic text-slate-400">Someone is typing…</p>}
              <div ref={bottomRef} />
            </div>

            {error && (
              <p role="alert" className="mx-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            <div className="border-t border-slate-100 bg-white p-3">
              {recorder.recording && (
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
                  Recording {formatVoiceTime(recorder.seconds)} — tap the square to send.
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-rose-700"
                    onClick={recorder.cancel}
                    aria-label="Discard recording"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                  placeholder="Message… (Enter to send, Shift+Enter for a new line)"
                  aria-label="Message"
                  rows={1}
                  className="max-h-[120px]"
                />
                <Button
                  onClick={() => void sendText()}
                  disabled={thread.sending || !draft.trim()}
                  aria-label="Send message"
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={imageInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void sendAttachment(file);
                }}
              />
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void sendAttachment(file);
                }}
              />
              <div className="mt-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 py-1"
                  onClick={() => imageInput.current?.click()}
                  disabled={uploading}
                  aria-label="Attach a photo"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 py-1"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  aria-label="Attach a file"
                >
                  <FileIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("px-2 py-1", recorder.recording && "text-rose-600")}
                  onClick={() => void toggleRecording()}
                  disabled={uploading || thread.sending}
                  aria-label={recorder.recording ? "Stop and send voice note" : "Record a voice note"}
                >
                  {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                {uploading && <span className="text-[11px] text-slate-500">Uploading…</span>}
                {recorder.error && <span className="text-[11px] text-rose-600">{recorder.error}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center border border-emerald-900/10 bg-slate-50 p-6 text-center text-slate-400 md:flex">
            <MessageCircle className="mb-2 h-10 w-10" />
            <p className="text-sm">Select a conversation or start a new message.</p>
          </div>
        )}
      </div>

      <NewGroupDialog
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        people={people}
        meId={meId}
        onCreated={handleGroupCreated}
      />
      <NewMessageDialog
        open={newDmOpen}
        onClose={() => setNewDmOpen(false)}
        people={people}
        onPick={openDm}
      />
    </div>
  );
}

export default ChatHub;
