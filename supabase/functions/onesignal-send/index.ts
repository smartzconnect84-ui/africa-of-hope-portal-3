import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-dispatch",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const STAFF_ROLES = ["admin", "super_admin", "registrar", "support", "teacher", "instructor", "admissions"];
const validUrl = (u: unknown): string => {
  try {
    const s = String(u ?? "/");
    if (!s.startsWith("/") && !s.startsWith("#")) return "/";
    const url = new URL(s.replace(/^#/, "/"), "https://example.org");
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
};

/** Constant-time comparison for the internal dispatch token. */
function sameToken(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

type Admin = ReturnType<typeof createClient>;

type SendOutcome = { status: "sent" | "failed"; provider: unknown };

async function sendOne(appId: string, apiKey: string, recipient: string, title: string, message: string, url: string): Promise<SendOutcome> {
  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
    include_external_user_ids: [recipient],
    web_url: url.startsWith("#") ? "/" + url : url,
    data: { url },
    chrome_web_icon: "/icons/icon-192.png",
    chrome_web_badge: "/icons/icon-192.png",
  };
  try {
    const res = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const provider = await res.json().catch(() => ({ http: res.status })) as any;
    const ids: string[] = Array.isArray(provider?.id) ? provider.id.map(String) : provider?.id ? [String(provider.id)] : [];
    const errors: string[] = Array.isArray(provider?.errors) ? provider.errors.map(String) : [];
    // OneSignal answers 200 with an `errors` array when nothing was deliverable.
    // An empty id with errors is not a send.
    return { status: res.ok && errors.length === 0 && ids.length > 0 ? "sent" : "failed", provider };
  } catch (e) {
    return { status: "failed", provider: { error: e instanceof Error ? e.message : "send failed" } };
  }
}

/**
 * Internal mode used by pg_cron (`_cron_dispatch_push`): drain queued
 * notification_outbox rows, one targeted push per recipient. Authenticated by a
 * token only the database and this service-role client can read.
 */
async function dispatchQueued(admin: Admin, appId: string, apiKey: string, rawLimit: unknown) {
  const take = Math.min(Math.max(Number(rawLimit) || 25, 1), 50);
  const { data: rows, error } = await admin
    .from("notification_outbox")
    .select("id,title,body,url,recipient_id,attempts")
    .eq("status", "queued")
    .not("recipient_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(take);
  if (error) return json({ error: "Could not read the queue." }, 500);

  const results: Array<{ id: string; status: string }> = [];
  for (const row of (rows ?? []) as any[]) {
    // Claim first so a second cron tick (or a manual call) cannot send twice.
    const { data: claimed } = await admin
      .from("notification_outbox")
      .update({ status: "sending", attempts: Number(row.attempts ?? 0) + 1 })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const outcome = await sendOne(
      appId, apiKey, String(row.recipient_id),
      String(row.title ?? "AFRICA OF HOPE"),
      String(row.body ?? "You have a new update in the portal."),
      validUrl(row.url),
    );

    await admin.from("notification_outbox").update({
      status: outcome.status,
      provider_response: outcome.provider,
      sent_at: outcome.status === "sent" ? new Date().toISOString() : null,
    }).eq("id", row.id);

    results.push({ id: String(row.id), status: outcome.status });
  }

  return json({ ok: true, dispatched: results.length, results });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // The App ID is public, but the REST key must remain a server-side secret.
  // Support the project-provided Vite name for the public ID while keeping the
  // server secret on the Edge Function only.
  const APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? Deno.env.get("VITE_ONESIGNAL_APP_ID") ?? "";
  const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
  if (!APP_ID || !API_KEY) return json({ error: "Push not configured (missing OneSignal app credentials on server)." }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured." }, 500);

  const admin = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  // ── Internal cron dispatch ────────────────────────────────────────────────
  // verify_jwt is off because pg_cron cannot mint a user JWT; this header check
  // is what protects the endpoint instead, and the browser path below still
  // requires a real verified session.
  const dispatchToken = req.headers.get("x-push-dispatch");
  if (dispatchToken) {
    const { data: tokenRow } = await admin.from("push_dispatch_token").select("token").limit(1).maybeSingle();
    const expected = String((tokenRow as any)?.token ?? "");
    if (!expected || !sameToken(dispatchToken, expected)) {
      return json({ error: "Unauthorized dispatch." }, 401);
    }
    return await dispatchQueued(admin, APP_ID, API_KEY, body?.limit);
  }

  // ── Browser / admin sends ─────────────────────────────────────────────────
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Sign in required." }, 401);
  const caller = createClient(supabaseUrl, anonKey || serviceKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await caller.auth.getUser(jwt);
  if (!user) return json({ error: "Invalid session." }, 401);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = String((profile as any)?.role ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const isStaff = STAFF_ROLES.includes(role);

  const title = String(body.title ?? "").trim().slice(0, 120);
  const message = String(body.message ?? body.body ?? "").trim().slice(0, 1000);
  if (!title || !message) return json({ error: "Title and message are required." }, 400);
  const url = validUrl(body.url);
  // Accept both `user_id` (canonical) and `userId` (older client callers) and
  // infer a single-user audience so a direct message can never fan out to all.
  const targetUserId = body.user_id ?? body.userId;
  const audience = String(body.audience ?? (targetUserId ? "user" : "all")).slice(0, 40);
  const courseId = body.course_id ? String(body.course_id).slice(0, 80) : null;
  const idempotencyKey = String(body.idempotency_key ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 120);

  // One-to-one alerts (direct messages) are open to any signed-in member, but
  // only for someone they already have a conversation with. Everything broader
  // stays staff-only.
  if (!isStaff) {
    if (!(audience === "user" && targetUserId)) {
      return json({ error: "Only authorized staff may send push notifications." }, 403);
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetUserId))) {
      return json({ error: "Unknown recipient." }, 400);
    }
    const { data: thread } = await admin
      .from("direct_messages")
      .select("id")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
      .limit(1)
      .maybeSingle();
    if (!thread) return json({ error: "You can only notify someone you have already messaged." }, 403);
  }

  // Broadcasts require admin-level roles; others may only target their course/all-students flows.
  if ((audience === "all" || audience === "all_users") && !["admin", "super_admin", "registrar"].includes(role)) {
    return json({ error: "Institution-wide sends require an administrator or registrar." }, 403);
  }

  // Idempotency: same key returns the earlier result without re-sending.
  const { data: existing } = await admin.from("notification_outbox").select("id,status,provider_response").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) return json({ ok: true, deduped: true, outbox_id: (existing as any).id, status: (existing as any).status });

  // Resolve recipients server-side from trusted records (never trust browser tags).
  let externalIds: string[] = [];
  let filters: any[] | undefined;
  if (audience === "all" || audience === "all_users") {
    filters = undefined; // OneSignal: included_segments ["Subscribed Users"]
  } else if (audience === "students" || audience === "teachers" || audience === "admins" || audience === "staff") {
    filters = [{ field: "tag", key: "role", relation: "=", value: audience }];
  } else if (audience === "course" && courseId) {
    filters = [{ field: "tag", key: "course_" + courseId, relation: "exists" }];
  } else if (audience === "user" && targetUserId) {
    externalIds = [String(targetUserId).slice(0, 80)];
  } else {
    return json({ error: "Unknown audience. Use all, students, teachers, admins, staff, course or user." }, 400);
  }

  const { data: outbox, error: obErr } = await admin.from("notification_outbox").insert({
    idempotency_key: idempotencyKey, title, body: message, url, audience,
    course_id: courseId, created_by: user.id, status: "sending",
    recipient_id: audience === "user" && targetUserId ? String(targetUserId) : null,
  }).select("id").maybeSingle();
  if (obErr) return json({ error: "Could not queue notification." }, 500);
  const outboxId = (outbox as any)?.id as string;

  // Build OneSignal payload. Scores/credentials never go in content.
  const payload: Record<string, unknown> = {
    app_id: APP_ID,
    headings: { en: title },
    contents: { en: message },
    data: { url, outbox_id: outboxId },
    chrome_web_icon: "/icons/icon-192.png",
    chrome_web_badge: "/icons/icon-192.png",
  };
  // Web push click opens the in-app destination; keep same-origin only.
  (payload as any).web_url = url.startsWith("#") ? "/" + url : url.startsWith("/") ? url : "/";
  if (externalIds.length) (payload as any).include_external_user_ids = externalIds;
  else if (filters) (payload as any).filters = filters;
  else (payload as any).included_segments = ["Subscribed Users"];

  let providerStatus = "failed";
  let providerResponse: unknown = null;
  try {
    const res = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${API_KEY}` },
      body: JSON.stringify(payload),
    });
    providerResponse = await res.json().catch(() => ({ http: res.status }));
    const provider = providerResponse as any;
    const providerIds: string[] = Array.isArray(provider?.id)
      ? provider.id.map((v: unknown) => String(v))
      : provider?.id ? [String(provider.id)] : [];
    const providerErrors: string[] = Array.isArray(provider?.errors)
      ? provider.errors.map((e: unknown) => String(e))
      : [];
    // OneSignal answers 200 with an `errors` array when nothing was deliverable
    // ("All included players are not subscribed" before anyone opts in). An
    // empty id with errors is not a send, so never record it as one.
    providerStatus = res.ok && providerErrors.length === 0 && providerIds.length > 0 ? "sent" : "failed";
    // The in-app row is authoritative and independent of push delivery, so it is
    // written even when the device is offline — but a trigger may already have
    // written the same row (a direct message raises its own notification), so
    // identical rows from the last ten minutes are not duplicated.
    const freshlyInserted: string[] = [];
    for (const uid of externalIds) {
      const { data: duplicate } = await admin
        .from("notifications")
        .select("id")
        .eq("recipient_id", uid)
        .eq("title", title)
        .eq("body", message)
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();
      if (duplicate) continue;
      const { data: created } = await admin.from("notifications").insert({
        recipient_id: uid, user_id: uid, title, body: message, url, kind: "announcement", read: false,
      }).select("id").maybeSingle();
      if (created) freshlyInserted.push(String((created as any).id));
    }
    // Inserting that row also queues it for the pg_cron dispatcher. This request
    // has already pushed it, so close the queued copy rather than send twice.
    if (freshlyInserted.length) {
      await admin
        .from("notification_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_response: { deduplicated: "delivered by the requesting session" },
        })
        .in("notification_id", freshlyInserted)
        .eq("status", "queued")
        .then(() => undefined)
        .catch(() => undefined);
    }
  } catch (e) {
    providerResponse = { error: e instanceof Error ? e.message : "send failed" };
  }

  await admin.from("notification_outbox").update({
    status: providerStatus, provider_response: providerResponse,
    sent_at: providerStatus === "sent" ? new Date().toISOString() : null,
  }).eq("id", outboxId);

  // Never log the API key; the response contains only OneSignal ids/errors.
  if (providerStatus !== "sent") {
    return json({ error: "The push was not delivered. Check the audience and whether any device is subscribed.", detail: providerResponse }, 502);
  }
  return json({ ok: true, outbox_id: outboxId, onesignal: providerResponse });
});
