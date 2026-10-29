-- ============================================================================
-- AFRICA OF HOPE — DEPLOY 01..14 paste guide (pure SQL, safe to Run).
--
-- This file itself changes nothing. It is valid SQL so pasting it into the
-- Supabase SQL editor will NOT raise "syntax error at or near #".
-- The checklist file supabase/DEPLOY_TAGS_PENDING.md is Markdown and must
-- never be pasted into the SQL editor — its "#" headings cause ERROR 42601.
--
-- HOW TO DEPLOY DEPLOY-01..14:
--   1. Paste THIS file and press Run (proves the editor works, shows checks).
--   2. Then open each migration file below in order and paste it alone:
--        DEPLOY-01  supabase/migrations/20261023000000_programs_title_alignment.sql
--        DEPLOY-02  supabase/migrations/20261024000000_admission_officer_support.sql
--        DEPLOY-03  supabase/migrations/20261024010000_cohort_discussions.sql
--        DEPLOY-04  supabase/migrations/20261024020000_newsletter_templates.sql
--        DEPLOY-05  supabase/migrations/20261025000000_account_congratulations.sql
--        DEPLOY-06  supabase/migrations/20261026000000_learning_memory.sql
--        DEPLOY-07  supabase/migrations/20261028000000_push_reminders.sql
--        DEPLOY-08  supabase/migrations/20261029000000_unique_identifiers.sql
--        DEPLOY-09  supabase/migrations/20261029010000_certificate_controls.sql
--        DEPLOY-10  supabase/migrations/20261030000000_production_access_hardening.sql
--        DEPLOY-11  supabase/migrations/20261105000000_certificate_types_audit.sql
--        DEPLOY-12  supabase/migrations/20261106000000_transparency_reports.sql
--        DEPLOY-13  supabase/migrations/20261106010000_student_helpdesk.sql
--        DEPLOY-14  supabase/migrations/20261106020000_grade_appeals.sql
--      Full file contents, order and skip rules live in
--      supabase/DEPLOY_TAGS_PENDING.md (read it, do not paste it).
--   3. If a file fails, stop, keep its error text and do not continue.
--   4. Re-run the checks at the bottom of this file after each step.
-- ============================================================================

select 'deploy-guide-loaded' as object, 'ok' as status;

-- ----------------------------------------------------------------------------
-- Checks: every row should read ok (or a count) once its DEPLOY step ran.
-- Safe to run before, during and after the 14 steps.
-- ----------------------------------------------------------------------------
select 'programs.title-column' as object,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'programs' and column_name = 'title'
  ) then 'ok' else 'missing-run-DEPLOY-01' end as status
union all
select 'admission-officer-role',
  case when exists (select 1 from public.roles where name = 'Admission Officer')
  then 'ok' else 'missing-run-DEPLOY-02' end
union all
select 'discussion_threads',
  case when to_regclass('public.discussion_threads') is not null then 'ok' else 'missing-run-DEPLOY-03' end
union all
select 'newsletter_subscribers',
  case when to_regclass('public.newsletter_subscribers') is not null then 'ok' else 'missing-run-DEPLOY-04' end
union all
select 'account-congratulations-fn',
  case when to_regprocedure('public._queue_account_congratulations(uuid)') is not null then 'ok' else 'missing-run-DEPLOY-05' end
union all
select 'learning_memory',
  case when to_regclass('public.learning_memory') is not null then 'ok' else 'missing-run-DEPLOY-06' end
union all
select 'push_subscriptions',
  case when to_regclass('public.push_subscriptions') is not null then 'ok' else 'missing-run-DEPLOY-07' end
union all
select 'profiles.account_number',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_number'
  ) then 'ok' else 'missing-run-DEPLOY-08' end
union all
select 'certificates.revoked_at',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'certificates' and column_name = 'revoked_at'
  ) then 'ok' else 'missing-run-DEPLOY-09' end
union all
select 'verify_public_certificate-fn',
  case when to_regprocedure('public.verify_public_certificate(text)') is not null then 'ok' else 'missing-run-DEPLOY-10' end
union all
select 'certificate_audit',
  case when to_regclass('public.certificate_audit') is not null then 'ok' else 'missing-run-DEPLOY-11' end
union all
select 'transparency_reports',
  case when to_regclass('public.transparency_reports') is not null then 'ok' else 'missing-run-DEPLOY-12' end
union all
select 'helpdesk_tickets',
  case when to_regclass('public.helpdesk_tickets') is not null then 'ok' else 'missing-run-DEPLOY-13' end
union all
select 'grade_appeals',
  case when to_regclass('public.grade_appeals') is not null then 'ok' else 'missing-run-DEPLOY-14' end;
