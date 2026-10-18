import {
  SUPABASE_ANON_KEY,
  SUPABASE_PROJECT_REF,
  SUPABASE_URL,
  SUPABASE_USING_ENV,
  isSupabaseConfigured,
  supabase,
} from "@/integrations/supabase/client";

export interface TableCheck {
  table: string;
  ok: boolean;
  rows: number | null;
  error: string | null;
}

export interface HealthResult {
  configured: boolean;
  usingEnv: boolean;
  url: string;
  projectRef: string;
  anonKeyPreview: string;
  reachable: boolean;
  reachabilityError: string | null;
  latencyMs: number | null;
  tables: TableCheck[];
  buckets: { name: string; ok: boolean; error: string | null }[];
  checkedAt: string;
}

export const REQUIRED_TABLES = [
  "profiles",
  "programs",
  "program_modules",
  "cohorts",
  "cohort_students",
  "attendance",
  "assignments",
  "submissions",
  "fee_transactions",
  "certificates",
  "announcements",
  "system_settings",
  "role_permissions",
  "school_policies",
  "policy_acceptances",
] as const;

const REQUIRED_BUCKETS = ["avatars", "program-images", "documents", "site-assets"];

function previewKey(key: string): string {
  if (key.length <= 16) return "••••";
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export async function checkSupabaseHealth(): Promise<HealthResult> {
  const started = Date.now();
  const base: Omit<HealthResult, "tables" | "buckets"> = {
    configured: isSupabaseConfigured(),
    usingEnv: SUPABASE_USING_ENV,
    url: SUPABASE_URL,
    projectRef: SUPABASE_PROJECT_REF,
    anonKeyPreview: previewKey(SUPABASE_ANON_KEY),
    reachable: false,
    reachabilityError: null,
    latencyMs: null,
    checkedAt: new Date().toISOString(),
  };

  if (!base.configured) {
    return {
      ...base,
      tables: REQUIRED_TABLES.map((table) => ({ table, ok: false, rows: null, error: "Not configured" })),
      buckets: REQUIRED_BUCKETS.map((name) => ({ name, ok: false, error: "Not configured" })),
    };
  }

  // 1. Reachability: a cheap read that also proves RLS allows anon access.
  try {
    const { error } = await supabase.from("system_settings").select("id").limit(1);
    if (error) throw new Error(error.message);
    base.reachable = true;
    base.latencyMs = Date.now() - started;
  } catch (err) {
    base.reachable = false;
    base.reachabilityError = err instanceof Error ? err.message : "Unreachable";
  }

  // 2. Per-table probes (count only, never downloads rows).
  const tables: TableCheck[] = [];
  for (const table of REQUIRED_TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        tables.push({ table, ok: false, rows: null, error: error.message });
      } else {
        tables.push({ table, ok: true, rows: count ?? 0, error: null });
      }
    } catch (err) {
      tables.push({
        table,
        ok: false,
        rows: null,
        error: err instanceof Error ? err.message : "Probe failed",
      });
    }
  }

  // 3. Storage buckets.
  const buckets: HealthResult["buckets"] = [];
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(error.message);
    const names = new Set((data ?? []).map((b) => b.name));
    for (const name of REQUIRED_BUCKETS) {
      buckets.push(
        names.has(name)
          ? { name, ok: true, error: null }
          : { name, ok: false, error: "Bucket missing — apply the storage migration" },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage probe failed";
    for (const name of REQUIRED_BUCKETS) buckets.push({ name, ok: false, error: message });
  }

  return { ...base, tables, buckets };
}

export const ENV_SNIPPET = `# Supabase — paste into Backend → Secrets (MonstarX) or a local .env file
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`;
