import { supabase } from "../integrations/supabase/client.ts";
import type { Certificate, CertificateStatus } from "@/types";

type Row = Record<string, unknown>;
type Client = typeof supabase;

const text = (value: unknown, fallback = "") =>
  value === null || value === undefined ? fallback : typeof value === "string" ? value : String(value);

/** Maps a `certificates` row (snake_case, from the RPC or a select) to the app's Certificate type. */
export function mapCertificateRow(row: Row): Certificate {
  const status: CertificateStatus = row.status === "Valid" ? "Valid" : "Revoked";
  return {
    id: text(row.id),
    studentId: text(row.student_id),
    programId: text(row.program_id),
    serial: text(row.serial),
    issueDate: text(row.issue_date).slice(0, 10),
    honors: text(row.honors, "Pass") || "Pass",
    grade: text(row.grade),
    status,
    revokedAt: row.revoked_at ? text(row.revoked_at) : undefined,
    revokedBy: row.revoked_by ? text(row.revoked_by) : undefined,
    revocationReason: row.revocation_reason ? text(row.revocation_reason) : undefined,
  };
}

/**
 * Turns the raw Postgres/PostgREST error into wording a staff member or student can act on.
 * Returns null when there was no error, so callers can `throw new Error(message)`.
 */
export function explainCertificateError(error: { message?: string } | null | undefined): string | null {
  if (!error) return null;
  const message = error.message ?? "";
  if (/could not find the function|function .* does not exist|schema cache/i.test(message)) {
    return "Certificate issuing is not set up on the server yet. An administrator must apply the certificate migration in supabase/migrations before certificates can be issued.";
  }
  if (/complete all approved lessons/i.test(message)) {
    return "Complete every approved lesson in this programme before claiming its certificate.";
  }
  if (/only active school admin or super admin/i.test(message)) {
    return "Only an active School Admin or Super Admin can revoke a certificate.";
  }
  if (/revocation reason/i.test(message)) {
    return "Add a revocation reason between 5 and 1000 characters.";
  }
  if (/certificate not found/i.test(message)) return "That certificate is no longer in the register. Reload and try again.";
  if (/certificate identity cannot be changed|revocation cannot be reversed/i.test(message)) {
    return "The register refused that change. Certificate identity and revocations are permanent.";
  }
  if (/not authorized|certificate staff/i.test(message)) {
    return "Your account is not allowed to issue certificates with that award class.";
  }
  if (/active signed-in account is required|the holder must be an active account/i.test(message)) {
    return "Certificate holders must be signed in with an active account.";
  }
  return message || "The certificate request failed.";
}

export interface CertificatesApi {
  /** Issues (or returns the existing) certificate through the checked database function. */
  issue(studentId: string, programId: string, honors: string): Promise<Certificate>;
  /** Administrator-only revocation; the database re-checks the role and requires a reason. */
  revoke(certificateId: string, reason: string): Promise<Certificate>;
}

export function createCertificatesApi(client: Client): CertificatesApi {
  return {
    async issue(studentId, programId, honors) {
      if (!studentId || !programId) throw new Error("Choose a student and a programme first.");
      const { data, error } = await client.rpc("issue_certificate", {
        p_student_id: studentId,
        p_program_id: programId,
        p_honors: honors || "Pass",
      });
      const message = explainCertificateError(error);
      if (message) throw new Error(message);
      if (!data) throw new Error("The server did not return the issued certificate. Reload and check the register.");
      return mapCertificateRow(data as Row);
    },

    async revoke(certificateId, reason) {
      const trimmed = reason.trim();
      if (trimmed.length < 5) throw new Error("Add a revocation reason of at least 5 characters.");
      const { data, error } = await client.rpc("revoke_certificate", {
        p_certificate_id: certificateId,
        p_reason: trimmed,
      });
      const message = explainCertificateError(error);
      if (message) throw new Error(message);
      if (!data) throw new Error("The server did not confirm the revocation. Reload and check the register.");
      return mapCertificateRow(data as Row);
    },
  };
}

export const certificatesApi = createCertificatesApi(supabase);
