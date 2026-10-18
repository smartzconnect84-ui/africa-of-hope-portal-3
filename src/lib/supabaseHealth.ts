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

  // 3. Storage buckets. listBuckets() is service-role only and returns an empty
  // list for the anon key even when the buckets exist, so probe each bucket.
  const listed = new Set<string>();
  try {
    const { data } = await supabase.storage.listBuckets();
    for (const bucket of data ?? []) listed.add(bucket.name);
  } catch {
    /* anon cannot list the catalogue; per-bucket probes still work */
  }
  const buckets = await Promise.all(REQUIRED_BUCKETS.map((name) => probeBucket(name, listed)));

  return { ...base, tables, buckets };
}

export const ENV_SNIPPET = `# Supabase — paste into Backend → Secrets (MonstarX) or a local .env file
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`;

/** Paste into Supabase → SQL Editor. Does not touch system_settings. */
export const STORAGE_BUCKET_SQL = `insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('program-images', 'program-images', true),
  ('documents', 'documents', false),
  ('site-assets', 'site-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists program_images_public_read on storage.objects;
create policy program_images_public_read on storage.objects for select
  using (bucket_id = 'program-images');

drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects for select
  using (bucket_id = 'site-assets');`;

async function probeBucket(
  name: string,
  listed: Set<string>,
): Promise<{ name: string; ok: boolean; error: string | null }> {
  if (listed.has(name)) return { name, ok: true, error: null };
  try {
    const { error } = await supabase.storage.from(name).list("", { limit: 1 });
    if (!error) return { name, ok: true, error: null };
    const message = error.message || "Storage probe failed";
    if (/not found|does not exist/i.test(message)) {
      return { name, ok: false, error: "Bucket missing — apply the storage migration" };
    }
    // The bucket exists; listing it may still be blocked for this key.
    if (/row-level security|unauthorized|permission|jwt|policy/i.test(message)) {
      return { name, ok: true, error: null };
    }
    return { name, ok: false, error: message };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err instanceof Error ? err.message : "Storage probe failed",
    };
  }
}
