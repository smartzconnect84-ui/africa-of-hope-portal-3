import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamAssistantOptions {
  messages: AssistantMessage[];
  surface: "public" | "portal";
  view?: string;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export class AssistantError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AssistantError";
    this.code = code;
  }
}

function messageFor(code: string, status: number): string {
  const messages: Record<string, string> = {
    missing_key: "AOH AI is not configured yet. A school administrator needs to set the server-side GROQ_API_KEY secret in Supabase (Edge Functions → Secrets).",
    disabled: "AOH AI is turned off in System Settings.",
    groq_auth: "The AI provider rejected the server's credentials. Please ask the school administrator to check the Groq configuration.",
    groq_rate_limit: "The AI provider's usage limit was reached. Please try again later or contact the school administrator.",
    groq_model: "The configured AI model is not available. Please contact the school administrator.",
    groq_error: "The AI provider could not complete this request. Please try again or contact the school administrator.",
    openai_auth: "The AI provider rejected the server's credentials. Please ask the school administrator to check the Groq configuration.",
    openai_rate_limit: "The AI provider's usage limit was reached. Please try again later or contact the school administrator.",
    openai_model: "The configured AI model is not available. Please contact the school administrator.",
    openai_error: "The AI provider could not complete this request. Please try again or contact the school administrator.",
    rate_limited: "The assistant's usage limit has been reached. Please try again later.",
    usage_unavailable: "The assistant's usage controls could not be checked. Please contact the school administrator; this is not a chat-limit notice.",
    settings_unavailable: "Assistant settings could not be loaded. Please try again or contact the school administrator.",
    context_unavailable: "Your school records could not be loaded safely. Please try again shortly.",
    auth_required: "Your session could not be verified. Please sign in again before using the portal assistant.",
    unauthorized: "Your session could not be verified. Please sign in again before using the portal assistant.",
    forbidden: "Your account does not have permission to use the assistant. Please contact the school administrator.",
    permissions_unavailable: "Assistant access could not be verified. Please try again or contact the school administrator.",
    invalid_request: "Please send a non-empty message of at most 1,500 characters. If the problem continues, reopen the chat.",
    interrupted: "The AI reply was interrupted and may be incomplete. Please try again.",
    incomplete: "The AI reply did not complete and may be incomplete. Please retry or ask for one section at a time.",
    truncated: "The reply reached its length limit and is incomplete. Please request a shorter answer or ask for one section at a time.",
    unavailable: "The AI provider is temporarily unavailable. Please try again shortly.",
    server_error: "AOH AI encountered a server error. Please try again or contact the school administrator.",
    empty: "AOH AI returned an empty reply. Please try again.",
  };
  if (status === 404) return "The assistant function could not be found. Please ask the school administrator to check its Supabase deployment.";
  return messages[code] ?? (status === 401 ? messages.auth_required : status === 403 ? messages.forbidden : "AOH AI is unavailable right now. Please try again shortly.");
}

function applySseLine(line: string, onDelta: (text: string) => void): "delta" | "done" | "ignore" {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return "ignore";
  const payload = trimmed.slice(5).trim();
  if (!payload) return "ignore";
  // Our backend must explicitly confirm completion; a Groq [DONE] alone
  // must not bypass its error/usage handling.
  let parsed: { delta?: unknown; done?: unknown; error?: unknown; code?: unknown };
  try {
    parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid event");
  } catch {
    throw new AssistantError(messageFor("interrupted", 502), "interrupted");
  }
  if (typeof parsed.error === "string") {
    const code = typeof parsed.code === "string" ? parsed.code : "unavailable";
    throw new AssistantError(messageFor(code, 502), code);
  }
  if (typeof parsed.delta === "string" && parsed.delta.length > 0) {
    onDelta(parsed.delta);
    return "delta";
  }
  return parsed.done === true ? "done" : "ignore";
}

export interface AssistantStatus {
  deployed: boolean;
  enabled: boolean;
  configured: boolean;
  model: string;
}

/** Configuration only: this probe does not send a request to Groq. */
export async function checkAssistantStatus(): Promise<AssistantStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
      method: "GET",
      signal: controller.signal,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const body = await resp.json().catch(() => null);
    if (!resp.ok) throw new AssistantError(messageFor(String(body?.code ?? "unavailable"), resp.status), String(body?.code ?? "unavailable"));
    if (!body || body.deployed !== true || typeof body.enabled !== "boolean" || typeof body.configured !== "boolean" || typeof body.model !== "string") {
      throw new AssistantError("The assistant's status response could not be verified. Check its deployed version.", "invalid_status");
    }
    return { deployed: true, enabled: body.enabled, configured: body.configured, model: body.model };
  } catch (err) {
    if (err instanceof AssistantError) throw err;
    throw new AssistantError("Could not check the assistant's configuration. Check your connection and try again.", "network");
  } finally {
    clearTimeout(timer);
  }
}

export async function testAssistant(): Promise<string> {
  let reply = "";
  await streamAssistant({
    messages: [{ role: "user", content: "Hello, who are you?" }],
    surface: "public",
    onDelta: (d) => { reply += d; },
  });
  return reply;
}

/** Success requires both text and the backend's explicit completion event. */
export async function streamAssistant(opts: StreamAssistantOptions): Promise<void> {
  if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  let sessionTimer: ReturnType<typeof setTimeout> | undefined;
  let token: string | undefined;
  try {
    const sessionData = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        sessionTimer = setTimeout(() => reject(new AssistantError("Your session check timed out. Please try again.", "auth_required")), 5000);
      }),
    ]);
    if (sessionData.error) throw new AssistantError(messageFor("auth_required", 401), "auth_required");
    token = sessionData.data.session?.access_token;
  } catch (err) {
    if (err instanceof AssistantError) throw err;
    throw new AssistantError(messageFor("auth_required", 401), "auth_required");
  } finally {
    clearTimeout(sessionTimer);
  }
  if (opts.surface === "portal" && !token) throw new AssistantError(messageFor("auth_required", 401), "auth_required");
  if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages: opts.messages.slice(-10), surface: opts.surface, view: opts.view }),
    });
    if (!resp.ok || !resp.body) {
      const body = await resp.json().catch(() => null);
      const code = typeof body?.code === "string" ? body.code : "unavailable";
      throw new AssistantError(messageFor(code, resp.status), code);
    }
    if (!resp.headers.get("content-type")?.includes("text/event-stream")) {
      throw new AssistantError(messageFor("interrupted", 502), "interrupted");
    }
    reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let sawText = false;
    const consume = (flush: boolean) => {
      const lines = buffered.split("\n");
      buffered = flush ? "" : lines.pop() ?? "";
      for (const line of lines) {
        const kind = applySseLine(line, (text) => {
          if (text.trim()) sawText = true;
          opts.onDelta(text);
        });
        if (kind === "done") {
          if (!sawText) throw new AssistantError(messageFor("empty", 502), "empty");
          return true;
        }
      }
      return false;
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      if (consume(false)) return;
    }
    buffered += decoder.decode();
    if (consume(true)) return;
    throw new AssistantError(messageFor("interrupted", 502), "interrupted");
  } catch (err) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (err instanceof AssistantError) throw err;
    const aborted = controller.signal.aborted;
    throw new AssistantError(
      aborted ? "AOH AI took too long to answer; any partial reply may be incomplete. Please try again." : "Could not reach AOH AI. Check your connection and try again.",
      aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
    if (reader) await reader.cancel().catch(() => {});
    controller.abort();
  }
}
