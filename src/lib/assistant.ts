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
    this.code = code;
  }
}

const CONFIG_MESSAGE =
  "Hope Assistant reached the server, but OpenAI did not answer. In Supabase project gatnzfjpuokopqyksqoy, open Edge Functions → Secrets and set OPENAI_API_KEY. Keep Assistant enabled in System Settings, then try again.";

function messageFor(code: string, serverMessage: string, status: number): string {
  if (code === "missing_key") return CONFIG_MESSAGE;
  if (code === "disabled") {
    return "Hope Assistant is turned off. Enable it in System Settings, then try again.";
  }
  if (code === "openai_auth") {
    return "OpenAI rejected the API key on the assistant function. Replace OPENAI_API_KEY in the Supabase function secrets with a valid key, then try again.";
  }
  if (code === "openai_rate_limit") {
    return "OpenAI rate-limited this request. Wait a moment and try again, or check that the API account still has usage allowance.";
  }
  if (code === "openai_model") {
    return "The model gpt-4o-mini is not available to this OpenAI account. Check the account's model access, then try again.";
  }
  if (code === "unavailable" || status === 503) return CONFIG_MESSAGE;
  if (code === "rate_limited") return serverMessage;
  if (status === 404) {
    return "The assistant function is not deployed on this Supabase project. Deploy it, then try again.";
  }
  return serverMessage || "Hope Assistant is unavailable right now. Please try again shortly.";
}

function applySseLine(line: string, onDelta: (text: string) => void): "delta" | "done" | "ignore" {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return "ignore";
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return "ignore";
  try {
    const parsed = JSON.parse(payload) as { delta?: unknown; done?: unknown; error?: unknown; code?: unknown };
    if (typeof parsed.error === "string") {
      throw new AssistantError(
        messageFor(String(parsed.code ?? "unavailable"), parsed.error, 502),
        String(parsed.code ?? "unavailable"),
      );
    }
    if (typeof parsed.delta === "string" && parsed.delta.length > 0) {
      onDelta(parsed.delta);
      return "delta";
    }
    if (parsed.done) return "done";
  } catch (err) {
    if (err instanceof AssistantError) throw err;
  }
  return "ignore";
}

export interface AssistantStatus {
  deployed: boolean;
  enabled: boolean;
  configured: boolean;
  model: string;
}

/**
 * Safe status probe for the admin activation panel. Never exposes secrets —
 * only booleans (is the function live, is the assistant enabled, is an
 * OpenAI key set) plus the model name.
 */
export async function checkAssistantStatus(): Promise<AssistantStatus> {
  const base: AssistantStatus = { deployed: false, enabled: false, configured: false, model: "gpt-4o-mini" };
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (resp.status === 404) return base;
    const body = (await resp.json().catch(() => null)) as Partial<AssistantStatus> | null;
    if (!body) return base;
    return {
      deployed: true,
      enabled: Boolean(body.enabled),
      configured: Boolean(body.configured),
      model: typeof body.model === "string" && body.model ? body.model : base.model,
    };
  } catch {
    return base;
  }
}

/** Short non-streaming test used by the admin panel ("Hello, who are you?"). */
export async function testAssistant(): Promise<string> {
  let reply = "";
  await streamAssistant({
    messages: [{ role: "user", content: "Hello, who are you?" }],
    surface: "public",
    onDelta: (d) => { reply += d; },
  });
  return reply;
}

/**
 * Streams a chat completion from the assistant edge function.
 * Rejects with an `AssistantError` so the panel can show the reason
 * instead of leaving the loading dots up forever.
 */
export async function streamAssistant(opts: StreamAssistantOptions): Promise<void> {
  const sessionData = await Promise.race([
    supabase.auth.getSession().catch(() => ({ data: { session: null } })),
    new Promise<{ data: { session: null } }>((resolve) => setTimeout(() => resolve({ data: { session: null } }), 4000)),
  ]);
  const token = sessionData.data.session?.access_token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages: opts.messages, surface: opts.surface, view: opts.view }),
    });

    if (!resp.ok || !resp.body) {
      let message = "Hope Assistant is unavailable right now. Please try again shortly.";
      let code = "unavailable";
      try {
        const body = await resp.json();
        if (body?.error) message = String(body.error);
        if (body?.code) code = String(body.code);
      } catch {
        /* keep the default message if the error body isn't JSON */
      }
      throw new AssistantError(messageFor(code, message, resp.status), code);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let sawDelta = false;

    const consume = (flush: boolean) => {
      const lines = buffered.split("\n");
      if (!flush) buffered = lines.pop() ?? "";
      else buffered = "";
      for (const line of lines) {
        const kind = applySseLine(line, opts.onDelta);
        if (kind === "delta") sawDelta = true;
        if (kind === "done" && !sawDelta) {
          throw new AssistantError("Hope Assistant returned an empty reply. Please try again.", "empty");
        }
        if (kind === "done") return true;
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
    if (!sawDelta) throw new AssistantError(CONFIG_MESSAGE, "empty");
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    if (err instanceof AssistantError) throw err;
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new AssistantError(
      aborted
        ? "Hope Assistant took too long to answer. Please try again."
        : "Could not reach Hope Assistant. Check your connection and try again.",
      aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
