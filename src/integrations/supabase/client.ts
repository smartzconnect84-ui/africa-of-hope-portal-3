/**
 * The portal's data client.
 *
 * The whole app talks to the school database through this one object. It keeps
 * the familiar `supabase.from(...)` / `supabase.auth` shape, so every screen,
 * helper and hook keeps working while the storage underneath is the project's
 * own backend (see `src/integrations/autobase/client.ts`).
 */
import type { Session, User } from "@supabase/supabase-js";
import {
  auth,
  db,
  isBackendConfigured,
  resetPassword,
  sendPasswordReset,
} from "../autobase/client.ts";

const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const BASE_URL = (env?.VITE_AUTOBASE_URL ?? "").replace(/\/$/, "");
const PUBLISHABLE_KEY = env?.VITE_AUTOBASE_PUBLISHABLE_KEY ?? "";

export const SUPABASE_URL: string = BASE_URL;
export const SUPABASE_ANON_KEY: string = PUBLISHABLE_KEY;
export const SUPABASE_USING_ENV = Boolean(BASE_URL && PUBLISHABLE_KEY);

export function supabaseProjectRef(url: string = SUPABASE_URL): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export const SUPABASE_PROJECT_REF = supabaseProjectRef();

export const isSupabaseConfigured = (): boolean => isBackendConfigured;

/**
 * better-auth types every generated endpoint as taking a required input object,
 * so the documented no-argument `getSession()` / `signOut()` calls fail to
 * typecheck while working perfectly at runtime. These narrow views keep the
 * calls exactly as they are executed.
 */
const sessionApi = auth as unknown as {
  getSession: () => Promise<{ data: AuthPayload | null }>;
  signOut: () => Promise<{ error: { message?: string } | null }>;
};

/** True when the page was opened from a password-reset email. */
export const OPENED_FROM_RECOVERY_LINK =
  typeof window !== "undefined" &&
  (/(^|[#&?])type=recovery(&|$)/.test(`${window.location.hash}&${window.location.search.slice(1)}`) ||
    /autobase_action=reset-password/.test(`${window.location.hash}${window.location.search}`));

// ── session shape ───────────────────────────────────────────────────────────

type AuthPayload = {
  user?: { id: string; email?: string | null; name?: string | null; image?: string | null };
  session?: { token?: string | null } | null;
} | null;

function toUser(user: NonNullable<AuthPayload>["user"]): User {
  return {
    id: user?.id ?? "",
    email: user?.email ?? null,
    user_metadata: { full_name: user?.name ?? null, avatar_url: user?.image ?? null },
    app_metadata: {},
    aud: "authenticated",
    created_at: "",
  } as unknown as User;
}

function toSession(payload: AuthPayload): Session | null {
  if (!payload?.user) return null;
  return {
    access_token: payload.session?.token ?? "",
    refresh_token: "",
    token_type: "bearer",
    expires_in: 60 * 60,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    user: toUser(payload.user),
  } as unknown as Session;
}

async function currentPayload(): Promise<AuthPayload> {
  try {
    const { data } = await sessionApi.getSession();
    return (data ?? null) as unknown as AuthPayload;
  } catch {
    return null;
  }
}

const failure = (message: string) => ({ data: { session: null, user: null }, error: { message } });

/**
 * Registration details are kept on the device until the account's profile row
 * exists, because email confirmation finishes the sign-up on another visit.
 */
const PENDING_PROFILE_KEY = "aoh-pending-profile:";

function rememberRegistration(email: string, details: Record<string, unknown>) {
  try {
    localStorage.setItem(`${PENDING_PROFILE_KEY}${email.toLowerCase()}`, JSON.stringify(details));
  } catch {
    // Storage is optional: the account and profile are still created.
  }
}

export function takePendingRegistration(email: string | null): Record<string, unknown> | null {
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

// ── auth ────────────────────────────────────────────────────────────────────

type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "PASSWORD_RECOVERY";
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const listeners = new Set<AuthListener>();
let lastUserId: string | null = null;
let watchStarted = false;

async function broadcast(event: AuthChangeEvent, force = false) {
  const session = toSession(await currentPayload());
  const nextId = session?.user.id ?? null;
  if (!force && event !== "INITIAL_SESSION" && nextId === lastUserId) return;
  const resolved: AuthChangeEvent = event === "INITIAL_SESSION" ? event : nextId ? "SIGNED_IN" : "SIGNED_OUT";
  lastUserId = nextId;
  for (const listener of [...listeners]) listener(resolved, session);
}

/** Watches for sign-in / sign-out once, for every screen that asked. */
function startWatching() {
  if (watchStarted) return;
  watchStarted = true;
  const store = (auth as unknown as { $store?: { listen?: (cb: () => void) => () => void } }).$store;
  if (store && typeof store.listen === "function") {
    try {
      store.listen(() => void broadcast("SIGNED_IN"));
    } catch {
      // A polling check below still keeps the session in step.
    }
  }
  window.setInterval(() => void broadcast("SIGNED_IN"), 20_000);
}

const authApi = {
  async getSession() {
    const payload = await currentPayload();
    return { data: { session: toSession(payload) }, error: null };
  },

  async getUser() {
    const payload = await currentPayload();
    const user = payload?.user ? toUser(payload.user) : null;
    return { data: { user }, error: user ? null : { message: "Not signed in." } };
  },

  onAuthStateChange(callback: AuthListener) {
    listeners.add(callback);
    startWatching();
    window.setTimeout(() => void broadcast("INITIAL_SESSION", true), 0);
    return {
      data: {
        subscription: {
          unsubscribe() {
            listeners.delete(callback);
          },
        },
      },
    };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const { data, error } = await auth.signIn.email({ email, password });
    if (error) return failure(error.message || "That email and password do not match an account.");
    void broadcast("SIGNED_IN", true);
    return { data: { session: toSession(data as unknown as AuthPayload), user: data?.user ? toUser(data.user) : null }, error: null };
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }) {
    const details = options?.data ?? {};
    const name = typeof details.full_name === "string" ? details.full_name : email.split("@")[0];
    const { data, error } = await auth.signUp.email({ email, password, name });
    if (error) {
      const message = /exist/i.test(error.message ?? "")
        ? "An account with this email already exists. One email can only be used for one account (User, Admin or Staff) — please sign in instead."
        : error.message || "The account could not be created.";
      return { data: { user: null, session: null, identities: [] }, error: { message } };
    }
    const { full_name: _name, ...rest } = details;
    if (Object.keys(rest).length) rememberRegistration(email, rest);
    void broadcast("SIGNED_IN", true);
    return {
      data: {
        user: data?.user ? toUser(data.user) : null,
        session: toSession(data as unknown as AuthPayload),
        identities: data?.user ? [{ id: data.user.id }] : [],
      },
      error: null,
    };
  },

  async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
    try {
      await sendPasswordReset(email, "/reset-password");
      return { data: {}, error: null };
    } catch (err) {
      return { data: {}, error: { message: err instanceof Error ? err.message : "The reset email could not be sent." } };
    }
  },

  async updateUser({ password }: { password?: string; [key: string]: unknown }) {
    if (!password) return { data: { user: null }, error: null };
    try {
      await resetPassword(password);
      return { data: { user: null }, error: null };
    } catch (err) {
      return { data: { user: null }, error: { message: err instanceof Error ? err.message : "The password could not be changed." } };
    }
  },

  async signOut() {
    const { error } = await sessionApi.signOut();
    void broadcast("SIGNED_OUT", true);
    return { error: error ? { message: error.message || "Sign-out did not finish." } : null };
  },
};

// ── server functions ───────────────────────────────────────────────────────

async function invokeFunction(name: string, body: unknown) {
  if (!isBackendConfigured) {
    return { data: null, error: { message: "The server function is unavailable right now." } };
  }
  const payload = await currentPayload();
  const token = payload?.session?.token ?? PUBLISHABLE_KEY;
  try {
    const response = await fetch(`${BASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });
    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Plain text answers are passed through as they are.
    }
    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : `The request failed (${response.status}).`;
      return { data: null, error: { message } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : "The request could not be sent." } };
  }
}

// ── the client the app already uses ────────────────────────────────────────

const NOT_CONNECTED =
  "The database is not connected in this build, so this action is unavailable. Tell us which module you need.";

/**
 * Server-side routines run on the same backend as the tables, so they are
 * forwarded rather than stubbed. They used to answer "not available yet" for
 * every call, which silently disabled helpdesk, quizzes, grade appeals,
 * newsletter campaigns, enrolment and the congratulations queue even though
 * the routines exist and are granted by the access policies.
 */
const rpc = async (
  fn: string,
  args?: Record<string, unknown>,
  options?: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> => {
  if (!isBackendConfigured) return { data: null, error: { message: NOT_CONNECTED } };
  const client = db as unknown as {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  return client.rpc(fn, args, options);
};

export const supabase = {
  from: (table: string) => db.from(table),
  storage: db.storage,
  channel: (name: string, params?: unknown) => db.channel(name, params as never),
  removeChannel: (channel: unknown) => db.removeChannel(channel as never),
  auth: authApi,
  functions: { invoke: invokeFunction },
  rpc,
};
