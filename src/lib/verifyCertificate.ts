import { supabase } from "@/integrations/supabase/client";
import type { Certificate } from "@/types";

/**
 * One certificate as the public register is allowed to expose it. This mirrors
 * the columns returned by the `verify-certificate` Edge Function — no private
 * student records, contact details or grades beyond the printed award class.
 */
export type VerifiedCertificate = Pick<
  Certificate,
  "serial" | "issueDate" | "honors" | "grade" | "status" | "revokedAt"
> & {
  holderName: string;
  programTitle: string;
  certificateType?: string;
  completionDate?: string | null;
};

export const CERTIFICATE_SERIAL_MAX = 80;

export function normalizeCertificateSerial(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, CERTIFICATE_SERIAL_MAX);
}

/**
 * Looks a serial up in the live register through the public Edge Function, which
 * re-checks the certificate row itself. A serial that exists but was revoked
 * comes back with status "Revoked" rather than being treated as valid.
 *
 * Throws on network / server problems so callers can tell "no such certificate"
 * apart from "the register could not be reached".
 */
export async function lookupCertificate(serial: string): Promise<VerifiedCertificate | null> {
  const query = normalizeCertificateSerial(serial);
  if (!query) throw new Error("Enter a certificate serial number.");
  const { data, error } = await supabase.functions.invoke("verify-certificate", {
    body: { serial: query },
  });
  if (error) throw new Error("The certificate register is unavailable. Try again or contact the registrar.");
  if (!data || typeof data !== "object") throw new Error("The server did not confirm a lookup result.");
  const payload = data as { error?: string; certificate?: VerifiedCertificate | null };
  if (payload.error) throw new Error(payload.error);
  return payload.certificate ?? null;
}

/** Reads a serial from `?serial=` in either the search string or the hash route. */
export function serialFromLocation(): string {
  if (typeof window === "undefined") return "";
  const fromSearch = new URLSearchParams(window.location.search).get("serial");
  const hash = window.location.hash;
  const marker = hash.indexOf("?");
  const fromHash = marker >= 0 ? new URLSearchParams(hash.slice(marker + 1)).get("serial") : null;
  return normalizeCertificateSerial(fromSearch || fromHash || "");
}
