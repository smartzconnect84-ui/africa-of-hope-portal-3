-- ROLLBACK-ONLY academic-planning migration contract harness.
--
-- Run only with explicit authorization through psql as the database owner.
-- This repository does not contain the base schema, so use a reviewed
-- production-shaped database during an approved maintenance window. The migration and all fixtures are
-- in one transaction; the final ROLLBACK is mandatory. This script intentionally
-- makes no COMMIT and does not invoke Storage HTTP APIs or create browser users.
--
-- Updated for the final reviewed 20261014030000 migration, including its
-- lesson-bundle RPC, private-material policy split, and expanded bucket types.
-- The harness relies on the current production base schema having at least one
-- program and cohort. It creates synthetic auth/profile/program/cohort rows with
-- the __txn_academic_test__ prefix, then rolls every DDL/DML change back.
--
-- Usage once authorized (do not use `-1`, which would conflict with this BEGIN):
--   DATABASE_URL="postgresql://..." npm run test:academic:db
--
-- `ON_ERROR_STOP` ensures a top-level SQL error returns a nonzero status. If psql
-- disconnects before the explicit ROLLBACK, PostgreSQL rolls back the transaction.

\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only off

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '90s';

CREATE TEMP TABLE pg_temp.test_results (
  name text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text NOT NULL DEFAULT ''
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.record_result(
  p_name text,
  p_passed boolean,
  p_detail text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO pg_temp.test_results(name, passed, detail)
  VALUES (p_name, p_passed, p_detail)
  ON CONFLICT (name) DO UPDATE
    SET passed = excluded.passed, detail = excluded.detail;
END;
$$;
GRANT SELECT, INSERT, UPDATE ON pg_temp.test_results TO authenticated, anon;
GRANT EXECUTE ON FUNCTION pg_temp.record_result(text, boolean, text) TO authenticated, anon;

\echo Applying migration first pass (inside transaction)
\ir ../migrations/20261014030000_academic_planning_enrollment.sql
\echo Applying migration idempotency pass (inside same transaction)
\ir ../migrations/20261014030000_academic_planning_enrollment.sql

-- Fixed, non-production identities. They exist only until the ROLLBACK below.
-- auth.users defaults vary by Supabase version; this uses production's instance_id
-- and required common fields, while the existing profile trigger creates profiles.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
SELECT fixture.id, (SELECT instance_id FROM auth.users LIMIT 1),
       'authenticated', 'authenticated', fixture.email, 'not-a-login-secret', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', fixture.full_name)
FROM (VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '__txn_academic_student__@testing.invalid', '__txn_academic_test__ Student'),
  ('10000000-0000-0000-0000-000000000002'::uuid, '__txn_academic_teacher__@testing.invalid', '__txn_academic_test__ Teacher'),
  ('10000000-0000-0000-0000-000000000003'::uuid, '__txn_academic_reviewer__@testing.invalid', '__txn_academic_test__ Reviewer')
) AS fixture(id, email, full_name);

UPDATE public.profiles
SET role = CASE id
  WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 'Student'
  WHEN '10000000-0000-0000-0000-000000000002'::uuid THEN 'Teacher'
  WHEN '10000000-0000-0000-0000-000000000003'::uuid THEN 'School Admin'
END,
status = 'Active',
full_name = coalesce(full_name, '__txn_academic_test__ fixture')
WHERE id IN (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid
);

-- Clone production-shaped rows rather than guessing non-null legacy columns. The
-- overrides are synthetic and unlikely to collide with existing unique values.
WITH template AS (
  SELECT to_jsonb(p) AS row_json FROM public.programs p ORDER BY p.id LIMIT 1
)
INSERT INTO public.programs
SELECT (jsonb_populate_record(
  NULL::public.programs,
  row_json || jsonb_build_object(
    'id', '20000000-0000-0000-0000-000000000001',
    'title', '__txn_academic_test__ Program',
    'name', '__txn_academic_test__ Program',
    'slug', '__txn-academic-test-program',
    'code', '__TXN_ACADEMIC_TEST__',
    'is_active', true,
    'completion_pass_mark', 50,
    'required_attendance_percent', 75
  )
)).*
FROM template;

INSERT INTO public.cohorts (
  id, name, program_id, teacher_id, start_date, end_date, room,
  capacity, enrollment_status, enrollment_opens_at, enrollment_closes_at
) VALUES (
  '30000000-0000-0000-0000-000000000001', '__txn_academic_test__ Cohort',
  '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  current_date, current_date + 30, '__txn_academic_test__ Room',
  5, 'open', now() - interval '1 hour', now() + interval '1 day'
);

-- A draft material is later submitted by its teacher through the public RPC.
INSERT INTO public.training_materials (
  id, program_id, cohort_id, created_by, title, description, material_type, external_url, status
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '__txn_academic_test__ Material', 'Synthetic, transaction-scoped fixture.', 'link', 'https://testing.invalid/material', 'draft'
);

SELECT pg_temp.record_result(
  'schema: required relation/function contracts exist',
  to_regclass('public.course_enrollments') IS NOT NULL
  AND to_regclass('public.teacher_course_plans') IS NOT NULL
  AND to_regclass('public.learning_units') IS NOT NULL
  AND to_regclass('public.notifications') IS NOT NULL
  AND to_regprocedure('public.preview_course_enrollment(uuid)') IS NOT NULL
  AND to_regprocedure('public.submit_course_enrollment(uuid)') IS NOT NULL
  AND to_regprocedure('public.submit_academic_item(text,uuid)') IS NOT NULL
  AND to_regprocedure('public.create_academic_lesson_bundle(uuid,uuid,uuid,text,text,text,integer,timestamptz,integer,numeric,integer,numeric)') IS NOT NULL
  AND to_regprocedure('public.review_academic_submission(text,uuid,text,text)') IS NOT NULL,
  'tables and final public RPCs required by src/lib/academics.ts'
);

SELECT pg_temp.record_result(
  'schema: private training-materials bucket contract',
  EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'training-materials' AND public = false AND file_size_limit = 26214400
      AND allowed_mime_types @> ARRAY['application/pdf', 'text/plain', 'video/webm']::text[]
  ),
  'private bucket, 25 MiB limit, and final expanded file-type contract'
);

-- Anonymous users must not execute the authenticated enrollment RPC.
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM public.preview_course_enrollment('30000000-0000-0000-0000-000000000001'::uuid);
  PERFORM pg_temp.record_result('RLS: anon enrollment preview is denied', false, 'RPC unexpectedly executed');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.record_result('RLS: anon enrollment preview is denied', true, SQLSTATE || ': ' || SQLERRM);
WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RLS: anon enrollment preview is denied', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Student preview and submit are exercised under authenticated JWT claims.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.preview_course_enrollment('30000000-0000-0000-0000-000000000001'::uuid) INTO result;
  PERFORM pg_temp.record_result(
    'RPC: student enrollment preview is allowed',
    coalesce((result ->> 'allowed')::boolean, false), result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: student enrollment preview is allowed', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.submit_course_enrollment('30000000-0000-0000-0000-000000000001'::uuid) INTO result;
  PERFORM pg_temp.record_result(
    'RPC: student submission creates submitted enrollment',
    result ->> 'status' = 'submitted' AND result ? 'enrollment_id', result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: student submission creates submitted enrollment', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
DO $$
DECLARE count_rows integer;
BEGIN
  SELECT count(*) INTO count_rows FROM public.training_materials
  WHERE id = '40000000-0000-0000-0000-000000000001'::uuid;
  PERFORM pg_temp.record_result(
    'RLS: student cannot read unapproved material', count_rows = 0, 'visible rows=' || count_rows
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RLS: student cannot read unapproved material', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Assigned teacher submits the drafted material through the same public RPC the UI calls.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.submit_academic_item('training_material', '40000000-0000-0000-0000-000000000001'::uuid) INTO result;
  PERFORM pg_temp.record_result(
    'RPC: assigned teacher submits material', result ->> 'status' = 'submitted', result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: assigned teacher submits material', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.create_academic_lesson_bundle(
    '20000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    '__txn_academic_test__ Lesson',
    'Synthetic lesson-bundle contract fixture.',
    'topic', 1, now() + interval '1 day', 30, 25, 15, 25
  ) INTO result;
  PERFORM pg_temp.record_result(
    'RPC: assigned teacher creates linked draft lesson bundle',
    result ->> 'status' = 'draft'
      AND nullif(result ->> 'quiz_id', '') IS NOT NULL
      AND nullif(result ->> 'classwork_assignment_id', '') IS NOT NULL,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: assigned teacher creates linked draft lesson bundle', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Reviewer sees the queue, approves both workflows, and triggers roster/notifications.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE count_rows integer;
BEGIN
  SELECT count(*) INTO count_rows FROM public.academic_approval_queue
  WHERE entity_id IN (
    '40000000-0000-0000-0000-000000000001'::uuid,
    (SELECT id FROM public.course_enrollments
     WHERE cohort_id = '30000000-0000-0000-0000-000000000001'::uuid
       AND student_id = '10000000-0000-0000-0000-000000000001'::uuid)
  );
  PERFORM pg_temp.record_result('RLS: reviewer sees submitted approval items', count_rows = 2, 'visible rows=' || count_rows);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RLS: reviewer sees submitted approval items', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
DO $$
DECLARE result jsonb; enrollment_id uuid;
BEGIN
  SELECT id INTO enrollment_id FROM public.course_enrollments
  WHERE cohort_id = '30000000-0000-0000-0000-000000000001'::uuid
    AND student_id = '10000000-0000-0000-0000-000000000001'::uuid;
  SELECT public.review_academic_submission('enrollment', enrollment_id, 'approved', 'Transaction test approval') INTO result;
  PERFORM pg_temp.record_result('RPC: reviewer approves enrollment', result ->> 'status' = 'approved', result::text);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: reviewer approves enrollment', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.review_academic_submission('training_material', '40000000-0000-0000-0000-000000000001'::uuid, 'approved', 'Transaction test approval') INTO result;
  PERFORM pg_temp.record_result('RPC: reviewer approves material', result ->> 'status' = 'approved', result::text);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: reviewer approves material', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Approved data is visible to the student; approval creates roster and recipient notifications.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE material_rows integer; notification_rows integer; roster_rows integer;
BEGIN
  SELECT count(*) INTO material_rows FROM public.training_materials
  WHERE id = '40000000-0000-0000-0000-000000000001'::uuid;
  SELECT count(*) INTO notification_rows FROM public.notifications
  WHERE recipient_id = '10000000-0000-0000-0000-000000000001'::uuid
    AND entity_type = 'enrollment';
  SELECT count(*) INTO roster_rows FROM public.cohort_students
  WHERE cohort_id = '30000000-0000-0000-0000-000000000001'::uuid
    AND student_id = '10000000-0000-0000-0000-000000000001'::uuid AND active;
  PERFORM pg_temp.record_result('RLS: student reads approved material', material_rows = 1, 'visible rows=' || material_rows);
  PERFORM pg_temp.record_result('trigger: approval creates own notification', notification_rows >= 1, 'visible rows=' || notification_rows);
  PERFORM pg_temp.record_result('trigger: approval adds student to roster', roster_rows = 1, 'active rows=' || roster_rows);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RLS: student reads approved material', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('trigger: approval creates own notification', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('trigger: approval adds student to roster', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Surface all assertion outcomes before rollback. This SELECT does not persist.
SELECT name, passed, detail FROM pg_temp.test_results ORDER BY name;
SELECT count(*) AS failed_contracts FROM pg_temp.test_results WHERE NOT passed;
SELECT CASE WHEN count(*) = 14 AND bool_and(passed) THEN 'true' ELSE 'false' END AS contracts_passed
FROM pg_temp.test_results
\gset

-- Mandatory final statement: all migration DDL, fixture auth accounts, metadata,
-- RLS policies, bucket changes, triggers, and synthetic domain rows are discarded.
ROLLBACK;
\echo ROLLBACK completed: no transaction-scoped changes were committed.
\if :contracts_passed
\echo ACADEMIC_CONTRACT_RESULT:PASS
\else
\echo ACADEMIC_CONTRACT_RESULT:FAIL
SELECT 1 / 0;
\endif
