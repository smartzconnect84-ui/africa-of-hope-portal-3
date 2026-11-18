import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ORGANIZATION_PROFILE, roleIntro, SYSTEM_PROMPT, UNAVAILABLE_MESSAGE, type AssistantSurface } from "./guide.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
const MAX_ASSISTANT_CHARS = 24000;
const MAX_TOTAL_CHARS = 36000;
const MAX_BODY_BYTES = 128000;

async function readBody(req: Request): Promise<unknown> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function validateMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null;
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
    if (!content.trim() || content.length > limit) return null;
    total += content.length;
    out.push({ role, content });
  }
  // Evict older turns rather than rejecting a valid follow-up to a long reply.
  while (total > MAX_TOTAL_CHARS && out.length > 1) {
    total -= out.shift()!.content.length;
  }
  while (out.length > 1 && out[0].role === "assistant") out.shift();
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

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || Number.isNaN(n) ? null : n;
};

/** Public page anchors the model may cite. Never invent other URLs. */
const PAGE_LINKS: Record<string, string> = {
  about: "#about", programmes: "#programmes", admissions: "#admissions", "term dates": "#term-dates", verify: "#verify", contact: "#contact", blog: "#blog", transparency: "#transparency", support: "#donate", team: "#team",
};

interface KnowledgeDoc { source: string; title: string; url: string; text: string }

function queryTokens(query: string): string[] {
  return query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !["the", "and", "for", "with", "what", "how", "does", "are", "you", "your"].includes(t)).slice(0, 24);
}

/** Keyword relevance ranking over live records (no separate index to go stale). */
function rankDocs(query: string, docs: KnowledgeDoc[], limit: number): KnowledgeDoc[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return docs.slice(0, limit);
  return docs.map((d) => {
    const hay = `${d.title} ${d.text}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (d.title.toLowerCase().includes(t)) score += 3;
      else if (hay.includes(t)) score += 1;
    }
    return { d, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.d);
}

function classifyQuery(text: string): string {
  const q = text.toLowerCase();
  const org = /(africa of hope|aoh\b|afrohope|enrol|admission|apply|course|program|training|fee|tuition|certificate|verify|intake|semester|cohort|contact|office|location|requirement|deadline|accredit)/.test(q);
  const general = /(explain|what is|how does|define|tutorial|example|principle|write|essay|code|math|physics|chemistry|biology|history|science|ai\b|artificial intelligence|entrepreneur|leadership|marketing|network)/.test(q);
  if (org && general) return "C";
  if (org) return "A";
  if (general) return "B";
  return "A";
}

/** Live retrieval across published public records. Unpublished/private rows are excluded here. */
async function buildPublicContext(admin: ReturnType<typeof createClient>, query: string): Promise<string> {
  const [settingsResult, programsResult, announcementsResult, blogResult] = await Promise.all([
    admin.from("system_settings").select("*").limit(1).maybeSingle(),
    admin.from("programs").select("*").order("title").limit(40),
    admin.from("announcements").select("*").order("created_at", { ascending: false }).limit(20),
    admin.from("blog_posts").select("id, slug, title, excerpt, status, published_at").order("published_at", { ascending: false }).limit(15),
  ]);
  const settings = (settingsResult.error ? null : settingsResult.data) as Row | null;
  const websiteSettings = (settings?.website_settings as Row | null) ?? null;
  const faqsRaw = (websiteSettings?.faqs ?? websiteSettings?.faq) as unknown;
  const faqList = Array.isArray(faqRaw) ? faqRaw : [];
  const admissionReqs = str(websiteSettings?.admissionRequirements ?? websiteSettings?.admission_requirements);
  const admissionSteps = str(websiteSettings?.admissionSteps ?? websiteSettings?.admission_steps ?? websiteSettings?.enrollmentProcedures);
  const contactEmail = str(settings?.contact_email) || str(websiteSettings?.contactEmail);
  const contactPhone = str(settings?.contact_phone) || str(websiteSettings?.contactPhone);
  const address = str(settings?.address) || str(websiteSettings?.address);

  const programRows = (programsResult.error ? [] : (programsResult.data as Row[] | null) ?? [])
    .filter((p) => (p.published as boolean | undefined) !== false);
  const announcementRows = (announcementsResult.error ? [] : (announcementsResult.data as Row[] | null) ?? [])
    .filter((a) => {
      const status = str(a.status).toLowerCase();
      if (status && !["published", "active", "public"].includes(status)) return false;
      const audience = str((a as Row).audience ?? (a as Row).visibility).toLowerCase();
      if (audience && !["public", "all", "everyone", ""].includes(audience)) return false;
      const expires = (a as Row).expires_at ? Date.parse(str((a as Row).expires_at)) : NaN;
      if (!Number.isNaN(expires) && expires < Date.now()) return false;
      return true;
    });
  const blogRows = (blogResult.error ? [] : (blogResult.data as Row[] | null) ?? [])
    .filter((b) => ["published", "scheduled"].includes(str(b.status).toLowerCase() || "published"))
    .filter((b) => !b.published_at || Date.parse(str(b.published_at)) <= Date.now());

  const docs: KnowledgeDoc[] = [];
  for (const p of programRows) {
    const title = str(p.title);
    if (!title) continue;
    const parts = [str(p.description), str(p.entry_requirements ?? p.requirements) ? `Entry requirements: ${str(p.entry_requirements ?? p.requirements)}` : "", [num(p.duration_weeks) ? `${num(p.duration_weeks)} weeks` : "", (Array.isArray(p.delivery_modes) ? (p.delivery_modes as unknown[]).map(String).join(", ") : str(p.delivery_modes)) ? `Modes: ${Array.isArray(p.delivery_modes) ? (p.delivery_modes as unknown[]).map(String).join(", ") : str(p.delivery_modes)}` : "", num(p.tuition) !== null ? `Tuition: ${num(p.tuition)}` : "", str(p.certification) ? `Certificate: ${str(p.certification)}` : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
    docs.push({ source: "programmes", title, url: PAGE_LINKS.programmes, text: parts.slice(0, 600) });
  }
  for (const a of announcementRows) {
    const title = str(a.title) || "Announcement";
    const body = str(a.body ?? a.message ?? a.content).slice(0, 500);
    if (!body && !title) continue;
    docs.push({ source: "announcement", title, url: PAGE_LINKS.blog, text: body });
  }
  for (const b of blogRows) {
    const title = str(b.title);
    if (!title) continue;
    docs.push({ source: "news", title, url: str(b.slug) ? `#blog/${str(b.slug)}` : PAGE_LINKS.blog, text: str(b.excerpt).slice(0, 400) });
  }
  for (const f of faqList.slice(0, 20)) {
    const r = f as Row;
    const q = str(r.question ?? r.q ?? r.title);
    const a = str(r.answer ?? r.a ?? r.body);
    if (!q && !a) continue;
    docs.push({ source: "faq", title: q || "FAQ", url: PAGE_LINKS.contact, text: a.slice(0, 500) });
  }
  if (admissionReqs) docs.push({ source: "admissions", title: "Admission requirements", url: PAGE_LINKS.admissions, text: admissionReqs.slice(0, 800) });
  if (admissionSteps) docs.push({ source: "admissions", title: "Enrolment procedure", url: PAGE_LINKS.admissions, text: admissionSteps.slice(0, 800) });

  const relevant = rankDocs(query, docs, 8);
  return JSON.stringify({
    organization: ORGANIZATION_PROFILE,
    academy: { name: str(settings?.academy_name) || "AFRICA OF HOPE", motto: str(settings?.motto), academic_year: str(settings?.academic_year), semester: str(settings?.semester), intake_status: str(settings?.intake_status), banner: str(settings?.marketing_banner) },
    contact: { email: contactEmail || null, phone: contactPhone || null, address: address || null },
    programme_count: programRows.length,
    programmes: programRows.slice(0, 20).map((p) => ({ title: str(p.title), category: str(p.category), duration_weeks: num(p.duration_weeks), tuition: num(p.tuition), certification: str(p.certification) })),
    relevant_sources: relevant,
    source_note: "Live published records for this request. Null means unavailable, not zero. Only published public records are included; drafts, unpublished, expired and private records are excluded. Cite relevant_sources titles with their url anchors.",
    verify_help: "Certificates are verified on the public Verify Certificate page (#verify) using the certificate serial number.",
  });
}

async function buildStudentContext(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("name, status, program_ids, cohort_ids")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Student context unavailable");
  const programIds = ((profile as Row | null)?.program_ids as string[] | undefined) ?? [];
  const cohortIds = ((profile as Row | null)?.cohort_ids as string[] | undefined) ?? [];

  const [programs, cohorts, fees, certs, attempts] = await Promise.all([
    programIds.length ? admin.from("programs").select("id, title, tuition").in("id", programIds) : Promise.resolve({ data: [], error: null }),
    cohortIds.length ? admin.from("cohorts").select("id, name").in("id", cohortIds) : Promise.resolve({ data: [], error: null }),
    admin.from("fee_transactions").select("amount").eq("student_id", userId),
    admin.from("certificates").select("id, program_id, status, issue_date").eq("student_id", userId),
    admin.from("quiz_attempts").select("percent, passed, status").eq("student_id", userId).order("submitted_at", { ascending: false }).limit(10),
  ]);

  // Never turn a failed data lookup into a zero balance or an empty record.
  if ([programs, cohorts, fees, certs, attempts].some((result) => result.error)) {
    throw new Error("Student context unavailable");
  }
  const tuitionTotal = ((programs.data as Row[] | null) ?? []).reduce((s, p) => s + Number(p.tuition ?? 0), 0);
  const paidTotal = ((fees.data as Row[] | null) ?? []).reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const graded = ((attempts.data as Row[] | null) ?? []).filter((a) => a.status !== "in_progress");

  return JSON.stringify({
    name: (profile as Row | null)?.name ?? null,
    status: (profile as Row | null)?.status ?? null,
    programmes: (programs.data as Row[] | null) ?? [],
    cohorts: (cohorts.data as Row[] | null) ?? [],
    balance_due: Math.max(tuitionTotal - paidTotal, 0),
    certificates: (certs.data as Row[] | null) ?? [],
    recent_quiz_attempts: graded.map((a) => ({ percent: a.percent, passed: a.passed })),
  });
}

async function buildTeacherContext(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: cohorts, error: cohortsError } = await admin
    .from("cohorts")
    .select("id, name, program_id, programs(title)")
    .eq("teacher_id", userId);
  if (cohortsError) throw new Error("Teacher context unavailable");
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
      student_count: counts[i]?.error ? null : counts[i]?.count ?? null,
    })),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── safe status probe (no secrets leaked) ───────────────────────────
  // GET /assistant returns { enabled, configured, model, deployed: true } so
  // the portal's System Settings panel can show what still needs configuring.
  // POST { "healthCheck": true } does the same for clients that can only POST.
  async function statusPayload() {
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(url, serviceKey);
      const { data, error } = await admin.from("system_settings").select("assistant_enabled").limit(1).maybeSingle();
      if (error) throw new Error("Settings unavailable");
      const enabled = (data as Row | null)?.assistant_enabled !== false;
      return json({
        deployed: true,
        enabled,
        configured: Boolean(Deno.env.get("GROQ_API_KEY")),
        model: Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b",
        provider: "groq",
      });
    } catch {
      return json({ error: "Assistant settings could not be checked.", code: "settings_unavailable" }, 503);
    }
  }
  if (req.method === "GET") return statusPayload();
  if (req.method !== "POST") return json({ error: "Method not allowed", code: "bad_method" }, 400);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const groqModel = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b";
    const salt = Deno.env.get("ASSISTANT_SALT") ?? "aoh-assistant";

    const body = await readBody(req) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid or oversized request body", code: "invalid_request" }, 400);
    }
    if (body.healthCheck === true || body.status === true) return statusPayload();

    const admin = createClient(url, serviceKey);

    // A disabled toggle and a missing key must not reach the model. They
    // return different codes so the chat can tell the admin what to fix.
    const { data: settingsRow, error: settingsError } = await admin.from("system_settings").select("assistant_enabled").limit(1).maybeSingle();
    if (settingsError) return json({ error: "Assistant settings are unavailable. Please try again later.", code: "settings_unavailable" }, 503);
    const enabled = (settingsRow as Row | null)?.assistant_enabled !== false;
    if (!enabled) {
      console.error("assistant unavailable: assistant_enabled is false");
      return json({ error: "AOH AI is turned off in System Settings.", code: "disabled" }, 503);
    }
    if (!groqKey) {
      console.error("assistant unavailable: GROQ_API_KEY is not set");
      return json({
        error: "AOH AI is not configured. Add the GROQ_API_KEY secret to this function.",
        code: "missing_key",
      }, 503);
    }

    const messages = validateMessages(body.messages);
    if (!messages) return json({ error: "Invalid message history", code: "invalid_request" }, 400);

    const surface: AssistantSurface = body.surface === "portal" ? "portal" : "public";

    // ── identity ──────────────────────────────────────────────────────
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    let userId: string | null = null;
    let role: string | null = null;
    if (token && token !== anonKey) {
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: authData, error: authError } = await caller.auth.getUser();
      if (authError || !authData?.user) {
        return json({ error: "Your session could not be verified. Please sign in again.", code: "unauthorized" }, 401);
      }
      userId = authData.user.id;
      const { data: allowed, error: permissionError } = await caller.rpc("has_permission", { perm: "assistant.use" });
      if (permissionError) return json({ error: "Assistant access could not be checked.", code: "permissions_unavailable" }, 503);
      if (allowed !== true) return json({ error: "Your account does not have permission to use the assistant.", code: "forbidden" }, 403);
      const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (profileError || !profile) return json({ error: "Your assistant profile could not be checked.", code: "permissions_unavailable" }, 503);
      role = ((profile as Row | null)?.role as string | undefined) ?? null;
    }
    if (surface === "portal" && !userId) {
      return json({ error: "Sign in to use the portal assistant.", code: "unauthorized" }, 401);
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

    const { data: withinIdentityLimit, error: identityLimitError } = await admin.rpc("assistant_consume", {
      p_bucket: identityBucket,
      p_window_seconds: HOUR,
      p_max_requests: identityMax,
    });
    if (identityLimitError) return json({ error: "Assistant usage controls are unavailable. Ask the administrator to check the assistant database setup.", code: "usage_unavailable" }, 503);
    if (withinIdentityLimit !== true) {
      return json({ error: "You've reached the chat limit for now — please try again in a bit.", code: "rate_limited" }, 429);
    }

    const { data: withinGlobalLimit, error: globalLimitError } = await admin.rpc("assistant_consume", {
      p_bucket: "global:requests",
      p_window_seconds: DAY,
      p_max_requests: GLOBAL_DAILY_REQUESTS,
    });
    if (globalLimitError) return json({ error: "Assistant usage controls are unavailable. Please try again later.", code: "usage_unavailable" }, 503);
    if (withinGlobalLimit !== true) {
      return json({ error: "AFROHOPE AI is busy right now — please try again later today.", code: "rate_limited" }, 429);
    }

    const { data: tokenUsageRow, error: tokenUsageError } = await admin
      .from("assistant_usage")
      .select("tokens")
      .eq("bucket", "global:tokens")
      .eq("window_start", windowStartIso(DAY))
      .maybeSingle();
    if (tokenUsageError) return json({ error: "Assistant usage tracking is unavailable. Please try again later.", code: "usage_unavailable" }, 503);
    if (((tokenUsageRow as Row | null)?.tokens as number | undefined ?? 0) >= GLOBAL_DAILY_TOKENS) {
      return json({ error: "AFROHOPE AI is busy right now — please try again later today.", code: "rate_limited" }, 429);
    }

    // ── scoped context: live published records are re-read on EVERY request, ─
    // so newly published content is searchable immediately, edits replace old
    // text, and unpublished/deleted rows simply stop appearing. No separate
    // index exists that could go stale, and private tables are never queried
    // for public answers.
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const prevUser = [...messages].reverse().filter((m) => m.role === "user")[1]?.content ?? "";
    const retrievalQuery = `${lastUser} ${prevUser}`.slice(0, 2000);
    const category = classifyQuery(`${prevUser} ${lastUser}`);
    let publicData = null;
    let personalData = null;
    try {
      publicData = JSON.parse(await buildPublicContext(admin, retrievalQuery));
    } catch {
      /* Missing institutional context must not block general-purpose help. */
    }
    try {
      if (userId && surface === "portal" && role === "Student") personalData = JSON.parse(await buildStudentContext(admin, userId));
      if (userId && surface === "portal" && role === "Teacher") personalData = JSON.parse(await buildTeacherContext(admin, userId));
    } catch {
      /* A failed private lookup is unknown; keep the public context intact. */
    }
    let dataBlock = JSON.stringify({ public: publicData, personal: personalData });

    if (surface === "portal" && userId && role && role !== "Student" && role !== "Teacher") {
      try {
        const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data: canAdminHelp } = await caller.rpc("has_permission", { perm: "assistant.admin_help" });
        if (canAdminHelp === true) {
          const { data: stats, error: statsError } = await caller.rpc("assistant_admin_stats");
          if (!statsError) dataBlock = JSON.stringify({ ...JSON.parse(dataBlock || "{}"), admin_stats: stats ?? null });
        }
      } catch {
        /* fall back to whatever dataBlock already holds */
      }
    }

    const systemContent = `${SYSTEM_PROMPT}\n\n${roleIntro(role, surface)}\n\nREQUEST_CATEGORY: ${category} (A = AFRICA OF HOPE facts from KNOWLEDGE/DATA only with page links; B = general knowledge; C = both, clearly labelled; D = say what is unverified and ask for the official detail). The latest user message is the current question; earlier turns resolve follow-ups like "the first one".\n\nKNOWLEDGE: ${dataBlock}`;

    const controller = new AbortController();
    // Covers response headers AND the full upstream stream, not headers alone.
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: groqModel,
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.3,
        max_tokens: 2000,
        messages: [{ role: "system", content: systemContent }, ...messages],
      }),
    }).catch((error) => {
      clearTimeout(timeout);
      throw error;
    });

    if (!groqResp.ok || !groqResp.body) {
      clearTimeout(timeout);
      const status = groqResp.status;
      let code = "groq_error";
      if (status === 401 || status === 403) code = "groq_auth";
      else if (status === 429) code = "groq_rate_limit";
      else if (status === 404) code = "groq_model";
      console.error(`assistant groq failed status=${status} code=${code} model=${groqModel}`);
      return json({ error: "AOH AI could not get a reply from Groq.", code }, 502);
    }

    let cancelled = false;
    const stream = new ReadableStream({
      async start(controllerStream) {
        const reader = groqResp.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffered = "";
        let totalTokens = 0;
        let upstreamDone = false;
        let sawText = false;
        let finishReason: string | null = null;
        const emit = (value: unknown) => {
          if (!cancelled) controllerStream.enqueue(encoder.encode(sse(value)));
        };
        const consumeLine = (line: string) => {
          if (!line.trim().startsWith("data:")) return;
          const payload = line.trim().slice(5).trim();
          if (payload === "[DONE]") { upstreamDone = true; return; }
          if (!payload) return;
          const parsed = JSON.parse(payload);
          if (parsed.error) throw new Error("Upstream stream failed");
          const choice = parsed?.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          const delta = choice?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            sawText = true;
            emit({ delta });
          }
          if (typeof parsed?.usage?.total_tokens === "number") totalTokens = parsed.usage.total_tokens;
        };
        try {
          while (!upstreamDone) {
            const { done, value } = await reader.read();
            if (done) break;
            buffered += decoder.decode(value, { stream: true });
            const lines = buffered.split("\n");
            buffered = lines.pop() ?? "";
            for (const line of lines) consumeLine(line);
          }
          buffered += decoder.decode();
          if (buffered.trim()) consumeLine(buffered);
          if (!upstreamDone || !sawText || finishReason !== "stop") {
            emit({ error: sawText ? "The AI reply was incomplete. Try a shorter request or ask for one section at a time." : "The AI returned no complete reply. Please try again.", code: "incomplete" });
          } else {
            emit({ done: true });
          }
        } catch {
          emit({ error: "The AI connection was interrupted. This reply may be incomplete. Please try again.", code: "interrupted" });
        } finally {
          clearTimeout(timeout);
          await reader.cancel().catch(() => {});
          reader.releaseLock();
          if (!cancelled) controllerStream.close();
          if (totalTokens > 0) {
            const { error } = await admin.rpc("assistant_add_tokens", { p_bucket: "global:tokens", p_window_seconds: DAY, p_tokens: totalTokens });
            if (error) console.error("assistant token accounting failed");
          }
        }
      },
      cancel() {
        cancelled = true;
        clearTimeout(timeout);
        controller.abort();
      },
    });

    return new Response(stream, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch {
    return json({ error: UNAVAILABLE_MESSAGE, code: "server_error" }, 500);
  }
});
