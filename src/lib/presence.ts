import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live presence via Supabase Realtime Presence (channel "aoh-presence").
 * No DB migration needed — tracks online user ids in-memory across clients.
 * Also maintains a localStorage last-seen fallback so "Last active Xm ago"
 * still renders when realtime is unreachable.
 */

const CHANNEL = "aoh-presence";
const LS_PREFIX = "aoh-last-seen-";

export function touchLastSeen(id: string) {
  try { localStorage.setItem(LS_PREFIX + id, new Date().toISOString()); } catch { /* ignore */ }
}

export function getLastSeen(id: string): string | null {
  try { return localStorage.getItem(LS_PREFIX + id); } catch { return null; }
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return "Last active unknown";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Last active unknown";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "Active now";
  if (mins < 60) return `Last active ${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Last active ${h}h ago`;
  return `Last active ${Math.floor(h / 24)}d ago`;
}

export function usePresence(meId: string | null) {
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  useEffect(() => {
    if (!meId) return;
    touchLastSeen(meId);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(CHANNEL, { config: { presence: { key: meId } } });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ user_id?: string }>();
          const ids = new Set<string>();
          Object.values(state).forEach((presences) => {
            (presences as { user_id?: string }[]).forEach((p) => {
              const key = (p as unknown as { presence_key?: string }).presence_key as string | undefined;
              const uid = p.user_id || key;
              if (uid) ids.add(uid);
            });
          });
          setOnlineIds(Array.from(ids));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try { await channel!.track({ user_id: meId, online_at: new Date().toISOString() }); } catch { /* ignore */ }
          }
        });
    } catch { /* realtime unavailable — last-seen fallback only */ }

    const beat = window.setInterval(() => touchLastSeen(meId), 60000);
    return () => {
      window.clearInterval(beat);
      try { if (channel) void supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [meId]);

  return {
    onlineIds,
    isOnline: (id: string) => onlineIds.includes(id),
  };
}
