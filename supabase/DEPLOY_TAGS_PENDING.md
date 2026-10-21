> **This is a Markdown checklist — not SQL. Do NOT paste this file into the Supabase SQL editor.**
> Its `#` headings are what caused `ERROR: 42601: syntax error at or near "#"`.
> Paste **`supabase/DEPLOY_01_14_RUN_ME.sql`** first (pure SQL, safe to Run), then paste
> each migration file listed below one at a time, in order.

# DEPLOY TAGS — unapplied migrations (run in this order)

> Nothing here has been executed. The builder has no live database connection.
> Run these yourself in Supabase Dashboard → SQL editor on project
> `gatnzfjpuokopqyksqoy`, staging first, one block at a time, top to bottom.
> Verify each with the check query before running the next.

## Legend
- `[DEPLOY-01..14]` = pending, reviewed, additive — run in order.
- `[SKIP]` = do NOT run (baseline, bundle, duplicate, or already-applied).
- `[VERIFY]` = read-only check, safe any time.

## Ordered deploy set

| Tag | File | What it unlocks |
| --- | --- | --- |
| [DEPLOY-01] | `supabase/migrations/20261023000000_programs_title_alignment.sql` | Programme title/name alignment (portal, admin builder, assistant agree) |
| [DEPLOY-02] | `supabase/migrations/20261024000000_admission_officer_support.sql` | Admission officer queue |
| [DEPLOY-03] | `supabase/migrations/20261024010000_cohort_discussions.sql` | Cohort discussions |
| [DEPLOY-04] | `supabase/migrations/20261024020000_newsletter_templates.sql` | Newsletter templates + consent (see `NEWSLETTER_PRODUCTION.md`) |
| [DEPLOY-05] | `supabase/migrations/20261025000000_account_congratulations.sql` | Registration / approval congratulations outbox |
| [DEPLOY-06] | `supabase/migrations/20261026000000_learning_memory.sql` | Bookmarks + Continue Learning |
| [DEPLOY-07] | `supabase/migrations/20261028000000_push_reminders.sql` | Push subscriptions + reminder queue (needs VAPID keys + worker deploy) |
| [DEPLOY-08] | `supabase/migrations/20261029000000_unique_identifiers.sql` | Unique account/course/certificate identifiers, serial hardening |
| [DEPLOY-09] | `supabase/migrations/20261029010000_certificate_controls.sql` | Certificate revocation + audit (required before -10 and -11) |
| [DEPLOY-10] | `supabase/migrations/20261030000000_production_access_hardening.sql` | Restrictive certificate-register / storage / access policies |
| [DEPLOY-11] | `supabase/migrations/20261105000000_certificate_types_audit.sql` | Certificate types + audit trail (requires -09 and -10 first) |
| [DEPLOY-12] | `supabase/migrations/20261106000000_transparency_reports.sql` | Transparency reports library tables + storage |
| [DEPLOY-13] | `supabase/migrations/20261106010000_student_helpdesk.sql` | Student helpdesk tickets + replies |
| [DEPLOY-14] | `supabase/migrations/20261106020000_grade_appeals.sql` | Grade appeals + remark decisions |

## How to run (dashboard, no CLI)

1. Open <https://supabase.com/dashboard/project/gatnzfjpuokopqyksqoy/sql/new>.
2. For DEPLOY-01 through DEPLOY-14 in order: open the file in this repo, copy its
   full contents, paste into the SQL editor, press **Run**.
3. If the dashboard already lists a migration as applied, mark it done and move on —
   never re-run it.
4. After each file, run its trailing verification `select` (or re-run the file's
   idempotency-safe body); every statement is `if not exists` / guarded, so a
   clean re-run is safe but unnecessary.

## [SKIP] — do not run against live data

- Any historical baseline migration predating `20261020000000`.
- `supabase/APPLY_ALL_PENDING_SQL.sql` as a whole against production — it bundles
  only `20261020000000`–`20261022000000` (support pledges, study plans, catalogue
  durations/fees, programme seed). Use it once for a fresh/staging catalogue only,
  or run `supabase/SEED_PROGRAMMES_ONLY.sql` if `public.programs` is still empty.
- Duplicate unversioned SQL files and `supabase/tests/*` fixtures (synthetic users).
- Rollback snippets — forward only on production.

## [VERIFY] — before and after

- Backup Auth users, row counts, certificate serials, storage objects; prove a
  restore on a disposable project first.
- Check for duplicate/blank certificate serials and orphaned rows before DEPLOY-08.
- Confirm each subscribed table is in the `supabase_realtime` publication.
- Full live journey checklist stays in `supabase/RELEASE_CHECKLIST.md` §5
  (email, push, newsletter, certificates, AOH AI, auth roles, PWA, helpdesk,
  appeals, transparency). Nothing there is verified from here.
