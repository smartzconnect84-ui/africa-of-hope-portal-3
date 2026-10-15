-- ROLLBACK-ONLY contract harness for the learning-path / classwork /
-- attendance migration (20261014080000_learning_path_attendance.sql).
--
-- Run only with explicit authorization through psql as the database owner,
-- against a reviewed production-shaped database during an approved
-- maintenance window. The migration and all fixtures run inside one
-- transaction; the final ROLLBACK is mandatory. No HTTP/Storage calls are
-- made and no browser auth users are created.
--
-- Usage once authorized (do not use `-1`, which would conflict with this BEGIN):
--   DATABASE_URL="postgresql://..." npm run test:learning-path:db

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
\ir ../migrations/20261014080000_learning_path_attendance.sql
\echo Applying migration idempotency pass (inside same transaction)
\ir ../migrations/20261014080000_learning_path_attendance.sql
\echo Applying fix migration first pass (inside same transaction)
\ir ../migrations/20261014090000_learning_path_attendance_fixes.sql
\echo Applying fix migration idempotency pass (inside same transaction)
\ir ../migrations/20261014090000_learning_path_attendance_fixes.sql
\echo Applying progress-locking migration first pass (inside same transaction)
\ir ../migrations/20261014100000_learning_progress_locking.sql
\echo Applying progress-locking migration idempotency pass (inside same transaction)
\ir ../migrations/20261014100000_learning_progress_locking.sql

-- Fixed, non-production identities. They exist only until the ROLLBACK below.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
SELECT fixture.id, (SELECT instance_id FROM auth.users LIMIT 1),
       'authenticated', 'authenticated', fixture.email, 'not-a-login-secret', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', fixture.full_name)
FROM (VALUES
  ('11000000-0000-0000-0000-000000000001'::uuid, '__txn_lpa_student__@testing.invalid', '__txn_lpa_test__ Student'),
  ('11000000-0000-0000-0000-000000000002'::uuid, '__txn_lpa_teacher__@testing.invalid', '__txn_lpa_test__ Teacher'),
  ('11000000-0000-0000-0000-000000000003'::uuid, '__txn_lpa_outsider__@testing.invalid', '__txn_lpa_test__ Outsider Student')
) AS fixture(id, email, full_name);

UPDATE public.profiles
SET role = CASE id
  WHEN '11000000-0000-0000-0000-000000000001'::uuid THEN 'Student'
  WHEN '11000000-0000-0000-0000-000000000002'::uuid THEN 'Teacher'
  WHEN '11000000-0000-0000-0000-000000000003'::uuid THEN 'Student'
END,
status = 'Active',
full_name = coalesce(full_name, '__txn_lpa_test__ fixture')
WHERE id IN (
  '11000000-0000-0000-0000-000000000001'::uuid,
  '11000000-0000-0000-0000-000000000002'::uuid,
  '11000000-0000-0000-0000-000000000003'::uuid
);

-- Clone a production-shaped program row rather than guessing legacy columns.
WITH template AS (
  SELECT to_jsonb(p) AS row_json FROM public.programs p ORDER BY p.id LIMIT 1
)
INSERT INTO public.programs
SELECT (jsonb_populate_record(
  NULL::public.programs,
  row_json || jsonb_build_object(
    'id', '21000000-0000-0000-0000-000000000001',
    'title', '__txn_lpa_test__ Program',
    'is_active', true,
    'completion_pass_mark', 50,
    'required_attendance_percent', 75
  )
)).*
FROM template;

-- Cohort 1: active course window (end_date in the future).
INSERT INTO public.cohorts (
  id, name, program_id, teacher_id, start_date, end_date, room,
  capacity, enrollment_status, enrollment_opens_at, enrollment_closes_at
) VALUES (
  '31000000-0000-0000-0000-000000000001', '__txn_lpa_test__ Cohort Active',
  '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002',
  current_date - 10, current_date + 20, '__txn_lpa_test__ Room',
  5, 'closed', now() - interval '20 days', now() - interval '10 days'
);

-- Cohort 2: course window already ended.
INSERT INTO public.cohorts (
  id, name, program_id, teacher_id, start_date, end_date, room,
  capacity, enrollment_status, enrollment_opens_at, enrollment_closes_at
) VALUES (
  '31000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Cohort Ended',
  '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002',
  current_date - 60, current_date - 5, '__txn_lpa_test__ Room',
  5, 'closed', now() - interval '70 days', now() - interval '60 days'
);

-- enrolled_at predates every fixture class session below (current_date-9
-- through current_date-3) so the join-date filter added by the
-- 20261014090000 fix migration's _attendance_standing() helper still counts
-- all four sessions as "held" for this student.
INSERT INTO public.cohort_students (cohort_id, student_id, active, enrolled_at) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', true, now() - interval '15 days'),
  ('31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', true, now() - interval '65 days');

INSERT INTO public.course_enrollments (id, cohort_id, student_id, status) VALUES
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'approved'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'approved');

-- _approved_enrollment_to_roster() resets cohort_students.enrolled_at = now()
-- whenever a course_enrollments row is inserted/updated to 'approved' (the
-- INSERT above included), so re-apply the historical join dates afterward.
UPDATE public.cohort_students SET enrolled_at = now() - interval '15 days'
WHERE cohort_id = '31000000-0000-0000-0000-000000000001' AND student_id = '11000000-0000-0000-0000-000000000001';
UPDATE public.cohort_students SET enrolled_at = now() - interval '65 days'
WHERE cohort_id = '31000000-0000-0000-0000-000000000002' AND student_id = '11000000-0000-0000-0000-000000000001';

-- Approving a learning_unit requires a published quiz + a graded classwork
-- assignment already linked (_validate_learning_unit_approval). Insert each
-- unit as draft, create its quiz/assignment, then flip to approved in one
-- UPDATE so the trigger sees quiz_id/classwork_assignment_id already set.

-- Unit 1: approved and available now, linked to a timed classwork assignment.
INSERT INTO public.learning_units (id, program_id, cohort_id, title, unit_type, position, available_from, status, created_by) VALUES
  ('33000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
   '__txn_lpa_test__ Unit 1', 'topic', 1, now() - interval '1 hour', 'draft', '11000000-0000-0000-0000-000000000002');

INSERT INTO public.assignments (id, cohort_id, title, due_date, max_marks, learning_unit_id, time_limit_minutes, grade_weight) VALUES
  ('34000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
   '__txn_lpa_test__ Classwork 1', current_date + 10, 100, '33000000-0000-0000-0000-000000000001', 1, 10);

INSERT INTO public.quizzes (id, title, program_id, cohort_id, status, learning_unit_id, grade_weight, pass_mark) VALUES
  ('36000000-0000-0000-0000-000000000001', '__txn_lpa_test__ Quiz 1', '21000000-0000-0000-0000-000000000001',
   '31000000-0000-0000-0000-000000000001', 'published', '33000000-0000-0000-0000-000000000001', 10, 50);

UPDATE public.learning_units
SET quiz_id = '36000000-0000-0000-0000-000000000001', classwork_assignment_id = '34000000-0000-0000-0000-000000000001', status = 'approved'
WHERE id = '33000000-0000-0000-0000-000000000001';

-- Unit 2: approved but not available until tomorrow (sequencing gate).
INSERT INTO public.learning_units (id, program_id, cohort_id, title, unit_type, position, available_from, status, created_by) VALUES
  ('33000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
   '__txn_lpa_test__ Unit 2', 'topic', 2, now() + interval '1 day', 'draft', '11000000-0000-0000-0000-000000000002');

INSERT INTO public.assignments (id, cohort_id, title, due_date, max_marks, learning_unit_id, grade_weight) VALUES
  ('34000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001',
   '__txn_lpa_test__ Classwork 2', current_date + 10, 100, '33000000-0000-0000-0000-000000000002', 10);

INSERT INTO public.quizzes (id, title, program_id, cohort_id, status, learning_unit_id, grade_weight, pass_mark) VALUES
  ('36000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Quiz 2', '21000000-0000-0000-0000-000000000001',
   '31000000-0000-0000-0000-000000000001', 'published', '33000000-0000-0000-0000-000000000002', 10, 50);

UPDATE public.learning_units
SET quiz_id = '36000000-0000-0000-0000-000000000002', classwork_assignment_id = '34000000-0000-0000-0000-000000000002', status = 'approved'
WHERE id = '33000000-0000-0000-0000-000000000002';

-- Unit 3: lives in the already-ended cohort (course window gate).
INSERT INTO public.learning_units (id, program_id, cohort_id, title, unit_type, position, available_from, status, created_by) VALUES
  ('33000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002',
   '__txn_lpa_test__ Unit 3', 'topic', 1, NULL, 'draft', '11000000-0000-0000-0000-000000000002');

INSERT INTO public.assignments (id, cohort_id, title, due_date, max_marks, learning_unit_id, grade_weight) VALUES
  ('34000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000002',
   '__txn_lpa_test__ Classwork 3', current_date - 20, 100, '33000000-0000-0000-0000-000000000003', 10);

INSERT INTO public.quizzes (id, title, program_id, cohort_id, status, learning_unit_id, grade_weight, pass_mark) VALUES
  ('36000000-0000-0000-0000-000000000003', '__txn_lpa_test__ Quiz 3', '21000000-0000-0000-0000-000000000001',
   '31000000-0000-0000-0000-000000000002', 'published', '33000000-0000-0000-0000-000000000003', 10, 50);

UPDATE public.learning_units
SET quiz_id = '36000000-0000-0000-0000-000000000003', classwork_assignment_id = '34000000-0000-0000-0000-000000000003', status = 'approved'
WHERE id = '33000000-0000-0000-0000-000000000003';

-- Four held class sessions in the active cohort: Present, Absent, Absent, Present.
INSERT INTO public.class_sessions (id, cohort_id, teacher_id, title, session_date, starts_at, ends_at, status) VALUES
  ('35000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Session 1', current_date - 9, '09:00', '10:00', 'approved'),
  ('35000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Session 2', current_date - 7, '09:00', '10:00', 'approved'),
  ('35000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Session 3', current_date - 5, '09:00', '10:00', 'approved'),
  ('35000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Session 4', current_date - 3, '09:00', '10:00', 'approved');

-- Standalone classwork (no learning_unit_id, so start_classwork's unit
-- availability gate is skipped) in the still-open active cohort, used only
-- by the 20261014090000 fix-migration assertions below.
INSERT INTO public.assignments (id, cohort_id, title, due_date, max_marks, time_limit_minutes, grade_weight) VALUES
  ('34000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001', '__txn_lpa_test__ Classwork 4', current_date + 10, 100, 5, 10),
  ('34000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000001', '__txn_lpa_test__ Classwork 5', current_date + 10, 100, 5, 10),
  ('34000000-0000-0000-0000-000000000006', '31000000-0000-0000-0000-000000000001', '__txn_lpa_test__ Classwork 6', current_date + 10, 100, 5, 10);

SELECT pg_temp.record_result(
  '01 schema: new relations/functions/triggers/bucket exist',
  to_regprocedure('public.start_classwork(uuid)') IS NOT NULL
  AND to_regprocedure('public.submit_classwork(uuid,text,text)') IS NOT NULL
  AND to_regprocedure('public.record_learning_progress(uuid,text)') IS NOT NULL
  AND to_regprocedure('public.my_course_status()') IS NOT NULL
  AND to_regprocedure('public.close_expired_course_windows()') IS NOT NULL
  AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'classwork-submissions' AND public = false AND file_size_limit = 26214400)
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'attendance_notify')
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'student_learning_progress_recompute')
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'class_sessions_notify_schedule')
  AND pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'submissions_status_check')) LIKE '%In Progress%'
  AND to_regprocedure('public.create_academic_lesson_bundle(uuid,uuid,uuid,text,text,text,integer,timestamptz,integer,numeric,integer,numeric,timestamptz)') IS NOT NULL
  AND to_regprocedure('public.create_academic_lesson_bundle(uuid,uuid,uuid,text,text,text,integer,timestamptz,integer,numeric,integer,numeric)') IS NULL
  AND to_regprocedure('public._attendance_standing(uuid,uuid)') IS NOT NULL
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'learning_units_recompute_progress')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'notifications_recipient_kind_entity_idx'),
  'RPCs, bucket, triggers and the widened submissions status check'
);

-- Anonymous users must not execute the authenticated classwork RPC.
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM public.start_classwork('34000000-0000-0000-0000-000000000001'::uuid);
  PERFORM pg_temp.record_result('02 RLS: anon start_classwork is denied', false, 'RPC unexpectedly executed');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.record_result('02 RLS: anon start_classwork is denied', true, SQLSTATE || ': ' || SQLERRM);
WHEN OTHERS THEN
  PERFORM pg_temp.record_result('02 RLS: anon start_classwork is denied', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Cohort member starts classwork.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.start_classwork('34000000-0000-0000-0000-000000000001'::uuid) INTO result;
  PERFORM pg_temp.record_result(
    '03 RPC: cohort member starts classwork',
    result ->> 'status' = 'In Progress' AND result ? 'submission_id' AND (result ->> 'time_limit_minutes')::int = 1,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('03 RPC: cohort member starts classwork', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Non-member is blocked.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.start_classwork('34000000-0000-0000-0000-000000000001'::uuid);
  PERFORM pg_temp.record_result('04 RPC: non-member start_classwork is blocked', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('04 RPC: non-member start_classwork is blocked', SQLERRM = 'forbidden', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Progress on a not-yet-available unit is blocked.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.record_learning_progress('33000000-0000-0000-0000-000000000002'::uuid, 'completed');
  PERFORM pg_temp.record_result('05 RPC: progress blocked before unit is available', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('05 RPC: progress blocked before unit is available', SQLERRM = 'unit_not_available', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Progress once the course window has closed is blocked.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.record_learning_progress('33000000-0000-0000-0000-000000000003'::uuid, 'in_progress');
  PERFORM pg_temp.record_result('06 RPC: progress blocked after course window closed', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('06 RPC: progress blocked after course window closed', SQLERRM = 'course_window_closed', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Completing the available unit recomputes course_enrollments.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.record_learning_progress('33000000-0000-0000-0000-000000000001'::uuid, 'completed') INTO result;
  PERFORM pg_temp.record_result(
    '07 RPC: record_learning_progress recomputes enrollment progress',
    (result ->> 'progress_percent')::numeric = 50 AND result ->> 'completion_status' = 'in_progress',
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('07 RPC: record_learning_progress recomputes enrollment progress', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

DO $$
DECLARE pct numeric; status text;
BEGIN
  SELECT progress_percent, completion_status INTO pct, status
  FROM public.course_enrollments WHERE id = '32000000-0000-0000-0000-000000000001';
  PERFORM pg_temp.record_result(
    '08 trigger: course_enrollments reflects 1-of-2 approved units completed',
    pct = 50 AND status = 'in_progress', 'progress_percent=' || pct || ' completion_status=' || status
  );
END;
$$;

-- Backdate the started_at timestamp (fixture-only; no RLS writer exists for this).
UPDATE public.submissions
SET started_at = now() - interval '10 minutes'
WHERE assignment_id = '34000000-0000-0000-0000-000000000001' AND student_id = '11000000-0000-0000-0000-000000000001';

-- Submitting past the time limit + grace period flags the submission late.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.submit_classwork('34000000-0000-0000-0000-000000000001'::uuid, 'My answer.', NULL) INTO result;
  PERFORM pg_temp.record_result(
    '09 RPC: submit_classwork flags a late submission',
    result ->> 'status' = 'Submitted' AND (result ->> 'is_late')::boolean = true,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('09 RPC: submit_classwork flags a late submission', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
DO $$
BEGIN
  PERFORM public.submit_classwork('34000000-0000-0000-0000-000000000001'::uuid, 'Second attempt.', NULL);
  PERFORM pg_temp.record_result('10 RPC: resubmitting a graded/submitted classwork is blocked', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('10 RPC: resubmitting a graded/submitted classwork is blocked', SQLERRM = 'classwork_already_submitted', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- Attendance: Present, Absent, Absent, Present across the four sessions.
INSERT INTO public.attendance (cohort_id, student_id, attendance_date, status, class_session_id) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', current_date - 9, 'Present', '35000000-0000-0000-0000-000000000001');
INSERT INTO public.attendance (cohort_id, student_id, attendance_date, status, class_session_id) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', current_date - 7, 'Absent', '35000000-0000-0000-0000-000000000002');
INSERT INTO public.attendance (cohort_id, student_id, attendance_date, status, class_session_id) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', current_date - 5, 'Absent', '35000000-0000-0000-0000-000000000003');
INSERT INTO public.attendance (cohort_id, student_id, attendance_date, status, class_session_id) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', current_date - 3, 'Present', '35000000-0000-0000-0000-000000000004');

DO $$
DECLARE missed_count integer;
BEGIN
  SELECT count(*) INTO missed_count FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000001' AND kind = 'attendance_missed' AND entity_type = 'attendance';
  PERFORM pg_temp.record_result(
    '11 trigger: each Absent session notifies the student once',
    missed_count = 2, 'attendance_missed rows=' || missed_count
  );
END;
$$;

DO $$
DECLARE student_warnings integer; teacher_warnings integer;
BEGIN
  SELECT count(*) INTO student_warnings FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000001' AND kind = 'attendance_warning' AND entity_type = 'cohort';
  SELECT count(*) INTO teacher_warnings FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000002' AND kind = 'attendance_warning' AND entity_type = 'cohort';
  PERFORM pg_temp.record_result(
    '12 trigger: attendance_warning fires once per 7 days for student and teacher',
    student_warnings = 1 AND teacher_warnings = 1,
    'student=' || student_warnings || ' teacher=' || teacher_warnings
  );
END;
$$;

-- my_course_status(): active cohort shows the computed attendance/progress numbers.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; active_entry jsonb; ended_entry jsonb;
BEGIN
  SELECT public.my_course_status() INTO result;
  SELECT elem INTO active_entry FROM jsonb_array_elements(result) elem
    WHERE elem ->> 'cohort_id' = '31000000-0000-0000-0000-000000000001';
  SELECT elem INTO ended_entry FROM jsonb_array_elements(result) elem
    WHERE elem ->> 'cohort_id' = '31000000-0000-0000-0000-000000000002';
  PERFORM pg_temp.record_result(
    '13 RPC: my_course_status computes attendance and progress for the active cohort',
    (active_entry ->> 'sessions_held')::int = 4
      AND (active_entry ->> 'sessions_attended')::int = 2
      AND (active_entry ->> 'sessions_missed')::int = 2
      AND (active_entry ->> 'attendance_percent')::numeric = 50
      AND (active_entry ->> 'attendance_ok')::boolean = false
      AND (active_entry ->> 'units_total')::int = 2
      AND (active_entry ->> 'units_completed')::int = 1
      AND (active_entry ->> 'progress_percent')::numeric = 50
      AND active_entry ->> 'window' = 'active'
      AND jsonb_array_length(active_entry -> 'missed') = 2,
    active_entry::text
  );
  PERFORM pg_temp.record_result(
    '14 RPC: my_course_status marks the ended cohort window',
    ended_entry ->> 'window' = 'ended',
    ended_entry::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('13 RPC: my_course_status computes attendance and progress for the active cohort', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('14 RPC: my_course_status marks the ended cohort window', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- A room change on a *past* approved session must NOT notify (20261014090000
-- fix migration: schedule_updated is scoped to session_date >= current_date).
UPDATE public.class_sessions SET room = '__txn_lpa_test__ Room B'
WHERE id = '35000000-0000-0000-0000-000000000001';

DO $$
DECLARE schedule_rows integer;
BEGIN
  SELECT count(*) INTO schedule_rows FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000001' AND kind = 'schedule_updated'
    AND entity_type = 'class_session' AND entity_id = '35000000-0000-0000-0000-000000000001';
  PERFORM pg_temp.record_result(
    '15 trigger: a past approved session room change does not notify',
    schedule_rows = 0, 'schedule_updated rows=' || schedule_rows
  );
END;
$$;

-- An approved *upcoming* session's room change notifies active cohort students.
INSERT INTO public.class_sessions (id, cohort_id, teacher_id, title, session_date, starts_at, ends_at, status) VALUES
  ('35000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', '__txn_lpa_test__ Session 5 (upcoming)', current_date + 5, '09:00', '10:00', 'approved');

UPDATE public.class_sessions SET room = '__txn_lpa_test__ Room C'
WHERE id = '35000000-0000-0000-0000-000000000005';

DO $$
DECLARE schedule_rows integer;
BEGIN
  SELECT count(*) INTO schedule_rows FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000001' AND kind = 'schedule_updated'
    AND entity_type = 'class_session' AND entity_id = '35000000-0000-0000-0000-000000000005';
  PERFORM pg_temp.record_result(
    '26 trigger: an upcoming approved session room change notifies active cohort students',
    schedule_rows = 1, 'schedule_updated rows=' || schedule_rows
  );
END;
$$;

-- ──────────── Fix-migration (20261014090000) assertions ────────────

-- Bundle creation with p_available_from, as the cohort teacher.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.create_academic_lesson_bundle(
    '21000000-0000-0000-0000-000000000001'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, NULL,
    '__txn_lpa_test__ Unit 4', 'Summary', 'topic', 4,
    now() + interval '10 days', 30, 50, 20, 50, now() + interval '1 day'
  ) INTO result;
  PERFORM pg_temp.record_result(
    '16 RPC: create_academic_lesson_bundle stores p_available_from',
    (result ->> 'available_from')::timestamptz is not null
      AND (SELECT available_from FROM public.learning_units WHERE id = (result ->> 'id')::uuid) = (result ->> 'available_from')::timestamptz,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('16 RPC: create_academic_lesson_bundle stores p_available_from', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- Bundle creation rejects an available_from on/after the due date.
DO $$
BEGIN
  PERFORM public.create_academic_lesson_bundle(
    '21000000-0000-0000-0000-000000000001'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, NULL,
    '__txn_lpa_test__ Unit 5', 'Summary', 'topic', 5,
    now() + interval '1 day', 30, 50, 20, 50, now() + interval '10 days'
  );
  PERFORM pg_temp.record_result('17 RPC: create_academic_lesson_bundle rejects available_from after due_at', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('17 RPC: create_academic_lesson_bundle rejects available_from after due_at', SQLERRM = 'available_after_due', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- record_learning_progress now rejects a non-member even for an available unit.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.record_learning_progress('33000000-0000-0000-0000-000000000001'::uuid, 'in_progress');
  PERFORM pg_temp.record_result('18 RPC: record_learning_progress rejects a non-member', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('18 RPC: record_learning_progress rejects a non-member', SQLERRM = 'forbidden', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- start_classwork is idempotent across repeat calls (ON CONFLICT DO NOTHING + re-select).
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE first_call jsonb; second_call jsonb;
BEGIN
  SELECT public.start_classwork('34000000-0000-0000-0000-000000000004'::uuid) INTO first_call;
  SELECT public.start_classwork('34000000-0000-0000-0000-000000000004'::uuid) INTO second_call;
  PERFORM pg_temp.record_result(
    '19 RPC: start_classwork is idempotent across repeat calls',
    first_call ->> 'submission_id' = second_call ->> 'submission_id'
      AND first_call ->> 'started_at' = second_call ->> 'started_at',
    'first=' || first_call::text || ' second=' || second_call::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('19 RPC: start_classwork is idempotent across repeat calls', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- A pre-existing 'Missing' row with no started_at (e.g. a seeded placeholder) is resurrected, not stuck.
INSERT INTO public.submissions (assignment_id, student_id, status, started_at)
VALUES ('34000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000001', 'Missing', NULL)
ON CONFLICT (assignment_id, student_id) DO NOTHING;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.start_classwork('34000000-0000-0000-0000-000000000005'::uuid) INTO result;
  PERFORM pg_temp.record_result(
    '20 RPC: start_classwork resurrects a pre-existing Missing/null-started_at row',
    result ->> 'status' = 'In Progress' AND result ->> 'started_at' IS NOT NULL,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('20 RPC: start_classwork resurrects a pre-existing Missing/null-started_at row', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- submit_classwork rechecks cohort membership even with a started submission row
-- (student 3 starts as a member, is then removed from the cohort, and must be
-- blocked from submitting).
INSERT INTO public.cohort_students (cohort_id, student_id, active, enrolled_at) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', true, now());
INSERT INTO public.submissions (assignment_id, student_id, status, started_at)
VALUES ('34000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000003', 'In Progress', now())
ON CONFLICT (assignment_id, student_id) DO NOTHING;
DELETE FROM public.cohort_students
WHERE cohort_id = '31000000-0000-0000-0000-000000000001' AND student_id = '11000000-0000-0000-0000-000000000003';

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.submit_classwork('34000000-0000-0000-0000-000000000006'::uuid, 'answer', NULL);
  PERFORM pg_temp.record_result('21 RPC: submit_classwork rechecks cohort membership', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('21 RPC: submit_classwork rechecks cohort membership', SQLERRM = 'forbidden', SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- submit_classwork rejects an attachment path with no matching storage.objects row,
-- then accepts an empty-string path as NULL (both on the resurrected row 20 above).
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.submit_classwork(
    '34000000-0000-0000-0000-000000000005'::uuid, '',
    '34000000-0000-0000-0000-000000000005/11000000-0000-0000-0000-000000000001/does-not-exist.pdf'
  );
  PERFORM pg_temp.record_result('22 RPC: submit_classwork rejects a non-existent attachment object', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('22 RPC: submit_classwork rejects a non-existent attachment object', SQLERRM = 'attachment_not_found', SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- submit_classwork treats an empty-string attachment path as NULL, not a literal empty string.
DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.submit_classwork('34000000-0000-0000-0000-000000000005'::uuid, 'My text-only answer.', '') INTO result;
  PERFORM pg_temp.record_result(
    '23 RPC: submit_classwork stores an empty-string attachment path as NULL',
    result ->> 'status' = 'Submitted'
      AND (SELECT attachment_path IS NULL FROM public.submissions WHERE id = (result ->> 'submission_id')::uuid),
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('23 RPC: submit_classwork stores an empty-string attachment path as NULL', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- close_expired_course_windows re-evaluates a completed_pending_review enrollment
-- whose attendance has since failed, and is idempotent on a second run.
UPDATE public.course_enrollments
SET completion_status = 'completed_pending_review', progress_percent = 100
WHERE id = '32000000-0000-0000-0000-000000000002';

DO $$
DECLARE closed_count integer; notif_count_1 integer; notif_count_2 integer; final_status text;
BEGIN
  SELECT public.close_expired_course_windows() INTO closed_count;
  SELECT completion_status INTO final_status FROM public.course_enrollments WHERE id = '32000000-0000-0000-0000-000000000002';
  SELECT count(*) INTO notif_count_1 FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000001' AND kind = 'course_window_closed'
    AND entity_type = 'enrollment' AND entity_id = '32000000-0000-0000-0000-000000000002';

  PERFORM public.close_expired_course_windows();
  SELECT count(*) INTO notif_count_2 FROM public.notifications
  WHERE recipient_id = '11000000-0000-0000-0000-000000000001' AND kind = 'course_window_closed'
    AND entity_type = 'enrollment' AND entity_id = '32000000-0000-0000-0000-000000000002';

  PERFORM pg_temp.record_result(
    '24 RPC: close_expired_course_windows re-evaluates completed_pending_review and is idempotent',
    final_status IN ('completed_pending_review', 'incomplete') AND notif_count_1 = 1 AND notif_count_2 = 1,
    'closed_count=' || closed_count || ' final_status=' || final_status || ' notif1=' || notif_count_1 || ' notif2=' || notif_count_2
  );
END;
$$;

-- _validate_student_learning_progress allows a maintenance write with no JWT (auth.uid() is null).
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);
DO $$
BEGIN
  INSERT INTO public.student_learning_progress (student_id, cohort_id, learning_unit_id, status, progress_percent)
  VALUES ('11000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000003', 'in_progress', 10)
  ON CONFLICT (student_id, cohort_id, learning_unit_id) DO UPDATE SET status = excluded.status;
  PERFORM pg_temp.record_result(
    '25 trigger: maintenance write with auth.uid() null bypasses the availability/window gate',
    EXISTS (
      SELECT 1 FROM public.student_learning_progress
      WHERE student_id = '11000000-0000-0000-0000-000000000003' AND cohort_id = '31000000-0000-0000-0000-000000000002'
    ),
    'ok'
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('25 trigger: maintenance write with auth.uid() null bypasses the availability/window gate', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- start_classwork never restarts a timer that already has started_at, and returns server_now.
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
UPDATE public.submissions SET status = 'Missing', started_at = now() - interval '30 minutes'
WHERE assignment_id = '34000000-0000-0000-0000-000000000004' AND student_id = '11000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; expected timestamptz;
BEGIN
  SELECT started_at INTO expected FROM public.submissions
  WHERE assignment_id = '34000000-0000-0000-0000-000000000004' AND student_id = '11000000-0000-0000-0000-000000000001';
  SELECT public.start_classwork('34000000-0000-0000-0000-000000000004'::uuid) INTO result;
  PERFORM pg_temp.record_result(
    '27 RPC: start_classwork keeps an existing started_at and returns server_now',
    (result ->> 'started_at')::timestamptz = expected AND result ->> 'server_now' IS NOT NULL,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('27 RPC: start_classwork keeps an existing started_at and returns server_now', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- After course_window_closed is sent, a recompute keeps completion_status.
DO $$
DECLARE final_status text;
BEGIN
  UPDATE public.course_enrollments SET completion_status = 'completed_pending_review'
  WHERE id = '32000000-0000-0000-0000-000000000002';
  INSERT INTO public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
  SELECT '11000000-0000-0000-0000-000000000001', 'course_window_closed', 'Course window closed', 'test', 'enrollment', '32000000-0000-0000-0000-000000000002'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications WHERE kind = 'course_window_closed' AND entity_type = 'enrollment'
      AND entity_id = '32000000-0000-0000-0000-000000000002'
  );
  PERFORM public._recompute_cohort_progress('31000000-0000-0000-0000-000000000002');
  SELECT completion_status INTO final_status FROM public.course_enrollments WHERE id = '32000000-0000-0000-0000-000000000002';
  PERFORM pg_temp.record_result(
    '28 trigger: recompute keeps completion_status after the course window closed',
    final_status = 'completed_pending_review',
    'final_status=' || coalesce(final_status, 'null')
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('28 trigger: recompute keeps completion_status after the course window closed', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- Surface all assertion outcomes before rollback. This SELECT does not persist.
SELECT name, passed, detail FROM pg_temp.test_results ORDER BY name;
SELECT count(*) AS failed_contracts FROM pg_temp.test_results WHERE NOT passed;
SELECT CASE WHEN count(*) = 28 AND bool_and(passed) THEN 'true' ELSE 'false' END AS contracts_passed
FROM pg_temp.test_results
\gset

-- Mandatory final statement: all migration DDL, fixture auth accounts, metadata,
-- RLS policies, bucket changes, triggers, and synthetic domain rows are discarded.
ROLLBACK;
\echo ROLLBACK completed: no transaction-scoped changes were committed.
\if :contracts_passed
\echo LEARNING_PATH_ATTENDANCE_CONTRACT_RESULT:PASS
\else
\echo LEARNING_PATH_ATTENDANCE_CONTRACT_RESULT:FAIL
SELECT 1 / 0;
\endif
