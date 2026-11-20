/**
 * The portal's data client.
 *
 * Every screen, hook and helper talks to the school database through this one
 * module: `supabase.from(...)` for tables, `supabase.auth` for sign-in and
 * sessions, `supabase.rpc(...)`, `supabase.storage` and `supabase.functions`.
 * The exported names (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, …) are read by the
 * backend status screens.
 *
 * It is a single real `@supabase/supabase-js` client, created once from
 * `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — the publishable/anon key,
 * which is the only key allowed in a browser bundle. The service-role key is a
 * server-only secret and must never appear here or in any `VITE_` variable.
 *
 * Resilience: a build with those variables missing must still boot. It points
 * at an RFC 2606 `.invalid` host, so data calls fail with a clear network error
 * while the public site keeps rendering. `isSupabaseConfigured()` lets the UI
 * explain that instead of crashing.
 */
import { createClient } from "@supabase/supabase-js";
import { authStorage } from "../../lib/authStorage.ts";

// `import.meta.env` only exists when Vite builds the page; reading it without a
// guard breaks every non-bundler entry point (the node test runner imports the
// data helpers).
const env = (import.meta as { env?: Record<string, string | undefined> }).env;

const ENV_URL = (env?.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
// The project ships both key styles; either one is a public client key.
const ENV_KEY = env?.VITE_SUPABASE_ANON_KEY ?? env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

function isValidConfig(url: string, key: string): boolean {
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  } catch {
    return false;
  }
  return key.length > 20;
}

/** False when the build has no Supabase project configured. */
export const SUPABASE_CONFIGURED = isValidConfig(ENV_URL, ENV_KEY);

// Syntactically valid, can never resolve: no request leaves the device.
const PLACEHOLDER_URL = "https://supabase-not-connected.invalid";

export const SUPABASE_URL: string = SUPABASE_CONFIGURED ? ENV_URL : PLACEHOLDER_URL;
export const SUPABASE_ANON_KEY: string = SUPABASE_CONFIGURED ? ENV_KEY : "";
export const SUPABASE_USING_ENV = Boolean(ENV_URL && ENV_KEY);

export function supabaseProjectRef(url: string = SUPABASE_URL): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export const SUPABASE_PROJECT_REF = supabaseProjectRef();

export const isSupabaseConfigured = (): boolean => SUPABASE_CONFIGURED;

if (!SUPABASE_CONFIGURED) {
  console.error(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing from this build, so sign-in and data features are unavailable.",
  );
}

/**
 * The session store honours the "Remember me" preference: a remembered
 * session lives in localStorage and survives a browser restart, otherwise it
 * lives in sessionStorage and still survives a refresh. Supabase owns token
 * rotation; this only chooses the persistence lifetime.
 */
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_CONFIGURED ? SUPABASE_ANON_KEY : "sb_publishable_not_connected",
  {
    auth: {
      storage: authStorage,
      storageKey: "aoh-auth-session",
      persistSession: true,
      autoRefreshToken: true,
      // Confirmation, recovery and magic links come back with the session in
      // the URL fragment; the client picks it up and fires SIGNED_IN /
      // PASSWORD_RECOVERY. Password reset and sign-up links are emailed with
      // this flow.
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  },
);

/** True when the page was opened from a password-reset email. */
export const OPENED_FROM_RECOVERY_LINK =
  typeof window !== "undefined" &&
  /(^|[#&?])type=recovery(&|$)/.test(`${window.location.hash}&${window.location.search}`);

// ── registration details that outlive the page ──────────────────────────────

/**
 * Registration details are kept on the device until the account's profile row
 * exists, because email confirmation finishes the sign-up on another visit.
 * The database trigger normally creates the profile from the sign-up metadata;
 * this is the fallback when the row is still missing on first sign-in.
 */
const PENDING_PROFILE_KEY = "aoh-pending-profile:";

export function rememberPendingRegistration(
  email: string,
  details: Record<string, unknown>,
): void {
  try {
    localStorage.setItem(
      `${PENDING_PROFILE_KEY}${email.toLowerCase()}`,
      JSON.stringify(details),
    );
  } catch {
    // Storage is optional: the account and profile are still created.
  }
}

export function takePendingRegistration(
  email: string | null,
): Record<string, unknown> | null {
  if (!email) return null;
  try {
    const key = `${PENDING_PROFILE_KEY}${email.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Email the confirmation link again. Used when someone tries to sign in
 * before confirming the address, so the form answers with a way forward
 * instead of a dead end.
 */
export async function resendConfirmationEmail(
  email: string,
  redirectTo: string = typeof window === "undefined" ? "" : window.location.origin,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: redirectTo },
  });
  return { error: error?.message ?? null };
}
