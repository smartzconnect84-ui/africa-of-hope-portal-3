# Account welcome and approval messages

Implementation is prepared, not deployed. Do not run production migrations without owner approval.

## After approval to enable

1. Apply `supabase/migrations/20261025000000_account_congratulations.sql` after the existing profiles, email outbox and payments/email hardening migrations. There is no bulk mail or historical backfill.
2. Redeploy the existing `send-email` Edge Function, including its existing shared newsletter dependency. Configure the server-side `APP_URL` to the HTTPS public application URL to include a website link. Never include a session or password token in it. The message remains valid without this optional link.
3. Keep existing `RESEND_API_KEY`, verified `RESEND_FROM_EMAIL`, service-role configuration and `EMAIL_CRON_SECRET`. The scheduled sender needs the existing Vault values `send_email_dispatch_url` and `email_cron_secret`, or an equivalent authenticated scheduler. Do not put secrets in source control or browser environment variables.
4. Register a test account. An unconfirmed email must not receive a welcome message. Confirm it: exactly one `account_registration` message should be queued for a pending profile. If an account is created already active and confirmed, it gets the approval welcome instead.
5. Approve that test applicant. Exactly one `account_approved` row should be queued. Repeat the staff 'Queue welcome email' action; no duplicate should be inserted. Suspended/rejected accounts must be ineligible. Unauthorized actors must be denied.
6. Run the existing worker and inspect **Email outbox** for queued/sent/failed status. Confirm actual inbox delivery and the website button before claiming email works. The worker retains its existing retry and expiry behavior.

## Staff links

Staff & Students and Applicants show **Welcome**. It previews status-appropriate wording and provides the idempotent server-side queue action. Email/WhatsApp links only open drafts for a person to review and send; clicking a link does not prove delivery. A WhatsApp contact must include its international country code. Editable contact email is used only for the explicit manual draft; automatic delivery always uses the confirmed auth identity email.

Approval is now saved before the UI reports success. No message action can approve an account. Registration and approval copy never promises admission, payment confirmation, certification or programme placement.

## Rollback

To stop new automated messages after review, remove only the `profile_account_congratulations` and `confirmed_account_congratulations` triggers. Existing outbox messages remain queued; review them separately using authorized operational procedures. This document intentionally does not execute a rollback or alter historical data.
