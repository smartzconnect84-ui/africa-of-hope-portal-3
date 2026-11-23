import { useEffect } from "react";
import { useKnockFeed } from "@knocklabs/react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";

export default function KnockLiveSync() {
  const { currentUser } = useApp();
  const { feedClient } = useKnockFeed();

  useEffect(() => {
    if (!currentUser?.id || !feedClient) return;

    const channel = supabase
      .channel(`knock-live-${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentUser.id}` },
        () => {
          try {
            void feedClient.fetch({ __fetchSource: "socket" });
          } catch {
            /* ignore */
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser?.id, feedClient]);

  return null;
}