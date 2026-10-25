import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { X, Send, Sparkles, Bot } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAssistantVisibility } from "../../context/AssistantVisibility";
import { streamAssistant, AssistantError, type AssistantMessage } from "../../lib/assistant";
import { answerLocally } from "../../lib/assistantOffline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveResearchResource } from "@/lib/researchResources";

interface ChatBubble {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  complete?: boolean;
}

function suggestionsFor(role: string | null): string[] {
  if (!role) {
    return [
      "What programmes do you offer?",
      "Help me write a professional letter",
      "Explain a topic for my studies",
    ];
  }
  if (role === "Student") {
    return ["How much do I still owe in fees?", "What quizzes do I have coming up?", "What programmes am I enrolled in?"];
  }
  if (role === "Teacher") {
    return ["How many students are in my cohorts?", "How do quiz attempts get graded?"];
  }
  return ["Give me a quick overview of the academy right now", "How many students are active?"];
}

export default function HopeAssistant() {
  const { state, currentUser } = useApp();
  const { hidden } = useAssistantVisibility();
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, sending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Do not carry another account's private conversation into a new session.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBubbles([]);
    setDraft("");
    setSending(false);
  }, [currentUser?.id]);

  if (!state.settings.assistantEnabled || hidden) return null;

  const configuredLabel = state.websiteSettings.assistantLauncherLabel?.trim();
  const label = !configuredLabel || /luna|hope assistant|afrohope ai/i.test(configuredLabel)
    ? "AOH AI"
    : configuredLabel;
  const surface: "public" | "portal" = currentUser ? "portal" : "public";

  async function saveResponse(content: string) {
    if (!currentUser || !content.trim()) return;
    try {
      await saveResearchResource({ title: content.trim().split("\\n")[0].slice(0, 180) || "AOH AI research note", content: content.trim(), source_url: null, visibility: currentUser.role === "Student" ? "private" : "staff" });
      setBubbles((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Saved to Resource Center.", complete: true }]);
    } catch { setBubbles((prev) => [...prev, { id: crypto.randomUUID(), role: "error", content: "I could not save that research note. Please try again." }]); }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || content.length > 1500 || sending) return;
    const history: AssistantMessage[] = [
      ...bubbles.filter((b) => b.role === "user" || (b.role === "assistant" && b.complete)).map((b) => ({ role: b.role as "user" | "assistant", content: b.content })),
      { role: "user", content },
    ];
    setBubbles((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
    setDraft("");
    setSending(true);

    const assistantId = crypto.randomUUID();
    setBubbles((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    let receivedText = false;
    abortRef.current = controller;
    try {
      await streamAssistant({
        messages: history,
        surface,
        signal: controller.signal,
        onDelta: (delta) => {
          receivedText = receivedText || Boolean(delta.trim());
          if (!controller.signal.aborted) setBubbles((prev) => prev.map((b) => (b.id === assistantId ? { ...b, content: b.content + delta } : b)));
        },
      });
      if (!controller.signal.aborted) setBubbles((prev) => prev.map((b) => b.id === assistantId ? { ...b, complete: true } : b));
    } catch (e) {
      if (controller.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        setBubbles((prev) => prev.filter((b) => !(b.id === assistantId && b.content === "")));
        return;
      }
      const code = e instanceof AssistantError ? e.code : "unavailable";
      const message = e instanceof AssistantError ? e.message : "AOH AI is unavailable right now. Please try again shortly.";
      // Preserve the actual failure, even when a limited local answer is available.
      // Local/failed/partial replies must never become AI conversation context.
      const hasPartialReply = receivedText;
      if (!hasPartialReply && ["missing_key", "unavailable", "network", "timeout", "server_error", "empty"].includes(code)) {
        const local = answerLocally(content, {
          academyName: state.settings.academyName,
          programmes: state.programs.map((p) => ({ title: p.title, category: p.category, description: p.description })),
          contactEmail: state.settings.contactEmail,
          contactPhone: state.settings.contactPhone,
          address: state.settings.address,
          intakeStatus: state.settings.intakeStatus,
        });
        if (local) {
          setBubbles((prev) => [
            ...prev.map((b) => (b.id === assistantId ? { ...b, content: `**Limited local response — not an AI answer**\n\n${local}` } : b)),
            { id: crypto.randomUUID(), role: "error", content: message },
          ]);
          return;
        }
      }
      setBubbles((prev) => {
        const withoutEmptyDraft = prev.filter((b) => !(b.id === assistantId && b.content === ""));
        return [...withoutEmptyDraft, { id: crypto.randomUUID(), role: "error", content: message }];
      });
    } finally {
      if (abortRef.current === controller) {
        setSending(false);
        abortRef.current = null;
      }
    }
  }

  return (
    <>
      {/* Launcher and panel are sized at ~70% (30% smaller) of the original
          dimensions — width/height/padding/icons scale down together, but no
          text drops below 12px (text-xs) so copy stays readable. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={cn(
            "fixed z-40 flex items-center gap-2 rounded-full bg-[#022c22] text-xs font-bold text-white shadow-2xl shadow-emerald-950/30 transition hover:brightness-110 hover:-translate-y-1",
            surface === "portal"
              ? "bottom-4 right-4 left-auto h-8 w-8 justify-center p-0 lg:w-[157px] lg:justify-start lg:px-[11px]"
              : "bottom-5 right-5 px-[14px] py-[10px] max-sm:bottom-4 max-sm:right-3 max-sm:h-8 max-sm:w-8 max-sm:justify-center max-sm:p-0",
          )}
        >
          <span className="grid h-[25px] w-[25px] place-items-center rounded-full bg-amber-400 text-[#022c22] max-sm:h-5 max-sm:w-5">
            <Sparkles className="h-[13px] w-[13px]" />
          </span>
          <span className={surface === "portal" ? "sr-only lg:not-sr-only" : "max-sm:sr-only"}>{label}</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-3 z-40 flex h-[min(420px,calc(100dvh-2rem))] w-[min(320px,calc(100vw-1.5rem))] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:h-[420px] sm:w-[266px]">
          <div className="flex items-center gap-2 bg-gradient-to-br from-emerald-900 to-[#022c22] p-[11px] text-white">
            <span className="relative grid h-7 w-7 flex-shrink-0 place-items-center rounded-xl bg-amber-400 text-[#022c22]">
              <Bot className="h-[14px] w-[14px]" />
              <span className="absolute -right-0.5 -bottom-0.5 h-[7px] w-[7px] rounded-full bg-emerald-400 ring-1 ring-[#022c22]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">AOH AI</p>
              <p className="truncate text-xs text-emerald-200">AFRICA OF HOPE</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="grid h-6 w-6 place-items-center rounded-lg text-emerald-100 hover:bg-white/10"
            >
              <X className="h-[11px] w-[11px]" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-[11px]">
            {bubbles.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Hi{currentUser ? ` ${currentUser.name.split(" ")[0]}` : ""}! I'm AOH AI, your intelligent assistant from AFRICA OF HOPE. How can I help you today?
                </p>
                <div className="ml-1 flex flex-wrap gap-1">
                  {suggestionsFor(currentUser?.role ?? null).map((s) => (
                    <button
                      key={s} type="button" onClick={() => send(s)}
                      className="rounded-full border border-emerald-600/25 bg-white px-2 py-1 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bubbles.map((b) => (
              <div key={b.id} className={cn("flex", b.role === "user" ? "justify-end" : "justify-start")}>
                {b.role === "error" ? (
                  <p className="max-w-[85%] rounded-xl bg-rose-50 px-[10px] py-[7px] text-xs text-rose-700">{b.content}</p>
                ) : (
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-[10px] py-[7px] text-xs leading-relaxed",
                      b.role === "user" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-800",
                    )}
                  >
                    {b.content ? (
                      <div className="prose-sm [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4">
                        <ReactMarkdown>{b.content}</ReactMarkdown>
                        {currentUser && b.role === "assistant" && b.complete && b.content !== "Saved to Resource Center." ? (
                          <button type="button" onClick={() => void saveResponse(b.content)} className="mt-2 text-[11px] font-semibold text-emerald-700 underline">Save to Resource Center</button>
                        ) : null}
                      </div>
                    ) : sending ? (
                      <span className="inline-flex items-center gap-1 py-1" aria-label="Waiting for a reply">
                        <i className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
                        <i className="h-1 w-1 animate-pulse rounded-full bg-emerald-500 [animation-delay:150ms]" />
                        <i className="h-1 w-1 animate-pulse rounded-full bg-emerald-500 [animation-delay:300ms]" />
                      </span>
                    ) : (
                      <span className="text-slate-500">No reply came back. Please try again.</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            className="border-t border-slate-100 p-2"
            onSubmit={(e) => { e.preventDefault(); send(draft); }}
          >
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-[10px] py-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask AOH AI…"
                maxLength={1500}
                disabled={sending}
                className="flex-1 bg-transparent py-1.5 text-xs outline-none disabled:opacity-60"
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim()} className="h-[25px] w-[25px] rounded-xl bg-emerald-700 hover:bg-emerald-800">
                <Send className="h-[11px] w-[11px]" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-xs text-slate-400">AOH AI can make mistakes. Verify important information and school details.</p>
          </form>
        </div>
      )}
    </>
  );
}
