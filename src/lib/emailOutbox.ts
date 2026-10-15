import { supabase } from "../integrations/supabase/client.ts";

export type EmailOutboxStatus = "queued" | "sending" | "sent" | "failed" | "skipped";

export interface EmailOutboxRow {
  id: string;
  toEmail: string;
  toName: string;
  template: string;
  subject: string;
  status: EmailOutboxStatus;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  sendAfter: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EmailOutboxCounts = Partial<Record<EmailOutboxStatus, number>>;

interface DbRow {
  id: string;
  to_email: string;
  to_name: string | null;
  template: string;
  subject: string;
  status: EmailOutboxStatus;
  attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  send_after: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DbRow): EmailOutboxRow {
  return {
    id: row.id,
    toEmail: row.to_email,
    toName: row.to_name ?? "",
    template: row.template,
    subject: row.subject,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    providerMessageId: row.provider_message_id,
    sendAfter: row.send_after,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Translates a Supabase/Postgres/function error into actionable UI copy. */
export function explainEmailOutboxError(error: { message: string } | null): string | null {
  if (!error) return null;
  if (/does not exist|schema cache|could not find/i.test(error.message)) {
    return "The email queue is not set up yet. Apply the latest database migration, then refresh this page.";
  }
  if (/row-level security|permission denied|not authorized/i.test(error.message)) {
    return "You don't have permission to view email delivery.";
  }
  return error.message;
}

export type EmailOutboxApiClient = typeof import("../integrations/supabase/client.ts")["supabase"];

export interface SendEmailStatusResponse {
  configured: boolean;
  counts?: EmailOutboxCounts;
}

export interface SendEmailRunResponse {
  configured: boolean;
  queued?: number;
  sent?: number;
}

export function createEmailOutboxApi(client: EmailOutboxApiClient) {
  return {
    /** Most recent rows across every status, newest first. */
    async recent(limit = 50): Promise<EmailOutboxRow[]> {
      const { data, error } = await client
        .from("email_outbox")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      const message = explainEmailOutboxError(error);
      if (message) throw new Error(message);
      return ((data ?? []) as DbRow[]).map(mapRow);
    },

    /** Count of rows per status, computed client-side from `rows` (cheap at outbox scale). */
    countsByStatus(rows: EmailOutboxRow[]): EmailOutboxCounts {
      const counts: EmailOutboxCounts = {};
      for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
      return counts;
    },

    /** Calls the `send-email` edge function to claim and send queued rows now. */
    async sendQueuedNow(): Promise<SendEmailRunResponse> {
      const { data, error } = await client.functions.invoke("send-email", { body: { action: "send" } });
      if (error) throw new Error(explainEmailOutboxError({ message: error.message }) ?? error.message);
      return (data ?? { configured: false }) as SendEmailRunResponse;
    },

    /** Reads provider configuration + outstanding counts from the `send-email` edge function. */
    async status(): Promise<SendEmailStatusResponse> {
      const { data, error } = await client.functions.invoke("send-email", { body: { action: "status" } });
      if (error) throw new Error(explainEmailOutboxError({ message: error.message }) ?? error.message);
      return (data ?? { configured: false }) as SendEmailStatusResponse;
    },

    /** Resets every `failed` row back to `queued` via the `retry_failed_emails` RPC. Returns the row count reset. */
    async retryFailed(): Promise<number> {
      const { data, error } = await client.rpc("retry_failed_emails");
      const message = explainEmailOutboxError(error);
      if (message) throw new Error(message);
      return (data ?? 0) as number;
    },
  };
}

export const emailOutboxApi = createEmailOutboxApi(supabase);
