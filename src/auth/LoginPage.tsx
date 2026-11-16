import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

function LoginForm({
  onSuccess,
  onSwitchToSignup,
  onSwitchToForgot,
}: {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  onSwitchToForgot?: () => void;
}) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setSubmitting(false);
      toast.success("Signed in.");
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">Sign in</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sign in to your account to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {onSwitchToForgot ? (
            <button
              type="button"
              onClick={onSwitchToForgot}
              className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Forgot password?
            </button>
          ) : null}
        </div>

        <div aria-live="polite">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {onSwitchToSignup ? (
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="mt-4 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Don&apos;t have an account? Sign up
        </button>
      ) : null}
    </>
  );
}

function ForgotForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await resetPassword(email);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setSent(true);
      toast.success("Password reset link sent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">Reset password</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {sent ? (
        <>
          <p className="mt-6 text-sm text-gray-600" aria-live="polite">
            Check your email for a reset link.
          </p>
          <button
            type="button"
            onClick={onBackToLogin}
            className="mt-6 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div aria-live="polite">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>

          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to sign in
          </button>
        </form>
      )}
    </>
  );
}

export function LoginPage({
  onSuccess,
  onSwitchToSignup,
  bare = false,
}: {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  bare?: boolean;
}) {
  const [mode, setMode] = React.useState<"login" | "forgot">("login");

  const card = (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      {mode === "forgot" ? (
        <ForgotForm onBackToLogin={() => setMode("login")} />
      ) : (
        <LoginForm
          onSuccess={onSuccess}
          onSwitchToSignup={onSwitchToSignup}
          onSwitchToForgot={() => setMode("forgot")}
        />
      )}
    </div>
  );

  if (bare) return card;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      {card}
    </div>
  );
}
