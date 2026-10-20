# Production audit — data-preserving release review

## Scope and evidence

This is a source-code review, not a live Supabase audit or a deployment certificate. Reviewed the portal data loader/context, authentication flows, assignment hand-in/marking, certificate issuance/revocation/verification, upload helpers and storage policies, realtime listener lifecycle, migration history, and the entry points/contracts for admin-users, assistant, newsletter, send-email and send-deadline-reminders. UI components outside those paths have not all received end-to-end testing.

No database, Auth account, bucket object, production setting or deployed function was changed by this review. Existing records and identifiers must remain intact. No attached photograph is published as part of this audit.

## Release-blocking findings

1. Historical account bootstrap SQL contained a fixed administrator password, account promotion and destructive cleanup. Account creation/reset code was removed from the versioned baseline; the historical account-purge migration is now a deliberate no-op; the duplicate unversioned live_backend_config.sql now aborts. **Rotate any password ever embedded in repository history**, revoke old sessions and review Auth logs. Removing a credential from source does not remove it from Git history or change a deployed password.
2. The browser context allowed passwordless profile-ID sign-in and cached the full portal state. Remove this fallback, require Supabase Auth and prevent stale account reads from repopulating another user's state. Browser cache is not an authorization boundary.
3. Public certificate verification searched a locally loaded register and exposed sample serials. Replace with an exact-serial backend lookup that returns only verification fields. Restrict bulk register reads to the holder/authorized staff and keep revocation reasons private. Deploy SQL and the verification function together with the client.
4. The assignment inbox displayed success before writes finished; its hand-in path omitted response_text and attachment_path. Route hand-in through existing start_classwork/submit_classwork RPCs and await publishing/marking. A typed link is an answer reference, not an uploaded private file. Timed work must use the existing timed classwork dialog.
5. admin-users checked the proposed Super Admin role but did not consistently protect existing administrator targets from reset/delete/demotion. Add target-role and active-caller checks, input validation, affected-row confirmation and explicit partial-failure messages.
6. Storage constraints were inconsistent with accepted image types. Add helper validation and a reviewed migration for matching bucket MIME/size limits. Personal documents remain private. Do not prune old objects before the record update succeeds.
7. Realtime refreshed every table for every event and did not refresh after initial authentication reliably. Debounce and serialize refreshes, restart subscriptions on identity changes, discard in-flight reads from old identities and refresh on reconnect/focus. RLS remains the authorization boundary.
8. Push dispatch did not check queue acknowledgement/expired-subscription cleanup errors. Acknowledge failures honestly. Email and push are at-least-once external delivery, not transactional exactly-once delivery.

## Migration discipline — required before production

- Take a database backup and an inventory of Auth users, row counts, certificate serials and storage objects; verify a restore in staging.
- Compare the deployed migration history to the reviewed timestamped migrations. Do not blindly replay historical baselines, unversioned duplicate SQL, APPLY_ALL_PENDING_SQL.sql or catalogue seeds against real data. Baselines grant broad access temporarily; later permission migrations are required. Catalogue seed/update scripts can change approved programme content.
- Apply only reviewed missing migrations, in timestamp/dependency order, on staging first. Certificate controls require academic/permissions/wiring and unique-ID prerequisites. The production audit hardening migration requires those certificate controls and existing storage buckets. It changes access policies and bucket metadata, not school records.
- Do not run rollback snippets in RUN_PENDING_SQL.md or contract test fixtures against production. The tests create synthetic Auth users and roll back; use a disposable/staging database and inspect the scripts first.
- Existing databases do not receive edits to already-applied migrations. The additive audit migration is the forward repair for deployed systems. Legacy migration hashes/history may need reconciliation with your operator; do not erase migration history.
- Inspect duplicate/blank serials and orphaned records before migration; stop for registrar review rather than silently deleting or renumbering records. Keep existing primary keys.

## Backend and infrastructure release gates

Use `RELEASE_CHECKLIST.md` for function auth modes, secrets, staging tests and deployment ordering. Applying SQL, deploying functions, setting secrets, enabling scheduling and delivery tests require backend access/owner approval and have not been performed here.

## Edge Function readiness (source fixes in this pass)

- `supabase/config.toml` now states the gateway JWT mode per function and names the server-only secret each handler needs, so a deploy cannot silently expose a worker or lock out a public entry point.
- Both cron workers (`send-email`, `send-deadline-reminders`) compare `CRON_SECRET` in constant time and report acknowledgement failures (`acknowledged`, `acknowledgementError`) instead of returning a bare success; expired push subscriptions and corrupt endpoints are cleaned up with their own error surfaced.
- Public entry points stay public at the gateway but validate size, shape and tokens inside the handler: `newsletter` requires a ≥32-character HMAC secret and signed tokens, `verify-certificate` accepts only a bounded serial and returns public fields, `assistant` remains rate limited.
- `RELEASE_CHECKLIST.md` lists the remaining human gates: secrets, migration order, storage ACLs, realtime publication, and live tests for email, push on physical devices, newsletter, certificates, Groq replies, role-by-role authorization and PWA updates.

Outstanding live verification: deployed RLS/grants/functions, actual storage ACLs, realtime publication membership, SMTP/Resend sender verification, newsletter confirmation/unsubscribe, email worker scheduling/concurrency, push delivery on physical iOS/Android devices, Groq request/reply, backup restoration, provider rate limits, logging/alerts, and browser role-by-role journeys. Do not describe the whole application as production-ready based only on a TypeScript/build check.
