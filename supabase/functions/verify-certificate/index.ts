import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await request.json();
    const serial = typeof body?.serial === "string" ? body.serial.trim().toUpperCase() : "";
    if (!serial || serial.length > 80) {
      return new Response(JSON.stringify({ error: "A valid certificate serial is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("certificates")
      .select("serial, issue_date, honors, grade, status, student_id, program_id")
      .eq("serial", serial)
      .maybeSingle();

    if (error) throw error;
    return new Response(JSON.stringify({
      valid: data?.status === "Valid",
      certificate: data ? {
        serial: data.serial,
        issueDate: data.issue_date,
        honors: data.honors,
        grade: data.grade,
        status: data.status,
        studentId: data.student_id,
        programId: data.program_id,
      } : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("verify-certificate failed", error);
    return new Response(JSON.stringify({ error: "Unable to verify certificate" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
