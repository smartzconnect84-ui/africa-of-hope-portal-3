import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  FileWarning,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { panelClass } from "../Navigation";
import {
  ENV_SNIPPET,
  STORAGE_BUCKET_SQL,
  checkSupabaseHealth,
  type HealthResult,
} from "@/lib/supabaseHealth";
import { useApp } from "@/context/AppContext";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`}
      aria-hidden
    />
  );
}

export default function BackendStatusCard() {
  const { live } = useApp();
  const [result, setResult] = useState<HealthResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState<"env" | "sql" | null>(null);

  const run = useCallback(async () => {
    setChecking(true);
    try {
      setResult(await checkSupabaseHealth());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const healthyTables = result?.tables.filter((t) => t.ok).length ?? 0;
  const healthyBuckets = result?.buckets.filter((b) => b.ok).length ?? 0;

  const copyText = async (kind: "env" | "sql", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const bucketsMissing = (result?.buckets ?? []).some((b) => !b.ok);
  const sqlEditorUrl = result?.projectRef
    ? `https://supabase.com/dashboard/project/${result.projectRef}/sql/new`
    : "https://supabase.com/dashboard";

  return (
    <div className={`${panelClass} space-y-5 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Database className="h-4 w-4 text-emerald-700" /> Supabase backend
          </h3>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Live connection, required tables and file-storage buckets. The portal
            reads and writes here; when a table is unreachable that section falls
            back to the last cached data.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={run} disabled={checking}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking…" : "Re-check"}
        </Button>
      </div>

      {checking && !result ? (
        <p className="text-sm text-slate-500">Contacting Supabase…</p>
      ) : result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Connection</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <StatusDot ok={result.reachable} />
                {result.reachable ? "Reachable" : "Unreachable"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {result.latencyMs != null ? `${result.latencyMs} ms` : live ? "Live sync active" : "Offline cache"} ·{" "}
                {result.usingEnv ? "env keys" : "built-in keys"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Project</p>
              <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-800" title={result.url}>
                {result.projectRef}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500" title={result.url}>{result.url}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tables</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {healthyTables}/{result.tables.length} readable
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Key: {result.anonKeyPreview}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Storage</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {healthyBuckets}/{result.buckets.length} buckets
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">avatars · program-images · documents · site-assets</p>
            </div>
          </div>

          {result.reachabilityError && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Supabase returned: {result.reachabilityError}. Check that the project
                is not paused and that the anon key matches the URL.
              </span>
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Required tables
              </h4>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {result.tables.map((t) => (
                  <li key={t.table} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-mono text-xs text-slate-700">
                      <StatusDot ok={t.ok} /> {t.table}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {t.ok ? (t.rows ?? 0).toLocaleString() + " rows" : t.error}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <HardDrive className="h-3.5 w-3.5" /> Storage buckets
                </h4>
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {result.buckets.map((b) => (
                    <li key={b.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-mono text-xs text-slate-700">
                        {b.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <FileWarning className="h-4 w-4 text-amber-500" />
                        )}
                        {b.name}
                      </span>
                      <span className="text-[11px] text-slate-500">{b.ok ? "Ready" : b.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {bucketsMissing && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Create the missing buckets</p>
                    <Button variant="outline" size="sm" onClick={() => copyText("sql", STORAGE_BUCKET_SQL)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> {copied === "sql" ? "Copied" : "Copy SQL"}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed">
                    This app cannot create Storage buckets itself. Open the{" "}
                    <a className="font-semibold underline" href={sqlEditorUrl} target="_blank" rel="noreferrer">
                      Supabase SQL editor
                    </a>
                    , paste this script and run it, then press Re-check. It does not touch system_settings, so the earlier column error will not roll the buckets back.
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-amber-900">
                    {STORAGE_BUCKET_SQL}
                  </pre>
                </div>
              )}
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">Point the app at another project</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText("env", ENV_SNIPPET)}
                    className="border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> {copied === "env" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-emerald-200">
                  {ENV_SNIPPET}
                </pre>
                <p className="mt-2 text-[11px] text-slate-300">
                  Add these in Backend → Secrets as VITE_SUPABASE_URL and
                  VITE_SUPABASE_ANON_KEY, then redeploy. Use the anon public key —
                  never the service-role key — because it ships in the browser.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Last checked {new Date(result.checkedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </div>
  );
}
