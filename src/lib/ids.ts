/**
 * Single source of truth for client-generated ids.
 * Safe on http://, older browsers and Safari where `crypto.randomUUID`
 * is unavailable (secure-context only). No duplication: every module
 * should import from here instead of re-implementing it.
 */

let seq = 0;

/** Cryptographically-strong-when-possible UUID, with deterministic fallbacks. Optional prefix for readable ids, e.g. newId("c"). */
export function newId(prefix?: string): string {
  let core: string;
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") {
      core = c.randomUUID();
    } else if (c && typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      core = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    } else {
      throw new Error("no-secure-random");
    }
  } catch {
    /* Math.random fallback only when WebCrypto is unavailable (old browsers / non-secure contexts). */
    core = `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  const clean = (prefix ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "");
  return clean ? `${clean}-${core}` : core;
}

/** Prefixed CMS/local id, e.g. genId("hero"). Single implementation backed by newId — no duplicate logic. */
export function genId(prefix = "id"): string {
  return newId(prefix);
}
