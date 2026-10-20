// f65 — deadline reminder sender.
//
// Reads the reminder queue the app writes while a student is signed in and
// delivers a web push to every enabled subscription, so a closed PWA still gets
// "fee balance due", "lesson due tomorrow" and "new announcement" alerts.
//
// Required secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:info@africaofhope.org)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase)
//
// Deploy: supabase functions deploy send-deadline-reminders
// Schedule it every 15 minutes (cron). It is safe to run repeatedly: items are
// marked sent_at once delivered.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReminderItem {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  due_at: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // Cron worker is privileged; never let an anonymous visitor trigger bulk sends.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const schedulerSecret = Deno.env.get("REMINDER_CRON_SECRET") || serviceKey;
  if (!schedulerSecret || req.headers.get("Authorization") !== `Bearer ${schedulerSecret}`) {
    return json({ error: "Not authorized" }, 401);
  }
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@africaofhope.org";
  if (!publicKey || !privateKey) {
    return json(
      {
        configured: false,
        error:
          "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set, so no phone alerts can be delivered. Reminders still appear while the app is open.",
      },
      503,
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Only items that are already inside their owner's reminder window.
  const { data: settings, error: settingsError } = await supabase
    .from("reminder_settings")
    .select("user_id, lessons, fees, announcements, window_hours")
    .eq("enabled", true);
  if (settingsError) return json({ error: settingsError.message }, 500);
  if (!settings || settings.length === 0) return json({ sent: 0, note: "No account has reminders switched on." });

  const windows = new Map<string, { lessons: boolean; fees: boolean; announcements: boolean; hours: number }>();
  for (const row of settings) {
    windows.set(row.user_id, {
      lessons: row.lessons,
      fees: row.fees,
      announcements: row.announcements,
      hours: row.window_hours ?? 24,
    });
  }

  const { data: items, error: itemsError } = await supabase
    .from("reminder_items")
    .select("id, user_id, kind, title, body, url, due_at")
    .is("sent_at", null)
    .order("due_at", { ascending: true })
    .limit(500);
  if (itemsError) return json({ error: itemsError.message }, 500);

  const now = Date.now();
  const due = (items as ReminderItem[] | null ?? []).filter((item) => {
    const prefs = windows.get(item.user_id);
    if (!prefs) return false;
    const wanted =
      item.kind === "fee" ? prefs.fees : item.kind === "announcement" ? prefs.announcements : prefs.lessons;
    if (!wanted) return false;
    const at = new Date(item.due_at).getTime();
    if (Number.isNaN(at)) return false;
    // Announcements go out as soon as they are published; deadlines inside the window.
    if (item.kind === "announcement") return at <= now;
    return at - now <= prefs.hours * 3_600_000 && at > now - 3_600_000;
  });

  if (due.length === 0) return json({ sent: 0, queued: 0 });

  const userIds = [...new Set(due.map((item) => item.user_id))];
  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id, preferences")
    .in("user_id", userIds)
    .eq("enabled", true);
  if (subsError) return json({ error: subsError.message }, 500);

  let sent = 0;
  const delivered: string[] = [];
  const expired: string[] = [];

  for (const item of due) {
    const mine = (subs ?? []).filter((sub) => {
      if (sub.user_id !== item.user_id) return false;
      const prefs = sub.preferences ?? {};
      if (prefs.enabled === false) return false;
      const key = item.kind === "fee" ? "fees" : item.kind === "announcement" ? "announcements" : "lessons";
      return prefs[key] !== false;
    });
    let any = false;
    for (const sub of mine) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: item.title, body: item.body, url: item.url, tag: item.id }),
        );
        any = true;
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser dropped the subscription; stop using it.
        if (status === 404 || status === 410) expired.push(sub.endpoint);
      }
    }
    if (any) delivered.push(item.id);
  }

  if (delivered.length) {
    await supabase
      .from("reminder_items")
      .update({ sent_at: new Date().toISOString() })
      .in("id", delivered);
  }
  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return json({ sent, items: delivered.length, removedSubscriptions: expired.length });
});
