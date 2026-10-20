# Newsletter — production setup

The public signup form, confirmation/unsubscribe pages and the admin Newsletter screen are
already wired to this backend. Nothing here is deployed by the app itself; each step below is an
explicit operator action. **Do not report delivery as working until a real inbox test passes.**

## 1. Database

Apply the additive migration:

```
supabase/migrations/20261024020000_newsletter_templates.sql
```

It creates `newsletter_subscribers`, `newsletter_campaigns`, `newsletter_signup_limits`,
`request_newsletter_signup(...)`, `queue_newsletter_campaign(...)`, RLS policies for staff
managers and a starter `email_templates` row. It depends on the existing `enqueue_email(...)`
helper and `email_outbox` table from the email migrations — apply those first.

## 2. Edge Functions

Deploy these functions (they share `supabase/functions/_shared/newsletter.ts`):

- `newsletter` — public subscribe, GET confirmation page, POST confirm, GET/POST unsubscribe.
- `send-email` — existing outbox worker that renders `newsletter_confirmation` and `newsletter`
  templates, attaches `List-Unsubscribe` headers and skips revoked consent.

## 3. Secrets (Backend → Secrets)

| Secret | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | HTTPS public site origin, e.g. `https://africaofhope.org`. Used to build the confirmation link hash route `#newsletter/confirm?token=…` and validated by the worker. Must be `https:`, no user/password. |
| `NEWSLETTER_TOKEN_SECRET` | At least 32 characters. Hashes confirmation tokens and signs unsubscribe links. Rotating it invalidates pending confirmations and old unsubscribe links. |
| `RESEND_API_KEY` | Existing email provider key. |
| `EMAIL_FROM` | Verified Resend sender identity. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Already present on hosted functions. |

Notes:

- `PUBLIC_SITE_URL` must point at the host that serves the SPA so the `/` + `#newsletter/confirm`
  hash route resolves to `NewsletterAction`.
- The worker also accepts legacy `/functions/v1/newsletter?action=confirm&token=…` links.

## 4. Schedule the email worker

Invoke `send-email` every minute with a scheduler (Supabase Cron / `pg_cron` + `pg_net`), sending
the service-role key. Without a schedule, confirmations and campaigns stay queued with no email
sent.

## 5. CMS toggles

Website Settings → Editorial:

- `Show newsletter signup` (`newsletter.enabled`) publishes the homepage form. When off, the
  function also rejects new signups.
- `Newsletter title / description / consent / button` are the stored copy. The server uses the
  saved consent text, never text supplied by a caller.

## 6. Test before announcing

1. Submit the public form with an address you own.
2. Confirm the `newsletter_confirmation` row appears in the outbox and is picked up by the worker.
3. Open the emailed link, confirm, and check the subscriber becomes `active`.
4. Trigger a campaign from the admin Newsletter screen and verify one delivery plus a working
   `List-Unsubscribe` link.
5. Unsubscribe from the email link and confirm the subscriber becomes `unsubscribed`.

Record the tested date, sender identity and public URL in the release notes. Consent changes
require a click: GET requests only render a confirmation page (mail scanners prefetch links).
