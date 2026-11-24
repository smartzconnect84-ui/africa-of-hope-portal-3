// Supabase client for the school portal.
//
// The app talks to the project's own Supabase backend in one place:
//   auth — GoTrue (`/auth/v1`): signInWithPassword, signUp, resetPasswordForEmail,
//          onAuthStateChange, getSession, signOut.
//   data — PostgREST (`/rest/v1`): supabase.from(...), plus storage and realtime.
//
// A single supabase-js client covers both, carries the signed-in session on
// every request, and persists it across reloads. The URL and publishable key
// come from VITE_AUTOBASE_URL / VITE_AUTOBASE_PUBLISHABLE_KEY (falling back to
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), inlined at build time.
//
// A missing backend must never crash the app: without valid env vars the
// client points at an unroutable placeholder, so the app still boots and
// renders while data/auth calls report an error.
import { createClient } from "@supabase/supabase-js";

function readEnv(): Record<string, string | undefined> {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  } catch {
    return {};
  }
}

const env = readEnv();

// ── Connection info (kept for health panels / diagnostics) ───────────────────
export const SUPABASE_URL: string =
  env.VITE_AUTOBASE_URL ?? env.VITE_SUPABASE_URL ?? "https://autobase-not-connected.invalid";
export const SUPABASE_ANON_KEY: string =
  env.VITE_AUTOBASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_not_connected";
export const SUPABASE_PUBLISHABLE_KEY: string = SUPABASE_ANON_KEY;

export const SUPABASE_PROJECT_REF: string = (() => {
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
})();

export const SUPABASE_USING_ENV: boolean = Boolean(
  env.VITE_AUTOBASE_URL ?? env.VITE_SUPABASE_URL,
);

export function isSupabaseConfigured(): boolean {
  if (SUPABASE_URL.includes("autobase-not-connected.invalid")) return false;
  if (!SUPABASE_ANON_KEY.startsWith("sb_publishable_")) return false;
  try {
    const u = new URL(SUPABASE_URL);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// True when the page was opened from a password-recovery email link.
export const OPENED_FROM_RECOVERY_LINK: boolean = (() => {
  try {
    if (typeof window === "undefined") return false;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("autobase_action") === "reset") return true;
    if (hash.get("type") === "recovery") return true;
    const search = new URLSearchParams(window.location.search);
    return search.get("type") === "recovery";
  } catch {
    return false;
  }
})();

// ── Pending registration details (carried to the first profile row) ───────────
const PENDING_KEY = "aoh:pending-registration";

export function rememberRegistration(email: string, payload: Record<string, unknown>): void {
  try {
    const key = email.trim().toLowerCase();
    if (!key) return;
    localStorage.setItem(`${PENDING_KEY}:${key}`, JSON.stringify(payload));
  } catch {
    // Private mode: registration still works, just without the saved details.
  }
}

export function takePendingRegistration(email: string | null): Record<string, unknown> | null {
  try {
    if (!email) return null;
    const key = email.trim().toLowerCase();
    const raw = localStorage.getItem(`${PENDING_KEY}:${key}`);
    if (!raw) return null;
    localStorage.removeItem(`${PENDING_KEY}:${key}`);
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// One client for auth and data. supabase-js persists the GoTrue session,
// refreshes it, and sends its access token on every REST/storage/realtime call.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
