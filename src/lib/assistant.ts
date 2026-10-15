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

/**
 * Streams a reply from the `assistant` edge function over SSE. Resolves once
 * the server sends `{"done":true}` (or the stream ends); rejects with an
 * `AssistantError` for 4xx/5xx responses, which already carry a friendly
 * `message` the UI can show as-is (rate limited, unavailable, etc.).
 */
export async function streamAssistant(opts: StreamAssistantOptions): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
    method: "POST",
    signal: opts.signal,
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
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch {
      /* keep the default message if the error body isn't JSON */
    }
    throw new AssistantError(message, code);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed.delta === "string") opts.onDelta(parsed.delta);
        if (parsed.done) return;
      } catch {
        /* ignore malformed SSE lines */
      }
    }
  }
}
