// The preference stores no email or password. Supabase owns its encrypted-transport
// token lifecycle; remember-me only selects the browser persistence lifetime.
const PREFERENCE_KEY = "aoh-remember-me";
const memory = new Map<string, string>();

export function remembersSession(): boolean {
  try { return localStorage.getItem(PREFERENCE_KEY) === "true"; }
  catch { return false; }
}

export function setRememberSession(remember: boolean): void {
  try { localStorage.setItem(PREFERENCE_KEY, String(remember)); }
  catch { if (remember) throw new Error("This browser blocks persistent storage. Uncheck Remember me to continue."); }
}

export const authStorage = {
  getItem(key: string): string | null {
    try {
      // Read legacy sessions so this change does not unexpectedly sign users out.
      return sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch { return memory.get(key) ?? null; }
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    try {
      const target = remembersSession() ? localStorage : sessionStorage;
      const other = remembersSession() ? sessionStorage : localStorage;
      other.removeItem(key);
      target.setItem(key, value);
    } catch { /* A blocked browser can still use this in-memory session. */ }
  },
  removeItem(key: string): void {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch { /* unavailable */ }
    try { sessionStorage.removeItem(key); } catch { /* unavailable */ }
  },
};
