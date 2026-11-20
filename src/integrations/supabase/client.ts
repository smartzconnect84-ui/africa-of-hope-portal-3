type AuthUserPayload = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  identities?: Array<{ id: string }>;
  created_at?: string;
};

type AuthSessionPayload = {
  token?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_in?: number | null;
  expires_at?: number | null;
};

type AuthPayload = {
  user?: AuthUserPayload | null;
  session?: AuthSessionPayload | null;
} | null;function toUser(user: NonNullable<AuthPayload>["user"]): User {
  const u = (user ?? {}) as any;
  return {
    id: u.id ?? "",
    email: u.email ?? null,
    user_metadata: { full_name: u.name ?? null, avatar_url: u.image ?? null },
    app_metadata: {},
    aud: "authenticated",
    created_at: u.created_at ?? "",
    identities: u.identities ?? [],
  } as unknown as User;
}

function toSession(payload: AuthPayload): Session | null {
  const user = payload?.user;
  const sessionData = payload?.session;
  if (!user) return null;

  const access_token = sessionData?.token ?? sessionData?.access_token ?? "";
  const refresh_token = sessionData?.refresh_token ?? "";
  const expires_in = sessionData?.expires_in ?? 3600;
  const expires_at = sessionData?.expires_at ?? Math.floor(Date.now() / 1000) + expires_in;

  return {
    access_token,
    refresh_token,
    token_type: sessionData?.token_type ?? "bearer",
    expires_in,
    expires_at,
    user: toUser(user),
  } as unknown as Session;
}async resetPasswordForEmail(
  email: string,
  options?: { redirectTo?: string }
) {
  try {
    const page = options?.redirectTo
      ? new URL(options.redirectTo, window.location.origin).pathname
      : "/reset-password";
    const { error } = await sendPasswordReset(email, page);
    return { data: {}, error };
  } catch (err) {
    return {
      data: {},
      error: { message: err instanceof Error ? err.message : "The reset email could not be sent." },
    };
  }
}async signUp({
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
    return { data: { user: null, session: null, identities: [] }, error: { message }, needsConfirmation: false };
  }

  const needsConfirmation = !data?.session;
  const user = data?.user ? toUser(data.user) : null;
  const identities = data?.user?.identities ?? [];

  const pending = { ...details };
  if (Object.keys(pending).length) rememberRegistration(email, pending);

  if (!needsConfirmation) {
    void broadcast("SIGNED_IN", true);
  }

  return {
    data: {
      user,
      session: needsConfirmation ? null : toSession(data as unknown as AuthPayload),
      identities,
    },
    error: null,
    needsConfirmation,
  };
}const signUp = React.useCallback(
  async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<SignUpResult> => {
    const cleanEmail = email.trim().toLowerCase();
    const { error, needsConfirmation } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      return { error: error.message, needsConfirmation: false };
    }

    return { error: null, needsConfirmation };
  },
  []
);const payload: Record<string, unknown> = {
  id: userId,
  email,
  full_name: (application.full_name as string) ?? null,
  role: "Student",
  status: "Pending Approval",
};
Object.assign(payload, application);

const { data: created, error: createError } = await supabase
  .from("profiles")
  .upsert(payload, { onConflict: "id" })
  .select()
  .single();const signOut = React.useCallback(async (): Promise<{ error: string | null }> => {
  const { error: signOutError } = await supabase.auth.signOut();
  setProfile(null);
  setUser(null);
  setSession(null);
  activeUserIdRef.current = null;
  const message = signOutError?.message ?? null;
  if (message) setError(message);
  return { error: message };
}, []);const resetPassword = React.useCallback(
  async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  },
  []
);if (
  nextSession?.user &&
  (_event === "SIGNED_IN" || _event === "USER_UPDATED")
) {
  const nextId = nextSession.user.id;
  const nextEmail = nextSession.user.email ?? null;
  window.setTimeout(() => {
    if (activeUserIdRef.current === nextId) void loadProfile(nextId, nextEmail);
  }, 0);
} else if (!nextSession?.user) {
  setProfile(null);
}async updateUser({ password }: { password?: string; [key: string]: unknown }) {
  if (!password) return { data: { user: null }, error: null };
  // Replace with your real password-update call or RPC.
  // Do not send a reset email here.
  return { data: { user: null }, error: { message: "Password update is not wired yet." } };
}
