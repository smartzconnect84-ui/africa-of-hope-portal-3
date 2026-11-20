// Autobase client — managed by Automo Build. The agent never edits this file.
//
// Two clients, one backend:
//   auth — sign-in (Better Auth): auth.signUp.email(), auth.signIn.email(),
//          auth.signOut(), auth.useSession() in components.
//   db   — data (the supabase-js API): db.from('todos').select()...
//          Requests carry the signed-in user's token, so the database's
//          access policies see who is asking.
//
// And the sign-in flows that leave the page and come back:
//   signInWithProvider('google' | 'microsoft')  — no keys to set up anywhere
//   sendMagicLink(email), sendPasswordReset(email), resendConfirmation(email)
//   completeSignIn() — call ONCE on app load; finishes whatever came back
//   resetPassword(newPassword) — on the page a reset email opened
//
// RESILIENCE RULE: a missing or misconfigured backend must NEVER crash the
// app. Without valid env vars this file exports clients pointed at an
// unroutable placeholder: the app still boots and renders, data calls resolve
// to { data: null, error } and sign-in calls return an error. NEVER "fix"
// this by throwing at module load, and NEVER fall back to another backend.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// better-auth is an optional runtime dependency: the preview sandbox may not
// have it installed even though it is listed in package.json. A static import
// would fail Vite resolution and the typecheck, so the real client is loaded
// lazily (see below) and a stub keeps the app bootable until then.

// `import.meta.env` only exists when Vite builds the page. Reading it without a
// guard threw on every other entry point (the node test runner imports this
// module), which made the data layer impossible to load outside the bundler.
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const baseUrl = env?.VITE_AUTOBASE_URL;
const publishableKey = env?.VITE_AUTOBASE_PUBLISHABLE_KEY;

function isValidConfig(url: string | undefined, key: string | undefined): boolean {
  if (!url || !key || !key.startsWith('sb_publishable_')) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** False when the backend is not connected — gate backend-dependent UI on this. */
export const isBackendConfigured = isValidConfig(baseUrl, publishableKey);

// RFC 2606 `.invalid`: syntactically valid, can never resolve.
const PLACEHOLDER_URL = 'https://autobase-not-connected.invalid';
const apiUrl = isBackendConfigured ? baseUrl!.replace(/\/$/, '') : PLACEHOLDER_URL;

if (!isBackendConfigured) {
  console.error('[backend] The backend is not connected, so data features are unavailable right now.');
}

// The session token lives in localStorage and travels as a bearer token: the
// backend is on another site than the app, where cookies would be blocked.
const SESSION_KEY = `autobase:session:${apiUrl}`;
const session = {
  get(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(SESSION_KEY, token);
    } catch {
      // Private mode: the session lasts for this page only.
    }
  },
  clear() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  },
};

/** The short-lived token data requests carry, refreshed a minute before it expires. */
let accessToken: { token: string; exp: number } | null = null;

/** Auth client: stub until the real better-auth client loads (if installed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAuth = any;
const authStubError = { message: 'Sign-in is not available right now.' };
const stubResult = async () => ({ data: null as AnyAuth, error: authStubError });
const stubStore = { notify() { /* no session to broadcast */ }, listen() { return () => { /* noop */ }; } };
export const auth: AnyAuth = {
  $store: stubStore,
  useSession: () => ({ data: null }),
  getSession: async () => ({ data: null }),
  signOut: async () => ({ error: null }),
  token: stubResult,
  verifyEmail: stubResult,
  resetPassword: stubResult,
  requestPasswordReset: stubResult,
  sendVerificationEmail: stubResult,
  magicLink: { verify: stubResult },
  signIn: { email: stubResult, magicLink: stubResult },
  signUp: { email: stubResult },
};

void (async () => {
  try {
    // Specifiers are built at runtime so Vite never statically resolves
    // "better-auth/*" (missing install would otherwise break the preview).
    const reactSpecifier = ['better-auth', 'react'].join('/');
    const pluginsSpecifier = ['better-auth', 'client', 'plugins'].join('/');
    const [reactMod, pluginMod] = await Promise.all([
      import(/* @vite-ignore */ reactSpecifier),
      import(/* @vite-ignore */ pluginsSpecifier),
    ]);
    const real = (reactMod as AnyAuth).createAuthClient({
      baseURL: `${apiUrl}/auth`,
      plugins: [(pluginMod as AnyAuth).jwtClient(), (pluginMod as AnyAuth).magicLinkClient()],
      fetchOptions: {
        auth: { type: 'Bearer', token: () => session.get() ?? '' },
        onSuccess: (ctx: AnyAuth) => {
          const issued = ctx.response.headers.get('set-auth-token');
          if (issued) {
            session.set(issued);
            accessToken = null;
          }
          if (ctx.request.url.toString().endsWith('/sign-out')) {
            session.clear();
            accessToken = null;
          }
        },
      },
    });
    Object.assign(auth, real);
  } catch {
    // better-auth not installed here (preview sandbox): keep the stub so the
    // app still boots and renders; backend features report unavailable.
  }
})();

function expiry(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

async function currentAccessToken(): Promise<string | null> {
  if (!session.get()) return null;
  if (accessToken && accessToken.exp - 60 > Date.now() / 1000) return accessToken.token;
  // The generated client types token() as requiring input; it is a no-argument call.
  const { data } = await (auth.token as unknown as () => Promise<{ data?: { token?: string } }>)();
  if (!data?.token) {
    accessToken = null;
    return null;
  }
  accessToken = { token: data.token, exp: expiry(data.token) };
  return accessToken.token;
}

/** Data access with the supabase-js API. Signed out, requests run as anonymous. */
export const db: SupabaseClient = createClient(apiUrl, isBackendConfigured ? publishableKey! : 'sb_publishable_not_connected', {
  accessToken: currentAccessToken,
});

// ── Sign-in flows that leave the page ───────────────────────────────────────
//
// Email links (magic link, confirmation, password reset) open this app with
// `#autobase_action=…&autobase_token=…`. Google and Microsoft sign-in runs on
// the platform, with its own provider apps, and comes back with
// `#session_token=…` (or, inside an iframe such as the builder preview, by a
// message from a popup). Either way completeSignIn() finishes it.

const SIGN_IN_SERVICE = 'https://api.automo.build/functions/v1/oauth-broker';
const SIGN_IN_MESSAGE = 'ciao-managed-oauth';
const PENDING_STATE_KEY = 'autobase:sign-in-state';
const RESET_TOKEN_KEY = 'autobase:reset-token';

export type SignInProvider = 'google' | 'microsoft';
export type CompletedSignIn = 'signed-in' | 'email-confirmed' | 'reset-password';

const FRIENDLY: Record<string, string> = {
  account_exists: 'An account with this email already exists. Sign in with your password first, or confirm your email address, then try again.',
  no_email: "Your account didn't share an email address. Try a different sign-in method.",
  expired: 'That sign-in attempt expired. Please try again.',
  expired_link: 'This link has expired or was already used. Ask for a new one.',
  not_available: "This sign-in option isn't available yet.",
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
};
const friendly = (code: string) => FRIENDLY[code] ?? "We couldn't complete the sign-in. Please try again.";

function sessionStore(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/** A full URL on this app for a path like '/reset-password'. */
function onThisApp(page: string): string {
  return new URL(page, window.location.origin).toString();
}

/** Signed in from outside the auth client: keep the session and tell useSession(). */
function adoptSession(token: string) {
  session.set(token);
  accessToken = null;
  auth.$store.notify('$sessionSignal');
}

function clearFragment() {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function finishProvider(returned: Record<string, string>, expectedState: string | null) {
  if (!expectedState || returned.state !== expectedState) throw new Error(friendly('expired'));
  if (returned.error) throw new Error(friendly(returned.error));
  if (!returned.session_token) throw new Error(friendly('backend_error'));
  adoptSession(returned.session_token);
}

/**
 * Sign in with Google or Microsoft. In a normal tab the page leaves and comes
 * back (finish it with completeSignIn() on load); inside an iframe a popup is
 * used and the user is signed in when this resolves. If that popup is blocked
 * or is this window (mobile WebView), the parent is asked to open a redirect
 * in the system browser and this call stops without setting a session here.
 */
export async function signInWithProvider(provider: SignInProvider): Promise<void> {
  if (!isBackendConfigured) throw new Error(friendly('not_available'));
  const state = crypto.randomUUID().replace(/-/g, '');
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    // A cross-origin parent: we are framed.
  }
  const params = new URLSearchParams({
    provider,
    backend: apiUrl,
    redirect_to: window.location.origin + window.location.pathname + window.location.search,
    mode: inIframe ? 'popup' : 'redirect',
    client_state: state,
  });
  const start = `${SIGN_IN_SERVICE}/start?${params.toString()}`;
  if (!inIframe) {
    sessionStore()?.setItem(PENDING_STATE_KEY, state);
    window.location.href = start;
    return;
  }
  const returned = await new Promise<Record<string, string> | null>((resolve, reject) => {
    const serviceOrigin = new URL(SIGN_IN_SERVICE).origin;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(friendly('expired')));
    }, 5 * 60 * 1000);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== serviceOrigin) return;
      const data = event.data as { source?: string; payload?: Record<string, string> } | null;
      if (!data || data.source !== SIGN_IN_MESSAGE || !data.payload) return;
      cleanup();
      resolve(data.payload);
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
    window.addEventListener('message', onMessage);
    const popupWin = window.open(start, SIGN_IN_MESSAGE, 'width=480,height=640');
    if (!popupWin || popupWin === window) {
      cleanup();
      resolve(null);
    }
  });
  if (!returned) {
    params.set('mode', 'redirect');
    const redirectUrl = `${SIGN_IN_SERVICE}/start?${params.toString()}`;
    window.parent.postMessage({ type: 'ciao:managed-oauth-open', url: redirectUrl }, '*');
    throw new Error('Sign-in continues in your browser.');
  }
  finishProvider(returned, state);
}

/** Email a one-time sign-in link that opens `page` of this app (the account is created on first use). */
export async function sendMagicLink(email: string, page = '/'): Promise<void> {
  const { error } = await auth.signIn.magicLink({ email, callbackURL: onThisApp(page) });
  if (error) throw new Error(error.message || friendly('backend_error'));
}

/** Email a password reset link that opens `page` of this app, where resetPassword() sets the new one. */
export async function sendPasswordReset(email: string, page = '/reset-password'): Promise<void> {
  const { error } = await auth.requestPasswordReset({ email, redirectTo: onThisApp(page) });
  if (error) throw new Error(error.message || friendly('backend_error'));
}

/** Email the address confirmation again, opening `page` of this app. */
export async function resendConfirmation(email: string, page = '/'): Promise<void> {
  const { error } = await auth.sendVerificationEmail({ email, callbackURL: onThisApp(page) });
  if (error) throw new Error(error.message || friendly('backend_error'));
}

/**
 * Finish whatever brought the user back to this page: a magic link or a
 * confirmation link (signs them in), Google/Microsoft sign-in (signs them in),
 * or a password reset link (returns 'reset-password': show the new-password
 * form and call resetPassword()). Null when there is nothing to finish. Call
 * once on app load; it throws a message to show the user when a link is
 * expired or a sign-in failed.
 */
export async function completeSignIn(): Promise<CompletedSignIn | null> {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const action = hash.get('autobase_action');
  const token = hash.get('autobase_token');
  if (action && token) {
    clearFragment();
    if (action === 'reset') {
      sessionStore()?.setItem(RESET_TOKEN_KEY, token);
      return 'reset-password';
    }
    if (action === 'magic') {
      const { error } = await auth.magicLink.verify({ query: { token } });
      if (error) throw new Error(friendly('expired_link'));
      auth.$store.notify('$sessionSignal');
      return 'signed-in';
    }
    if (action === 'verify') {
      const { error } = await auth.verifyEmail({ query: { token } });
      if (error) throw new Error(friendly('expired_link'));
      auth.$store.notify('$sessionSignal');
      return 'email-confirmed';
    }
    return null;
  }
  if (hash.has('state') && (hash.has('session_token') || hash.has('error'))) {
    const returned = Object.fromEntries(hash.entries());
    clearFragment();
    const store = sessionStore();
    const expected = store?.getItem(PENDING_STATE_KEY) ?? null;
    store?.removeItem(PENDING_STATE_KEY);
    finishProvider(returned, expected);
    return 'signed-in';
  }
  return null;
}

/** On the page a password reset email opened: set the new password. Sign in with it afterwards. */
export async function resetPassword(newPassword: string): Promise<void> {
  const store = sessionStore();
  const token = store?.getItem(RESET_TOKEN_KEY);
  if (!token) throw new Error(friendly('expired_link'));
  const { error } = await auth.resetPassword({ newPassword, token });
  if (error) throw new Error(error.code === 'INVALID_TOKEN' ? friendly('expired_link') : error.message || friendly('backend_error'));
  store?.removeItem(RESET_TOKEN_KEY);
}
