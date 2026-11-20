// Supabase-compat bridge onto the Autobase backend.
//
// The app keeps calling `supabase.from(...) / supabase.auth.* / supabase.storage`
// and those calls run against the project backend via
// `src/integrations/autobase/client.ts` (db = supabase-js API, auth = better-auth).
// A missing backend must never crash the app: without valid env vars the db
// client points at an unroutable placeholder and auth calls report unavailable.
import { auth as platformAuth, db } from "../autobase/client";

// ── Connection info (kept for health panels / diagnostics) ───────────────────
function readEnv(): Record<string, string | undefined> {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  } catch {
    return {};
  }
}

const env = readEnv();

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

// ── Session mapping (better-auth → supabase-js shape) ─────────────────────────
function toSupabaseUser(u: unknown): unknown {
  const raw = (u ?? {}) as Record<string, unknown>;
  const id = (raw.id as string) ?? "";
  return {
    id,
    email: (raw.email as string | null) ?? null,
    user_metadata: {
      full_name: (raw.name as string | null) ?? (raw.full_name as string | null) ?? null,
      avatar_url: (raw.image as string | null) ?? (raw.avatar_url as string | null) ?? null,
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: (raw.createdAt as string) ?? (raw.created_at as string) ?? "",
    // A non-empty identities list marks a genuinely new account. The app
    // treats an empty list as "this email already exists", so only return
    // an empty list when there is no user at all.
    identities: id ? [{ identity_id: id, user_id: id }] : [],
  };
}

function toSupabaseSession(payload: unknown): unknown {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const userRaw =
    (raw.user as unknown) ?? (raw.data as Record<string, unknown> | undefined)?.user ?? null;
  if (!userRaw) return null;
  const sessionRaw = ((raw.session as Record<string, any> | null) ??
    (raw.data as Record<string, any> | undefined)?.session ??
    null) as Record<string, any> | null;
  const token =
    (sessionRaw?.token as string) ??
    (raw.token as string) ??
    (raw.access_token as string) ??
    "";
  const refresh =
    (sessionRaw?.refreshToken as string) ??
    (raw.refresh_token as string) ??
    "";
  const expiresAt =
    typeof sessionRaw?.expiresAt === "string"
      ? Math.floor(new Date(sessionRaw.expiresAt as string).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: token,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: toSupabaseUser(userRaw),
  };
}

async function currentBridgeSession(): Promise<{ data: { session: unknown } }> {
  try {
    const res = await (platformAuth as unknown as {
      getSession?: () => Promise<{ data?: unknown }>;
    }).getSession?.();
    const session = toSupabaseSession(res?.data);
    return { data: { session } };
  } catch {
    return { data: { session: null } };
  }
}

// ── Auth bridge (supabase-js auth interface → better-auth) ────────────────────
type AuthBridge = {
  signUp: (args: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }) => Promise<{ data: { user: unknown; session: unknown; identities?: unknown[] }; error: { message: string } | null; needsConfirmation?: boolean }>;
  signInWithPassword: (args: {
    email: string;
    password: string;
  }) => Promise<{ data: { user: unknown; session: unknown }; error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string },
  ) => Promise<{ data: Record<string, never>; error: { message: string } | null }>;
  updateUser: (attrs: {
    password?: string;
    [key: string]: unknown;
  }) => Promise<{ data: { user: unknown }; error: { message: string } | null }>;
  getSession: () => Promise<{ data: { session: unknown }; error: null }>;
  onAuthStateChange: (
    cb: (event: string, session: unknown) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
};

const bridgeAuth: AuthBridge = {
  async signUp({ email, password, options }) {
    const cleanEmail = email.trim().toLowerCase();
    const details = (options?.data ?? {}) as Record<string, unknown>;
    const name =
      (details.full_name as string) ??
      (details.name as string) ??
      cleanEmail.split("@")[0] ??
      cleanEmail;
    try {
      const { data, error } = await (platformAuth as unknown as {
        signUp: {
          email: (args: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
        };
      }).signUp.email({
        email: cleanEmail,
        password,
        name,
        callbackURL:
          options?.emailRedirectTo ??
          (typeof window !== "undefined" ? window.location.origin : undefined),
      });
      if (error) {
        const message = /exist/i.test(error.message ?? "")
          ? "An account with this email already exists. One email can only be used for one account (User, Admin or Staff) — please sign in instead."
          : error.message || "The account could not be created.";
        return { data: { user: null, session: null, identities: [] }, error: { message } };
      }
      const session = toSupabaseSession(data);
      const dataRec = (data ?? {}) as Record<string, unknown>;
      const userRaw =
        (dataRec.user as unknown) ??
        (dataRec.data as Record<string, unknown> | undefined)?.user ??
        null;
      const user = userRaw ? toSupabaseUser(userRaw) : null;
      const needsConfirmation = !session;
      if (Object.keys(details).length) rememberRegistration(cleanEmail, details);
      return { data: { user, session, identities: [] }, error: null, needsConfirmation };
    } catch (err) {
      return {
        data: { user: null, session: null, identities: [] },
        error: { message: err instanceof Error ? err.message : "The account could not be created." },
      };
    }
  },

  async signInWithPassword({ email, password }) {
    try {
      const { data, error } = await (platformAuth as unknown as {
        signIn: {
          email: (args: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
        };
      }).signIn.email({ email: email.trim().toLowerCase(), password });
      if (error) return { data: { user: null, session: null }, error: { message: error.message || "Sign-in failed." } };
      const session = toSupabaseSession(data) as Record<string, unknown> | null;
      const user = (session?.user as unknown) ?? null;
      if (!session || !user) {
        // Fall back to getSession in case the payload shape differs.
        const current = await currentBridgeSession();
        const fallback = current.data.session as Record<string, unknown> | null;
        if (fallback?.user) return { data: { user: fallback.user, session: fallback }, error: null };
        return { data: { user: null, session: null }, error: { message: "The server did not create a sign-in session. Please retry." } };
      }
      return { data: { user, session }, error: null };
    } catch (err) {
      return {
        data: { user: null, session: null },
        error: { message: err instanceof Error ? err.message : "Sign-in failed." },
      };
    }
  },

  async signOut() {
    try {
      await (platformAuth as unknown as { signOut?: () => Promise<unknown> }).signOut?.();
    } catch {
      // Fall through to GoTrue sign-out so local state is still cleared.
    }
    try {
      const { error } = await db.auth.signOut();
      return { error: error ? { message: error.message } : null };
    } catch (err) {
      return { error: err instanceof Error ? { message: err.message } : null };
    }
  },

  async resetPasswordForEmail(email, options) {
    try {
      const page = options?.redirectTo
        ? (() => {
            try {
              return new URL(options.redirectTo, typeof window !== "undefined" ? window.location.origin : "https://localhost").pathname;
            } catch {
              return "/reset-password";
            }
          })()
        : "/reset-password";
      const { sendPasswordReset } = await import("../autobase/client");
      await sendPasswordReset(email.trim().toLowerCase(), page);
      return { data: {}, error: null };
    } catch (err) {
      return {
        data: {},
        error: { message: err instanceof Error ? err.message : "The reset email could not be sent." },
      };
    }
  },

  async updateUser({ password }) {
    if (!password) return { data: { user: null }, error: null };
    try {
      const candidate = platformAuth as unknown as {
        changePassword?: (args: Record<string, unknown>) => Promise<{ error?: { message?: string } | null }>;
      };
      if (typeof candidate.changePassword === "function") {
        const { error } = await candidate.changePassword({ newPassword: password });
        if (error) return { data: { user: null }, error: { message: error.message || "Password update failed." } };
        return { data: { user: null }, error: null };
      }
      return { data: { user: null }, error: { message: "Password update is not wired yet." } };
    } catch (err) {
      return {
        data: { user: null },
        error: { message: err instanceof Error ? err.message : "Password update failed." },
      };
    }
  },

  async getSession() {
    const current = await currentBridgeSession();
    if (current.data.session) return { data: current.data, error: null };
    try {
      const { data } = await db.auth.getSession();
      return { data: { session: (data.session as unknown) ?? null }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  onAuthStateChange(cb) {
    // Forward GoTrue events; better-auth sign-ins also refresh via getSession polling below.
    const { data } = db.auth.onAuthStateChange((event, session) => {
      try {
        cb(event, session as unknown);
      } catch {
        // Listener errors must never break auth state.
      }
    });
    let cancelled = false;
    if (typeof window !== "undefined") {
      void currentBridgeSession().then((current) => {
        if (!cancelled && current.data.session) {
          try {
            cb("SIGNED_IN", current.data.session);
          } catch {
            // ignore
          }
        }
      });
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            cancelled = true;
            try {
              data.subscription.unsubscribe();
            } catch {
              // ignore
            }
          },
        },
      },
    };
  },
};

// The data client keeps the full supabase-js surface (from/storage/channel/rpc/functions)
// with auth replaced by the better-auth bridge. Mutating the instance preserves
// prototype-bound methods that a spread would detach.
(db as unknown as Record<string, unknown>).auth = bridgeAuth;

export const supabase = db;
