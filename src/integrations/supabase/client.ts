import { createClient } from "@supabase/supabase-js";
import { authStorage } from "../../lib/authStorage.ts";

/**
 * Live Supabase project for the Africa of Hope portal.
 *
 * CONFIRMED live project: `gatnzfjpuokopqyksqoy`
 * (https://gatnzfjpuokopqyksqoy.supabase.co). The old linked project
 * `txprgdnznzxpwpuqlxlq` (supabase-blue-ball) is unused — pause/delete it in
 * the Supabase dashboard; local CLI link files now point at gatnz….
 *
 * Configuration priority:
 *  1. `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` environment variables
 *     (Backend → Secrets in MonstarX, or a local `.env` file).
 *  2. Built-in production fallback so the public site and portal keep working
 *     without extra setup.
 */

const FALLBACK_URL = "https://gatnzfjpuokopqyksqoy.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhdG56ZmpwdW9rb3BxeWtzcW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjAyMTcsImV4cCI6MjEwNzgzNjIxN30.g0tptBFvclxGhqePFrWz0nov3R_DRsOgnSQJpKjdDT8";

function readEnv(name: string): string {
  try {
    const value = (import.meta as unknown as { env?: Record<string, string> }).env?.[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

export const SUPABASE_URL: string = readEnv("VITE_SUPABASE_URL") || FALLBACK_URL;

export const SUPABASE_ANON_KEY: string =
  readEnv("VITE_SUPABASE_ANON_KEY") || FALLBACK_ANON_KEY;

export const SUPABASE_USING_ENV = Boolean(
  readEnv("VITE_SUPABASE_URL") && readEnv("VITE_SUPABASE_ANON_KEY"),
);

/** e.g. https://gatnzfjpuokopqyksqoy.supabase.co -> gatnzfjpuokopqyksqoy */
export function supabaseProjectRef(url: string = SUPABASE_URL): string {
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return match ? match[1] : url;
}

export const SUPABASE_PROJECT_REF = supabaseProjectRef(SUPABASE_URL);

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL) &&
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 40;

/**
 * True when the page was opened from a password-reset email. Read before the
 * client starts, because the client consumes and clears the URL tokens.
 */
export const OPENED_FROM_RECOVERY_LINK =
  typeof window !== "undefined" &&
  /(^|[#&?])type=recovery(&|$)/.test(`${window.location.hash}&${window.location.search.slice(1)}`);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: authStorage,
    autoRefreshToken: true,
    // Needed so email confirmation and password-reset links start a session.
    detectSessionInUrl: true,
    storageKey: "aoh-portal-auth",
  },
});
