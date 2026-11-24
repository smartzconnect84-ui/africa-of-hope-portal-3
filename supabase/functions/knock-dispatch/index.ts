import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const KNOCK_API_KEY = Deno.env.get("KNOCK_API_KEY") ?? "";
const KNOCK_WORKFLOW = Deno.env.get("KNOCK_WORKFLOW") ?? "in-app-notification";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = req.headers.get("x-push-dispatch") ?? "";
  const { data: tokenRow } = await admin.from("push_dispatch_token").select("token").limit(1).maybeSingle();
  if (!tokenRow?.token || token !== tokenRow.token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { notification_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const id = body.notification_id;
  if (!id) return new Response(JSON.stringify({ error: "notification_id required" }), { status: 400 });

  const { data: n, error } = await admin.from("notifications").select("*").eq("id", id).maybeSingle();
  if (error || !n) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  const recipient = n.recipient_id ?? n.user_id;
  if (!recipient) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

  if (!KNOCK_API_KEY) return new Response(JSON.stringify({ error: "KNOCK_API_KEY not set" }), { status: 503 });

  const res = await fetch("https://api.knock.app/v1/workflows/" + encodeURIComponent(KNOCK_WORKFLOW) + "/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + KNOCK_API_KEY,
    },
    body: JSON.stringify({
      recipients: [recipient],
      data: {
        notification_id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        url: n.url,
        entity_type: n.entity_type,
        entity_id: n.entity_id,
      },
    }),
  });

  const text = await res.text();
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, body: text }), { status: res.status, headers: { "Content-Type": "application/json" } });
});
