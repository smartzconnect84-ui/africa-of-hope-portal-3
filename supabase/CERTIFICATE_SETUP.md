# Certificate issuing, revocation and downloads — production setup

These two additive migrations are **prepared only**. Nothing here has been applied to
production, and no live certificate could be tested from this environment.

1. `supabase/migrations/20261029000000_unique_identifiers.sql` — unique account and course
   numbers (existing records keep their IDs).
2. `supabase/migrations/20261029010000_certificate_controls.sql` — certificate serials,
   issuance RPC, administrator revocation, and write protection.

## Apply order

1. Back up the database and run both on staging first.
2. Apply `unique_identifiers` (it only adds columns, sequences and backfills new numbers).
3. Apply `certificate_controls`. It **stops** with a clear error if duplicate certificate
   serials already exist — resolve those with the registrar, then re-run. Empty serials are
   backfilled as `AOH-LEGACY-<id>`; no existing serial is renumbered.
4. Sign in as an active admin and issue a certificate for a test student.

## What the database now enforces

- Serials come from `next_certificate_serial()` (`AOH-CERT-<year>-0000000001`), never from
  the browser, and `certificates_serial_unique` blocks case-insensitive duplicates.
- `issue_certificate` is serialized per holder/programme with an advisory lock, returns the
  existing record instead of duplicating it, requires an active account, and for students
  requires every approved lesson to be completed.
- `revoke_certificate` requires an active **School Admin** or **Super Admin**, a reason of
  5–1000 characters, and stores `revoked_at`, `revoked_by` and `revocation_reason`.
  Revocation cannot be reversed and certificate identity columns are immutable.
- Direct `insert/update/delete` on `public.certificates` is revoked from `anon` and
  `authenticated`, so only the checked functions write the register.

## Verify after applying

- Issue twice for the same student/programme → one certificate, same serial returned.
- Revoke as a teacher (if they hold `certificates.manage`) → refused by the database.
- Revoke as School Admin → status `Revoked` in Admin → Certificate Studio and in the public
  verification portal; PDF export carries a REVOKED watermark and the reason.
- Download PDF, CSV and JSON for a signed-in student and for the admin register.
