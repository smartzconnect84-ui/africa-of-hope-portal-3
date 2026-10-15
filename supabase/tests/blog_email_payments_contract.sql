-- ROLLBACK-ONLY contract harness for the blog/payments/email-outbox
-- migration and its payments/email hardening follow-up.
--
-- Run only with explicit authorization through psql as the database owner.
-- The migrations and all fixtures run in one transaction; the final
-- ROLLBACK is mandatory. This script makes no COMMIT and does not call
-- Storage HTTP APIs, Resend, or create browser sessions -- it only
-- exercises SQL/RPCs.
--
-- Usage once authorized (do not use `-1`, which would conflict with this BEGIN):
--   DATABASE_URL="postgresql://..." psql "$DATABASE_URL" -X -f supabase/tests/blog_email_payments_contract.sql
--
-- `ON_ERROR_STOP` ensures a top-level SQL error returns a nonzero status. If
-- psql disconnects before the explicit ROLLBACK, PostgreSQL rolls back the
-- transaction anyway.

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

\echo Applying blog/payments/email migration (040000) first pass
\ir ../migrations/20261014040000_blog_email_payments.sql
\echo Applying blog/payments/email migration (040000) idempotency pass
\ir ../migrations/20261014040000_blog_email_payments.sql
\echo Applying backend hardening migration (050000)
\ir ../migrations/20261014050000_backend_hardening.sql
\echo Applying payments/email hardening migration (060000) first pass
\ir ../migrations/20261014060000_payments_email_hardening.sql
\echo Applying payments/email hardening migration (060000) idempotency pass
\ir ../migrations/20261014060000_payments_email_hardening.sql

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
  ('b1000000-0000-0000-0000-000000000001'::uuid, '__txn_blog_pay_test__student@testing.invalid', '__txn_blog_pay_test__ Student'),
  ('b1000000-0000-0000-0000-000000000002'::uuid, '__txn_blog_pay_test__reviewer@testing.invalid', '__txn_blog_pay_test__ Reviewer'),
  ('b1000000-0000-0000-0000-000000000003'::uuid, '__txn_blog_pay_test__nonreviewer@testing.invalid', '__txn_blog_pay_test__ Non-reviewer'),
  ('b1000000-0000-0000-0000-000000000004'::uuid, '__txn_blog_pay_test__admin@testing.invalid', '__txn_blog_pay_test__ Admin')
) AS fixture(id, email, full_name);

UPDATE public.profiles
SET role = CASE id
  WHEN 'b1000000-0000-0000-0000-000000000001'::uuid THEN 'Student'
  WHEN 'b1000000-0000-0000-0000-000000000002'::uuid THEN 'Finance Officer'
  WHEN 'b1000000-0000-0000-0000-000000000003'::uuid THEN 'Teacher'
  WHEN 'b1000000-0000-0000-0000-000000000004'::uuid THEN 'School Admin'
END,
status = 'Active',
full_name = coalesce(full_name, '__txn_blog_pay_test__ fixture')
WHERE id IN (
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid,
  'b1000000-0000-0000-0000-000000000004'::uuid
);

-- Blog fixtures: published (visible), scheduled-in-the-future (hidden until
-- its time), scheduled-in-the-past (already live), draft (never public).
INSERT INTO public.blog_posts (id, slug, title, excerpt, body, status, published_at, author_name)
VALUES
  ('b2000000-0000-0000-0000-000000000001', 'txn-blog-pay-test-published-zzzzz1', 'Published fixture', '', 'Body.', 'published', now() - interval '1 day', 'Fixture'),
  ('b2000000-0000-0000-0000-000000000002', 'txn-blog-pay-test-future-zzzzz2', 'Future scheduled fixture', '', 'Body.', 'scheduled', now() + interval '1 day', 'Fixture'),
  ('b2000000-0000-0000-0000-000000000003', 'txn-blog-pay-test-past-scheduled-zzzzz3', 'Past scheduled fixture', '', 'Body.', 'scheduled', now() - interval '1 hour', 'Fixture'),
  ('b2000000-0000-0000-0000-000000000004', 'txn-blog-pay-test-draft-zzzzz4', 'Draft fixture', '', 'Body.', 'draft', NULL, 'Fixture');

INSERT INTO public.payment_channels (id, provider, label, account_name, account_number, active)
VALUES ('b3000000-0000-0000-0000-000000000001', 'mtn_momo', '__txn_blog_pay_test__ MoMo', 'Africa of Hope', '0770000000', true);

SELECT pg_temp.record_result(
  'schema: required relation/function contracts exist',
  to_regclass('public.blog_posts') IS NOT NULL
  AND to_regclass('public.payment_channels') IS NOT NULL
  AND to_regclass('public.payment_submissions') IS NOT NULL
  AND to_regclass('public.email_outbox') IS NOT NULL
  AND to_regprocedure('public.submit_payment(uuid,numeric,text,text,text,text,date,text)') IS NOT NULL
  AND to_regprocedure('public.review_payment(uuid,text,text,numeric)') IS NOT NULL
  AND to_regprocedure('public.review_payment(uuid,text,text)') IS NULL
  AND to_regprocedure('public.enqueue_email(text,text,text,text,jsonb,uuid,text,timestamptz)') IS NOT NULL
  AND to_regprocedure('public.retry_failed_emails()') IS NOT NULL
  AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'blog-covers' AND public = true)
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_submissions' AND column_name = 'ledger_amount_usd'
  )
  AND EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'payment_submissions'
      AND indexname = 'payment_submissions_provider_reference_active_key'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_submissions_provider_reference_key'
  ),
  'tables, RPCs, bucket, ledger column and partial unique index required by the contract'
);

-- ─────────────────────── Blog visibility (public/anon) ───────────────────

SET LOCAL ROLE anon;
DO $$
DECLARE
  visible_count integer;
  future_visible boolean;
  draft_visible boolean;
BEGIN
  SELECT count(*) INTO visible_count FROM public.blog_posts
  WHERE id IN (
    'b2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000004'
  );
  SELECT EXISTS (SELECT 1 FROM public.blog_posts WHERE id = 'b2000000-0000-0000-0000-000000000002') INTO future_visible;
  SELECT EXISTS (SELECT 1 FROM public.blog_posts WHERE id = 'b2000000-0000-0000-0000-000000000004') INTO draft_visible;
  PERFORM pg_temp.record_result(
    'RLS: anon sees only published + past-scheduled posts', visible_count = 2, 'visible rows=' || visible_count
  );
  PERFORM pg_temp.record_result('RLS: anon cannot see a future-scheduled post', NOT future_visible, 'future_visible=' || future_visible);
  PERFORM pg_temp.record_result('RLS: anon cannot see a draft post', NOT draft_visible, 'draft_visible=' || draft_visible);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RLS: anon sees only published + past-scheduled posts', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('RLS: anon cannot see a future-scheduled post', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('RLS: anon cannot see a draft post', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- ───────────── Student submits a payment; duplicate reference rejected ───

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT public.submit_payment(
    'b3000000-0000-0000-0000-000000000001'::uuid, 25.00, 'USD', 'Tuition',
    '0880000001', '__txn-pay-0001', current_date, 'Contract test payment'
  ) INTO submission_id;
  PERFORM pg_temp.record_result('RPC: student submits a payment', submission_id IS NOT NULL, 'submission_id=' || submission_id);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: student submits a payment', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

DO $$
BEGIN
  PERFORM public.submit_payment(
    'b3000000-0000-0000-0000-000000000001'::uuid, 25.00, 'USD', 'Tuition',
    '0880000001', '__txn-pay-0001', current_date, 'Duplicate reference'
  );
  PERFORM pg_temp.record_result('RPC: duplicate transaction reference is rejected', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result(
    'RPC: duplicate transaction reference is rejected', SQLERRM = 'payment_reference_used', SQLSTATE || ': ' || SQLERRM
  );
END;
$$;

-- A second, independent payment used for the reject-path assertions below.
DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT public.submit_payment(
    'b3000000-0000-0000-0000-000000000001'::uuid, 10.00, 'USD', 'Books',
    '0880000001', '__txn-pay-0002', current_date, 'Second contract test payment'
  ) INTO submission_id;
  PERFORM pg_temp.record_result('RPC: student submits a second payment', submission_id IS NOT NULL, 'submission_id=' || submission_id);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: student submits a second payment', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- ───────────────── Non-reviewer is blocked from review_payment ───────────

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-0001';
  PERFORM public.review_payment(submission_id, 'confirm', 'Should be forbidden');
  PERFORM pg_temp.record_result('RLS/RPC: non-reviewer cannot review a payment', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result(
    'RLS/RPC: non-reviewer cannot review a payment', SQLERRM = 'forbidden', SQLSTATE || ': ' || SQLERRM
  );
END;
$$;
RESET ROLE;

-- ─────────── Reviewer confirms payment #1: fee row, receipt, notification,
-- ─────────── and email_outbox rows must all be created.

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  submission_id uuid;
  result jsonb;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-0001';
  SELECT public.review_payment(submission_id, 'confirm', 'Confirmed via contract test') INTO result;
  PERFORM pg_temp.record_result(
    'RPC: reviewer confirms a payment and gets a receipt number',
    result ->> 'status' = 'confirmed' AND nullif(result ->> 'receipt_number', '') IS NOT NULL,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: reviewer confirms a payment and gets a receipt number', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- Verification counts must run outside the reviewer's own RLS context: a
-- reviewer cannot SELECT another user's notifications or (without
-- settings.manage) the email_outbox, so these checks run as the
-- RLS-bypassing session role instead of impersonating the reviewer.
RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE
  submission_id uuid;
  fee_rows integer;
  notif_rows integer;
  email_rows integer;
  receipt_email_rows integer;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-0001';

  SELECT count(*) INTO fee_rows FROM public.fee_transactions
  WHERE student_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND reference = '__TXN-PAY-0001';

  SELECT count(*) INTO notif_rows FROM public.notifications
  WHERE recipient_id = 'b1000000-0000-0000-0000-000000000001'::uuid
    AND entity_type = 'payment_submission' AND entity_id = submission_id AND kind = 'payment_confirmed';

  SELECT count(*) INTO email_rows FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid;

  SELECT count(*) INTO receipt_email_rows FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND template = 'payment_receipt';

  PERFORM pg_temp.record_result('confirm: inserts a fee_transactions row', fee_rows = 1, 'rows=' || fee_rows);
  PERFORM pg_temp.record_result('confirm: notifies the student', notif_rows = 1, 'rows=' || notif_rows);
  PERFORM pg_temp.record_result('confirm: queues a payment_receipt email', receipt_email_rows = 1, 'rows=' || receipt_email_rows);
  -- Exactly one, not merely "at least one": the notifications->email bridge
  -- must skip 'payment_confirmed' (it already got the dedicated receipt
  -- email above), or the student gets duplicate mail for one decision.
  PERFORM pg_temp.record_result('confirm: queues exactly one email_outbox row for the student', email_rows = 1, 'rows=' || email_rows);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('confirm: inserts a fee_transactions row', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('confirm: notifies the student', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('confirm: queues a payment_receipt email', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('confirm: queues exactly one email_outbox row for the student', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- Reviewer rejects payment #2: requires a note, and queues a payment_rejected email.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-0002';
  PERFORM public.review_payment(submission_id, 'reject', '');
  PERFORM pg_temp.record_result('RPC: reject without a note is rejected', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result(
    'RPC: reject without a note is rejected', SQLERRM = 'rejection_note_required', SQLSTATE || ': ' || SQLERRM
  );
END;
$$;

DO $$
DECLARE
  submission_id uuid;
  result jsonb;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-0002';
  SELECT public.review_payment(submission_id, 'reject', 'Reference did not match our records.') INTO result;
  PERFORM pg_temp.record_result('RPC: reviewer rejects a payment with a note', result ->> 'status' = 'rejected', result::text);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: reviewer rejects a payment with a note', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- Again, verify outside the reviewer's own RLS context (see note above).
RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE
  submission_id uuid;
  rejected_email_rows integer;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-0002';
  SELECT count(*) INTO rejected_email_rows FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND template = 'payment_rejected';
  PERFORM pg_temp.record_result('reject: queues a payment_rejected email', rejected_email_rows = 1, 'rows=' || rejected_email_rows);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('reject: queues a payment_rejected email', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- One email per decision, overall: this student's two reviewed submissions
-- (one confirmed, one rejected) must have produced exactly two emails in
-- total -- the dedicated payment_receipt and payment_rejected ones -- and
-- no extra generic 'notification' template rows from the bridge trigger.
DO $$
DECLARE
  total_email_rows integer;
  generic_notification_rows integer;
BEGIN
  SELECT count(*) INTO total_email_rows FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid;

  SELECT count(*) INTO generic_notification_rows FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND template = 'notification';

  PERFORM pg_temp.record_result(
    'email dedupe: exactly one email per payment decision',
    total_email_rows = 2 AND generic_notification_rows = 0,
    'total=' || total_email_rows || ' generic_notification=' || generic_notification_rows
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('email dedupe: exactly one email per payment decision', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- ────────── Resubmission with the same reference is allowed once the ──────
-- ────────── earlier submission using it was rejected ──────────────────────

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT public.submit_payment(
    'b3000000-0000-0000-0000-000000000001'::uuid, 10.00, 'USD', 'Books',
    '0880000001', '__txn-pay-0002', current_date, 'Resubmitted after rejection'
  ) INTO submission_id;
  PERFORM pg_temp.record_result('RPC: resubmission after rejection is allowed', submission_id IS NOT NULL, 'submission_id=' || submission_id);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: resubmission after rejection is allowed', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

-- ───────── LRD confirmation: a USD ledger amount is required and used ────
-- fee_transactions carries no currency column, so an LRD submission must
-- have its USD-equivalent amount supplied by the reviewer at confirm time.

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT public.submit_payment(
    'b3000000-0000-0000-0000-000000000001'::uuid, 20000.00, 'LRD', 'Tuition',
    '0880000001', '__txn-pay-lrd-0001', current_date, 'LRD contract test payment'
  ) INTO submission_id;
  PERFORM pg_temp.record_result('RPC: student submits an LRD payment', submission_id IS NOT NULL, 'submission_id=' || submission_id);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: student submits an LRD payment', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE submission_id uuid;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-LRD-0001';
  PERFORM public.review_payment(submission_id, 'confirm', 'Confirmed via contract test');
  PERFORM pg_temp.record_result('RPC: LRD confirmation without a ledger amount is rejected', false, 'RPC unexpectedly succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result(
    'RPC: LRD confirmation without a ledger amount is rejected', SQLERRM = 'ledger_amount_required', SQLSTATE || ': ' || SQLERRM
  );
END;
$$;

DO $$
DECLARE
  submission_id uuid;
  result jsonb;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-LRD-0001';
  SELECT public.review_payment(submission_id, 'confirm', 'Confirmed via contract test', 90.00) INTO result;
  PERFORM pg_temp.record_result(
    'RPC: reviewer confirms an LRD payment with a USD ledger amount',
    result ->> 'status' = 'confirmed' AND nullif(result ->> 'receipt_number', '') IS NOT NULL,
    result::text
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('RPC: reviewer confirms an LRD payment with a USD ledger amount', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE
  submission_id uuid;
  fee_amount numeric;
  fee_reference text;
  ledger_amount numeric;
BEGIN
  SELECT id INTO submission_id FROM public.payment_submissions WHERE transaction_reference = '__TXN-PAY-LRD-0001';

  SELECT amount, reference INTO fee_amount, fee_reference FROM public.fee_transactions
  WHERE student_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND reference LIKE '__TXN-PAY-LRD-0001%';

  SELECT ledger_amount_usd INTO ledger_amount FROM public.payment_submissions WHERE id = submission_id;

  PERFORM pg_temp.record_result(
    'LRD confirm: fee_transactions amount is the USD ledger amount', fee_amount = 90.00, 'amount=' || fee_amount
  );
  PERFORM pg_temp.record_result(
    'LRD confirm: fee_transactions reference mentions the original LRD amount',
    fee_reference = '__TXN-PAY-LRD-0001 (LRD 20000.00)', 'reference=' || fee_reference
  );
  PERFORM pg_temp.record_result(
    'LRD confirm: payment_submissions.ledger_amount_usd is set', ledger_amount = 90.00, 'ledger_amount_usd=' || ledger_amount
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('LRD confirm: fee_transactions amount is the USD ledger amount', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('LRD confirm: fee_transactions reference mentions the original LRD amount', false, SQLSTATE || ': ' || SQLERRM);
  PERFORM pg_temp.record_result('LRD confirm: payment_submissions.ledger_amount_usd is set', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- ───────────── Stale `sending` emails are reclaimed by retry_failed_emails ─

DO $$
DECLARE
  stale_email_id uuid;
BEGIN
  SELECT id INTO stale_email_id FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND template = 'payment_receipt'
  LIMIT 1;

  -- email_outbox_touch (BEFORE UPDATE) always rewrites updated_at to now(),
  -- so it must be disabled briefly to fabricate a stale "sending" fixture row.
  ALTER TABLE public.email_outbox DISABLE TRIGGER email_outbox_touch;
  UPDATE public.email_outbox
    SET status = 'sending', updated_at = now() - interval '20 minutes'
    WHERE id = stale_email_id;
  ALTER TABLE public.email_outbox ENABLE TRIGGER email_outbox_touch;
END;
$$;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000004', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  reclaimed_count int;
BEGIN
  SELECT public.retry_failed_emails() INTO reclaimed_count;
  PERFORM pg_temp.record_result('retry_failed_emails: reclaims a stale sending row', reclaimed_count >= 1, 'reclaimed_count=' || reclaimed_count);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('retry_failed_emails: reclaims a stale sending row', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
DECLARE
  stale_status text;
BEGIN
  SELECT status INTO stale_status FROM public.email_outbox
  WHERE related_user_id = 'b1000000-0000-0000-0000-000000000001'::uuid AND template = 'payment_receipt'
  LIMIT 1;
  PERFORM pg_temp.record_result('retry_failed_emails: stale row is back to queued', stale_status = 'queued', 'status=' || stale_status);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.record_result('retry_failed_emails: stale row is back to queued', false, SQLSTATE || ': ' || SQLERRM);
END;
$$;

-- Surface all assertion outcomes before rollback. This SELECT does not persist.
SELECT name, passed, detail FROM pg_temp.test_results ORDER BY name;
SELECT count(*) AS failed_contracts FROM pg_temp.test_results WHERE NOT passed;
SELECT CASE WHEN count(*) = 25 AND bool_and(passed) THEN 'true' ELSE 'false' END AS contracts_passed
FROM pg_temp.test_results;
\gset

-- Mandatory final statement: all migration DDL, fixture auth accounts,
-- RLS policies, triggers, bucket, and synthetic domain rows are discarded.
ROLLBACK;
\echo ROLLBACK completed: no transaction-scoped changes were committed.
\if :contracts_passed
\echo BLOG_EMAIL_PAYMENTS_CONTRACT_RESULT:PASS
\else
\echo BLOG_EMAIL_PAYMENTS_CONTRACT_RESULT:FAIL
SELECT 1 / 0;
\endif
