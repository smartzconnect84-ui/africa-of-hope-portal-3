import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function timingSafeEqual(a: string, b: string): boolean {
  const aB = new TextEncoder().encode(a);
  const bB = new TextEncoder().encode(b);
  const len = Math.max(aB.length, bB.length, 32);
  let diff = aB.length === bB.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (i < aB.length ? aB[i] : 0) ^ (i < bB.length ? bB[i] : 0);
  return diff === 0;
}

const STAFF_ROLES = ["admin", "super_admin", "registrar", "support", "teacher", "instructor", "admissions"];
const validUrl = (u: unknown): string => {
  try {
    const s = String(u ?? "/");
    if (!s.startsWith("/")) return "/";
    const url = new URL(s, "https://example.org");
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
  const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
  if (!APP_ID || !API_KEY) return json({ error: "Push not configured (missing OneSignal app credentials on server)." }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured." }, 500);

  // Caller must be an authenticated staff member (admin/registrar/support/teacher).
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Sign in required." }, 401);
  const caller = createClient(supabaseUrl, anonKey || serviceKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await caller.auth.getUser(jwt);
  if (!user) return json({ error: "Invalid session." }, 401);
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = String((profile as any)?.role ?? "").toLowerCase();
  if (!STAFF_ROLES.includes(role)) return json({ error: "Only authorized staff may send push notifications." }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const title = String(body.title ?? "").trim().slice(0, 120);
  const message = String(body.message ?? body.body ?? "").trim().slice(0, 1000);
  if (!title || !message) return json({ error: "Title and message are required." }, 400);
  const url = validUrl(body.url);
  const audience = String(body.audience ?? "all").slice(0, 40);
  const courseId = body.course_id ? String(body.course_id).slice(0, 80) : null;
  const idempotencyKey = String(body.idempotency_key ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 120);

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
  } else if (audience === "user" && body.user_id) {
    externalIds = [String(body.user_id).slice(0, 80)];
  } else {
    return json({ error: "Unknown audience. Use all, students, teachers, admins, staff, course or user." }, 400);
  }

  const { data: outbox, error: obErr } = await admin.from("notification_outbox").insert({
    idempotency_key: idempotencyKey, title, body: message, url, audience,
    course_id: courseId, created_by: user.id, status: "sending",
  }).select("id").maybeSingle();
  if (obErr) return json({ error: "Could not queue notification." }, 500);
  const outboxId = (outbox as any)?.id as string;

  // Build OneSignal payload. Scores/credentials never go in content.
  const payload: Record<string, unknown> = {
    app_id: APP_ID,
    headings: { en: title },
    contents: { en: message },
    url: undefined as unknown,
    web_url: undefined as unknown,
    data: { url, outbox_id: outboxId },
    chrome_web_icon: "/icons/icon-192.png",
    chrome_web_badge: "/icons/icon-192.png",
  };
  // Web push click opens the in-app destination; keep same-origin only.
  (payload as any).web_url = url.startsWith("/") ? url : "/";
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
    providerStatus = res.ok ? "sent" : "failed";
    // Persist in-app records for targeted single users (authoritative store).
    if (res.ok && externalIds.length) {
      await admin.from("notifications").insert(externalIds.map((uid) => ({
        user_id: uid, title, body: message, url, kind: "announcement", read: false,
      }))).then(() => undefined).catch(() => undefined);
    }
  } catch (e) {
    providerResponse = { error: e instanceof Error ? e.message : "send failed" };
  }

  await admin.from("notification_outbox").update({
    status: providerStatus, provider_response: providerResponse,
  }).eq("id", outboxId);

  // Timing-safe: never log the API key; response contains only OneSignal ids/errors.
  if (providerStatus !== "sent") return json({ error: "Provider rejected the send. Check audience and retry.", detail: providerResponse }, 502);
  return json({ ok: true, outbox_id: outboxId, onesignal: providerResponse });
});
