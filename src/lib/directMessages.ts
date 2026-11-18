import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { broadcastLive } from "@/lib/livePush";

export interface DMMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  seen_at: string | null;
}

export function conversationId(a: string, b: string) {
  return [a, b].sort().join("__");
}

const KEY = (cid: string) => `aoh-dm:v1:${cid}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuidId = (v: string | undefined | null) => !!v && UUID_RE.test(v);

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `dm-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

function loadLocal(cid: string): DMMessage[] {
  try {
    const raw = localStorage.getItem(KEY(cid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DMMessage[]) : [];
  } catch {
    return [];
  }
}

function persistLocal(cid: string, rows: DMMessage[]) {
  try {
    localStorage.setItem(KEY(cid), JSON.stringify(rows.slice(-300)));
  } catch {
    /* private mode — realtime still delivers */
  }
  try {
    window.dispatchEvent(new CustomEvent("aoh:dm-changed", { detail: { cid } }));
  } catch {
    /* noop */
  }
}

function mergeRows(a: DMMessage[], b: DMMessage[]): DMMessage[] {
  const map = new Map<string, DMMessage>();
  for (const m of [...a, ...b]) {
    const prev = map.get(m.id);
    if (!prev) {
      map.set(m.id, m);
      continue;
    }
    // Prefer the version that has been seen.
    map.set(m.id, prev.seen_at ? prev : m);
  }
  return [...map.values()].sort((x, y) => +new Date(x.created_at) - +new Date(y.created_at));
}

/** Total unread 1:1 messages for a user across every local conversation. */
export function countLocalUnread(userId: string | undefined): number {
  if (!userId) return 0;
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("aoh-dm:v1:")) continue;
      try {
        const rows = JSON.parse(localStorage.getItem(k) ?? "[]") as DMMessage[];
        if (Array.isArray(rows)) {
          for (const m of rows) if (m.receiver_id === userId && !m.seen_at) total++;
        }
      } catch {
        /* skip corrupt thread */
      }
    }
  } catch {
    /* storage unavailable */
  }
  return total;
}

/**
 * Global unread counter for the header badges. Listens to local writes,
 * cross-tab storage events and the live broadcast so counts tick without
 * a refresh. Falls back to a light poll for same-tab external writes.
 */
export function useUnreadDMs(userId: string | undefined) {
  const [unread, setUnread] = useState(() => countLocalUnread(userId));
  const userRef = useRef(userId);
  userRef.current = userId;

  // Local threads give an instant number; the database is authoritative for real
  // accounts so the badge matches the messages actually waiting on every device.
  const refresh = useCallback(() => {
    const local = countLocalUnread(userRef.current);
    setUnread(local);
    const me = userRef.current;
    if (!isUuidId(me)) return;
    void (async () => {
      try {
        const { count, error } = await supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", me)
          .is("seen_at", null);
        if (!error && typeof count === "number") setUnread((prev) => Math.max(prev, count));
      } catch {
        /* offline — the local count stands */
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("aoh-dm:v1:")) refresh();
    };
    const onLive = (e: Event) => {
      try {
        const p = (e as CustomEvent).detail as { kind?: string; to?: string } | undefined;
        if (!p || p.kind !== "dm") return;
        if (!userRef.current || !p.to || p.to === userRef.current) refresh();
      } catch {
        /* noop */
      }
    };
    window.addEventListener("aoh:dm-changed", onChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("aoh:live", onLive as EventListener);
    const t = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("aoh:dm-changed", onChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aoh:live", onLive as EventListener);
      window.clearInterval(t);
    };
  }, [refresh]);

  return { unread, refresh };
}

export function useDirectMessages(meId: string | undefined, peerId: string | undefined) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const rowsRef = useRef<DMMessage[]>([]);
  rowsRef.current = messages;
  const cid = meId && peerId ? conversationId(meId, peerId) : null;
  const meRef = useRef(meId);
  meRef.current = meId;

  const applyRows = useCallback(
    (rows: DMMessage[]) => {
      rowsRef.current = rows;
      setMessages(rows);
      if (cid) persistLocal(cid, rows);
    },
    [cid],
  );

  // Load local history instantly, then merge durable Supabase rows when
  // both accounts are real UUID profiles (demo ids like "user-1" can never
  // satisfy the uuid foreign key, so we skip the query instead of failing).
  useEffect(() => {
    if (!cid || !meId || !peerId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessages(loadLocal(cid));
    setFailed(null);
    if (!isUuidId(meId) || !isUuidId(peerId)) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("direct_messages")
          .select("id,sender_id,receiver_id,body,created_at,seen_at")
          .or(`and(sender_id.eq.${meId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${meId})`)
          .order("created_at", { ascending: true })
          .limit(300);
        if (cancelled || error || !Array.isArray(data)) return;
        const merged = mergeRows(loadLocal(cid), data as DMMessage[]);
        if (!cancelled) {
          rowsRef.current = merged;
          setMessages(merged);
          persistLocal(cid, merged);
        }
      } catch {
        /* offline — local history already shown */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, meId, peerId]);

  // Realtime: per-conversation broadcast (works for every id shape) plus a
  // postgres listener when both ids are UUIDs so history converges.
  useEffect(() => {
    if (!cid || !meId || !peerId) return;
    let active = true;
    const ch = supabase.channel(`dm:${cid}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;
    ch.on("broadcast", { event: "message" }, ({ payload }) => {
      const msg = payload as DMMessage;
      if (!msg || msg.sender_id !== peerId) return;
      const merged = mergeRows(rowsRef.current, [msg]);
      rowsRef.current = merged;
      setMessages(merged);
      persistLocal(cid, merged);
    });
    ch.on("broadcast", { event: "seen" }, ({ payload }) => {
      const ids = new Set((payload as { ids?: string[] })?.ids ?? []);
      if (ids.size === 0) return;
      const next = rowsRef.current.map((m) => (ids.has(m.id) && !m.seen_at ? { ...m, seen_at: new Date().toISOString() } : m));
      rowsRef.current = next;
      setMessages(next);
      persistLocal(cid, next);
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if ((payload as { from?: string })?.from !== peerId) return;
      setPeerTyping(true);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setPeerTyping(false), 2500);
    });
    ch.subscribe();

    let pg: ReturnType<typeof supabase.channel> | null = null;
    if (isUuidId(meId) && isUuidId(peerId)) {
      pg = supabase
        .channel(`dm-pg:${cid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "direct_messages" },
          (change) => {
            const row = ((change.new ?? change.old) as DMMessage | undefined) ?? undefined;
            if (!row) return;
            const mine =
              (row.sender_id === meId && row.receiver_id === peerId) ||
              (row.sender_id === peerId && row.receiver_id === meId);
            if (!mine || !active) return;
            if (change.eventType === "INSERT") {
              const merged = mergeRows(rowsRef.current, [row]);
              rowsRef.current = merged;
              setMessages(merged);
              persistLocal(cid, merged);
            } else if (change.eventType === "UPDATE") {
              const next = rowsRef.current.map((m) => (m.id === row.id ? { ...m, ...row } : m));
              rowsRef.current = next;
              setMessages(next);
              persistLocal(cid, next);
            }
          },
        )
        .subscribe();
    }
    const onLocal = (e: Event) => {
      try {
        if ((e as CustomEvent).detail?.cid !== cid) return;
      } catch {
        return;
      }
      const fresh = loadLocal(cid);
      // Another hook instance in this tab wrote first — adopt it.
      if (fresh.length !== rowsRef.current.length) {
        rowsRef.current = fresh;
        setMessages(fresh);
      }
    };
    window.addEventListener("aoh:dm-changed", onLocal);
    return () => {
      active = false;
      window.removeEventListener("aoh:dm-changed", onLocal);
      window.clearTimeout(typingTimer.current);
      try {
        void ch.unsubscribe();
      } catch {
        /* noop */
      }
      try {
        if (pg) void pg.unsubscribe();
      } catch {
        /* noop */
      }
      channelRef.current = null;
    };
  }, [cid, meId, peerId]);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const body = text.trim();
      if (!body || !meId || !peerId || !cid || sending) return false;
      setSending(true);
      setFailed(null);
      const msg: DMMessage = {
        id: uid(),
        sender_id: meId,
        receiver_id: peerId,
        body: body.slice(0, 2000),
        created_at: new Date().toISOString(),
        seen_at: null,
      };
      // Optimistic local save first — the message is never lost even if the
      // network or the uuid-only table rejects it.
      const next = mergeRows(rowsRef.current, [msg]);
      rowsRef.current = next;
      setMessages(next);
      persistLocal(cid, next);

      let delivered = true;
      try {
        const ch = channelRef.current;
        if (ch) {
          const res = await ch.send({ type: "broadcast", event: "message", payload: msg });
          if (res !== "ok") delivered = false;
        } else {
          delivered = false;
        }
      } catch {
        delivered = false;
      }
      // Global live bus: wakes the inbox badge, toast + device notification
      // on the receiver's screen even when this thread is closed.
      try {
        await broadcastLive({ kind: "dm", to: peerId, from: meId, title: "New message", body: msg.body.slice(0, 120) });
      } catch {
        /* live bus is best-effort */
      }
      // Durable cross-device copy for real UUID profiles.
      if (isUuidId(meId) && isUuidId(peerId)) {
        try {
          const { error } = await supabase.from("direct_messages").insert({
            sender_id: meId,
            receiver_id: peerId,
            body: msg.body,
          });
          if (error) delivered = false;
          // The recipient's notification row is raised by the
          // direct_message_notification trigger on insert; a browser insert here
          // would only be rejected by row level security.
        } catch {
          delivered = false;
        }
      }
      // Device push is no longer sent from here. The direct_message_notification
      // trigger writes the recipient's notification row, and the
      // notifications_queue_push trigger queues it for the pg_cron dispatcher,
      // which pushes it even if this tab is closed. Sending from both places
      // would deliver the same message twice.
      setSending(false);
      if (!delivered) {
        // Kept locally and retried on the next send/poll — surfaced honestly.
        setFailed("Sent on this device, waiting for the other side to connect. It will appear automatically — no need to resend.");
      }
      return true;
    },
    [cid, meId, peerId, sending],
  );

  const sendTyping = useCallback(() => {
    try {
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: meId } });
    } catch {
      /* noop */
    }
  }, [meId]);

  const markSeen = useCallback(async () => {
    if (!meId || !peerId || !cid) return;
    const unseen = rowsRef.current.filter((m) => m.receiver_id === meId && !m.seen_at);
    if (unseen.length === 0) return;
    const stamp = new Date().toISOString();
    const ids = unseen.map((m) => m.id);
    const next = rowsRef.current.map((m) => (ids.includes(m.id) ? { ...m, seen_at: stamp } : m));
    rowsRef.current = next;
    setMessages(next);
    persistLocal(cid, next);
    try {
      await channelRef.current?.send({ type: "broadcast", event: "seen", payload: { ids } });
    } catch {
      /* noop */
    }
    if (isUuidId(meId)) {
      try {
        await supabase.from("direct_messages").update({ seen_at: stamp }).in("id", ids);
      } catch {
        /* local receipts already saved */
      }
    }
  }, [cid, meId, peerId]);

  return { messages, peerTyping, sending, failed, send, sendTyping, markSeen };
}
