import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

export function SignupPage({
  onSuccess,
  onSwitchToLogin,
  bare = false,
}: {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  bare?: boolean;
}) {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = React.useState<
    string | null
  >(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUp(email, password, fullName.trim());
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setConfirmationSentTo(email);
        toast.success("Account created. Check your email to confirm.", {
          duration: 7000,
        });
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      toast.success("Account created — you're signed in.");
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const card = (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      {confirmationSentTo ? (
        <>
          <h1 className="text-xl font-semibold text-gray-900">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a confirmation link to{" "}
            <span className="font-medium text-gray-900">
              {confirmationSentTo}
            </span>
            . Open it to finish creating your account, then sign in.
          </p>
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="mt-6 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Back to sign in
            </button>
          ) : null}
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-gray-900">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your details to get started.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="signup-full-name"
                className="block text-sm font-medium text-gray-700"
              >
                Full name
              </label>
              <input
                id="signup-full-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="signup-email"
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
                htmlFor="signup-password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="mt-4 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Already have an account? Sign in
            </button>
          ) : null}
        </>
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
