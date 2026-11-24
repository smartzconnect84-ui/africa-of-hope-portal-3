import { useEffect, useState } from "react";
import { KnockProvider, KnockFeedProvider } from "@knocklabs/react";
import { useApp } from "@/context/AppContext";
import { isKnockConfigured } from "@/lib/knock";
import KnockLiveSync from "@/components/notifications/KnockLiveSync";
import { supabase, edgeUrl } from "@/lib/supabase";

export default function KnockProviderShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp();
  const [userToken, setUserToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isKnockConfigured() || !currentUser?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(edgeUrl("knock-user-token"), {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json?.token) setUserToken(json.token);
        }
      } catch {
        /* fall back to public identification */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  if (!isKnockConfigured() || !currentUser?.id) return <>{children}</>;

  return (
    <KnockProvider
      apiKey={import.meta.env.VITE_KNOCK_PUBLIC_API_KEY as string}
      user={{ id: currentUser.id, name: currentUser.name, email: currentUser.email, avatar: currentUser.avatarUrl }}
      userToken={userToken}
      enabled
    >
      <KnockFeedProvider feedId={import.meta.env.VITE_KNOCK_FEED_CHANNEL_ID as string}>
        <KnockLiveSync />
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
}
