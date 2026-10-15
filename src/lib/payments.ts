import { supabase } from "../integrations/supabase/client.ts";

export type PaymentProvider = "mtn_momo" | "orange_money";

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  mtn_momo: "MTN MoMo",
  orange_money: "Orange Money",
};

export type PaymentCurrency = "USD" | "LRD";
export type PaymentSubmissionStatus = "pending" | "confirmed" | "rejected";
export type PaymentReviewDecision = "confirm" | "reject";

export interface PaymentChannel {
  id: string;
  provider: PaymentProvider;
  label: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  active: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentChannelInput {
  provider: PaymentProvider;
  label: string;
  accountName: string;
  accountNumber: string;
  instructions?: string;
  active?: boolean;
  sort?: number;
}

export interface PaymentSubmission {
  id: string;
  studentId: string;
  channelId: string | null;
  provider: PaymentProvider;
  amount: number;
  currency: PaymentCurrency;
  category: string;
  payerPhone: string;
  transactionReference: string;
  paidOn: string;
  note: string;
  status: PaymentSubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  feeTransactionId: string | null;
  receiptNumber: string | null;
  /** USD amount actually posted to fee_transactions. Equals `amount` for USD submissions; for LRD submissions it's the reviewer-supplied conversion, set only once confirmed. */
  ledgerAmountUsd: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitPaymentInput {
  channelId: string;
  amount: number;
  currency: PaymentCurrency;
  category: string;
  payerPhone: string;
  transactionReference: string;
  paidOn: string;
  note?: string;
}

export type PaymentsApiClient = typeof import("../integrations/supabase/client.ts")["supabase"];
type ChannelsQuery = ReturnType<ReturnType<PaymentsApiClient["from"]>["select"]>;
type SubmissionsQuery = ReturnType<ReturnType<PaymentsApiClient["from"]>["select"]>;

interface PaymentChannelRow {
  id: string;
  provider: PaymentProvider;
  label: string;
  account_name: string;
  account_number: string;
  instructions: string | null;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

interface PaymentSubmissionRow {
  id: string;
  student_id: string;
  channel_id: string | null;
  provider: PaymentProvider;
  amount: number;
  currency: PaymentCurrency;
  category: string;
  payer_phone: string;
  transaction_reference: string;
  paid_on: string;
  note: string | null;
  status: PaymentSubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  fee_transaction_id: string | null;
  receipt_number: string | null;
  ledger_amount_usd: number | null;
  created_at: string;
  updated_at: string;
}

export function mapChannelRow(row: PaymentChannelRow): PaymentChannel {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    accountName: row.account_name,
    accountNumber: row.account_number,
    instructions: row.instructions ?? "",
    active: row.active,
    sort: row.sort,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSubmissionRow(row: PaymentSubmissionRow): PaymentSubmission {
  return {
    id: row.id,
    studentId: row.student_id,
    channelId: row.channel_id,
    provider: row.provider,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    payerPhone: row.payer_phone,
    transactionReference: row.transaction_reference,
    paidOn: row.paid_on,
    note: row.note ?? "",
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note ?? "",
    feeTransactionId: row.fee_transaction_id,
    receiptNumber: row.receipt_number,
    ledgerAmountUsd: row.ledger_amount_usd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Translates a Supabase/Postgres/RPC error into actionable UI copy. */
export function explainPaymentError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  if (/does not exist|schema cache|could not find/i.test(error.message)) {
    return "Payments are not set up yet. Apply the latest database migration, then refresh this page.";
  }
  if (error.message === "payment_reference_used") {
    return "This transaction ID has already been used for a payment. Double-check the number from your mobile money message, or contact the finance office.";
  }
  if (error.message === "rejection_note_required" || error.message === "decision_note_required") {
    return "Add a note explaining the rejection before you submit it.";
  }
  if (error.message === "channel_not_found") {
    return "That payment channel is no longer active. Choose another one.";
  }
  if (error.message === "channel_required") {
    return "Choose which account you paid into.";
  }
  if (error.message === "invalid_transaction_reference") {
    return "Enter the transaction ID from your mobile money confirmation message (4-64 characters).";
  }
  if (error.message === "invalid_amount") {
    return "Enter the amount you paid.";
  }
  if (error.message === "invalid_currency") {
    return "Choose USD or LRD.";
  }
  if (error.message === "paid_on_required") {
    return "Enter the date you paid.";
  }
  if (error.message === "active_account_required") {
    return "Your account isn't active yet. Contact the school office.";
  }
  if (error.message === "payment_not_pending") {
    return "This payment was already reviewed.";
  }
  if (error.message === "payment_not_found") {
    return "This payment report could not be found.";
  }
  if (error.message === "ledger_amount_required") {
    return "Enter the USD amount actually credited for this LRD payment before confirming it.";
  }
  if (error.message === "invalid_payer_phone") {
    return "Enter a valid mobile money number, e.g. +231 77 667 9963.";
  }
  if (error.message === "category_too_long") {
    return "Shorten the category to 60 characters or fewer.";
  }
  if (error.message === "note_too_long") {
    return "Shorten the note to 500 characters or fewer.";
  }
  if (error.message === "not_authenticated" || error.message === "forbidden") {
    return "You don't have permission to do that.";
  }
  if (/row-level security|permission denied|not authorized/i.test(error.message)) {
    return "You don't have permission to do that.";
  }
  if (/fee_transactions_amount_check|violates check constraint/i.test(error.message)) {
    return "Enter a USD ledger amount greater than zero (after rounding to cents) for this payment.";
  }
  return error.message;
}

/** Loosely validates a Liberian mobile number: optional +231/231/0 prefix, 7-15 digits after it. */
export function isValidPaymentPhone(input: string): boolean {
  // Mirrors submit_payment: strip spaces and dashes, then 7-15 digits with an optional leading +.
  const cleaned = input.trim().replace(/[\s-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

/** The DB trims and upper-cases the reference; this mirrors its 4..64 char length check. */
export function isValidTransactionReference(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length >= 4 && trimmed.length <= 64;
}

export function createPaymentsApi(client: PaymentsApiClient) {
  async function channelRows(query?: (q: ChannelsQuery) => ChannelsQuery): Promise<PaymentChannel[]> {
    let request = client.from("payment_channels").select("*");
    if (query) request = query(request);
    const { data, error } = await request;
    const message = explainPaymentError(error);
    if (message) throw new Error(message);
    return ((data ?? []) as PaymentChannelRow[]).map(mapChannelRow);
  }

  async function submissionRows(query?: (q: SubmissionsQuery) => SubmissionsQuery): Promise<PaymentSubmission[]> {
    let request = client.from("payment_submissions").select("*");
    if (query) request = query(request);
    const { data, error } = await request;
    const message = explainPaymentError(error);
    if (message) throw new Error(message);
    return ((data ?? []) as PaymentSubmissionRow[]).map(mapSubmissionRow);
  }

  return {
    /** Active channels only, for the student payment form. */
    async channels(): Promise<PaymentChannel[]> {
      return channelRows((q) => q.eq("active", true).order("sort", { ascending: true }));
    },

    /** Every channel including inactive ones, for the admin channel manager. */
    async allChannels(): Promise<PaymentChannel[]> {
      return channelRows((q) => q.order("sort", { ascending: true }));
    },

    async createChannel(input: PaymentChannelInput): Promise<PaymentChannel> {
      const row = {
        provider: input.provider,
        label: input.label.trim(),
        account_name: input.accountName.trim(),
        account_number: input.accountNumber.trim(),
        instructions: input.instructions ?? "",
        active: input.active ?? true,
        sort: input.sort ?? 0,
      };
      const { data, error } = await client.from("payment_channels").insert(row).select().single();
      const message = explainPaymentError(error);
      if (message) throw new Error(message);
      return mapChannelRow(data as PaymentChannelRow);
    },

    async updateChannel(id: string, changes: Partial<PaymentChannelInput>): Promise<PaymentChannel> {
      const row: Record<string, unknown> = {};
      if (changes.provider !== undefined) row.provider = changes.provider;
      if (changes.label !== undefined) row.label = changes.label.trim();
      if (changes.accountName !== undefined) row.account_name = changes.accountName.trim();
      if (changes.accountNumber !== undefined) row.account_number = changes.accountNumber.trim();
      if (changes.instructions !== undefined) row.instructions = changes.instructions;
      if (changes.active !== undefined) row.active = changes.active;
      if (changes.sort !== undefined) row.sort = changes.sort;
      const { data, error } = await client.from("payment_channels").update(row).eq("id", id).select().single();
      const message = explainPaymentError(error);
      if (message) throw new Error(message);
      return mapChannelRow(data as PaymentChannelRow);
    },

    async setChannelActive(id: string, active: boolean): Promise<PaymentChannel> {
      const { data, error } = await client.from("payment_channels").update({ active }).eq("id", id).select().single();
      const message = explainPaymentError(error);
      if (message) throw new Error(message);
      return mapChannelRow(data as PaymentChannelRow);
    },

    async deleteChannel(id: string): Promise<void> {
      const { error } = await client.from("payment_channels").delete().eq("id", id);
      const message = explainPaymentError(error);
      if (message) throw new Error(message);
    },

    /** The signed-in student's own reported payments, newest first. */
    async mySubmissions(studentId: string): Promise<PaymentSubmission[]> {
      return submissionRows((q) => q.eq("student_id", studentId).order("created_at", { ascending: false }));
    },

    /** Admin view across every student; optionally scoped to one status. */
    async allSubmissions(filters: { status?: PaymentSubmissionStatus } = {}): Promise<PaymentSubmission[]> {
      return submissionRows((q) => {
        let next = q.order("created_at", { ascending: false });
        if (filters.status) next = next.eq("status", filters.status);
        return next;
      });
    },

    /** Reports a mobile money payment for confirmation via the `submit_payment` RPC. */
    async submit(input: SubmitPaymentInput): Promise<string> {
      if (!isValidPaymentPhone(input.payerPhone)) {
        throw new Error("Enter a valid mobile money number, e.g. +231 77 667 9963.");
      }
      if (!isValidTransactionReference(input.transactionReference)) {
        throw new Error("Enter the transaction ID from your mobile money confirmation message (4-64 characters).");
      }
      if (!(input.amount > 0)) {
        throw new Error("Enter the amount you paid.");
      }
      const { data, error } = await client.rpc("submit_payment", {
        p_channel_id: input.channelId,
        p_amount: input.amount,
        p_currency: input.currency,
        p_category: input.category,
        p_payer_phone: input.payerPhone.trim(),
        p_transaction_reference: input.transactionReference.trim(),
        p_paid_on: input.paidOn,
        p_note: input.note ?? "",
      });
      const message = explainPaymentError(error);
      if (message) throw new Error(message);
      return data as string;
    },

    /**
     * Confirms or rejects a pending submission via the `review_payment` RPC. A reject requires a note.
     * `ledgerAmountUsd` is required (and must be > 0) when confirming an LRD submission, since
     * fee_transactions has no currency column and only ever carries a USD amount; it's ignored for
     * USD submissions, which always post their own amount. Omitting it on an LRD confirm throws
     * `ledger_amount_required` (translated by explainPaymentError).
     */
    async review(
      submissionId: string,
      decision: PaymentReviewDecision,
      note: string,
      ledgerAmountUsd?: number,
    ): Promise<{ id: string; status: PaymentSubmissionStatus; receipt_number: string | null }> {
      if (decision === "reject" && !note.trim()) {
        throw new Error("Add a note explaining the rejection before you submit it.");
      }
      const { data, error } = await client.rpc("review_payment", {
        p_submission_id: submissionId,
        p_decision: decision,
        p_note: note,
        p_ledger_amount_usd: ledgerAmountUsd ?? null,
      });
      const message = explainPaymentError(error);
      if (message) throw new Error(message);
      return data as { id: string; status: PaymentSubmissionStatus; receipt_number: string | null };
    },
  };
}

export const paymentsApi = createPaymentsApi(supabase);
