# Backend reconciliation report — 2026-11-13

Generated from the current source (no live DB writes were made by the builder).

## 1. Existing database structures identified

Core portal tables referenced by `src/lib/supabaseHealth.ts`, `src/data/liveData.ts`
and `src/context/AppContext.tsx`:
`profiles`, `programs`, `program_modules`, `cohorts`, `cohort_students`,
`attendance`, `assignments`, `submissions`, `fee_transactions`, `certificates`,
`announcements`, `system_settings`, `permissions`, `role_permissions`.

Feature tables with dedicated migrations already in `supabase/migrations/`:
`roles/permissions/role_permissions`, `quizzes/quiz_questions/quiz_attempts/assistant_*`,
`learning_units/teacher_course_plans/class_sessions/course_enrollments/training_materials/…`,
`blog_posts/payment_channels/payment_submissions/email_outbox`,
`school_policies/policy_acceptances`, `support_pledges/study_plans`,
`discussion_threads/discussion_replies`, `email_templates/newsletter_*`,
`learning_memory`, `reminder_settings/reminder_items/push_subscriptions`,
`transparency_reports`, `helpdesk_*`, `grade_appeals`, `staff_vacancies/vacancy_applications/alumni_businesses/application_drafts`,
`notification_outbox/onesignal_devices/notifications`, `entrance_test_results/entrance_settings`,
`crash_programs/program_applications`, `enrollment_arrangement_history`,
`yearbook_entries`, `website_enquiries`, `data_migrations`, `certificate_audit`.

Edge Functions in `supabase/functions/`: `verify-certificate`, `onesignal-send`,
`admin-users`, `newsletter`, `send-email`, `assistant` (+ scheduled cron entries).

## 2. Missing database structures discovered

- Fresh projects had **no `CREATE TABLE` for the 12 core portal tables** —
  they were created in the dashboard on the live project, so `db push` alone
  left a new project empty (public site fell back to the built-in catalogue).
- `system_settings.theme_settings`, `programs.title/name` twins,
  `programs.delivery_modes/study_plan`, `blog_posts.program_id/program_title`,
  `discussion_threads.unit_id/author_*`, `payment_submissions.proof_path/status`
  were read/written by code but absent on older schemas.
- `blog-covers`, `training-materials`, `classwork-submissions`,
  `transparency-reports` buckets had no bucket migration.
- `supabase_realtime` did not include feature tables.
- `src/integrations/supabase/types.ts` was a generic stub (`Record<string, any>`).

## 3. SQL migration files generated

- `supabase/migrations/20261113000000_complete_backend_reconciliation.sql`
  — one idempotent baseline: extensions, 12 core `CREATE TABLE IF NOT EXISTS`,
  ~90 defensive `ADD COLUMN IF NOT EXISTS`, unique indexes, FKs (only when the
  constraint name is absent), RLS enable, additive `reconciled_*` policies,
  grants, 9 storage buckets, storage policies, realtime, `updated_at` triggers.

## 4. Existing migrations updated

None. Per instructions no existing migration was edited, renamed, or deleted.
The new file only adds `_reconciled_*` policies/constraints so earlier
role-gated policies stay authoritative.

## 5. Security policies generated

- `reconciled_<table>_portal_all` (`ALL TO authenticated`) for ~40 tables.
- `reconciled_<table>_public_read` (`SELECT TO anon`) for
  `programs, program_modules, announcements, certificates, blog_posts,
  transparency_reports, staff_vacancies, alumni_businesses, crash_programs`.
- `reconciled_<table>_anon_insert` (`INSERT TO anon`) for public inboxes:
  `website_enquiries, support_pledges, study_plans, vacancy_applications,
  newsletter_subscribers, entrance_test_results, program_applications`.
- `reconciled_profiles_application_insert` preserves self-registration.
- Storage: `reconciled_public_read` (5 public buckets) +
  `reconciled_portal_write` (all 9 buckets, authenticated only).

## 6. Functions and triggers generated

- No business RPC was redefined (existing `has_permission`, quiz/academic/
  certificate/newsletter/payment/helpdesk/grade RPCs remain the source of truth).
- Added only `public.handle_reconciled_updated_at()` + `reconciled_updated_at`
  triggers on 7 core tables, and FK constraints absent on legacy schemas.

## 7. Storage configurations generated

Buckets upserted: `avatars`, `program-images`, `site-assets`, `blog-covers`,
`certificates` (public) + `documents`, `training-materials`,
`classwork-submissions`, `transparency-reports` (private) — matching
`src/lib/storage.ts`, `academicApiFactory.ts`, `blog.ts`, `transparency.ts`,
and `AssignmentInbox.tsx`.

## 8. TypeScript database types updated

- `src/integrations/supabase/types.ts` now carries concrete `Row/Insert/Update`
  shapes for `profiles, programs, cohorts, assignments, submissions,
  fee_transactions, announcements, system_settings` while keeping the generic
  `Record<string, GenericTable>` index so `supabase.from("<any-table>")`
  keeps compiling.

## 9. Validation results

- New migration parses as plain Postgres (no `CREATE POLICY IF NOT EXISTS`,
  no temp-table compile trap, `pg_constraint` guards for FKs).
- Execution order: extensions → tables → columns → backfills → indexes →
  FKs → RLS/policies → grants → buckets → realtime → triggers (dependency-safe).
- FK targets (`profiles/programs/cohorts/assignments`) are created in §1
  before dependents.
- Frontend/backend compatibility: every `supabase.from("…")` table in §1/§5 of
  the search index exists after this file; every `storage.from("…")` bucket
  exists after §6; RPC names were not renamed.
- Secrets: no keys committed (client keeps env + fallback pattern; anon key
  preview only in health check).
- `check_project` (routes + `tsc --noEmit`) — run after this report lands.

## 10. Remaining manual configuration

1. `supabase db push` (or paste `APPLY_ALL_PENDING_SQL.sql` + the new file in
   the SQL editor) against `gatnzfjpuokopqyksqoy`, then re-run the verification
   query in `RUN_PENDING_SQL.md`.
2. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` under Backend → Secrets.
3. Confirm Auth → email confirmation + password-reset redirect URLs.
4. Create the first Super Admin in the dashboard (no bootstrap RPC remains).
5. Live-test RLS as each role + storage owner checks (see `BACKEND_ACTION_COVERAGE.md`).
6. This report describes generated SQL only — it does not claim migrations
   were applied or data was migrated.
