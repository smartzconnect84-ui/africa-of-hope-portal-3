import { NotificationFeed } from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import { isKnockConfigured } from "@/lib/knock";

export default function KnockNotificationCenter() {
  if (!isKnockConfigured()) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Knock notifications are not configured. Set VITE_KNOCK_PUBLIC_API_KEY and VITE_KNOCK_FEED_CHANNEL_ID.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-xl font-semibold">Notifications</h1>
      <NotificationFeed />
    </div>
  );
}
