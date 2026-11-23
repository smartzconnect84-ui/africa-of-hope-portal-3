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

type Listener = (event: LiveEvent) => void;
const listeners = new Set<Listener>();

let shared: ReturnType<typeof supabase.channel> | null = null;
let joinPromise: Promise<void> | null = null;

/**
 * ONE topic is used for both sending and receiving.
 *
 * This used to be two topics — `broadcastLive()` sent on `aoh-live-v1` while
 * `useLivePush()` listened on `aoh-live-v1-rx`. Supabase Realtime broadcast
 * has no wildcard, so a message sent from another account never reached the
 * receiver's listener: the unread badge ticked (it polls) but no toast or
 * device alert ever appeared. `broadcast.self: false` already stops the
 * sender's own client from echoing its own broadcast, so a single topic is
 * safe and is the only way the two sides can meet.
 */
function ensureChannel(): ReturnType<typeof supabase.channel> {
  if (shared) return shared;
  shared = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
  shared.on("broadcast", { event: "live" }, ({ payload }) => {
    const event = payload as LiveEvent;
    if (!event || !event.kind) return;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        /* one bad listener must not stop the rest */
      }
    }
  });
  return shared;
}

function join(): Promise<void> {
  const channel = ensureChannel();
  if (!joinPromise) {
    joinPromise = new Promise<void>((resolve) => {
      try {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" || status === "TIMED_OUT" || status === "CLOSED") resolve();
        });
        // Never hang the sender if realtime is unreachable.
        window.setTimeout(resolve, 2500);
      } catch {
        resolve();
      }
    });
  }
  return joinPromise;
}

/** Best-effort live broadcast to every online subscriber (portal + public). */
export async function broadcastLive(event: LiveEvent): Promise<void> {
  try {
    const channel = ensureChannel();
    await join();
    await channel.send({ type: "broadcast", event: "live", payload: event });
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
    const notification = new Notification(title, { body: body.slice(0, 160), tag: `aoh-${Date.now()}` });
    if (url) {
      notification.onclick = () => {
        try {
          window.focus();
        } catch {
          /* noop */
        }
        notification.close();
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
    const handle = (event: LiveEvent) => {
      // A DM that names a different receiver is not ours.
      if (event.kind === "dm" && event.to && userRef.current && event.to !== userRef.current) return;
      try {
        cbRef.current?.(event);
      } catch {
        /* noop */
      }
      if (event.kind === "dm") {
        toast.message(event.title || "New message", {
          description: event.body,
          duration: 6000,
        });
        deviceNotify(event.title || "New message", event.body, event.url);
      } else {
        toast.message(event.title || "Announcement", {
          description: event.body,
          duration: 7000,
        });
        deviceNotify(event.title || "Africa of Hope", event.body, event.url);
      }
    };
    listeners.add(handle);
    void join();

    const onLocal = (evt: Event) => {
      try {
        const event = (evt as CustomEvent).detail as LiveEvent;
        if (!event || !event.kind) return;
        // Local echo from this tab's own sender — the sender already sees
        // their message, so only surface it for the intended receiver.
        if (event.kind === "dm" && (!event.to || event.to !== userRef.current)) return;
        try {
          cbRef.current?.(event);
        } catch {
          /* noop */
        }
      } catch {
        /* noop */
      }
    };
    window.addEventListener("aoh:live", onLocal);
    return () => {
      listeners.delete(handle);
      window.removeEventListener("aoh:live", onLocal);
    };
  }, []);
}
