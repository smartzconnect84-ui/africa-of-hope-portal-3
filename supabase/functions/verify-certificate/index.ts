import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return json({ error: "Request too large" }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: "Invalid JSON" }, 400); }
  const serial = body && typeof body === "object" && "serial" in body && typeof body.serial === "string"
    ? body.serial.trim() : "";
  if (!serial || serial.length > 80) return json({ error: "Enter a certificate serial (1–80 characters)" }, 400);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return json({ error: "Verification is not configured" }, 503);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("verify_public_certificate", { p_serial: serial });
  if (error) {
    console.error("Certificate lookup failed", error.code);
    return json({ error: "The register is unavailable. Please contact the registrar or try again later." }, 503);
  }
  return json({ valid: data?.status === "Valid", certificate: data ?? null });
});
