import Knock from "@knocklabs/client";

export const KNOCK_PUBLIC_API_KEY = (import.meta.env.VITE_KNOCK_PUBLIC_API_KEY as string | undefined)?.trim() || "";
export const KNOCK_FEED_CHANNEL_ID = (import.meta.env.VITE_KNOCK_FEED_CHANNEL_ID as string | undefined)?.trim() || "";

export function isKnockConfigured(): boolean {
  return Boolean(KNOCK_PUBLIC_API_KEY && KNOCK_FEED_CHANNEL_ID);
}

let client: Knock | null = null;

export function getKnockClient(userId: string, userToken?: string): Knock | null {
  if (!isKnockConfigured() || !userId) return null;
  if (client) return client;
  client = new Knock(KNOCK_PUBLIC_API_KEY);
  client.authenticate(userId, userToken);
  return client;
}

export function resetKnockClient() {
  client = null;
}
