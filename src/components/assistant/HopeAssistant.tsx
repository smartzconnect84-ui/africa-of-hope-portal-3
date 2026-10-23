import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { X, Send, Sparkles, Bot } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAssistantVisibility } from "../../context/AssistantVisibility";
import { streamAssistant, AssistantError, type AssistantMessage } from "../../lib/assistant";
import { answerLocally } from "../../lib/assistantOffline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [materialCohortId, setMaterialCohortId] = useState("");
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
  const canSaveMaterial = currentUser && ["Teacher", "School Admin", "Super Admin"].includes(currentUser.role);
  const materialCohorts = (state.cohorts ?? []).filter((c) => !currentUser || currentUser.role !== "Teacher" || c.teacherId === currentUser.id).slice(0, 50);

  function saveToMaterials(bubbleId: string, content: string) {
    const text = content.trim();
    if (!text) return;
    const cohort = (state.cohorts ?? []).find((c) => c.id === (materialCohortId || materialCohorts[0]?.id)) ?? null;
    const program = (state.programs ?? []).find((p) => p.id === cohort?.programId) ?? null;
    try {
      const key = "aoh-assistant-material-queue";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
      const queue = Array.isArray(existing) ? existing : [];
      queue.push({ id: crypto.randomUUID(), title: text.split("\n")[0].slice(0, 80) || "AOH AI resource", body: text, savedAt: new Date().toISOString(), savedBy: currentUser?.id ?? null, programId: program?.id ?? null, cohortId: cohort?.id ?? null, programTitle: program?.title ?? null, cohortName: cohort?.name ?? null });
      localStorage.setItem(key, JSON.stringify(queue.slice(-20)));
      window.dispatchEvent(new CustomEvent("aoh:assistant-material", { detail: { count: queue.length, programId: program?.id ?? null, cohortId: cohort?.id ?? null } }));
      setSavedIds((prev) => (prev.includes(bubbleId) ? prev : [...prev, bubbleId]));
    } catch { /* storage unavailable — guidance below still shows */ }
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
                      <div>
                      <div className="prose-sm [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4">
                        <ReactMarkdown>{b.content}</ReactMarkdown>
                      </div>
                      {b.role === "assistant" && b.complete && canSaveMaterial && (
                        <div className="mt-1.5 space-y-1">
                          {materialCohorts.length > 0 && (
                            <label className="flex items-center gap-1 text-[11px] text-emerald-800">Course:
                              <select value={materialCohortId || materialCohorts[0].id} onChange={(e) => setMaterialCohortId(e.target.value)} className="max-w-[150px] rounded-full border border-emerald-600/30 bg-white px-1.5 py-0.5 text-[11px]" aria-label="Course for training material">
                                {materialCohorts.map((c) => (
                                  <option key={c.id} value={c.id}>{(state.programs ?? []).find((p) => p.id === c.programId)?.title ?? "Course"} · {c.name}</option>
                                ))}
                              </select>
                            </label>
                          )}
                          <button type="button" disabled={savedIds.includes(b.id)} onClick={() => saveToMaterials(b.id, b.content)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-emerald-600/30 bg-white px-2.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">{savedIds.includes(b.id) ? "Saved to training materials ✓" : "Save to training materials"}</button>
                        </div>
                      )}
                      {b.role === "assistant" && b.complete && canSaveMaterial && savedIds.includes(b.id) && (
                        <p className="mt-1 text-[11px] text-emerald-700">Saved with course context. Open Academic Planning → Materials to review and submit it to the shared training materials.</p>
                      )}
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
