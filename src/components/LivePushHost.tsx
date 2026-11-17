import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { isAnnouncementLiveFor } from "@/lib/announcements";
import { broadcastLive, useLivePush } from "@/lib/livePush";

/** Mount once inside the app provider: live toasts + device alerts for everyone. */
export default function LivePushHost() {
  const { state, currentUser } = useApp();
  const seenRef = useRef<Set<string> | null>(null);

  // Incoming realtime broadcasts (DMs addressed to me, office announcements).
  useLivePush(currentUser?.id);

  // New bulletin-board announcements surface as a live toast even when they
  // arrive via the regular data sync rather than the broadcast channel.
  useEffect(() => {
    const now = Date.now();
    const role = currentUser?.role ?? "Student";
    const live = state.announcements.filter((a) => isAnnouncementLiveFor(a, role, now));
    if (!seenRef.current) {
      // First paint: remember what exists, don't toast history.
      seenRef.current = new Set(live.map((a) => a.id));
      return;
    }
    const seen = seenRef.current;
    for (const a of live) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const title = a.title?.trim() || "New announcement";
      const body = (a.body ?? "").slice(0, 160) || a.category || "";
      toast.message(title, { description: body, duration: 7000 });
      try {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body: body.slice(0, 160) });
        }
      } catch {
        /* toast already shown */
      }
      void broadcastLive({ kind: "announcement", title, body });
    }
    // Retire dismissed/expired ids so the set never grows forever.
    if (seen.size > 60) {
      const keep = new Set(live.map((a) => a.id));
      seenRef.current = keep;
    }
  }, [state.announcements, currentUser?.role]);

  return null;
}
