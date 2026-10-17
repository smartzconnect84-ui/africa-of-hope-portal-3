import { createClient } from "@supabase/supabase-js";

/**
 * Live Supabase project for the Africa of Hope portal.
 * URL + publishable (anon) key are wired directly so every client — public
 * website or admin portal — talks to the same production database.
 */
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? "https://gatnzfjpuokopqyksqoy.supabase.co";

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhdG56ZmpwdW9rb3BxeWtzcW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjAyMTcsImV4cCI6MjEwNzgzNjIxN30.g0tptBFvclxGhqePFrWz0nov3R_DRsOgnSQJpKjdDT8";

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
    autoRefreshToken: true,
    // Needed so email confirmation and password-reset links start a session.
    detectSessionInUrl: true,
    storageKey: "aoh-portal-auth",
  },
});