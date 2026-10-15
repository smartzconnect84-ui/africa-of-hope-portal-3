import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at?: string;
  [key: string]: unknown;
};

type SignInResult = { error: string | null };

type SignUpResult = { error: string | null; needsConfirmation: boolean };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<SignUpResult>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  updateProfile: (
    fields: Partial<Profile>
  ) => Promise<{ error: string | null }>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const activeUserIdRef = React.useRef<string | null>(null);

  const loadProfile = React.useCallback(
    async (userId: string, email: string | null) => {
      const { data, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (activeUserIdRef.current !== userId) return;
      if (selectError) {
        // A failed read is not an absent row: never fall through to INSERT.
        setError(selectError.message);
        return;
      }
      if (data) {
        setProfile(data as Profile);
        return;
      }
      // The signup trigger normally creates the row; if it did not, create it.
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: userId, email })
        .select()
        .maybeSingle();
      if (activeUserIdRef.current !== userId) return;
      setProfile((created as Profile) ?? { id: userId, email, full_name: null });
    },
    []
  );

  React.useEffect(() => {
    // Subscribe before the initial read. The listener may deliver a fresher
    // session (INITIAL_SESSION / sign-in) while getSession() is still in
    // flight; once an event has arrived the late read must not overwrite it.
    let gotEvent = false;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        gotEvent = true;
        setError(null);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        activeUserIdRef.current = nextSession?.user?.id ?? null;
        setLoading(false);
        if (nextSession?.user) {
          void loadProfile(nextSession.user.id, nextSession.user.email ?? null);
        } else {
          setProfile(null);
        }
      }
    );

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (gotEvent) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        activeUserIdRef.current = data.session?.user?.id ?? null;
        if (data.session?.user) {
          void loadProfile(data.session.user.id, data.session.user.email ?? null);
        }
      })
      .catch((err: unknown) => {
        // Surface the failure instead of swallowing it: leave the user
        // signed-out with the error available on the context.
        if (gotEvent) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = React.useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const signUp = React.useCallback(
    async (
      email: string,
      password: string,
      fullName?: string
    ): Promise<SignUpResult> => {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) {
        return { error: signUpError.message, needsConfirmation: false };
      }
      // A session means confirmation is disabled and the user is signed in.
      if (data.session) {
        return { error: null, needsConfirmation: false };
      }
      // User created but no session: try one immediate sign-in (works when
      // confirmation is off but signUp withheld a session). If that fails,
      // confirmation is genuinely required.
      if (data.user) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (!signInError) {
          return { error: null, needsConfirmation: false };
        }
      }
      return { error: null, needsConfirmation: true };
    },
    []
  );

  const resetPassword = React.useCallback(
    async (email: string): Promise<{ error: string | null }> => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: window.location.origin }
      );
      return { error: resetError?.message ?? null };
    },
    []
  );

  const signOut = React.useCallback(
    async (): Promise<{ error: string | null }> => {
      const { error: signOutError } = await supabase.auth.signOut();
      const message = signOutError?.message ?? null;
      if (message) {
        setError(message);
      } else {
        setProfile(null);
      }
      return { error: message };
    },
    []
  );

  const updateProfile = React.useCallback(
    async (fields: Partial<Profile>): Promise<{ error: string | null }> => {
      if (!session?.user) {
        return { error: "Not signed in." };
      }
      // Never let callers rewrite the primary key / server-managed columns.
      const safeFields: Partial<Profile> = { ...fields };
      delete safeFields.id;
      delete safeFields.created_at;
      const { error: updateError } = await supabase
        .from("profiles")
        .update(safeFields)
        .eq("id", session.user.id);
      if (updateError) {
        return { error: updateError.message };
      }
      setProfile((prev) => (prev ? { ...prev, ...safeFields } : prev));
      return { error: null };
    },
    [session]
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      error,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      error,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}