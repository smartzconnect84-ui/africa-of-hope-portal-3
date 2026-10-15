/** Shared text-input styling for the auth and profile forms. */
export const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";

/** Validates a new password and its confirmation. */
export function newPasswordErrors(password: string, confirm: string): { a?: string; b?: string } {
  return {
    ...(password.length < 8 && { a: "Use at least 8 characters" }),
    ...(confirm !== password && { b: "Passwords do not match" }),
  };
}
