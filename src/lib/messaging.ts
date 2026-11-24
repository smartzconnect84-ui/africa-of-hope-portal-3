import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { broadcastLive } from "@/lib/livePush";
import { conversationId, isUuidId } from "@/lib/directMessages";
import {
  attachmentTypeFor,
  formatVoiceTime,
  uploadChatFile,
  useSignedUrl,
  useVoiceRecorder,
  type ChatAttachmentType,
} from "@/lib/chat";
import {
  addGroupMembers,
  createChatGroup,
  leaveChatGroup,
  renameChatGroup,
  uploadGroupBackground,
  uploadGroupPhoto,
} from "@/lib/chat";
import type { User } from "@/types";

/**
 * Messaging data layer for the rebuilt chat workspace.
 *
 * Content lives in the tables the app already used — `direct_messages` and
 * `group_messages` — so every conversation already in the database or in a
 * browser's `aoh-dm:v1:` cache keeps its history. Attachments stay in the
 * private `chat-attachments` bucket and are addressed by storage path.
 *
 * The rich fields (reply, edit, delete, pin, star, reactions) are read from the
 * database when `20261125120000_messaging_rebuild.sql` has been applied. Until
 * then everything still works: the same fields are kept in the local thread
 * cache and mirrored over the realtime broadcast, so two open windows behave
 * identically either way.
 */

export type { ChatAttachmentType };
export { formatVoiceTime, useSignedUrl, useVoiceRecorder, attachmentTypeFor, uploadChatFile };
export { createChatGroup, addGroupMembers, leaveChatGroup, renameChatGroup, uploadGroupPhoto, uploadGroupBackground };

export type ThreadRef = { kind: "dm"; peerId: string } | { kind: "group"; groupId: string };

export interface Reaction {
  emoji: string;
  user_ids: string[];
}

export interface MessageAttachment {
  path: string;
  type: ChatAttachmentType;
  name: string;
  duration: number | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
  body: string;
  created_at: string;
  seen_at: string | null;
  attachment: MessageAttachment | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  pinned: boolean;
  starred: boolean;
  reactions: Reaction[];
  /** Optimistic local message that the server has not confirmed yet. */
  pending?: boolean;
}

export interface Conversation {
  key: string;
  kind: "dm" | "group";
  peerId?: string;
  groupId?: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  online?: boolean;
  lastBody: string;
  lastAt: string;
  unread: number;
  memberIds?: string[];
  memberCount?: number;
  ownerId?: string;
  lastReadAt?: string;
}

export interface MessagingCapabilities {
  /** Attachment columns exist on the message tables. */
  attachments: boolean;
  /** reply/edit/delete/pin/star columns exist. */
  rich: boolean;
  /** `message_reactions` is available. */
  reactions: boolean;
  /** Group chat tables are available. */
  groups: boolean;
}

type Row = Record<string, unknown>;

export const MESSAGE_LIMIT = 500;

export const str = (v: unknown) => (v == null ? "" : String(v));

export const chatErrorText = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/row-level security|permission denied/i.test(message)) {
    return "You do not have permission for this conversation.";
  }
  if (/bucket|not found/i.test(message)) {
    return "Chat storage is not available yet. Ask an administrator to apply the latest database migration.";
  }
  if (/relation .* does not exist|schema cache|column .* does not exist/i.test(message)) {
    return "Messaging storage is still being set up. Your messages are saved on this device meanwhile.";
  }
  return message || fallback;
};

// ── Capability probe ──────────────────────────────────────────────────────

let capsCache: MessagingCapabilities | null = null;
let capsInFlight: Promise<MessagingCapabilities> | null = null;

export function messagingCapabilities(force = false): Promise<MessagingCapabilities> {
  if (!force && capsCache) return Promise.resolve(capsCache);
  if (!force && capsInFlight) return capsInFlight;
  capsInFlight = (async () => {
    try {
      const [attachments, rich, reactions, groups] = await Promise.all([
        supabase.from("direct_messages").select("id,attachment_path").limit(1),
        supabase.from("direct_messages").select("id,reply_to,edited_at,deleted_at,pinned_at,starred").limit(1),
        supabase.from("message_reactions").select("id").limit(1),
        supabase.from("chat_groups").select("id").limit(1),
      ]);
      const next: MessagingCapabilities = {
        attachments: !attachments.error,
        rich: !rich.error,
        reactions: !reactions.error,
        groups: !groups.error,
      };
      // A probe only fails when the schema is missing; a blocked or offline
      // network must not disable the feature for the rest of the session.
      const offline = [attachments, rich, reactions, groups].some((r) =>
        /fetch|network|failed to send|timeout/i.test(String(r.error?.message ?? "")),
      );
      if (!offline) capsCache = next;
      return next;
    } catch {
      return { attachments: false, rich: false, reactions: false, groups: false };
    } finally {
      capsInFlight = null;
    }
  })();
  return capsInFlight;
}

// ── Thread keys and local cache ───────────────────────────────────────────

/** Same key the earlier DM dialog wrote, so both share one local history. */
export function dmCacheKey(meId: string, peerId: string) {
  return `aoh-dm:v1:${conversationId(meId, peerId)}`;
}

export function groupCacheKey(groupId: string) {
  return `aoh-msg:v1:group:${groupId}`;
}

export function threadCacheKey(meId: string, target: ThreadRef) {
  return target.kind === "dm" ? dmCacheKey(meId, target.peerId) : groupCacheKey(target.groupId);
}

/** Stable React key / UI identifier for a thread. */
export function threadKeyOf(target: ThreadRef) {
  return target.kind === "dm" ? `dm:${target.peerId}` : `group:${target.groupId}`;
}

export const DM_CACHE_PREFIX = "aoh-dm:v1:";
export const GROUP_CACHE_PREFIX = "aoh-msg:v1:group:";
const DRAFT_PREFIX = "aoh-msg-draft:v1:";
const LOCAL_LIMIT = 400;

export function normalizeMessage(raw: Row): Message {
  const type = str(raw.attachment_type);
  const attachment =
    raw.attachment_path && (type === "image" || type === "voice" || type === "file")
      ? {
          path: str(raw.attachment_path),
          type: type as ChatAttachmentType,
          name: str(raw.attachment_name) || "attachment",
          duration: raw.duration_seconds == null ? null : Number(raw.duration_seconds),
        }
      : null;
  return {
    id: str(raw.id),
    sender_id: str(raw.sender_id),
    receiver_id: raw.receiver_id == null ? null : str(raw.receiver_id),
    group_id: raw.group_id == null ? null : str(raw.group_id),
    body: str(raw.body),
    created_at: str(raw.created_at) || new Date().toISOString(),
    seen_at: raw.seen_at ? str(raw.seen_at) : null,
    attachment,
    reply_to: raw.reply_to ? str(raw.reply_to) : null,
    edited_at: raw.edited_at ? str(raw.edited_at) : null,
    deleted_at: raw.deleted_at ? str(raw.deleted_at) : null,
    pinned: raw.pinned_at != null ? true : false,
    starred: raw.starred === true,
    reactions: Array.isArray(raw.reactions) ? (raw.reactions as Reaction[]) : [],
    pending: raw.pending === true,
  };
}

const byCreatedAt = (a: Message, b: Message) => +new Date(a.created_at) - +new Date(b.created_at);

function sortMessages(rows: Message[]) {
  return [...rows].sort(byCreatedAt);
}

export function readLocalThread(key: string): Message[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortMessages(parsed.map((row) => normalizeMessage(row as Row)).filter((m) => m.id));
  } catch {
    return [];
  }
}

export function writeLocalThread(key: string, rows: Message[]) {
  try {
    localStorage.setItem(key, JSON.stringify(sortMessages(rows).slice(-LOCAL_LIMIT)));
  } catch {
    /* private mode — the database still holds the conversation */
  }
  try {
    window.dispatchEvent(new CustomEvent("aoh:dm-changed", { detail: { key } }));
  } catch {
    /* noop */
  }
}

function appendLocalThread(key: string, message: Message) {
  writeLocalThread(key, mergeInto(readLocalThread(key), [message]));
}

/** Merge rows by id, keeping the richest version of each message. */
export function mergeInto(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const next of incoming) {
    if (!next.id) continue;
    const prev = map.get(next.id);
    map.set(
      next.id,
      prev
        ? {
            ...prev,
            ...next,
            attachment: next.attachment ?? prev.attachment,
            reply_to: next.reply_to ?? prev.reply_to,
            edited_at: next.edited_at ?? prev.edited_at,
            deleted_at: next.deleted_at ?? prev.deleted_at,
            seen_at: next.seen_at ?? prev.seen_at,
            pinned: next.pinned || prev.pinned,
            starred: next.starred || prev.starred,
            reactions: next.reactions.length > 0 ? next.reactions : prev.reactions,
          }
        : next,
    );
  }
  return sortMessages([...map.values()]);
}

// ── Drafts ────────────────────────────────────────────────────────────────

export function saveDraft(meId: string, threadKey: string, body: string) {
  try {
    const key = `${DRAFT_PREFIX}${meId}:${threadKey}`;
    if (!body.trim()) localStorage.removeItem(key);
    else localStorage.setItem(key, body);
  } catch {
    /* drafts are a convenience */
  }
}

export function loadDraft(meId: string, threadKey: string) {
  try {
    return localStorage.getItem(`${DRAFT_PREFIX}${meId}:${threadKey}`) ?? "";
  } catch {
    return "";
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────

function messageColumns(caps: MessagingCapabilities, withGroup: boolean) {
  const cols = ["id", "sender_id", "body", "created_at"];
  cols.push(withGroup ? "group_id" : "receiver_id", withGroup ? "sender_id" : "sender_id");
  if (!withGroup) cols.push("seen_at");
  if (caps.attachments) cols.push("attachment_path", "attachment_type", "attachment_name", "duration_seconds");
  if (caps.rich) cols.push("reply_to", "edited_at", "deleted_at", "pinned_at", "starred");
  return Array.from(new Set(cols)).join(",");
}

async function fetchReactions(kind: "dm" | "group", ids: string[]): Promise<Record<string, Reaction[]>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id,emoji,user_id")
    .eq("message_kind", kind)
    .in("message_id", ids);
  if (error) return {};
  const out: Record<string, Reaction[]> = {};
  for (const row of (data ?? []) as Row[]) {
    const id = str(row.message_id);
    const emoji = str(row.emoji);
    if (!id || !emoji) continue;
    const bucket = (out[id] ??= []);
    const entry = bucket.find((r) => r.emoji === emoji);
    if (entry) entry.user_ids.push(str(row.user_id));
    else bucket.push({ emoji, user_ids: [str(row.user_id)] });
  }
  return out;
}

export async function fetchThread(meId: string, target: ThreadRef): Promise<Message[]> {
  const caps = await messagingCapabilities();
  if (target.kind === "dm") {
    if (!isUuidId(meId) || !isUuidId(target.peerId)) return [];
    const { data, error } = await supabase
      .from("direct_messages")
      .select(messageColumns(caps, false))
      .or(
        `and(sender_id.eq.${meId},receiver_id.eq.${target.peerId}),and(sender_id.eq.${target.peerId},receiver_id.eq.${meId})`,
      )
      .order("created_at", { ascending: true })
      .limit(MESSAGE_LIMIT);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as Row[]).map((row) =>
      normalizeMessage({ ...row, receiver_id: row.sender_id === meId ? target.peerId : meId }),
    );
    if (caps.reactions) {
      const reactions = await fetchReactions("dm", rows.map((m) => m.id));
      rows.forEach((m) => {
        m.reactions = reactions[m.id] ?? [];
      });
    }
    return rows;
  }

  if (!caps.groups) return [];
  const { data, error } = await supabase
    .from("group_messages")
    .select(messageColumns(caps, true))
    .eq("group_id", target.groupId)
    .order("created_at", { ascending: true })
    .limit(MESSAGE_LIMIT);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Row[]).map((row) => normalizeMessage({ ...row, group_id: target.groupId }));
  if (caps.reactions) {
    const reactions = await fetchReactions("group", rows.map((m) => m.id));
    rows.forEach((m) => {
      m.reactions = reactions[m.id] ?? [];
    });
  }
  return rows;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  ownerId: string;
  memberIds: string[];
}

export async function fetchMyGroups(meId: string): Promise<GroupSummary[]> {
  const caps = await messagingCapabilities();
  if (!caps.groups || !isUuidId(meId)) return [];
  const { data: mine, error } = await supabase
    .from("chat_group_members")
    .select("group_id,member_role")
    .eq("user_id", meId);
  if (error) return [];
  const ids = ((mine ?? []) as Row[]).map((row) => str(row.group_id)).filter(Boolean);
  if (ids.length === 0) return [];
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("chat_groups").select("id,name,description,avatar_url,background_url,created_by").in("id", ids),
    supabase.from("chat_group_members").select("group_id,user_id,member_role").in("group_id", ids),
  ]);
  const memberRows = (members ?? []) as Row[];
  return ((groups ?? []) as Row[]).map((group) => {
    const rows = memberRows.filter((row) => str(row.group_id) === str(group.id));
    return {
      id: str(group.id),
      name: str(group.name),
      description: str(group.description),
      avatarUrl: group.avatar_url ? str(group.avatar_url) : null,
      backgroundUrl: group.background_url ? str(group.background_url) : null,
      ownerId: rows.find((row) => str(row.member_role) === "owner")?.user_id
        ? str(rows.find((row) => str(row.member_role) === "owner")!.user_id)
        : str(group.created_by),
      memberIds: rows.map((row) => str(row.user_id)),
    };
  });
}

export async function fetchGroupMembers(groupId: string): Promise<{ userId: string; role: string }[]> {
  const { data, error } = await supabase
    .from("chat_group_members")
    .select("user_id,member_role")
    .eq("group_id", groupId);
  if (error) return [];
  return ((data ?? []) as Row[]).map((row) => ({ userId: str(row.user_id), role: str(row.member_role) }));
}

// ── Writes ────────────────────────────────────────────────────────────────

export interface OutgoingMessage {
  body?: string;
  attachment?: MessageAttachment | null;
  replyTo?: string | null;
}

interface InsertResult {
  id: string;
  created_at: string;
  seen_at: string | null;
}

async function insertMessage(
  meId: string,
  target: ThreadRef,
  payload: OutgoingMessage,
  caps: MessagingCapabilities,
): Promise<InsertResult | null> {
  const body = (payload.body ?? "").slice(0, 4000);
  if (!body.trim() && !payload.attachment) return null;
  const record: Row = { sender_id: meId, body };
  if (target.kind === "dm") record.receiver_id = target.peerId;
  else record.group_id = target.groupId;
  if (caps.attachments && payload.attachment) {
    record.attachment_path = payload.attachment.path;
    record.attachment_type = payload.attachment.type;
    record.attachment_name = payload.attachment.name;
    record.duration_seconds = payload.attachment.duration;
  }
  if (caps.rich && payload.replyTo) record.reply_to = payload.replyTo;

  const table = target.kind === "dm" ? "direct_messages" : "group_messages";
  const columns = ["id", "created_at", ...(target.kind === "dm" ? ["seen_at"] : [])].join(",");
  const { data, error } = await supabase.from(table).insert(record).select(columns).single();
  if (error) throw error;
  const row = (data ?? {}) as Row;
  return { id: str(row.id), created_at: str(row.created_at), seen_at: row.seen_at ? str(row.seen_at) : null };
}

export async function renameGroup(groupId: string, name: string) {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error("The group needs a name.");
  const { error } = await supabase.from("chat_groups").update({ name: trimmed }).eq("id", groupId);
  if (error) throw error;
}

/** Send without a mounted thread (used for forwarding from another chat). */
export async function sendToThread(meId: string, target: ThreadRef, payload: OutgoingMessage): Promise<boolean> {
  const caps = await messagingCapabilities();
  const key = threadCacheKey(meId, target);
  const optimistic = optimisticFrom(meId, target, payload);
  appendLocalThread(key, optimistic);
  try {
    const saved = await insertMessage(meId, target, payload, caps);
    if (!saved) return false;
    writeLocalThread(key, mergeInto(readLocalThread(key).filter((m) => m.id !== optimistic.id), [
      { ...optimistic, id: saved.id, created_at: saved.created_at, pending: false, seen_at: saved.seen_at },
    ]));
    if (target.kind === "dm") {
      await broadcastLive({
        kind: "dm",
        to: target.peerId,
        from: meId,
        title: "New message",
        body: (payload.body || previewLabel(optimistic)).slice(0, 120),
      }).catch(() => undefined);
    }
    return true;
  } catch {
    writeLocalThread(key, readLocalThread(key).map((m) => (m.id === optimistic.id ? { ...m, pending: true } : m)));
    return false;
  }
}

function optimisticFrom(meId: string, target: ThreadRef, payload: OutgoingMessage): Message {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`,
    sender_id: meId,
    receiver_id: target.kind === "dm" ? target.peerId : null,
    group_id: target.kind === "group" ? target.groupId : null,
    body: (payload.body ?? "").slice(0, 4000),
    created_at: new Date().toISOString(),
    seen_at: null,
    attachment: payload.attachment ?? null,
    reply_to: payload.replyTo ?? null,
    edited_at: null,
    deleted_at: null,
    pinned: false,
    starred: false,
    reactions: [],
    pending: true,
  };
}

const PREVIEW: Record<string, string> = {
  image: "Photo",
  voice: "Voice note",
  file: "Document",
};

export function previewLabel(message: Message | null | undefined): string {
  if (!message) return "";
  if (message.deleted_at) return "This message was deleted";
  if (message.body.trim()) return message.body;
  return message.attachment ? PREVIEW[message.attachment.type] ?? "Attachment" : "";
}

/** Realtime channel name — the 1:1 one matches the directory quick-reply dialog. */
function channelName(meId: string, target: ThreadRef) {
  return target.kind === "dm"
    ? `dm:${conversationId(meId, target.peerId)}`
    : `group:${target.groupId}`;
}

// ── Thread hook ───────────────────────────────────────────────────────────

export function useMessageThread(meId: string | undefined, target: ThreadRef | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const targetRef = useRef(target);
  targetRef.current = target;
  const rowsRef = useRef<Message[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const key = meId && target ? threadCacheKey(meId, target) : "";

  const commit = useCallback(
    (rows: Message[]) => {
      const sorted = sortMessages(rows);
      rowsRef.current = sorted;
      setMessages(sorted);
      if (key) writeLocalThread(key, sorted);
    },
    [key],
  );

  const refresh = useCallback(async () => {
    const current = targetRef.current;
    if (!meId || !current) {
      rowsRef.current = [];
      setMessages([]);
      return;
    }
    const cache = threadCacheKey(meId, current);
    const local = readLocalThread(cache);
    rowsRef.current = local;
    setMessages(local);
    setLoading(local.length === 0);
    setError(null);
    try {
      const remote = await fetchThread(meId, current);
      if (!targetRef.current || threadCacheKey(meId, targetRef.current) !== cache) return;
      const merged = mergeInto(readLocalThread(cache), remote);
      rowsRef.current = merged;
      setMessages(merged);
      writeLocalThread(cache, merged);
    } catch (err) {
      setError(chatErrorText(err, "This conversation could not be loaded. Messages saved on this device are shown."));
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, key]);

  // Realtime: broadcast for instant delivery on any id shape, postgres for
  // durable convergence when the thread lives in the database.
  useEffect(() => {
    const current = targetRef.current;
    if (!meId || !current) return;
    const cache = threadCacheKey(meId, current);
    let active = true;

    const channel = supabase.channel(channelName(meId, current), { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    const adopt = (incoming: Message) => {
      const merged = mergeInto(rowsRef.current, [incoming]);
      rowsRef.current = merged;
      setMessages(merged);
      writeLocalThread(cache, merged);
    };

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const incoming = normalizeMessage((payload ?? {}) as Row);
        if (!incoming.id) return;
        if (incoming.sender_id === meId) return;
        if (current.kind === "dm") {
          const forMe =
            (incoming.sender_id === current.peerId && incoming.receiver_id === meId) ||
            (incoming.sender_id === current.peerId && !incoming.receiver_id);
          if (!forMe) return;
          adopt({ ...incoming, receiver_id: meId });
        } else {
          if (incoming.group_id && incoming.group_id !== current.groupId) return;
          adopt({ ...incoming, group_id: current.groupId });
        }
      })
      .on("broadcast", { event: "seen" }, ({ payload }) => {
        const ids = new Set(((payload as { ids?: string[] })?.ids ?? []).map(String));
        if (ids.size === 0) return;
        const stamp = new Date().toISOString();
        const next = rowsRef.current.map((m) => (ids.has(m.id) && !m.seen_at ? { ...m, seen_at: stamp } : m));
        rowsRef.current = next;
        setMessages(next);
        writeLocalThread(cache, next);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const from = (payload as { from?: string })?.from;
        if (!from || from === meId) return;
        setPeerTyping(true);
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setPeerTyping(false), 2600);
      })
      .on("broadcast", { event: "meta" }, ({ payload }) => {
        const patch = payload as { id?: string; message?: Row };
        if (!patch?.id || !patch.message) return;
        const next = rowsRef.current.map((m) =>
          m.id === patch.id ? { ...m, ...normalizeMessage({ ...m, ...patch.message }) } : m,
        );
        rowsRef.current = next;
        setMessages(next);
        writeLocalThread(cache, next);
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const data = payload as { id?: string; reactions?: Reaction[] };
        if (!data?.id || !Array.isArray(data.reactions)) return;
        const next = rowsRef.current.map((m) => (m.id === data.id ? { ...m, reactions: data.reactions! } : m));
        rowsRef.current = next;
        setMessages(next);
        writeLocalThread(cache, next);
      })
      .subscribe();

    const table = current.kind === "dm" ? "direct_messages" : "group_messages";
    const postgres = supabase
      .channel(`msg-live:${cache}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (change) => {
        if (!active) return;
        const row = (change.new ?? change.old ?? {}) as Row;
        if (current.kind === "dm") {
          const mine =
            (str(row.sender_id) === meId && str(row.receiver_id) === current.peerId) ||
            (str(row.sender_id) === current.peerId && str(row.receiver_id) === meId);
          if (!mine) return;
        } else if (str(row.group_id) !== current.groupId) {
          return;
        }
        const incoming = normalizeMessage({
          ...row,
          receiver_id: current.kind === "dm" ? (str(row.sender_id) === meId ? current.peerId : meId) : null,
        });
        if (!incoming.id) return;
        adopt({ ...incoming, pending: false });
      })
      .subscribe();

    const onLocalWrite = (event: Event) => {
      try {
        if ((event as CustomEvent).detail?.key !== cache) return;
      } catch {
        return;
      }
      // The directory quick-reply dialog wrote to the same cache.
      const fresh = readLocalThread(cache);
      if (fresh.length !== rowsRef.current.length) {
        rowsRef.current = fresh;
        setMessages(fresh);
      }
    };
    window.addEventListener("aoh:dm-changed", onLocalWrite);

    return () => {
      active = false;
      window.removeEventListener("aoh:dm-changed", onLocalWrite);
      window.clearTimeout(typingTimer.current);
      setPeerTyping(false);
      try {
        void channel.unsubscribe();
      } catch {
        /* noop */
      }
      try {
        void postgres.unsubscribe();
      } catch {
        /* noop */
      }
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, key]);

  const sendTyping = useCallback(() => {
    try {
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: meId } });
    } catch {
      /* typing is best effort */
    }
  }, [meId]);

  const send = useCallback(
    async (payload: OutgoingMessage): Promise<boolean> => {
      const current = targetRef.current;
      if (!meId || !current || sending) return false;
      const body = (payload.body ?? "").trim();
      if (!body && !payload.attachment) return false;
      setSending(true);
      setError(null);
      const cache = threadCacheKey(meId, current);
      const optimistic = optimisticFrom(meId, current, { ...payload, body: body.slice(0, 4000) });
      const merged = mergeInto(rowsRef.current, [optimistic]);
      rowsRef.current = merged;
      setMessages(merged);
      writeLocalThread(cache, merged);
      try {
        void channelRef.current?.send({ type: "broadcast", event: "message", payload: optimistic });
      } catch {
        /* durable insert below still delivers */
      }
      try {
        const caps = await messagingCapabilities();
        const saved = await insertMessage(meId, current, { ...payload, body }, caps);
        if (!saved) {
          setError("The message could not be saved. Check your connection and try again.");
          const stale = rowsRef.current.map((m) => (m.id === optimistic.id ? { ...m, pending: true } : m));
          rowsRef.current = stale;
          setMessages(stale);
          writeLocalThread(cache, stale);
          return false;
        }
        const confirmed: Message = {
          ...optimistic,
          id: saved.id,
          created_at: saved.created_at,
          seen_at: saved.seen_at,
          pending: false,
        };
        const replaced = mergeInto(
          rowsRef.current.filter((m) => m.id !== optimistic.id && m.id !== saved.id),
          [confirmed],
        );
        rowsRef.current = replaced;
        setMessages(replaced);
        writeLocalThread(cache, replaced);
        // Tell the other window which local id became the stored row.
        try {
          void channelRef.current?.send({
            type: "broadcast",
            event: "meta",
            payload: { id: optimistic.id, message: { ...confirmed, id: optimistic.id } },
          });
        } catch {
          /* the postgres listener covers database-backed threads */
        }
        if (current.kind === "dm") {
          void broadcastLive({
            kind: "dm",
            to: current.peerId,
            from: meId,
            title: "New message",
            body: previewLabel(confirmed).slice(0, 120),
          }).catch(() => undefined);
        }
        return true;
      } catch (err) {
        const failed = rowsRef.current.map((m) => (m.id === optimistic.id ? { ...m, pending: true } : m));
        rowsRef.current = failed;
        setMessages(failed);
        writeLocalThread(cache, failed);
        setError(chatErrorText(err, "The message was kept on this device and will sync when you are back online."));
        return false;
      } finally {
        setSending(false);
      }
    },
    [meId, sending],
  );

  const patchMessage = useCallback(
    async (id: string, patch: Partial<Message>) => {
      const current = targetRef.current;
      if (!current) return;
      const cache = threadCacheKey(meId as string, current);
      const next = rowsRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m));
      rowsRef.current = next;
      setMessages(next);
      writeLocalThread(cache, next);
      try {
        void channelRef.current?.send({
          type: "broadcast",
          event: "meta",
          payload: { id, message: patch as Row },
        });
      } catch {
        /* peers read it from the database when available */
      }
    },
    [meId],
  );

  const edit = useCallback(
    async (id: string, body: string) => {
      const current = targetRef.current;
      if (!current) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const edited_at = new Date().toISOString();
      await patchMessage(id, { body: trimmed, edited_at });
      const caps = await messagingCapabilities();
      if (!caps.rich || !isUuidId(meId)) return;
      const table = current.kind === "dm" ? "direct_messages" : "group_messages";
      const { error: updateError } = await supabase.from(table).update({ body: trimmed, edited_at }).eq("id", id);
      if (updateError) setError(chatErrorText(updateError, "The edit is saved on this device only."));
    },
    [meId, patchMessage],
  );

  const remove = useCallback(
    async (id: string) => {
      const current = targetRef.current;
      if (!current) return;
      const deleted_at = new Date().toISOString();
      await patchMessage(id, { body: "", deleted_at });
      const caps = await messagingCapabilities();
      if (!caps.rich || !isUuidId(meId)) return;
      const table = current.kind === "dm" ? "direct_messages" : "group_messages";
      const { error: deleteError } = await supabase.from(table).update({ body: "", deleted_at }).eq("id", id);
      if (deleteError) setError(chatErrorText(deleteError, "The delete is saved on this device only."));
    },
    [meId, patchMessage],
  );

  const toggleStar = useCallback(
    async (id: string) => {
      const current = targetRef.current;
      const message = rowsRef.current.find((m) => m.id === id);
      if (!current || !message) return;
      const starred = !message.starred;
      await patchMessage(id, { starred });
      const caps = await messagingCapabilities();
      if (!caps.rich || !isUuidId(meId)) return;
      const table = current.kind === "dm" ? "direct_messages" : "group_messages";
      await supabase.from(table).update({ starred }).eq("id", id);
    },
    [meId, patchMessage],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const current = targetRef.current;
      const message = rowsRef.current.find((m) => m.id === id);
      if (!current || !message) return;
      const pinned = !message.pinned;
      await patchMessage(id, { pinned });
      const caps = await messagingCapabilities();
      if (!caps.rich || !isUuidId(meId)) return;
      const table = current.kind === "dm" ? "direct_messages" : "group_messages";
      await supabase.from(table).update({ pinned_at: pinned ? new Date().toISOString() : null }).eq("id", id);
    },
    [meId, patchMessage],
  );

  const react = useCallback(
    async (message: Message, emoji: string) => {
      const current = targetRef.current;
      if (!current || !meId) return;
      const existing = message.reactions.find((r) => r.emoji === emoji);
      const mine = existing?.user_ids.includes(meId) ?? false;
      const reactions = message.reactions
        .map((r) =>
          r.emoji === emoji
            ? { ...r, user_ids: mine ? r.user_ids.filter((id) => id !== meId) : [...r.user_ids, meId] }
            : r,
        )
        .filter((r) => r.user_ids.length > 0);
      if (!existing && !mine) reactions.push({ emoji, user_ids: [meId] });
      await patchMessage(message.id, { reactions });
      try {
        void channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { id: message.id, reactions } });
      } catch {
        /* noop */
      }
      const caps = await messagingCapabilities();
      if (!caps.reactions || !isUuidId(meId)) return;
      try {
        if (mine) {
          await supabase
            .from("message_reactions")
            .delete()
            .eq("message_id", message.id)
            .eq("message_kind", current.kind)
            .eq("user_id", meId)
            .eq("emoji", emoji);
        } else {
          const { error: insertError } = await supabase.from("message_reactions").insert({
            message_id: message.id,
            message_kind: current.kind,
            user_id: meId,
            emoji,
          });
          if (insertError && !/duplicate|unique/i.test(insertError.message)) throw insertError;
        }
      } catch {
        /* the reaction already shows locally and to the open peer */
      }
    },
    [meId, patchMessage],
  );

  const markSeen = useCallback(async () => {
    const current = targetRef.current;
    if (!meId || !current) return;
    if (current.kind === "group") {
      if (!isUuidId(meId)) return;
      await supabase
        .from("chat_group_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("group_id", current.groupId)
        .eq("user_id", meId)
        .then(() => undefined, () => undefined);
      return;
    }
    const unseen = rowsRef.current.filter((m) => m.sender_id === current.peerId && !m.seen_at);
    if (unseen.length === 0) return;
    const stamp = new Date().toISOString();
    const ids = unseen.map((m) => m.id);
    const next = rowsRef.current.map((m) => (ids.includes(m.id) ? { ...m, seen_at: stamp } : m));
    rowsRef.current = next;
    setMessages(next);
    writeLocalThread(threadCacheKey(meId, current), next);
    try {
      void channelRef.current?.send({ type: "broadcast", event: "seen", payload: { ids } });
    } catch {
      /* noop */
    }
    if (!isUuidId(meId) || ids.some((id) => !isUuidId(id))) return;
    await supabase
      .from("direct_messages")
      .update({ seen_at: stamp })
      .in("id", ids)
      .then(() => undefined, () => undefined);
  }, [meId]);

  return {
    messages,
    loading,
    error,
    sending,
    peerTyping,
    send,
    edit,
    remove,
    react,
    toggleStar,
    togglePin,
    markSeen,
    sendTyping,
    refresh,
    setError,
  };
}

// ── Inbox ─────────────────────────────────────────────────────────────────

function localRowsForUser(meId: string): Map<string, Message[]> {
  const byPeer = new Map<string, Message[]>();
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(DM_CACHE_PREFIX)) continue;
      for (const message of readLocalThread(key)) {
        if (message.sender_id !== meId && message.receiver_id !== meId) continue;
        const peer = message.sender_id === meId ? message.receiver_id : message.sender_id;
        if (!peer) continue;
        const rows = byPeer.get(peer) ?? [];
        rows.push(message);
        byPeer.set(peer, rows);
      }
    }
  } catch {
    /* storage unavailable */
  }
  return byPeer;
}

function localGroupRows(): Map<string, Message[]> {
  const byGroup = new Map<string, Message[]>();
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(GROUP_CACHE_PREFIX)) continue;
      const groupId = key.slice(GROUP_CACHE_PREFIX.length);
      const rows = readLocalThread(key);
      if (rows.length > 0) byGroup.set(groupId, rows);
    }
  } catch {
    /* storage unavailable */
  }
  return byGroup;
}

async function fetchDmInbox(meId: string, caps: MessagingCapabilities): Promise<Message[]> {
  if (!isUuidId(meId)) return [];
  const { data, error } = await supabase
    .from("direct_messages")
    .select(messageColumns(caps, false))
    .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
    .order("created_at", { ascending: false })
    .limit(800);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((row) =>
    normalizeMessage({
      ...row,
      receiver_id: str(row.sender_id) === meId ? row.receiver_id : meId,
    }),
  );
}

async function fetchGroupInbox(
  meId: string,
  caps: MessagingCapabilities,
): Promise<{ groups: GroupSummary[]; rows: Message[]; readAt: Map<string, string> }> {
  if (!caps.groups || !isUuidId(meId)) return { groups: [], rows: [], readAt: new Map() };
  const { data: mine, error } = await supabase
    .from("chat_group_members")
    .select("group_id,last_read_at")
    .eq("user_id", meId);
  if (error) throw error;
  const readAt = new Map(((mine ?? []) as Row[]).map((row) => [str(row.group_id), str(row.last_read_at)]));
  const ids = Array.from(readAt.keys());
  if (ids.length === 0) return { groups: [], rows: [], readAt };
  const [{ data: groupRows, error: groupError }, { data: messages, error: messageError }] = await Promise.all([
    supabase.from("chat_groups").select("id,name,description,avatar_url,background_url,created_by").in("id", ids),
    supabase
      .from("group_messages")
      .select(messageColumns(caps, true))
      .in("group_id", ids)
      .order("created_at", { ascending: false })
      .limit(800),
  ]);
  if (groupError) throw groupError;
  if (messageError) throw messageError;
  const { data: members } = await supabase
    .from("chat_group_members")
    .select("group_id,user_id,member_role")
    .in("group_id", ids);
  const memberRows = (members ?? []) as Row[];
  const groups: GroupSummary[] = ((groupRows ?? []) as Row[]).map((group) => {
    const rows = memberRows.filter((row) => str(row.group_id) === str(group.id));
    return {
      id: str(group.id),
      name: str(group.name),
      description: str(group.description),
      avatarUrl: group.avatar_url ? str(group.avatar_url) : null,
      backgroundUrl: group.background_url ? str(group.background_url) : null,
      ownerId: rows.find((row) => str(row.member_role) === "owner")?.user_id
        ? str(rows.find((row) => str(row.member_role) === "owner")!.user_id)
        : str(group.created_by),
      memberIds: rows.map((row) => str(row.user_id)),
    };
  });
  return { groups, rows: ((messages ?? []) as unknown as Row[]).map((row) => normalizeMessage(row)), readAt };
}

export function useInbox(meId: string | undefined, users: User[], tick = 0) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<MessagingCapabilities | null>(capsCache);
  const usersRef = useRef(users);
  usersRef.current = users;

  const reload = useCallback(async () => {
    if (!meId) {
      setConversations([]);
      setGroups([]);
      return;
    }
    setLoading(true);
    setError(null);
    const caps = await messagingCapabilities();
    setCapabilities(caps);
    const byId = new Map(usersRef.current.map((user) => [user.id, user]));
    const next: Conversation[] = [];

    // 1:1 conversations — database rows merged into the device cache, so a
    // conversation that only exists locally still appears in the list.
    const dmRows = new Map<string, Message[]>(localRowsForUser(meId));
    try {
      for (const message of await fetchDmInbox(meId, caps)) {
        const peer = message.sender_id === meId ? message.receiver_id : message.sender_id;
        if (!peer) continue;
        const rows = dmRows.get(peer) ?? [];
        rows.push(message);
        dmRows.set(peer, rows);
      }
    } catch (err) {
      setError(chatErrorText(err, "Your conversations could not be synced. Showing messages on this device."));
    }
    for (const [peerId, rows] of dmRows) {
      const merged = mergeInto([], rows);
      if (merged.length === 0) continue;
      const last = merged[merged.length - 1];
      const user = byId.get(peerId);
      next.push({
        key: `dm:${peerId}`,
        kind: "dm",
        peerId,
        name: user?.name ?? "Portal member",
        role: user?.role,
        avatarUrl: user?.avatarUrl,
        online: user?.isOnline === true,
        lastBody: previewLabel(last),
        lastAt: last.created_at,
        unread: merged.filter((m) => m.receiver_id === meId && m.sender_id === peerId && !m.seen_at).length,
      });
    }

    // Groups
    try {
      const grouped = await fetchGroupInbox(meId, caps);
      setGroups(grouped.groups);
      const localGroups = localGroupRows();
      for (const group of grouped.groups) {
        const merged = mergeInto(localGroups.get(group.id) ?? [], grouped.rows.filter((m) => m.group_id === group.id));
        const readAt = +new Date(grouped.readAt.get(group.id) ?? 0);
        const last = merged[merged.length - 1];
        next.push({
          key: `group:${group.id}`,
          kind: "group",
          groupId: group.id,
          name: group.name,
          avatarUrl: group.avatarUrl ?? undefined,
          backgroundUrl: group.backgroundUrl ?? undefined,
          lastBody: last ? previewLabel(last) : group.description || "No messages yet",
          lastAt: last?.created_at ?? new Date(0).toISOString(),
          unread: merged.filter(
            (m) => m.sender_id !== meId && +new Date(m.created_at) > readAt && !m.deleted_at,
          ).length,
          memberIds: group.memberIds,
          memberCount: group.memberIds.length,
          ownerId: group.ownerId,
        });
      }
    } catch (err) {
      setError(chatErrorText(err, "Group chats could not be loaded."));
    }

    next.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
    setConversations(next);
    setLoading(false);
  }, [meId]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, tick]);

  useEffect(() => {
    if (!meId) return;
    const refresh = () => void reload();
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("aoh:dm-changed", refresh);
    window.addEventListener("aoh:live", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("aoh:dm-changed", refresh);
      window.removeEventListener("aoh:live", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [meId, reload]);

  return { conversations, groups, loading, error, reload, capabilities };
}

// ── Formatting helpers shared by the UI ───────────────────────────────────

export function messageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function conversationTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return messageTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

export function presenceLabel(user: User | undefined, online: boolean) {
  if (online || user?.isOnline) return "online";
  if (user?.lastSeenAt) return `last seen ${conversationTime(user.lastSeenAt).toLowerCase()}`;
  return "offline";
}
