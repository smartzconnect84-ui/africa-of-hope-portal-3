import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const OUTBOX_STATUSES = ["queued", "sending", "sent", "failed", "skipped"] as const;
const BRAND_NAME = "Africa of Hope Academy";
const BRAND_COLOR = "#0f5132";

/**
 * Constant-time string comparison for the `x-cron-secret` header. A plain
 * `===` lets an attacker learn the secret one byte at a time from response
 * timing; this always walks a fixed number of byte positions and never
 * short-circuits on the first mismatch.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length, 32);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    const x = i < aBytes.length ? aBytes[i] : 0;
    const y = i < bBytes.length ? bBytes[i] : 0;
    diff |= x ^ y;
  }
  return diff === 0;
}

/**
 * Strips characters that would let a user-controlled display name break out
 * of the `"Name" <email>` envelope (e.g. injecting another recipient via a
 * comma, or a header via a stray CR/LF).
 */
function sanitizeDisplayName(name: unknown): string {
  return String(name ?? "")
    .replace(/[<>",\r\n]/g, "")
    .trim();
}

/** Escapes a value for safe interpolation into HTML. Every template field goes through this. */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapBrand(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:${BRAND_COLOR};padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">${escapeHtml(BRAND_NAME)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 14px;font-size:18px;color:#111827;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f0f2f1;color:#6b7280;font-size:12px;">
                This is an automated message from ${escapeHtml(BRAND_NAME)}. Please do not reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRow(label: string, value: unknown): string {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f0f2f1;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px;border-bottom:1px solid #f0f2f1;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Renders one of the three known templates. Falls back to the generic "notification" layout for anything else. */
function renderTemplate(template: string, subject: string, payload: Record<string, unknown>): string {
  if (template === "payment_receipt") {
    const rows = [
      detailRow("Receipt number", payload.receipt_number),
      detailRow("Amount", `${String(payload.currency ?? "")} ${String(payload.amount ?? "")}`.trim()),
      payload.currency === "LRD" && payload.ledger_amount_usd != null
        ? detailRow("Credited to fee account", `USD ${String(payload.ledger_amount_usd)}`)
        : "",
      detailRow("Category", payload.category),
      detailRow("Method", payload.method),
      detailRow("Paid on", payload.paid_on),
      detailRow("Transaction reference", payload.transaction_reference),
    ].join("");
    return wrapBrand(subject, `
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">Your mobile money payment has been confirmed. Please keep this receipt for your records.</p>
      <table role="presentation" width="100%" style="border-top:1px solid #e5e7eb;">${rows}</table>
    `);
  }

  if (template === "payment_rejected") {
    const note = typeof payload.review_note === "string" ? payload.review_note.trim() : "";
    return wrapBrand(subject, `
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">Your reported mobile money payment could not be confirmed.</p>
      <table role="presentation" width="100%" style="border-top:1px solid #e5e7eb;margin-bottom:12px;">
        ${detailRow("Amount", `${String(payload.currency ?? "")} ${String(payload.amount ?? "")}`.trim())}
        ${detailRow("Category", payload.category)}
        ${detailRow("Transaction reference", payload.transaction_reference)}
      </table>
      ${note ? `<p style="margin:0;font-size:14px;color:#111827;"><strong>Reviewer note:</strong> ${escapeHtml(note)}</p>` : ""}
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">You can report the payment again with a corrected transaction reference from the Payments Center.</p>
    `);
  }

  // "notification" (and any unknown template): plain escaped body, paragraphs preserved.
  const body = typeof payload.body === "string" ? payload.body : "";
  return wrapBrand(subject, `<p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(body)}</p>`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("EMAIL_CRON_SECRET") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const emailFrom = Deno.env.get("EMAIL_FROM") ?? "";

    // ── Auth: either a settings.manage user JWT, or the cron secret header.
    const headerCronSecret = req.headers.get("x-cron-secret") ?? "";
    let authorized = cronSecret.length > 0 && headerCronSecret.length > 0 && timingSafeEqual(headerCronSecret, cronSecret);

    if (!authorized) {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (token) {
        const caller = createClient(url, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authData } = await caller.auth.getUser();
        if (authData?.user) {
          const { data: canManage, error } = await caller.rpc("has_permission", { perm: "settings.manage" });
          authorized = !error && canManage === true;
        }
      }
    }
    if (!authorized) return json({ error: "Not authorized" }, 401);

    const admin = createClient(url, serviceKey);

    let action = "send";
    if (req.method === "GET") {
      action = "status";
    } else {
      const body = await req.json().catch(() => ({}));
      action = String((body as { action?: unknown })?.action ?? "send");
    }

    const configured = resendKey.length > 0 && emailFrom.length > 0;

    // ── Opportunistic maintenance, run on every invocation (status or send):
    // reclaim rows abandoned mid-send, and expire anything that has been
    // waiting for a provider for too long. Mirrors retry_failed_emails()'s
    // stale-`sending` reclaim and the one-off backlog sweep from migration
    // 20261014060000_payments_email_hardening.sql, so the backlog stays
    // bounded even if nobody ever calls retry_failed_emails from the portal.
    const STALE_SENDING_MINUTES = 15;
    const BACKLOG_EXPIRY_HOURS = 72;
    const staleSendingCutoff = new Date(Date.now() - STALE_SENDING_MINUTES * 60_000).toISOString();
    await admin
      .from("email_outbox")
      .update({ status: "queued", last_error: "reclaimed after being stuck in sending", send_after: new Date().toISOString() })
      .eq("status", "sending")
      .lt("updated_at", staleSendingCutoff);

    // Only expire the backlog while no provider is configured. Once a
    // provider exists, "Retry failed" must be able to resend older rows.
    if (!configured) {
      const backlogCutoff = new Date(Date.now() - BACKLOG_EXPIRY_HOURS * 60 * 60_000).toISOString();
      await admin
        .from("email_outbox")
        .update({ status: "skipped", last_error: "expired before a provider was configured" })
        .eq("status", "queued")
        .lt("created_at", backlogCutoff);
    }

    if (action === "status") {
      const counts: Record<string, number> = {};
      for (const status of OUTBOX_STATUSES) {
        const { count } = await admin
          .from("email_outbox")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        counts[status] = count ?? 0;
      }
      return json({ configured, counts });
    }

    if (!configured) {
      const { count: queuedCount } = await admin
        .from("email_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued");
      return json({ configured: false, queued: queuedCount ?? 0 });
    }

    const nowIso = new Date().toISOString();
    const { data: due, error: dueError } = await admin
      .from("email_outbox")
      .select("*")
      .eq("status", "queued")
      .lte("send_after", nowIso)
      .order("send_after", { ascending: true })
      .limit(BATCH_SIZE);
    if (dueError) throw dueError;

    let sentCount = 0;
    let failedCount = 0;
    let requeuedCount = 0;

    for (const row of due ?? []) {
      // Claim atomically so a second concurrent invocation skips this row.
      const { data: claimed } = await admin
        .from("email_outbox")
        .update({ status: "sending" })
        .eq("id", row.id)
        .eq("status", "queued")
        .select()
        .maybeSingle();
      if (!claimed) continue;

      const html = renderTemplate(claimed.template, claimed.subject, claimed.payload ?? {});
      const attempts = (claimed.attempts ?? 0) + 1;
      const safeToName = sanitizeDisplayName(claimed.to_name);

      try {
        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: emailFrom,
            to: [safeToName ? `${safeToName} <${claimed.to_email}>` : claimed.to_email],
            subject: claimed.subject,
            html,
          }),
        });
        const resendJson = await resendResp.json().catch(() => ({}));
        if (!resendResp.ok) {
          throw new Error(
            typeof resendJson?.message === "string" ? resendJson.message : `Resend responded with ${resendResp.status}`,
          );
        }

        await admin
          .from("email_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: typeof resendJson?.id === "string" ? resendJson.id : null,
            attempts,
            last_error: null,
          })
          .eq("id", claimed.id);
        sentCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempts >= MAX_ATTEMPTS) {
          await admin
            .from("email_outbox")
            .update({ status: "failed", attempts, last_error: message })
            .eq("id", claimed.id);
          failedCount++;
        } else {
          const backoffMinutes = Math.min(60, 2 ** attempts);
          await admin
            .from("email_outbox")
            .update({
              status: "queued",
              attempts,
              last_error: message,
              send_after: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
            })
            .eq("id", claimed.id);
          requeuedCount++;
        }
      }
    }

    return json({
      configured: true,
      processed: (due ?? []).length,
      sent: sentCount,
      failed: failedCount,
      requeued: requeuedCount,
    });
  } catch (error) {
    console.error("send-email failed", error);
    return json({ error: "Unable to process the email outbox" }, 500);
  }
});
