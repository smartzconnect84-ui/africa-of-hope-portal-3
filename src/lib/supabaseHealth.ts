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
  /** Table exists but RLS correctly denies the anon key — healthy, not broken. */
  secured?: boolean;
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

/**
 * Every table the client queries directly, so this card cannot report
 * "connected" while most of the contract is still unchecked.
 * Keep in sync with: rg -o 'from\("([a-z_]+)"\)' -r '$1' src | sort -u
 */
export const REQUIRED_TABLES = [
  // Tables the client queries that were missing from this list, so the card could
  // report "connected" while seven real tables went unchecked.
  // Guarded by: npm run check:health-parity
  "email_templates",
  "grade_appeals",
  "helpdesk_messages",
  "helpdesk_tickets",
  "newsletter_campaigns",
  "newsletter_subscribers",
  "transparency_reports",
  "alumni_businesses",
  "announcements",
  "application_drafts",
  "assignments",
  "attendance",
  "blog_posts",
  "certificates",
  "class_sessions",
  "cohort_students",
  "cohorts",
  "discussion_replies",
  "discussion_threads",
  "email_outbox",
  "entrance_settings",
  "entrance_test_results",
  "fee_transactions",
  "learning_memory",
  "notification_outbox",
  "notifications",
  "payment_channels",
  "payment_submissions",
  "permissions",
  "policy_acceptances",
  "profiles",
  "program_modules",
  "programs",
  "push_subscriptions",
  "quiz_attempts",
  "quiz_questions",
  "quizzes",
  "reminder_items",
  "reminder_settings",
  "role_permissions",
  "school_policies",
  "staff_vacancies",
  "study_plans",
  "submissions",
  "support_pledges",
  "system_settings",
  "teacher_course_plans",
  "training_materials",
  "vacancy_applications",
  "website_enquiries",
  "yearbook_entries",
] as const;

const REQUIRED_BUCKETS = [
  "avatars",
  "blog-covers",
  "certificates",
  "classwork-submissions",
  "documents",
  "program-images",
  "site-assets",
  "site-media",
  "training-materials",
  "transparency-reports",
];

/**
 * Distinguishes an unapplied migration from a correctly secured table.
 * A table that exists but denies the anon key is healthy: RLS is doing its job.
 * A "not found / schema cache" error means the migration never ran — a real gap.
 */
function classifyProbe(table: string, message: string): TableCheck {
  const missing =
    /could not find the table|does not exist|schema cache|pgrst205|undefined table|relation .* not found/i.test(
      message,
    );
  if (missing) {
    return { table, ok: false, rows: null, error: "Missing — migration not applied" };
  }
  const secured =
    /row-level security|permission denied|not authorized|42501|unauthori[sz]ed|\b401\b|\b403\b/i.test(
      message,
    );
  if (secured) {
    return { table, ok: true, rows: null, secured: true, error: null };
  }
  return { table, ok: false, rows: null, error: message };
}

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
  const tables: TableCheck[] = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (error) return classifyProbe(table, error.message);
        return { table, ok: true, rows: count ?? 0, error: null };
      } catch (err) {
        return classifyProbe(table, err instanceof Error ? err.message : "Probe failed");
      }
    }),
  );

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
  ('blog-covers', 'blog-covers', true),
  ('certificates', 'certificates', false),
  ('classwork-submissions', 'classwork-submissions', false),
  ('documents', 'documents', false),
  ('program-images', 'program-images', true),
  ('site-assets', 'site-assets', true),
  ('site-media', 'site-media', true),
  ('training-materials', 'training-materials', false),
  ('transparency-reports', 'transparency-reports', false)
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
