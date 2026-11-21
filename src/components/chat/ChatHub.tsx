import { useMemo, useState } from "react";
import { MessageCircle, Plus, Users, Image as ImageIcon, File, Mic, Send, ChevronLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useChatThread, useConversations, type ChatConversation } from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useVoiceRecorder, uploadChatFile, type ChatAttachmentType, chatErrorMessage, formatVoiceTime, useSignedUrl } from "@/lib/chat";
import { Check } from "lucide-react";
import UserProfileDialog from "./UserProfileDialog";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/types";

function ConversationRow({ conv, active, onClick, unreadCount }: { conv: ChatConversation; active: boolean; onClick: () => void; unreadCount?: number; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-emerald-50", active && "bg-emerald-100")}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-emerald-800 text-amber-400">{conv.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{conv.name}</span>
      {unreadCount ? <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span> : null}
    </button>
  );
}

function NewGroupDialog({ open, onClose, users, meId }: { open: boolean; onClose: () => void; users: User[]; meId: string; }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const me = meId;
  async function submit() {
    if (!name.trim()) { setError("The group needs a name."); return; }
    setSaving(true); setError(null);
    try {
      const ids = users.map((u) => u.id).filter((id) => selected.includes(id) || id === me);
      const { data: group } = await supabase.from("chat_groups").insert({ name: name.trim().slice(0, 80), created_by: me }).select("id").single();
      const members = users.filter((u) => selected.includes(u.id) || u.id === me);
      const { error: e2 } = await supabase.from("chat_group_members").insert(members.map((u) => ({ group_id: group!.id, user_id: u.id, member_role: u.id === me ? "owner" : "member" })));
      if (e2) throw e2;
      setCreated({ id: group!.id, name: name.trim() });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New group chat</DialogTitle><DialogDescription>Pick the people you want in the group. They receive a join invitation.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Label>Group name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project squad" />
          <Label>Description (optional)</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this group is for" />
          <Label>Members</Label><div className="max-h-[240px] overflow-y-auto space-y-1">{users.map((u) => <button key={u.id} type="button" onClick={() => setSelected((s) => s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id])} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition", selected.includes(u.id) && "bg-emerald-50")}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-800 text-[11px] font-bold text-amber-400">{u.name.split(" ").map((p) => p[0]).slice(0,2).join("").toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>{selected.includes(u.id) && <Check className="h-4 w-4 text-emerald-700" />}</button>)}</div>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
          <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create group"}</Button></DialogFooter>
          {created && <p className="text-xs text-emerald-700">{created.name} is live.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Bubble({ mine, body, time, attachment, seen }: { mine: boolean; body: string; time: string; attachment?: { type: "image" | "file" | "voice"; name: string; seconds: number | null; url: string | null }; seen?: boolean; }) {
  if (attachment?.type === "voice") {
    return (
      <div className={cn("flex gap-2 max-width-full", mine ? "justify-end" : "justify-start")}>
        <div className={cn("flex flex-col items-center gap-1 rounded-2xl px-3 py-2 shadow-sm", mine ? "bg-emerald-700" : "bg-white ring-1 ring-slate-200")}>
          <audio controls className="max-w-[260px]" src={attachment.url ?? undefined} />
          <p className={cn("text-[11px] text-right", mine ? "text-emerald-100" : "text-slate-400")}>{formatVoiceTime(attachment.seconds)}</p>
        </div>
        {!mine && attachment.url && <div className="flex flex-col items-center"><span className="text-[11px] text-slate-400">{attachment.name}</span></div>}
      </div>
    );
  }
  return (
    <div className={cn("flex gap-2 max-width-full", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 shadow-sm", mine ? "bg-emerald-700" : "bg-white ring-1 ring-slate-200")}>
        <p className={cn("text-sm", !mine && "text-slate-800")}>{body}</p>
        <p className={cn("text-[11px] mt-1 text-right", mine ? "text-emerald-100" : "text-slate-400")}>{time}</p>
      </div>
    </div>
  );
}

function ChatHub() {
  const { currentUser } = useApp();
  const meId = currentUser?.id ?? null;

  const { conversations } = useConversations(meId, [], 0);

  const [view, setView] = useState<"conversations" | "thread">("conversations");
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peer, setPeer] = useState<User | null>(null);
  const [threadUser, setThreadUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [audioFile, setAudioFile] = useState<{ blob: Blob; mime: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const threadTarget = useMemo(() => {
    if (!meId || !peer) return null;
    return { kind: "dm" as const, id: peer.id };
  }, [meId, peer]);

  // Load people list
  async function loadPeople() {
    if (!meId) return;
    try {
      const { data, error } = await supabase.from("users").select("id, name, email, role").neq("id", meId).order("name");
      if (!error && data) setUsers(data as User[]);
    } catch { /* ignore */ }
  }

  // Send a message (direct or group)
  async function sendMessage(text: string) {
    if (!meId || !text.trim() || !threadTarget) return;
    setSending(true);
    setError(null);
    try {
      const { sendDirectMessage, sendGroupMessage } = await import("@/lib/chat");
      const payload = { body: text.trim() };
      if (threadTarget.kind === "dm") {
        await sendDirectMessage(meId!, threadTarget.id, payload);
      } else {
        await sendGroupMessage(meId!, threadTarget.id, payload);
      }
      setActive({ key: threadTarget.id, kind: "dm", name: "", lastBody: "", lastAt: "", unread: 0 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  // Voice
  function startRecording() {
    setRecording(true); setRecordingError(null); setSeconds(0); setRecordingUrl(null);
  }
  function stopRecording() {
    setRecording(false);
  }
  function cancelRecording() {
    setRecording(false); setAudioFile(null); setRecordingUrl(null); setSeconds(0);
  }

  function attachVoice() {
    if (audioFile) {
      const blob = audioFile.blob;
      setAttaching(true);
      uploadChatFile({ meId: meId!, type: "voice" as const, file: new Blob([blob], { type: audioFile.mime }), fileName: `voice-${Date.now()}.webm` })
        .then(({ path }) => { setAudioFile(null); setRecordingUrl(path); setError(null); })
        .catch((err: unknown) => setError(chatErrorMessage(err, "Could not upload the voice note.")))
        .finally(() => setAttaching(false));
      setAudioFile(null);
    }
  }

  return (
    <div>
      <div className="flex h-full max-h-[calc(100dvh-4rem)] gap-3">
        {/* Conversation list */}
        <div className={cn("flex w-[320px] max-w-[80vw] flex-col border border-emerald-900/10 bg-white overflow-hidden", view === "conversations" ? "hidden md:flex" : "flex")}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <MessageCircle className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-slate-800">Messages</span>
          </div>
          <div className="p-1.5">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setGroupOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New group
            </Button>
            {conversations.map((c) => (
              <ConversationRow key={c.key} conv={c} active={active?.key === c.key} onClick={() => { setActive(c); setView("thread"); }} unreadCount={c.unread} />
            ))}
          </div>
        </div>

        {/* Thread / composer */}
        {view === "thread" && active && threadTarget ? (
          <div className="flex flex-1 flex-col border border-emerald-900/10 bg-slate-50 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => setView("conversations")}><ChevronLeft className="h-4 w-4" /></Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-800 text-amber-400">{active.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold text-slate-800">{active.name}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((m) => {
                const mine = m.sender_id === meId;
                const attachment = m.attachment_path ? { type: m.attachment_type ?? "file", name: m.attachment_name ?? "", seconds: m.duration_seconds, url: useSignedUrl(m.attachment_path) } : undefined;
                return <Bubble key={m.id} mine={mine} body={m.body} time={new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} attachment={attachment} seen={m.seen_at != null} />;
              })}
              {peerTyping && <p className="text-xs italic text-slate-400">Someone is typing…</p>}
              {!messages.length && <p className="py-8 text-center text-xs text-slate-400">No messages yet. Say hello!</p>}
            </div>
            <div className="border-t border-slate-100 p-3">
              <div className="flex gap-2">
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(draft); } }} placeholder="Message…" rows={1} className="max-h-[120px]" />
                <Button onClick={() => void sendMessage(draft)} disabled={sending}><Send className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 flex gap-1">
                <Button variant="ghost" size="sm" className="px-2 py-1"><ImageIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="px-2 py-1"><File className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => { if (recording) { attachVoice(); } else { startRecording(); } }} disabled={attaching}>
                  <Mic className={cn("h-4 w-4", recording ? "animate-pulse" : "h-4 w-4")} />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col border border-emerald-900/10 bg-slate-50 items-center justify-center text-slate-400">
            <MessageCircle className="h-10 w-10 mb-2" />
            <p className="text-sm">Select a conversation or create a group to start messaging.</p>
          </div>
        )}
      </div>

      <NewGroupDialog open={groupOpen} onClose={() => setGroupOpen(false)} users={users} meId={meId} />
    </div>
  );
}

export default ChatHub;
