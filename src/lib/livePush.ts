import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface LiveEvent {
  kind: "dm" | "announcement" | "notice";
  title: string;
  body: string;
  /** Portal user id of the intended receiver (DMs). Omit for public. */
  to?: string;
  from?: string;
  url?: string;
}

const CHANNEL = "aoh-live-v1";

let shared: ReturnType<typeof supabase.channel> | null = null;
let joinPromise: Promise<void> | null = null;

function ensureChannel(): ReturnType<typeof supabase.channel> {
  if (shared) return shared;
  shared = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
  return shared;
}

/** Best-effort live broadcast to every online subscriber (portal + public). */
export async function broadcastLive(event: LiveEvent): Promise<void> {
  try {
    const ch = ensureChannel();
    if (!joinPromise) {
      joinPromise = new Promise<void>((resolve) => {
        try {
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED" || status === "TIMED_OUT" || status === "CLOSED") resolve();
          });
          // Never hang the sender if realtime is unreachable.
          window.setTimeout(resolve, 2500);
        } catch {
          resolve();
        }
      });
    }
    await joinPromise;
    await ch.send({ type: "broadcast", event: "live", payload: event });
  } catch {
    /* offline — local toasts still fire on the sender's screen */
  }
  try {
    window.dispatchEvent(new CustomEvent("aoh:live", { detail: event }));
  } catch {
    /* noop */
  }
}

function canNotify(): boolean {
  try {
    return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  } catch {
    return false;
  }
}

function deviceNotify(title: string, body: string, url?: string) {
  if (!canNotify()) return;
  try {
    const n = new Notification(title, { body: body.slice(0, 160), tag: `aoh-${Date.now()}` });
    if (url) {
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* noop */
        }
        n.close();
      };
    }
  } catch {
    /* blocked — toast already shown */
  }
}

/**
 * Global live listener for every visitor and portal user. Shows an in-app
 * toast (+ device notification when granted) for announcements and for DMs
 * addressed to this user. Never requests permission by itself.
 */
export function useLivePush(userId: string | undefined, onEvent?: (e: LiveEvent) => void) {
  const userRef = useRef(userId);
  userRef.current = userId;
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    const ch = supabase.channel(`${CHANNEL}-rx`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "live" }, ({ payload }) => {
      const e = payload as LiveEvent;
      if (!e || !e.kind) return;
      if (e.kind === "dm" && e.to && userRef.current && e.to !== userRef.current) return;
      try {
        window.dispatchEvent(new CustomEvent("aoh:live", { detail: e }));
      } catch {
        /* noop */
      }
      try {
        cbRef.current?.(e);
      } catch {
        /* noop */
      }
      if (e.kind === "dm") {
        toast.message(e.title || "New message", {
          description: e.body,
          duration: 6000,
        });
      } else {
        toast.message(e.title || "Announcement", {
          description: e.body,
          duration: 7000,
        });
      }
      deviceNotify(e.title || "Africa of Hope", e.body, e.url);
    });
    ch.subscribe();
    const onLocal = (evt: Event) => {
      try {
        const e = (evt as CustomEvent).detail as LiveEvent;
        if (!e || !e.kind) return;
        // Local echo from this tab's own sender — the sender already sees
        // their message, so only surface it for the intended receiver.
        if (e.kind === "dm" && (!e.to || e.to !== userRef.current)) return;
        try {
          cbRef.current?.(e);
        } catch {
          /* noop */
        }
      } catch {
        /* noop */
      }
    };
    window.addEventListener("aoh:live", onLocal);
    return () => {
      window.removeEventListener("aoh:live", onLocal);
      try {
        void ch.unsubscribe();
      } catch {
        /* noop */
      }
    };
  }, []);
}
