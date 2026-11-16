import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DMMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  seen_at: string | null;
}

export function conversationKey(a: string, b: string) {
  return [a, b].sort().join("__");
}

function storeKey(a: string, b: string) {
  return `aoh-dm-${conversationKey(a, b)}`;
}

function loadLocal(me: string, peer: string): DMMessage[] {
  try {
    const raw = localStorage.getItem(storeKey(me, peer));
    if (!raw) return [];
    const arr = JSON.parse(raw) as DMMessage[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveLocal(me: string, peer: string, msgs: DMMessage[]) {
  try { localStorage.setItem(storeKey(me, peer), JSON.stringify(msgs.slice(-200))); } catch { /* ignore */ }
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * 1:1 chat hook. Works immediately on localStorage + realtime broadcast.
 * If a `direct_messages` table exists in Supabase it is used as durable
 * storage (best-effort — missing table never breaks the UI).
 */
export function useDirectMessages(meId: string | null, peerId: string | null) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimeout = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial load
  useEffect(() => {
    if (!meId || !peerId) { setMessages([]); return; }
    setMessages(loadLocal(meId, peerId));
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(`and(sender_id.eq.${meId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${meId})`)
          .order("created_at", { ascending: true })
          .limit(200);
        if (!error && data && !cancelled) {
          const rows = (data as unknown as DMMessage[]).map((r) => ({
            id: String((r as unknown as Record<string, unknown>).id ?? uid()),
            sender_id: String(r.sender_id),
            receiver_id: String(r.receiver_id),
            body: String(r.body ?? ""),
            created_at: String(r.created_at ?? new Date().toISOString()),
            seen_at: (r.seen_at as string | null) ?? null,
          }));
          if (rows.length) {
            setMessages(rows);
            saveLocal(meId, peerId, rows);
          }
        }
      } catch { /* table may not exist yet */ }
    })();
    return () => { cancelled = true; };
  }, [meId, peerId]);

  // Realtime: broadcast new messages + typing + seen across devices/tabs.
  useEffect(() => {
    if (!meId || !peerId) return;
    const key = conversationKey(meId, peerId);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`dm-${key}`);
      channel
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const m = payload as DMMessage;
          if (!m || m.sender_id !== peerId) return;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            const next = [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
            saveLocal(meId, peerId, next);
            return next;
          });
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const p = payload as { sender_id?: string };
          if (p?.sender_id !== peerId) return;
          setPeerTyping(true);
          if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
          typingTimeout.current = window.setTimeout(() => setPeerTyping(false), 2500);
        })
        .on("broadcast", { event: "seen" }, ({ payload }) => {
          const p = payload as { sender_id?: string; at?: string };
          if (p?.sender_id !== peerId) return;
          const at = p.at ?? new Date().toISOString();
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.sender_id === meId && !m.seen_at ? { ...m, seen_at: at } : m,
            );
            saveLocal(meId, peerId, next);
            return next;
          });
        })
        .subscribe();
      channelRef.current = channel;
    } catch { /* realtime unavailable */ }

    // Cross-tab fallback within this browser.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storeKey(meId, peerId) && e.newValue) {
        try {
          const arr = JSON.parse(e.newValue) as DMMessage[];
          if (Array.isArray(arr)) setMessages(arr);
        } catch { /* ignore */ }
      }
      if (e.key === `${storeKey(meId, peerId)}:typing` && e.newValue) {
        try {
          const t = JSON.parse(e.newValue) as { sender_id?: string; at?: number };
          if (t.sender_id === peerId && Date.now() - (t.at ?? 0) < 3000) {
            setPeerTyping(true);
            if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
            typingTimeout.current = window.setTimeout(() => setPeerTyping(false), 2500);
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
      try { if (channel) void supabase.removeChannel(channel); } catch { /* ignore */ }
      channelRef.current = null;
    };
  }, [meId, peerId]);

  const send = useCallback(async (body: string) => {
    if (!meId || !peerId) return "Chat is unavailable.";
    const text = body.trim();
    if (!text) return "Write a message first.";
    if (text.length > 2000) return "Keep messages under 2000 characters.";
    const msg: DMMessage = {
      id: uid(),
      sender_id: meId,
      receiver_id: peerId,
      body: text.slice(0, 2000),
      created_at: new Date().toISOString(),
      seen_at: null,
    };
    setMessages((prev) => {
      const next = [...prev, msg];
      saveLocal(meId, peerId, next);
      return next;
    });
    // Broadcast to the other side (best-effort).
    try { await channelRef.current?.send({ type: "broadcast", event: "message", payload: msg }); } catch { /* ignore */ }
    try { localStorage.setItem(storeKey(meId, peerId), JSON.stringify(loadLocal(meId, peerId).concat(msg).slice(-200))); } catch { /* ignore */ }
    // Durable save when the table exists (missing table never blocks).
    try {
      await supabase.from("direct_messages").insert({
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        body: msg.body,
      });
    } catch { /* ignore */ }
    return null;
  }, [meId, peerId]);

  const sendTyping = useCallback(() => {
    if (!meId || !peerId) return;
    try { void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { sender_id: meId } }); } catch { /* ignore */ }
    try { localStorage.setItem(`${storeKey(meId, peerId)}:typing`, JSON.stringify({ sender_id: meId, at: Date.now() })); } catch { /* ignore */ }
  }, [meId, peerId]);

  const markSeen = useCallback(async () => {
    if (!meId || !peerId) return;
    const at = new Date().toISOString();
    let changed = false;
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.receiver_id === meId && m.sender_id === peerId && !m.seen_at) { changed = true; return { ...m, seen_at: at }; }
        return m;
      });
      if (changed) saveLocal(meId, peerId, next);
      return next;
    });
    try { await channelRef.current?.send({ type: "broadcast", event: "seen", payload: { sender_id: meId, at } }); } catch { /* ignore */ }
    try {
      await supabase.from("direct_messages").update({ seen_at: at }).eq("sender_id", peerId).eq("receiver_id", meId).is("seen_at", null);
    } catch { /* ignore */ }
  }, [meId, peerId]);

  return { messages, peerTyping, send, sendTyping, markSeen };
}
