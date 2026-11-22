import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Chat data layer: 1:1 messages (direct_messages) and group chat
 * (chat_groups / chat_group_members / group_messages), with attachments and
 * voice notes stored privately in the chat-attachments bucket.
 *
 * Rows are addressed by storage path, not public URL, so a signed URL is
 * minted only for the person allowed to read the file.
 */

export type ChatAttachmentType = "image" | "file" | "voice";

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
  body: string;
  attachment_path: string | null;
  attachment_type: ChatAttachmentType | null;
  attachment_name: string | null;
  duration_seconds: number | null;
  created_at: string;
  seen_at: string | null;
}

export interface ChatGroup {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  /** When the signed-in member last opened this group; drives the unread badge. */
  lastReadAt: string;
  memberIds: string[];
  ownerId: string;
  admins: string[];
}

export interface ChatConversation {
  key: string;
  kind: "dm" | "group";
  peerId?: string;
  groupId?: string;
  name: string;
  role?: string;
  lastBody: string;
  lastAt: string;
  unread: number;
  memberCount?: number;
  avatarUrl?: string;
}

type Row = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v));
const BUCKET = "chat-attachments";

function mapMessage(row: Row): ChatMessage {
  const type = str(row.attachment_type);
  return {
    id: str(row.id),
    sender_id: str(row.sender_id),
    receiver_id: row.receiver_id == null ? null : str(row.receiver_id),
    group_id: row.group_id == null ? null : str(row.group_id),
    body: str(row.body),
    attachment_path: row.attachment_path ? str(row.attachment_path) : null,
    attachment_type: type === "image" || type === "voice" || type === "file" ? type : null,
    attachment_name: row.attachment_name ? str(row.attachment_name) : null,
    duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    created_at: str(row.created_at),
    seen_at: row.seen_at ? str(row.seen_at) : null,
  };
}

function sortMessages(rows: ChatMessage[]) {
  return [...rows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function mergeMessage(rows: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map(rows.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...(map.get(m.id) ?? {}), ...m });
  return sortMessages([...map.values()]);
}

export const chatErrorMessage = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/row-level security|permission denied/i.test(message)) {
    return "You do not have permission for this conversation.";
  }
  if (/bucket|not found/i.test(message)) {
    return "Chat storage is not available yet. Ask an administrator to apply the latest database migration.";
  }
  return message || fallback;
};

// ── Reads ─────────────────────────────────────────────────────────────────

export async function loadDirectMessages(meId: string, peerId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${meId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${meId})`,
    )
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return sortMessages(((data ?? []) as Row[]).map(mapMessage));
}

export async function loadGroupMessages(groupId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return sortMessages(((data ?? []) as Row[]).map(mapMessage));
}

export async function loadMyGroups(meId: string): Promise<ChatGroup[]> {
  const { data: mine, error } = await supabase
    .from("chat_group_members")
    .select("group_id,member_role,last_read_at")
    .eq("user_id", meId);
  if (error) throw error;
  const ids = ((mine ?? []) as Row[]).map((r) => str(r.group_id)).filter(Boolean);
  if (ids.length === 0) return [];
  const lastReadByGroup = new Map(
    ((mine ?? []) as Row[]).map((r) => [str(r.group_id), str(r.last_read_at)]),
  );
  const [{ data: groups, error: groupError }, { data: members, error: memberError }] = await Promise.all([
    supabase.from("chat_groups").select("*").in("id", ids),
    supabase.from("chat_group_members").select("group_id,user_id,member_role").in("group_id", ids),
  ]);
  if (groupError) throw groupError;
  if (memberError) throw memberError;
  const memberRows = (members ?? []) as Row[];
  return ((groups ?? []) as Row[]).map((g) => {
    const groupMembers = memberRows.filter((m) => str(m.group_id) === str(g.id));
    return {
      id: str(g.id),
      name: str(g.name),
      description: str(g.description),
      created_by: str(g.created_by),
      created_at: str(g.created_at),
      lastReadAt: lastReadByGroup.get(str(g.id)) || str(g.created_at),
      memberIds: groupMembers.map((m) => str(m.user_id)),
      ownerId: groupMembers.find((m) => str(m.member_role) === "owner")?.user_id
        ? str(groupMembers.find((m) => str(m.member_role) === "owner")!.user_id)
        : str(g.created_by),
      admins: groupMembers.filter((m) => str(m.member_role) !== "member").map((m) => str(m.user_id)),
    };
  });
}

/** Latest direct messages involving me, for the conversation list. */
export async function loadDirectInbox(meId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as Row[];
}

/** Latest message per group I belong to. */
export async function loadGroupInbox(groupIds: string[]): Promise<Row[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as Row[];
}

// ── Writes ────────────────────────────────────────────────────────────────

export interface OutgoingMessage {
  body?: string;
  attachment_path?: string | null;
  attachment_type?: ChatAttachmentType | null;
  attachment_name?: string | null;
  duration_seconds?: number | null;
}

export async function sendDirectMessage(
  meId: string,
  peerId: string,
  payload: OutgoingMessage,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      sender_id: meId,
      receiver_id: peerId,
      body: payload.body?.slice(0, 2000) ?? "",
      attachment_path: payload.attachment_path ?? null,
      attachment_type: payload.attachment_type ?? null,
      attachment_name: payload.attachment_name ?? null,
      duration_seconds: payload.duration_seconds ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapMessage(data as Row);
}

export async function sendGroupMessage(
  meId: string,
  groupId: string,
  payload: OutgoingMessage,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      sender_id: meId,
      group_id: groupId,
      body: payload.body?.slice(0, 2000) ?? "",
      attachment_path: payload.attachment_path ?? null,
      attachment_type: payload.attachment_type ?? null,
      attachment_name: payload.attachment_name ?? null,
      duration_seconds: payload.duration_seconds ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapMessage(data as Row);
}

export async function markDirectSeen(meId: string, peerId: string) {
  const { error } = await supabase
    .from("direct_messages")
    .update({ seen_at: new Date().toISOString() })
    .eq("receiver_id", meId)
    .eq("sender_id", peerId)
    .is("seen_at", null);
  if (error) throw error;
}

export async function markGroupRead(groupId: string, meId: string) {
  const { error } = await supabase
    .from("chat_group_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", meId);
  if (error) throw error;
}

export async function createChatGroup(input: {
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];
}): Promise<ChatGroup> {
  const name = input.name.trim();
  if (!name) throw new Error("Give the group a name.");
  const { data, error } = await supabase
    .from("chat_groups")
    .insert({
      name: name.slice(0, 80),
      description: input.description?.trim().slice(0, 500) ?? "",
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  const group = data as Row;
  const unique = Array.from(new Set([input.createdBy, ...input.memberIds]));
  const rollback = async () => {
    await supabase.from("chat_groups").delete().eq("id", str(group.id));
  };
  // Insert the owner row first: the chat_group_members policy authorises the
  // other rows through is_chat_group_admin(), which is STABLE and therefore
  // cannot see membership rows written by the same multi-row INSERT.
  const { error: ownerError } = await supabase.from("chat_group_members").insert({
    group_id: str(group.id),
    user_id: input.createdBy,
    member_role: "owner",
  });
  if (ownerError) {
    await rollback();
    throw ownerError;
  }
  const others = unique.filter((id) => id !== input.createdBy);
  if (others.length > 0) {
    const { error: memberError } = await supabase.from("chat_group_members").insert(
      others.map((id) => ({
        group_id: str(group.id),
        user_id: id,
        member_role: "member",
      })),
    );
    if (memberError) {
      await rollback();
      throw memberError;
    }
  }
  return {
    id: str(group.id),
    name: str(group.name),
    description: str(group.description),
    created_by: str(group.created_by),
    created_at: str(group.created_at),
    lastReadAt: str(group.created_at),
    memberIds: unique,
    ownerId: input.createdBy,
    admins: [input.createdBy],
  };
}

export async function addGroupMembers(groupId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("chat_group_members").upsert(
    userIds.map((id) => ({ group_id: groupId, user_id: id, member_role: "member" })),
    { onConflict: "group_id,user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function leaveChatGroup(groupId: string, meId: string) {
  const { error } = await supabase
    .from("chat_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", meId);
  if (error) throw error;
}

export async function renameChatGroup(groupId: string, name: string, description: string) {
  const { error } = await supabase
    .from("chat_groups")
    .update({ name: name.trim().slice(0, 80), description: description.trim().slice(0, 500) })
    .eq("id", groupId);
  if (error) throw error;
}

// ── Attachments ───────────────────────────────────────────────────────────

export async function uploadChatFile(input: {
  meId: string;
  peerId?: string;
  groupId?: string;
  file: Blob;
  fileName: string;
  type: ChatAttachmentType;
}): Promise<{ path: string; name: string }> {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "attachment";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const folder = input.groupId ? `group/${input.groupId}` : `dm/${input.meId}/${input.peerId}`;
  const path = `${folder}/${unique}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file instanceof File ? input.file.type || undefined : undefined,
  });
  if (error) throw error;
  return { path, name: safeName };
}

export function attachmentTypeFor(file: File): ChatAttachmentType {
  if (file.type.startsWith("audio/")) return "voice";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}

/** Signed URL for a private attachment, refreshed before it expires. */
export function useSignedUrl(path: string | null, seconds = 3600) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
        if (!cancelled && !error) setUrl(data?.signedUrl ?? null);
      } catch {
        /* leave null and show a fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, seconds]);
  return url;
}

export function formatVoiceTime(seconds: number | null | undefined) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// ── Voice recording ───────────────────────────────────────────────────────

function preferredMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const resolveStop = useRef<((value: { blob: Blob; seconds: number; mime: string } | null) => void) | null>(null);
  const secondsRef = useRef(0);

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
    chunks.current = [];
    setRecording(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot record voice notes. Try Chrome, Edge, Firefox or Safari on a phone.");
      return false;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const mime = preferredMimeType();
      const rec = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        const result =
          blob.size > 0 ? { blob, seconds: secondsRef.current, mime: rec.mimeType || mime || "audio/webm" } : null;
        resolveStop.current?.(result);
        resolveStop.current = null;
        cleanup();
      };
      secondsRef.current = 0;
      setSeconds(0);
      rec.start();
      setRecording(true);
      timer.current = window.setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
      return true;
    } catch (err) {
      setError("Microphone access was blocked. Allow it in the browser, then try again.");
      cleanup();
      void err;
      return false;
    }
  }, [cleanup]);

  const stop = useCallback(async () => {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") {
      cleanup();
      return null;
    }
    const result = new Promise<{ blob: Blob; seconds: number; mime: string } | null>((resolve) => {
      resolveStop.current = resolve;
    });
    rec.stop();
    return result;
  }, [cleanup]);

  const cancel = useCallback(() => {
    resolveStop.current?.(null);
    resolveStop.current = null;
    try {
      recorder.current?.stop();
    } catch {
      /* already stopped */
    }
    cleanup();
  }, [cleanup]);

  return { recording, seconds, error, start, stop, cancel };
}

// ── Thread hook ───────────────────────────────────────────────────────────

export interface ChatThreadTarget {
  kind: "dm" | "group";
  /** Peer profile id for a DM, group id for a group. */
  id: string;
}

export function useChatThread(meId: string | undefined, target: ChatThreadTarget | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const rowsRef = useRef<ChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const key = target ? `${target.kind}:${target.id}` : "";
  // Callers often build the target inline, so a fresh object arrives on every
  // render. Keep the latest one in a ref and depend on the stable string key,
  // otherwise refresh() changes identity and the thread refetches in a loop.
  const targetRef = useRef(target);
  targetRef.current = target;

  const apply = useCallback((rows: ChatMessage[]) => {
    rowsRef.current = sortMessages(rows);
    setMessages(rowsRef.current);
  }, []);

  const refresh = useCallback(async () => {
    const current = targetRef.current;
    if (!meId || !current) {
      apply([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows =
        current.kind === "dm"
          ? await loadDirectMessages(meId, current.id)
          : await loadGroupMessages(current.id);
      rowsRef.current = rows;
      setMessages(rows);
    } catch (err) {
      setError(chatErrorMessage(err, "This conversation could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [meId, apply]);

  useEffect(() => {
    void refresh();
  }, [refresh, key]);

  // Realtime inserts/updates for the open thread.
  useEffect(() => {
    const current = targetRef.current;
    if (!meId || !current) return;
    const table = current.kind === "dm" ? "direct_messages" : "group_messages";
    const ch = supabase
      .channel(`chat-thread:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (change) => {
          const row = mapMessage((change.new ?? change.old ?? {}) as Row);
          if (current.kind === "dm") {
            const mine =
              (row.sender_id === meId && row.receiver_id === current.id) ||
              (row.sender_id === current.id && row.receiver_id === meId);
            if (!mine) return;
          } else if (row.group_id !== current.id) {
            return;
          }
          if (change.eventType === "INSERT" || change.eventType === "UPDATE") {
            apply(mergeMessage(rowsRef.current, [row]));
          }
        },
      )
      .subscribe();

    const broadcast = supabase
      .channel(`chat-live:${key}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { from?: string })?.from !== meId) {
          setPeerTyping(true);
          window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => setPeerTyping(false), 2500);
        }
      })
      .subscribe();

    channelRef.current = broadcast;
    return () => {
      window.clearTimeout(typingTimer.current);
      setPeerTyping(false);
      try {
        void ch.unsubscribe();
      } catch {
        /* noop */
      }
      try {
        void broadcast.unsubscribe();
      } catch {
        /* noop */
      }
      channelRef.current = null;
    };
  }, [meId, key, apply]);

  const sendTyping = useCallback(() => {
    try {
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: meId } });
    } catch {
      /* noop */
    }
  }, [meId]);

  const send = useCallback(
    async (payload: OutgoingMessage) => {
      const current = targetRef.current;
      if (!meId || !current || sending) return false;
      if (!payload.body?.trim() && !payload.attachment_path) return false;
      setSending(true);
      setError(null);
      try {
        const row =
          current.kind === "dm"
            ? await sendDirectMessage(meId, current.id, payload)
            : await sendGroupMessage(meId, current.id, payload);
        apply(mergeMessage(rowsRef.current, [row]));
        return true;
      } catch (err) {
        setError(chatErrorMessage(err, "The message could not be sent."));
        return false;
      } finally {
        setSending(false);
      }
    },
    [meId, sending, apply],
  );

  const markSeen = useCallback(async () => {
    const current = targetRef.current;
    if (!meId || !current) return;
    try {
      if (current.kind === "dm") await markDirectSeen(meId, current.id);
      else await markGroupRead(current.id, meId);
    } catch {
      /* read receipts are best effort */
    }
  }, [meId]);

  return { messages, loading, error, sending, peerTyping, send, sendTyping, markSeen, refresh };
}

/** Aggregate the conversation list (DMs + groups) with unread counts. */
export function useConversations(
  meId: string | undefined,
  users: { id: string; name: string; role: string; avatarUrl?: string }[],
  tick: number,
  navigateToMessages = false,
) {
  const [dms, setDms] = useState<Row[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [groupRows, setGroupRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!meId) {
      setDms([]);
      setGroups([]);
      setGroupRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [direct, myGroups] = await Promise.all([loadDirectInbox(meId), loadMyGroups(meId)]);
      const rows = await loadGroupInbox(myGroups.map((g) => g.id));
      setDms(direct);
      setGroups(myGroups);
      setGroupRows(rows);
    } catch (err) {
      setError(chatErrorMessage(err, "Your conversations could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    void reload();
  }, [reload, tick, navigateToMessages]);

  const byId = new Map(users.map((u) => [u.id, u]));
  const direct = new Map<string, ChatConversation>();
  for (const row of dms) {
    const sender = str(row.sender_id);
    const receiver = str(row.receiver_id);
    const peerId = sender === meId ? receiver : sender;
    if (!peerId) continue;
    const user = byId.get(peerId);
    const unread = receiver === meId && !row.seen_at ? 1 : 0;
    const prev = direct.get(peerId);
    const body = str(row.body) || (str(row.attachment_type) === "voice" ? "Voice note" : str(row.attachment_type) === "image" ? "Photo" : "Attachment");
    if (!prev) {
      direct.set(peerId, {
        key: `dm:${peerId}`,
        kind: "dm",
        peerId,
        name: user?.name ?? "Portal member",
        role: user?.role,
        avatarUrl: user?.avatarUrl,
        lastBody: body,
        lastAt: str(row.created_at),
        unread,
      });
    } else {
      prev.unread += unread;
      if (str(row.created_at) >= prev.lastAt) {
        prev.lastBody = body;
        prev.lastAt = str(row.created_at);
      }
    }
  }
  const grouped = groups.map((group) => {
    const latest = groupRows.find((r) => str(r.group_id) === group.id);
    // Unread = messages from other members since this member last opened the
    // group, not every message the group has ever had.
    const readAt = +new Date(group.lastReadAt || group.created_at);
    const unread = groupRows.filter(
      (r) =>
        str(r.group_id) === group.id &&
        str(r.sender_id) !== meId &&
        +new Date(str(r.created_at)) > readAt,
    ).length;
    const body = latest
      ? str(latest.body) || (str(latest.attachment_type) === "voice" ? "Voice note" : str(latest.attachment_type) === "image" ? "Photo" : "Attachment")
      : group.description || "No messages yet";
    return {
      key: `group:${group.id}`,
      kind: "group" as const,
      groupId: group.id,
      name: group.name,
      lastBody: body,
      lastAt: latest ? str(latest.created_at) : group.created_at,
      unread,
      memberCount: group.memberIds.length,
    } satisfies ChatConversation;
  });

  return {
    conversations: [...direct.values(), ...grouped].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)),
    groups,
    loading,
    error,
    reload,
  };
}
