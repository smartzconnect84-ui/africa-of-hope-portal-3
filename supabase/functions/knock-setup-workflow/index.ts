import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const KNOCK_SERVICE_TOKEN = Deno.env.get("KNOCK_SERVICE_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BASE = "https://control.knock.app/v1";

async function mgmt(path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + KNOCK_SERVICE_TOKEN, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, text, json };
}

Deno.serve(async (req) => {
  const token = req.headers.get("x-push-dispatch") ?? "";
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\\s+/i, "");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let ok = false;
  if (serviceRole && auth === serviceRole) ok = true;
  if (!ok) {
    const { data: tokenRow } = await admin.from("push_dispatch_token").select("token").limit(1).maybeSingle();
    if (tokenRow?.token && token === tokenRow.token) ok = true;
  }
  if (!ok) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const url = new URL(req.url);
  const action = (url.searchParams.get("action") ?? body.action ?? "probe") as string;

  if (action === "probe") {
    const envs = await mgmt("/environments");
    const channels = await mgmt("/channels");
    return new Response(JSON.stringify({ envs, channels }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (action === "upsert-workflow") {
    const env = (body.environment ?? "development") as string;
    const channelKey = body.channel_key as string;
    const payload = {
      workflow: {
        name: "In-app notification",
        steps: [
          {
            ref: "channel_1",
            type: "channel",
            channel_key: channelKey,
            template: { type: "markdown", markdown_body: "**{{ title }}**\n\n{{ body }}", action_url: "{{ url }}" },
          },
        ],
      },
    };
    const up = await mgmt("/workflows/in-app-notification?environment=" + encodeURIComponent(env) + "&commit=true&force=true", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return new Response(JSON.stringify(up), { status: up.status, headers: { "Content-Type": "application/json" } });
  }

  if (action === "promote") {
    const to = (body.to_environment ?? "production") as string;
    const up = await mgmt("/commits/promote?to_environment=" + encodeURIComponent(to), { method: "PUT" });
    return new Response(JSON.stringify(up), { status: up.status, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), { status: 400 });
});
