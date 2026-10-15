import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { roleIntro, SYSTEM_PROMPT, UNAVAILABLE_MESSAGE, type AssistantSurface } from "./guide.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const sse = (body: unknown) => `data: ${JSON.stringify(body)}\n\n`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 10;
const MAX_USER_CHARS = 1500;
const MAX_ASSISTANT_CHARS = 2000;
const MAX_TOTAL_CHARS = 12000;

function validateMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const trimmed = raw.slice(-MAX_MESSAGES);
  let total = 0;
  const out: ChatMessage[] = [];
  for (const m of trimmed) {
    if (!m || typeof m !== "object") return null;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const limit = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (content.length === 0 || content.length > limit) return null;
    total += content.length;
    out.push({ role, content });
  }
  if (total > MAX_TOTAL_CHARS) return null;
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Current window bucket boundary, matching `assistant_consume`'s own bucketing math. */
function windowStartIso(windowSeconds: number): string {
  const bucketed = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  return new Date(bucketed * 1000).toISOString();
}

const GLOBAL_DAILY_REQUESTS = 2000;
const GLOBAL_DAILY_TOKENS = 1_500_000;
const DAY = 86_400;
const HOUR = 3_600;

type Row = Record<string, unknown>;

async function buildPublicContext(admin: ReturnType<typeof createClient>): Promise<string> {
  const [{ data: settings }, { data: programs }] = await Promise.all([
    admin.from("system_settings").select(
      "academy_name, motto, contact_email, contact_phone, address, academic_year, semester, intake_status",
    ).limit(1).maybeSingle(),
    admin.from("programs").select("title, category, duration_weeks, tuition, certification").order("title").limit(20),
  ]);
  return JSON.stringify({
    academy: settings ?? null,
    programmes: (programs as Row[] | null) ?? [],
    verify_help: "Certificates can be verified on the public Verify Certificate page using the certificate serial number.",
  });
}

async function buildStudentContext(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: profile } = await admin
    .from("profiles")
    .select("name, status, program_ids, cohort_ids")
    .eq("id", userId)
    .maybeSingle();
  const programIds = ((profile as Row | null)?.program_ids as string[] | undefined) ?? [];
  const cohortIds = ((profile as Row | null)?.cohort_ids as string[] | undefined) ?? [];

  const [{ data: programs }, { data: cohorts }, { data: fees }, { data: certs }, { data: attempts }] = await Promise.all([
    programIds.length ? admin.from("programs").select("id, title, tuition").in("id", programIds) : Promise.resolve({ data: [] }),
    cohortIds.length ? admin.from("cohorts").select("id, name").in("id", cohortIds) : Promise.resolve({ data: [] }),
    admin.from("fee_transactions").select("amount").eq("student_id", userId),
    admin.from("certificates").select("id, program_id, status, issue_date").eq("student_id", userId),
    admin.from("quiz_attempts").select("percent, passed, status").eq("student_id", userId).order("submitted_at", { ascending: false }).limit(10),
  ]);

  const tuitionTotal = ((programs as Row[] | null) ?? []).reduce((s, p) => s + Number(p.tuition ?? 0), 0);
  const paidTotal = ((fees as Row[] | null) ?? []).reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const graded = ((attempts as Row[] | null) ?? []).filter((a) => a.status !== "in_progress");

  return JSON.stringify({
    name: (profile as Row | null)?.name ?? null,
    status: (profile as Row | null)?.status ?? null,
    programmes: (programs as Row[] | null) ?? [],
    cohorts: (cohorts as Row[] | null) ?? [],
    balance_due: Math.max(tuitionTotal - paidTotal, 0),
    certificates: (certs as Row[] | null) ?? [],
    recent_quiz_attempts: graded.map((a) => ({ percent: a.percent, passed: a.passed })),
  });
}

async function buildTeacherContext(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id, name, program_id, programs(title)")
    .eq("teacher_id", userId);
  const cohortRows = (cohorts as Row[] | null) ?? [];
  const counts = await Promise.all(
    cohortRows.map((c) =>
      admin.from("cohort_students").select("student_id", { count: "exact", head: true }).eq("cohort_id", c.id as string),
    ),
  );
  return JSON.stringify({
    cohorts: cohortRows.map((c, i) => ({
      name: c.name,
      programme: (c.programs as Row | null)?.title ?? null,
      student_count: counts[i]?.count ?? null,
    })),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed", code: "bad_method" }, 400);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const salt = Deno.env.get("ASSISTANT_SALT") ?? "aoh-assistant";

    const admin = createClient(url, serviceKey);

    // The system settings toggle (admin.system_settings.assistant_enabled) and
    // a missing API key both produce the exact same friendly 503 — neither
    // case should ever reach the model.
    const { data: settingsRow } = await admin.from("system_settings").select("assistant_enabled").maybeSingle();
    const enabled = (settingsRow as Row | null)?.assistant_enabled !== false;
    if (!openaiKey || !enabled) {
      return json({ error: UNAVAILABLE_MESSAGE, code: "unavailable" }, 503);
    }

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid request body", code: "invalid_request" }, 400);

    const messages = validateMessages(body.messages);
    if (!messages) return json({ error: "Invalid message history", code: "invalid_request" }, 400);

    const surface: AssistantSurface = body.surface === "portal" ? "portal" : "public";

    // ── identity ──────────────────────────────────────────────────────
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    let userId: string | null = null;
    let role: string | null = null;
    if (token) {
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: authData } = await caller.auth.getUser();
      if (authData?.user) {
        userId = authData.user.id;
        const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
        role = ((profile as Row | null)?.role as string | undefined) ?? null;
      }
    }

    // ── rate limits (never logs message content) ───────────────────────
    let identityBucket: string;
    let identityMax: number;
    if (userId) {
      identityBucket = `user:${userId}`;
      identityMax = 60;
    } else {
      const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
      identityBucket = `anon:${await sha256Hex(ip + salt)}`;
      identityMax = 15;
    }

    const { data: withinIdentityLimit } = await admin.rpc("assistant_consume", {
      p_bucket: identityBucket,
      p_window_seconds: HOUR,
      p_max_requests: identityMax,
    });
    if (withinIdentityLimit !== true) {
      return json({ error: "You've reached the chat limit for now — please try again in a bit.", code: "rate_limited" }, 429);
    }

    const { data: withinGlobalLimit } = await admin.rpc("assistant_consume", {
      p_bucket: "global:requests",
      p_window_seconds: DAY,
      p_max_requests: GLOBAL_DAILY_REQUESTS,
    });
    if (withinGlobalLimit !== true) {
      return json({ error: "Hope Assistant is busy right now — please try again later today.", code: "rate_limited" }, 429);
    }

    const { data: tokenUsageRow } = await admin
      .from("assistant_usage")
      .select("tokens")
      .eq("bucket", "global:tokens")
      .eq("window_start", windowStartIso(DAY))
      .maybeSingle();
    if (((tokenUsageRow as Row | null)?.tokens as number | undefined ?? 0) >= GLOBAL_DAILY_TOKENS) {
      return json({ error: "Hope Assistant is busy right now — please try again later today.", code: "rate_limited" }, 429);
    }

    // ── scoped context ──────────────────────────────────────────────────
    let dataBlock = "";
    try {
      if (!userId || surface === "public") {
        dataBlock = await buildPublicContext(admin);
      } else if (role === "Student") {
        dataBlock = await buildStudentContext(admin, userId);
      } else if (role === "Teacher") {
        dataBlock = await buildTeacherContext(admin, userId);
      } else {
        dataBlock = await buildPublicContext(admin);
      }
    } catch {
      dataBlock = "{}"; // never block the chat because context lookup failed
    }

    if (userId && role && role !== "Student" && role !== "Teacher") {
      try {
        const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data: canAdminHelp } = await caller.rpc("has_permission", { perm: "assistant.admin_help" });
        if (canAdminHelp === true) {
          const { data: stats } = await caller.rpc("assistant_admin_stats");
          dataBlock = JSON.stringify({ admin_stats: stats ?? null });
        }
      } catch {
        /* fall back to whatever dataBlock already holds */
      }
    }

    const systemContent = `${SYSTEM_PROMPT}\n\n${roleIntro(role, surface)}\n\nDATA: ${dataBlock}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.3,
        max_tokens: 600,
        messages: [{ role: "system", content: systemContent }, ...messages],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!openaiResp.ok || !openaiResp.body) {
      return json({ error: UNAVAILABLE_MESSAGE, code: "unavailable" }, 503);
    }

    const stream = new ReadableStream({
      async start(controllerStream) {
        const reader = openaiResp.body!.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        let totalTokens = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffered += decoder.decode(value, { stream: true });
            const lines = buffered.split("\n");
            buffered = lines.pop() ?? "";
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data:")) continue;
              const payload = trimmedLine.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  controllerStream.enqueue(new TextEncoder().encode(sse({ delta })));
                }
                if (parsed?.usage?.total_tokens) totalTokens = parsed.usage.total_tokens;
              } catch {
                /* ignore partial/malformed SSE lines */
              }
            }
          }
        } catch {
          /* upstream aborted/timed out; still send done below so the client stops waiting */
        } finally {
          controllerStream.enqueue(new TextEncoder().encode(sse({ done: true })));
          controllerStream.close();
          if (totalTokens > 0) {
            admin.rpc("assistant_add_tokens", { p_bucket: "global:tokens", p_window_seconds: DAY, p_tokens: totalTokens })
              .then(() => {}).catch(() => {});
          }
        }
      },
    });

    return new Response(stream, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch {
    return json({ error: "Something went wrong. Please try again.", code: "server_error" }, 500);
  }
});
