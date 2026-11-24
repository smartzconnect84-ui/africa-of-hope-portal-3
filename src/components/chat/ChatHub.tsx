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
  Smile,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  attachmentTypeFor,
  chatErrorMessage,
  createChatGroup,
  deleteMessage,
  editMessage,
  loadDraft,
  pinMessage,
  saveDraft,
  formatVoiceTime,
  toggleReaction,
  toggleStarred,
  uploadChatFile,
  updateLastSeen,
  createPoll,
  votePoll,
  loadPolls,
  loadPollVotes,
  type ChatPoll,
  requestJoinGroup,
  loadJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  type ChatJoinRequest,
  sendGroupInvite,
  updateGroupPermissions,
  renameChatGroup,
  uploadGroupPhoto,
  uploadGroupBackground,
  useChatThread,
  useConversations,
  useSignedUrl,
  useVoiceRecorder,
  type ChatConversation,
  type ChatGroup,
  type ChatMessage,
} from "@/lib/chat";
import { supabase } from "@/integrations/supabase/client";
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
import { cn } from "@/lib/utils";
import UserAvatar from "../UserAvatar";
import { displayRole } from "@/lib/roleDisplay";
import { LanguageSwitcher } from "@/lib/locale";
import type { User } from "@/types";

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
      <div className="relative shrink-0">
        <UserAvatar
          user={{ name: conv.name, avatarUrl: conv.avatarUrl }}
          className="h-8 w-8 text-[11px]"
        />
        {conv.kind === "dm" && (
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
              conv.online ? "bg-emerald-500" : "bg-slate-300",
            )}
            aria-label={conv.online ? "Online" : "Offline"}
          />
        )}
      </div>
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

function Bubble({
  mine,
  message,
  meId,
  messages,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onStar,
  onReact,
}: {
  mine: boolean;
  message: ChatMessage;
  meId: string | null;
  messages: ChatMessage[];
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onStar: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
}) {
  const time = new Date(message.created_at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const replied = message.reply_to ? messages.find((m) => m.id === message.reply_to) : null;
  const isDeleted = !!message.deleted_at;
  const COMMON_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  return (
    <div
      className={cn("group flex gap-2", mine ? "justify-end" : "justify-start")}
      onContextMenu={(e) => {
        if (mine && !message.deleted_at) {
          e.preventDefault();
          onDelete(message);
        }
      }}
    >
      <div
        className={cn(
          "max-w-[75%] space-y-1.5 rounded-2xl px-3 py-2 shadow-sm",
          mine ? "bg-emerald-700 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200",
        )}
      >
                    {message.pinned_at && (
          <p className="text-[10px] font-semibold opacity-80">📌 Pinned</p>
        )}
        {message.starred && (
          <p className="text-[10px] font-semibold text-amber-500">⭐ Starred</p>
        )}
        {replied && (
          <div
            className={cn(
              "rounded-lg px-2 py-1 text-[11px] opacity-80",
              mine ? "bg-emerald-800/60" : "bg-slate-100",
            )}
          >
            <span className="font-semibold">{replied.sender_id === meId ? "You" : "Reply"}: </span>
            <span className="truncate">{replied.deleted_at ? "Message deleted" : replied.body || "Attachment"}</span>
          </div>
        )}
        {isDeleted ? (
          <p className="text-[11px] italic opacity-70">Message deleted</p>
        ) : (
          <>
            {message.attachment_path && <AttachmentView message={message} />}
            {message.body.trim() && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.body.split(/(@[A-Za-z0-9_]+)/g).map((part, i) =>
                  /^@[A-Za-z0-9_]+$/.test(part) ? (
                    <span key={i} className="font-semibold text-amber-200">
                      {part}
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
            )}
          </>
        )}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(message, r.emoji)}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px]",
                  mine ? "bg-emerald-800/60" : "bg-slate-100",
                )}
              >
                {r.emoji} {r.user_ids.length}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
            {COMMON_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(message, e)}
                className="text-[12px] hover:scale-110"
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
            <button type="button" onClick={() => onReply(message)} className="text-[10px] underline" aria-label="Reply">
              Reply
            </button>
            {!isDeleted && (
              <>
                <button type="button" onClick={() => onPin(message)} className="text-[10px] underline" aria-label="Pin">
                  {message.pinned_at ? "Unpin" : "Pin"}
                </button>
                <button type="button" onClick={() => onStar(message)} className="text-[10px] underline" aria-label="Star">
                  {message.starred ? "Unstar" : "Star"}
                </button>
              </>
            )}
            {mine && !isDeleted && (
              <>
                <button type="button" onClick={() => onEdit(message)} className="text-[10px] underline" aria-label="Edit">
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(message)} className="text-[10px] underline" aria-label="Delete">
                  Del
                </button>
              </>
            )}
          </div>
          <p
            className={cn(
              "flex items-center gap-1 text-[11px]",
              mine ? "text-emerald-100" : "text-slate-400",
            )}
          >
            {message.edited_at && <span className="italic">edited</span>}
            {time}
            {mine && message.seen_at && (
              <span className="inline-flex items-center gap-0.5 text-blue-200" title="Seen">
                <Check className="h-3 w-3" /> Seen
              </span>
            )}
          </p>
        </div>
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
                    <UserAvatar user={u} className="h-6 w-6 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800">{u.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{displayRole(u.role)}</span>
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
              <UserAvatar user={u} className="h-8 w-8 text-[11px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{displayRole(u.role)}</span>
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

  useEffect(() => {
    if (!meId) return;
    void updateLastSeen(meId);
    const interval = setInterval(() => void updateLastSeen(meId), 60000);
    return () => clearInterval(interval);
  }, [meId]);

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [starredOnly] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupMembersOpen, setGroupMembersOpen] = useState(false);
  const [pollVoting, setPollVoting] = useState<string | null>(null);
  const [groupSettingsName, setGroupSettingsName] = useState("");
  const [groupSettingsDesc, setGroupSettingsDesc] = useState("");
  const [groupSettingsJoinPolicy, setGroupSettingsJoinPolicy] = useState("invite");
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
  const [joinRequests, setJoinRequests] = useState<ChatJoinRequest[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [polls, setPolls] = useState<ChatPoll[]>([]);
  const [pollVotes, setPollVotes] = useState<Record<string, { user_id: string; option_index: number }[]>>({});
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
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
    if (meId) {
      const key = conv.kind === "dm" ? `dm:${conv.peerId}` : `group:${conv.groupId}`;
      void loadDraft(meId, key).then((d) => {
        if (d) setDraft(d);
      });
    }
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
      memberIds: group.memberIds,
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

  const dmThreadKey = active?.kind === "dm" && meId && active.peerId
    ? [meId, active.peerId].sort().join(":")
    : null;

  useEffect(() => {
    if (!active) { setPolls([]); setPollVotes({}); return; }
    const groupId = active.kind === "group" ? active.groupId ?? null : null;
    const dmThread = active.kind === "dm" ? dmThreadKey : null;
    if (!groupId && !dmThread) { setPolls([]); setPollVotes({}); return; }
    let cancelled = false;
    void (async () => {
      try {
        const ps = await loadPolls(groupId, dmThread);
        if (cancelled) return;
        setPolls(ps);
        const votes: Record<string, { user_id: string; option_index: number }[]> = {};
        await Promise.all(ps.map(async (p) => {
          votes[p.id] = await loadPollVotes(p.id);
        }));
        if (!cancelled) setPollVotes(votes);
      } catch {
        /* best effort */
      }
    })();
    return () => { cancelled = true; };
  }, [active?.groupId, active?.peerId, active?.kind, dmThreadKey, tick]);

  useEffect(() => {
    if (groupSettingsOpen && active) {
      setGroupSettingsName(active.name ?? "");
      setGroupSettingsDesc("");
      setGroupSettingsJoinPolicy("invite");
      if (active.kind === "group" && active.groupId) {
        void (async () => {
          try {
            const { data } = await supabase
              .from("chat_groups")
              .select("name, description, join_policy")
              .eq("id", active.groupId)
              .maybeSingle();
            if (data) {
              setGroupSettingsName((data as { name?: string }).name ?? active.name ?? "");
              setGroupSettingsDesc((data as { description?: string }).description ?? "");
              setGroupSettingsJoinPolicy((data as { join_policy?: string }).join_policy ?? "invite");
            }
          } catch {
            /* keep defaults */
          }
          try {
            const reqs = await loadJoinRequests(active.groupId);
            setJoinRequests(reqs);
          } catch {
            setJoinRequests([]);
          }
        })();
      }
    }
  }, [groupSettingsOpen, active]);

  async function sendText() {
    const body = draft.trim();
    if (!body || !target) return;
    if (editingId) {
      try {
        await editMessage(target.kind, editingId, body);
        setEditingId(null);
        setDraft("");
        await thread.refresh();
      } catch (err) {
        setUploadError(chatErrorMessage(err, "Could not edit the message."));
      }
      return;
    }
    setDraft("");
    setUploadError(null);
    const ok = await thread.send({ body, reply_to: replyTo?.id ?? null });
    if (!ok) setDraft(body);
    else {
      setReplyTo(null);
      setTick((t) => t + 1);
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    const match = value.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
    if (meId && active) {
      const key = active.kind === "dm" ? `dm:${active.peerId}` : `group:${active.groupId}`;
      void saveDraft(meId, key, value);
    }
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
          <div className="px-2 py-1.5">
            <Input placeholder="Search conversations…" value={convSearch} onChange={(e) => setConvSearch(e.target.value)} className="h-8 text-xs" />
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
            {conversations
              .filter((conv) =>
                convSearch.trim()
                  ? conv.name.toLowerCase().includes(convSearch.trim().toLowerCase()) ||
                    (conv.lastBody ?? "").toLowerCase().includes(convSearch.trim().toLowerCase())
                  : true,
              )
              .map((conv) => (
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
              <UserAvatar user={{ name: active.name, avatarUrl: active.avatarUrl }} className="h-8 w-8 text-[11px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{active.name}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  {active.kind === "group"
                    ? (
                      <>
                        <button type="button" onClick={() => setGroupMembersOpen(true)} className="font-medium text-slate-700 hover:underline">
                          {active.memberCount ?? 0} member{(active.memberCount ?? 0) === 1 ? "" : "s"}
                        </button>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {(() => {
                            const ids = active.memberIds ?? [];
                            const online = ids.filter((id) => state.users.find((u) => u.id === id)?.isOnline).length;
                            return `${online} online`;
                          })()}
                        </span>
                      </>
                    )
                    : (() => {
                        const peer = people.find((p) => p.id === active.peerId);
                        if (peer?.isOnline) return "Online";
                        if (peer?.lastSeenAt)
                          return `Last seen ${new Date(peer.lastSeenAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
                        return displayRole(active.role) || "Direct message";
                      })()}
                </p>
              </div>
              <LanguageSwitcher className="ml-auto" />
              {active.kind === "group" && (
                <>
                  <button type="button" onClick={() => setGroupSettingsOpen(true)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                    Settings
                  </button>
                </>
              )}
            </div>

            {thread.messages.some((m) => m.pinned_at) && (
              <div className="border-b border-slate-100 bg-amber-50 px-3 py-2">
                <p className="mb-1 text-[11px] font-semibold text-amber-700">Pinned</p>
                <div className="space-y-1">
                  {thread.messages
                    .filter((m) => m.pinned_at)
                    .map((m) => (
                      <p key={m.id} className="truncate text-xs text-slate-700">
                        {m.deleted_at ? "(deleted)" : m.body || "Attachment"}
                      </p>
                    ))}
                </div>
              </div>
            )}
            {polls.length > 0 && (
              <div className="space-y-2 border-b border-slate-100 bg-white p-3">
                {polls.map((poll) => {
                  const votes = pollVotes[poll.id] ?? [];
                  const total = votes.length;
                  const counts = poll.options.map((_, i) => votes.filter((v) => v.option_index === i).length);
                  const myVotes = votes.filter((v) => v.user_id === meId).map((v) => v.option_index);
                  const expired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
                  return (
                    <div key={poll.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">📊 {poll.question}</p>
                      {expired && <p className="text-[10px] text-rose-600">Closed</p>}
                      <div className="mt-2 space-y-1.5">
                        {poll.options.map((opt, i) => {
                          const count = counts[i] ?? 0;
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          const voted = myVotes.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={expired || pollVoting === poll.id}
                              onClick={async () => {
                                if (!meId || pollVoting === poll.id) return;
                                setPollVoting(poll.id);
                                try {
                                  await votePoll(poll.id, meId, i, poll.multiple);
                                  const fresh = await loadPollVotes(poll.id);
                                  setPollVotes((prev) => ({ ...prev, [poll.id]: fresh }));
                                } catch (err) {
                                  setUploadError(chatErrorMessage(err, "Could not vote."));
                                } finally {
                                  setPollVoting(null);
                                }
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-left text-xs",
                                voted ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                              )}
                            >
                              <span>{opt.text}</span>
                              <span className="text-slate-500">{count} ({pct}%)</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">{total} vote{total === 1 ? "" : "s"}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3" aria-live="polite" style={active?.backgroundUrl ? { backgroundImage: `url(${active.backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : undefined}>
              {thread.loading && thread.messages.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">Loading messages…</p>
              )}
              {!thread.loading && thread.messages.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">No messages yet. Say hello!</p>
              )}
              {thread.messages
                .filter((message) => !message.expires_at || new Date(message.expires_at) > new Date())
                .filter((message) => (starredOnly ? message.starred : true))
                .filter((message) =>
                  searchQuery.trim()
                    ? message.body.toLowerCase().includes(searchQuery.trim().toLowerCase())
                    : true,
                )
                .map((message) => (
                <Bubble
                  key={message.id}
                  mine={message.sender_id === meId}
                  message={message}
                  meId={meId}
                  messages={thread.messages}
                  onReply={(m) => {
                    setReplyTo(m);
                    setDraft("");
                  }}
                  onPin={async (m) => {
                    if (!meId || !target) return;
                    try {
                      await pinMessage(target.kind, m.id, meId, !m.pinned_at);
                      await thread.refresh();
                      setTick((t) => t + 1);
                    } catch (err) {
                      setUploadError(chatErrorMessage(err, "Could not pin the message."));
                    }
                  }}
                  onStar={async (m) => {
                    if (!target) return;
                    try {
                      await toggleStarred(target.kind, m.id, !m.starred);
                      await thread.refresh();
                      setTick((t) => t + 1);
                    } catch (err) {
                      setUploadError(chatErrorMessage(err, "Could not star the message."));
                    }
                  }}
                  onEdit={(m) => {
                    setEditingId(m.id);
                    setDraft(m.body);
                  }}
                  onDelete={async (m) => {
                    try {
                      await deleteMessage(target!.kind, m.id);
                      await thread.refresh();
                      setTick((t) => t + 1);
                    } catch (err) {
                      setUploadError(chatErrorMessage(err, "Could not delete the message."));
                    }
                  }}
                  onReact={async (m, emoji) => {
                    if (!meId) return;
                    const existing = m.reactions.find((r) => r.emoji === emoji);
                    const has = !!existing?.user_ids.includes(meId);
                    try {
                      await toggleReaction(m.id, target!.kind, meId, emoji, !has);
                      await thread.refresh();
                    } catch (err) {
                      setUploadError(chatErrorMessage(err, "Could not react."));
                    }
                  }}
                />
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
              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                  <span className="truncate">
                    Replying to: {replyTo.deleted_at ? "deleted message" : replyTo.body || "attachment"}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} className="ml-2 text-slate-500 hover:text-slate-800">
                    ✕
                  </button>
                </div>
              )}
              {editingId && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                  <span>Editing message</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setDraft("");
                    }}
                    className="ml-2 text-amber-500 hover:text-amber-800"
                  >
                    ✕
                  </button>
                </div>
              )}
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
              {mentionQuery !== null && people.length > 0 && (
                <div className="mb-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow">
                  {people
                    .filter((p) =>
                      (p.name ?? "")
                        .toLowerCase()
                        .includes(mentionQuery.toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100"
                        onClick={() => {
                          const name = (p.name ?? "").replace(/\s+/g, "");
                          const newDraft = draft.replace(/@(\w*)$/, `@${name} `);
                          onDraftChange(newDraft);
                          setMentionQuery(null);
                        }}
                      >
                        @{p.name}
                      </button>
                    ))}
                </div>
              )}
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {pendingPreviewUrl && pendingFile.type.startsWith("image/") ? (
                    <img src={pendingPreviewUrl} alt="preview" className="h-16 w-16 rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-200 text-slate-500">
                      <FileIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-xs text-slate-700">
                    <p className="truncate font-medium">{pendingFile.name}</p>
                    <p className="text-slate-400">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setPendingFile(null); if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl); setPendingPreviewUrl(null); }}>
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={uploading} onClick={() => { if (pendingFile) { void sendAttachment(pendingFile); setPendingFile(null); if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl); setPendingPreviewUrl(null); } }}>
                    {uploading ? "Sending…" : "Send"}
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="relative">
                  <Button type="button" variant="ghost" size="sm" aria-label="Emoji" onClick={() => setEmojiOpen((v) => !v)}>
                    <Smile className="h-4 w-4" />
                  </Button>
                  {emojiOpen && (
                    <div className="absolute bottom-12 left-0 z-20 grid max-h-48 w-64 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      {"😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤔 🤫 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 😞 😓 😩 😫 😤 😠 😡 🤬 😢 😭 😟 😦 😧 😮 😯 😲 😳 🥺 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😠 😡 🤬 👍 👎 👏 🙌 🙏 💪 🫶 ❤️ 🔥 ⭐ ✨ 🎉 🎊 🎁 🎂 🎈 🎆 🎇 🌟 💡 📌 📎 📝 ✅ ❌ ⚠️ ℹ️ 📷 📹 🎤 🎧 📞 💬 📧 📨 📩 📤 📥 📦 📁 📂 🗂️ 📋 📊 📈 📉 🧾 💰 💵 💳 🏦 🛒 🛍️ 🚗 🚕 🚌 🚆 ✈️ 🚢 🏠 🏫 🏥 🏦 🏪 🌍 🌎 🌏 🌅 🌄 🌆 🌇 🌙 ⭐ ☀️ ⛅ 🌧️ 🌦️ 🌨️ ⚡ 🌪️ 🌈 🍎 🍌 🍊 🍋 🍉 🍇 🍓 🍒 🍑 🥭 🥑 🍅 🥕 🥦 🌽 🥒 🥬 🥔 🍞 🥐 🥖 🧀 🍗 🍖 🍤 🍣 🍜 🍝 🍕 🍔 🌭 🌮 🌯 🥙 🥘 🥗 🍲 🍛 🍱 🍚 🍠 🍢 🍡 🍥 🍮 🍧 🍨 🍦 🍰 🥧 🍪 🍫 🍬 🍭 🍩 🍿 🥂 🍾 🍷 🍸 🍹 🍺 🍻 ☕ 🍵 🥤 🥛 🍼".split(/\s+/).map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="rounded p-1 text-base hover:bg-slate-100"
                          onClick={() => {
                            onDraftChange(draft + emoji);
                            setEmojiOpen(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  if (file) {
                    setPendingFile(file);
                    setPendingPreviewUrl(URL.createObjectURL(file));
                  }
                }}
              />
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    setPendingFile(file);
                    setPendingPreviewUrl(URL.createObjectURL(file));
                  }
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
                  className="px-2 py-1"
                  onClick={() => setPollOpen(true)}
                  aria-label="Create poll"
                >
                  Poll
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
      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Group name</Label>
              <Input className="mt-1" value={groupSettingsName} onChange={(e) => setGroupSettingsName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input className="mt-1" value={groupSettingsDesc} onChange={(e) => setGroupSettingsDesc(e.target.value)} />
            </div>
            <div>
              <Label>Join policy</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={groupSettingsJoinPolicy}
                onChange={(e) => setGroupSettingsJoinPolicy(e.target.value)}
              >
                <option value="invite">Invite only</option>
                <option value="request">Request to join</option>
                <option value="open">Open</option>
              </select>
            </div>
            <div>
              <Label>Group photo</Label>
              <label className="mt-1 inline-block cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !active?.groupId) return;
                    try {
                      await uploadGroupPhoto(active.groupId, file);
                      setTick((t) => t + 1);
                    } catch (err) {
                      setUploadError(chatErrorMessage(err, "Could not upload group photo."));
                    }
                  }}
                />
              </label>
            </div>
            <div>
              <Label>Chat background image</Label>
              <label className="mt-1 inline-block cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Upload background
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !active?.groupId) return;
                    try {
                      await uploadGroupBackground(active.groupId, file);
                      setTick((t) => t + 1);
                    } catch (err) {
                      setUploadError(chatErrorMessage(err, "Could not upload background."));
                    }
                  }}
                />
              </label>
            </div>
            <div>
              <Label>Invite a member</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                defaultValue=""
                onChange={async (e) => {
                  const inviteeId = e.target.value;
                  if (!inviteeId || !active?.groupId || !meId) return;
                  try {
                    await sendGroupInvite(active.groupId, meId, inviteeId);
                    setUploadError(null);
                  } catch (err) {
                    setUploadError(chatErrorMessage(err, "Could not send invite."));
                  }
                  e.target.value = "";
                }}
              >
                <option value="">Select member…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {active?.groupId && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (!meId || !active.groupId) return;
                  try {
                    await requestJoinGroup(active.groupId, meId, "Requesting to join");
                  } catch (err) {
                    setUploadError(chatErrorMessage(err, "Could not request."));
                  }
                }}
              >
                Request to join (demo)
              </Button>
            )}
            {joinRequests.length > 0 && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-600">Pending join requests</p>
                {joinRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">{req.user_id}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!active?.groupId) return;
                        try {
                          await approveJoinRequest(req.id, active.groupId, req.user_id);
                          setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
                          setTick((t) => t + 1);
                        } catch (err) {
                          setUploadError(chatErrorMessage(err, "Could not approve."));
                        }
                      }}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try {
                          await rejectJoinRequest(req.id);
                          setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
                        } catch (err) {
                          setUploadError(chatErrorMessage(err, "Could not reject."));
                        }
                      }}>Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                disabled={groupSettingsSaving}
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={async () => {
                  if (!active?.groupId) return;
                  setGroupSettingsSaving(true);
                  try {
                    await renameChatGroup(active.groupId, groupSettingsName, groupSettingsDesc);
                    await updateGroupPermissions(active.groupId, {}, groupSettingsJoinPolicy);
                    setUploadError(null);
                    setTick((t) => t + 1);
                  } catch (err) {
                    setUploadError(chatErrorMessage(err, "Could not save settings."));
                  } finally {
                    setGroupSettingsSaving(false);
                  }
                }}
              >
                {groupSettingsSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={groupMembersOpen} onOpenChange={setGroupMembersOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Group members</DialogTitle>
            <DialogDescription>People in this conversation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {(active?.memberIds ?? []).length === 0 && (
              <p className="py-4 text-center text-xs text-slate-500">No members listed.</p>
            )}
            {(active?.memberIds ?? []).map((id) => {
              const u = state.users.find((x) => x.id === id);
              return (
                <div key={id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                  <UserAvatar user={{ name: u?.name ?? "Member", avatarUrl: u?.avatarUrl }} className="h-8 w-8 text-[11px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{u?.name ?? id}</span>
                    <span className="block truncate text-[11px] text-slate-500">{u ? displayRole(u.role) : ""}</span>
                  </span>
                  {u?.isOnline && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Online" />}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create poll</DialogTitle>
          </DialogHeader>
          <PollForm
            meId={meId}
            groupId={active?.kind === "group" ? (active?.groupId ?? null) : null}
            dmThread={active?.kind === "dm" ? dmThreadKey : null}
            onCreated={() => { setPollOpen(false); setTick((t) => t + 1); }}
            onError={(msg) => setUploadError(msg)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PollForm({
  meId,
  groupId,
  dmThread,
  onCreated,
  onError,
}: {
  meId: string | null;
  groupId: string | null;
  dmThread: string | null;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1" />
      </div>
      <div className="space-y-2">
        <Label>Options</Label>
        {options.map((o, i) => (
          <Input
            key={i}
            value={o}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setOptions(next);
            }}
            placeholder={`Option ${i + 1}`}
            className="mt-1"
          />
        ))}
        <Button variant="ghost" size="sm" onClick={() => setOptions([...options, ""])}>
          Add option
        </Button>
      </div>
      <Button
        disabled={submitting || !meId || !question.trim() || options.filter((o) => o.trim()).length < 2}
        onClick={async () => {
          if (!meId) return;
          setSubmitting(true);
          try {
            await createPoll({
              groupId,
              dmThread,
              creatorId: meId,
              question: question.trim(),
              options: options.filter((o) => o.trim()),
            });
            onCreated();
          } catch (err) {
            onError(chatErrorMessage(err, "Could not create poll."));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        Create poll
      </Button>
    </div>
  );
}

export default ChatHub;
