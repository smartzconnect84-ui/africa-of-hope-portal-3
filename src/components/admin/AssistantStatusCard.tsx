import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, Copy, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { checkAssistantStatus, streamAssistant, type AssistantStatus } from "@/lib/assistant";
import { panelClass } from "../Navigation";

const DEPLOY_CMD = "supabase functions deploy assistant --project-ref gatnzfjpuokopqyksqoy";

export default function AssistantStatusCard() {
  const { state, updateSystemSettings } = useApp();
  const enabled = state.settings.assistantEnabled;
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    setVerified(false);
    setTestResult(null);
    try {
      setStatus(await checkAssistantStatus());
    } catch (error) {
      setStatus(null);
      setCheckError(error instanceof Error ? error.message : "Assistant status could not be checked.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  };

  const runTest = async () => {
    setTesting(true);
    setVerified(false);
    setTestResult(null);
    let reply = "";
    try {
      await streamAssistant({
        messages: [{ role: "user", content: "Introduce yourself briefly, then explain in one sentence why the sky looks blue." }],
        surface: "portal",
        onDelta: (d) => {
          reply += d;
        },
      });
      if (!reply.trim()) throw new Error("The function returned no AI text.");
      setVerified(true);
      setTestResult(`✓ Live AI reply confirmed: ${reply.slice(0, 500)}`);
      toast.success("Assistant test succeeded");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Test failed";
      setTestResult(`✕ ${message}`);
      toast.error("Assistant test failed");
    } finally {
      setTesting(false);
    }
  };

  const ready = status?.deployed && status.enabled && status.configured;
  const StatusIcon = verified ? CheckCircle2 : XCircle;
  const statusColor = verified ? "text-emerald-700" : "text-amber-700";

  const changeEnabled = async (value: boolean) => {
    setSaving(true);
    setVerified(false);
    setTestResult(null);
    try {
      const error = await updateSystemSettings({ assistantEnabled: value });
      if (error) { toast.error(`Could not save assistant setting: ${error}`); return; }
      toast.success("Assistant setting saved");
      await runCheck();
    } catch {
      toast.error("Could not save assistant setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${panelClass} space-y-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Bot className="h-4 w-4 text-emerald-700" /> AOH AI — AI activation
          </h3>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            AOH AI is affiliated with AFRICA OF HOPE. Configuration checks do not test Groq.
            Use the live test below to verify a complete AI reply; limited local references are not AI answers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runCheck} disabled={checking || testing || saving}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking…" : "Re-check"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200 p-3 text-sm">
        <span className={`flex items-center gap-1.5 font-semibold ${statusColor}`}>
          <StatusIcon className="h-4 w-4" />
          {checking ? "Checking…" : verified ? "Live reply verified this session" : ready ? "Configured — reply unverified" : status?.deployed ? "Setup required" : "Status unavailable"}
        </span>
        <span className="text-xs text-slate-500">
          Switch: {enabled ? "ON" : "OFF"} · Key:{" "}
          {status?.configured == null ? "unknown" : status.configured ? "set" : "missing"} · Model:{" "}
          {status?.model ?? "—"}
        </span>
      </div>

      {checkError && <p role="alert" className="text-xs text-rose-700">{checkError}</p>}

      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-emerald-900/10 bg-white p-4">
        <span>
          <span className="block text-sm font-medium text-slate-800">AOH AI enabled</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Turn off to hide the chat everywhere and return a friendly unavailable message.
          </span>
        </span>
        <Checkbox
          checked={enabled}
          disabled={saving || testing || checking}
          onCheckedChange={(v) => void changeEnabled(v === true)}
          className="mt-0.5"
        />
      </label>

      {!ready && !checking && (
        <ol className="space-y-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
          <li><strong className="text-slate-800">1. Turn the switch ON</strong> above (it saves to the live database).</li>
          <li>
            <strong className="text-slate-800">2. Add the Groq key</strong> in the Supabase dashboard → Edge
            Functions → Secrets, name <code className="rounded bg-slate-200 px-1 font-mono">GROQ_API_KEY</code> (starts
            with <code className="font-mono">gsk_</code>). The key stays server-side — never paste it into website code.
          </li>
          <li>
            <strong className="text-slate-800">3. After deployment approval, deploy the updated function</strong>:
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-slate-900 px-2 py-1.5 font-mono text-[11px] text-emerald-200">{DEPLOY_CMD}</code>
              <Button variant="outline" size="sm" onClick={() => copy(DEPLOY_CMD, "Deploy command")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
          <li><strong className="text-slate-800">4. Press Test below</strong> — a successful AI reply confirms activation.</li>
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={runTest} disabled={testing || checking || saving} className="bg-emerald-700 hover:bg-emerald-800">
          {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          {testing ? "Testing…" : "Test assistant"}
        </Button>
        <span className="text-[11px] text-slate-500">Tests identity and a general-knowledge question through the live function using your signed-in access.</span>
      </div>
      {testResult && (
        <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">{testResult}</p>
      )}
    </div>
  );
}
