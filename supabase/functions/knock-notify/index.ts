import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KNOCK_API_KEY = Deno.env.get("KNOCK_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  if (!KNOCK_API_KEY) return new Response(JSON.stringify({ error: "Knock not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const workflow = String(body?.workflow ?? "");
  const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
  const data = body?.data ?? {};

  if (!workflow || recipients.length === 0) {
    return new Response(JSON.stringify({ error: "workflow and recipients required" }), { status: 400 });
  }

  const res = await fetch(`https://api.knock.app/v1/workflows/${encodeURIComponent(workflow)}/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KNOCK_API_KEY}`,
    },
    body: JSON.stringify({ recipients, data, actor: user.id }),
  });

  const text = await res.text();
  return new Response(text, { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
