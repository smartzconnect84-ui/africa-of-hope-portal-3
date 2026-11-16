-- Payments/email code-review hardening. Idempotent: safe to re-run.
--
-- Migrations 20261014040000_blog_email_payments.sql and
-- 20261014050000_backend_hardening.sql are already applied to production, so
-- every fix below lands as new DDL/DML here rather than editing those files.
--
-- Findings addressed (see PR #6 code review):
--  1. Ledger currency bug: fee_transactions has no currency column and every
--     existing balance assumes USD. review_payment() now gets a 4th
--     parameter, p_ledger_amount_usd, required (and > 0) for LRD
--     confirmations, and writes that USD amount to both
--     fee_transactions.amount and the new payment_submissions.ledger_amount_usd
--     column. The LRD amount is preserved in the fee_transactions.reference
--     text instead (e.g. "<TXN> (LRD 20000.00)").
--  2. Email recipient: use the verified auth.users.email, never the
--     self-editable profiles.email, when enqueueing notification/payment
--     emails.
--  3. Duplicate emails: the notifications->email trigger now skips
--     'payment_confirmed'/'payment_rejected' kinds, which already get a
--     dedicated email from review_payment().
--  4. Transaction ID reuse: a rejected submission no longer blocks reusing
--     its transaction_reference. The old table-wide unique constraint is
--     replaced with a partial unique index that ignores rejected rows, and
--     submit_payment()'s duplicate check is kept consistent with it.
--  6. Backlog policy: emails older than 72h that are still queued are
--     expired here once for any existing rows; supabase/functions/send-email
--     repeats this check on every run (see that file for the ongoing half).
--  7. Revoke default PUBLIC grants on pg_net surfaces and the receipt
--     sequence from anon/authenticated.
--  8. Drop the public SELECT (listing) policy on storage.objects for
--     blog-covers; the bucket is still public (its files are still
--     reachable at /storage/v1/object/public/blog-covers/<path>, which is
--     controlled by storage.buckets.public and does not consult this RLS
--     policy at all). blog_covers_manage_all (blog.manage) still grants
--     managers full access including listing.
--  9. Receipt numbers no longer truncate once the sequence passes 999999:
--     lpad's target width is now `greatest(6, length(n))` instead of a flat 6.
-- 10. submit_payment() now validates payer_phone, category length and note
--     length server-side (the client already does similar checks, but the
--     RPC is the real trust boundary).
--
-- (5. stale `sending` reclaim, 11. constant-time cron-secret compare and the
-- rest of 6/2 live in supabase/functions/send-email/index.ts, which is
-- redeployed after this migration lands.)

-- ───────────────── 1. payment_submissions.ledger_amount_usd ──────────────

alter table public.payment_submissions
  add column if not exists ledger_amount_usd numeric(12, 2);

comment on column public.payment_submissions.ledger_amount_usd is
  'USD amount actually posted to fee_transactions for this submission. '
  'Equal to amount for USD submissions; for LRD submissions it is the '
  'USD equivalent entered by the reviewer at confirmation time (the ledger '
  'is USD-only).';

-- ──────────── 4. Transaction ID reuse after rejection is allowed ─────────

alter table public.payment_submissions
  drop constraint if exists payment_submissions_provider_reference_key;

drop index if exists payment_submissions_provider_reference_active_key;
create unique index payment_submissions_provider_reference_active_key
  on public.payment_submissions (provider, transaction_reference)
  where status <> 'rejected';

-- ───────────────────── 2/3. Fixed notification->email bridge ────────────

create or replace function public._enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text;
  v_name text;
begin
  -- payment_confirmed / payment_rejected already get a dedicated, richer
  -- email (payment_receipt / payment_rejected templates) from
  -- review_payment() below. Enqueueing the generic 'notification' email too
  -- would send the student two emails for one decision.
  if new.kind in ('payment_confirmed', 'payment_rejected') then
    return new;
  end if;

  -- The verified login identity's email, not the self-editable
  -- public.profiles.email column.
  select u.email, coalesce(p.full_name, p.name, '')
    into v_email, v_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = new.recipient_id;

  if v_email is not null and length(btrim(v_email)) > 0 then
    perform public.enqueue_email(
      v_email, v_name, 'notification', new.title,
      jsonb_build_object('title', new.title, 'body', new.body, 'entity_type', new.entity_type, 'entity_id', new.entity_id),
      new.recipient_id,
      'notification:' || new.id::text
    );
  end if;

  return new;
end;
$fn$;

-- ──────── 5. retry_failed_emails() also reclaims stale `sending` rows ────

create or replace function public.retry_failed_emails()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_failed_count int;
  v_stale_count int;
begin
  if not public.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.email_outbox
    set status = 'queued', attempts = 0, last_error = null, send_after = now(), updated_at = now()
    where status = 'failed';
  get diagnostics v_failed_count = row_count;

  -- A row stuck in `sending` (e.g. the edge function crashed mid-send)
  -- never reaches 'failed', so the above update alone would never recover
  -- it. Anything claimed more than 15 minutes ago is treated as abandoned.
  update public.email_outbox
    set status = 'queued', attempts = coalesce(attempts, 0), last_error = 'reclaimed after being stuck in sending', send_after = now(), updated_at = now()
    where status = 'sending' and updated_at < now() - interval '15 minutes';
  get diagnostics v_stale_count = row_count;

  return v_failed_count + v_stale_count;
end;
$fn$;

revoke all on function public.retry_failed_emails() from public, anon;
grant execute on function public.retry_failed_emails() to authenticated;

-- ───── 10. submit_payment(): server-side phone/category/note validation,
-- ───── and the duplicate-reference check now matches the partial index ───

create or replace function public.submit_payment(
  p_channel_id uuid,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_payer_phone text,
  p_transaction_reference text,
  p_paid_on date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reference text;
  v_provider text;
  v_submission_id uuid;
  v_category text;
  v_phone text;
  v_phone_digits text;
  v_note text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.has_permission('payments.submit') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'Active') then
    raise exception 'active_account_required' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if coalesce(p_currency, '') not in ('USD', 'LRD') then
    raise exception 'invalid_currency' using errcode = 'P0001';
  end if;
  if p_paid_on is null then
    raise exception 'paid_on_required' using errcode = 'P0001';
  end if;
  if p_channel_id is null then
    raise exception 'channel_required' using errcode = 'P0001';
  end if;

  v_phone := btrim(coalesce(p_payer_phone, ''));
  v_phone_digits := regexp_replace(v_phone, '[[:space:]-]', '', 'g');
  if v_phone_digits !~ '^\+?[0-9]{7,15}$' then
    raise exception 'invalid_payer_phone' using errcode = 'P0001';
  end if;

  v_category := coalesce(nullif(btrim(p_category), ''), 'Tuition');
  if length(v_category) > 60 then
    raise exception 'category_too_long' using errcode = 'P0001';
  end if;

  v_note := coalesce(p_note, '');
  if length(v_note) > 500 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;

  v_reference := upper(btrim(coalesce(p_transaction_reference, '')));
  if length(v_reference) < 4 or length(v_reference) > 64 then
    raise exception 'invalid_transaction_reference' using errcode = 'P0001';
  end if;

  select provider into v_provider from public.payment_channels where id = p_channel_id and active;
  if v_provider is null then
    raise exception 'channel_not_found' using errcode = 'P0002';
  end if;

  -- Mirrors payment_submissions_provider_reference_active_key: a reference
  -- can be reused once its earlier submission was rejected.
  if exists (
    select 1 from public.payment_submissions
    where provider = v_provider and transaction_reference = v_reference and status <> 'rejected'
  ) then
    raise exception 'payment_reference_used' using errcode = 'P0001';
  end if;

  insert into public.payment_submissions (
    student_id, channel_id, provider, amount, currency, category,
    payer_phone, transaction_reference, paid_on, note
  ) values (
    auth.uid(), p_channel_id, v_provider, p_amount, p_currency,
    v_category, v_phone, v_reference, p_paid_on, v_note
  )
  returning id into v_submission_id;

  insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
  select p.id, 'payment_submitted', 'New mobile money payment reported',
    'A ' || v_provider || ' payment of ' || p_currency || ' ' || p_amount::text || ' was reported for review.',
    'payment_submission', v_submission_id
  from public.profiles p
  where p.status = 'Active'
    and (p.role = 'Super Admin' or exists (
      select 1 from public.role_permissions rp where rp.role = p.role and rp.permission = 'payments.confirm'
    ));

  return v_submission_id;
exception when unique_violation then
  raise exception 'payment_reference_used' using errcode = 'P0001';
end;
$fn$;

revoke all on function public.submit_payment(uuid, numeric, text, text, text, text, date, text) from public, anon;
grant execute on function public.submit_payment(uuid, numeric, text, text, text, text, date, text) to authenticated;

-- ───── 1/2/9. review_payment(): new 4-arg signature with the LRD ledger ──
-- ───── amount, auth.users.email, and the uncapped receipt lpad width ─────

drop function if exists public.review_payment(uuid, text, text);

create or replace function public.review_payment(
  p_submission_id uuid,
  p_decision text,
  p_note text,
  p_ledger_amount_usd numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sub public.payment_submissions%rowtype;
  v_method text;
  v_fee_id uuid;
  v_receipt text;
  v_seq bigint;
  v_student_email text;
  v_student_name text;
  v_ledger_amount numeric(12, 2);
  v_fee_reference text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.has_permission('payments.confirm') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if coalesce(p_decision, '') not in ('confirm', 'reject') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'reject' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'rejection_note_required' using errcode = 'P0001';
  end if;

  select * into v_sub from public.payment_submissions where id = p_submission_id for update;
  if v_sub.id is null then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if v_sub.status <> 'pending' then raise exception 'payment_not_pending' using errcode = 'P0001'; end if;

  -- The verified login identity's email, not the self-editable
  -- public.profiles.email column.
  select u.email, coalesce(p.full_name, p.name, '')
    into v_student_email, v_student_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_sub.student_id;

  if p_decision = 'confirm' then
    v_method := case v_sub.provider
      when 'mtn_momo' then 'MTN MoMo'
      when 'orange_money' then 'Orange Money'
      else v_sub.provider
    end;

    -- fee_transactions carries no currency column: the ledger is USD-only.
    -- A USD submission posts its own amount; an LRD submission requires the
    -- reviewer to supply the USD amount actually credited, and keeps the
    -- original LRD amount visible in the reference text instead.
    if v_sub.currency = 'USD' then
      v_ledger_amount := v_sub.amount;
      v_fee_reference := v_sub.transaction_reference;
    else
      if p_ledger_amount_usd is null or p_ledger_amount_usd <= 0 then
        raise exception 'ledger_amount_required' using errcode = 'P0001';
      end if;
      v_ledger_amount := p_ledger_amount_usd;
      v_fee_reference := v_sub.transaction_reference || ' (LRD ' || v_sub.amount::text || ')';
    end if;

    insert into public.fee_transactions (student_id, category, amount, transaction_date, method, reference)
    values (v_sub.student_id, v_sub.category, v_ledger_amount, v_sub.paid_on, v_method, v_fee_reference)
    returning id into v_fee_id;

    v_seq := nextval('public.payment_receipt_seq');
    v_receipt := 'AOH-RCPT-' || to_char(now(), 'YYYY') || '-'
      || lpad(v_seq::text, greatest(6, length(v_seq::text)), '0');

    update public.payment_submissions
      set status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = coalesce(p_note, ''), fee_transaction_id = v_fee_id, receipt_number = v_receipt,
          ledger_amount_usd = v_ledger_amount
      where id = p_submission_id;

    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    values (
      v_sub.student_id, 'payment_confirmed', 'Payment confirmed',
      'Your ' || v_method || ' payment of ' || v_sub.currency || ' ' || v_sub.amount::text
        || ' was confirmed. Receipt ' || v_receipt || '.',
      'payment_submission', p_submission_id
    );

    perform public.enqueue_email(
      v_student_email, v_student_name, 'payment_receipt',
      'Your Africa of Hope payment receipt ' || v_receipt,
      jsonb_build_object(
        'receipt_number', v_receipt, 'amount', v_sub.amount, 'currency', v_sub.currency,
        'ledger_amount_usd', v_ledger_amount,
        'category', v_sub.category, 'method', v_method, 'paid_on', v_sub.paid_on,
        'transaction_reference', v_sub.transaction_reference
      ),
      v_sub.student_id,
      'payment_receipt:' || p_submission_id::text
    );

    return jsonb_build_object('id', p_submission_id, 'status', 'confirmed', 'receipt_number', v_receipt);
  else
    update public.payment_submissions
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
      where id = p_submission_id;

    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    values (
      v_sub.student_id, 'payment_rejected', 'Payment report was rejected',
      coalesce(nullif(p_note, ''), 'Your reported payment could not be confirmed.'),
      'payment_submission', p_submission_id
    );

    perform public.enqueue_email(
      v_student_email, v_student_name, 'payment_rejected',
      'Your Africa of Hope payment report needs attention',
      jsonb_build_object(
        'amount', v_sub.amount, 'currency', v_sub.currency, 'category', v_sub.category,
        'transaction_reference', v_sub.transaction_reference, 'review_note', p_note
      ),
      v_sub.student_id,
      'payment_rejected:' || p_submission_id::text
    );

    return jsonb_build_object('id', p_submission_id, 'status', 'rejected', 'receipt_number', null);
  end if;
end;
$fn$;

revoke all on function public.review_payment(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.review_payment(uuid, text, text, numeric) to authenticated;

-- ──────────────── 6. Backlog policy: expire old queued emails ───────────
-- Documented in supabase/functions/send-email/index.ts, which repeats this
-- on every run so new backlog keeps getting expired. This is the one-time
-- sweep for whatever already exists in production.

update public.email_outbox
set status = 'skipped', last_error = 'expired before a provider was configured', updated_at = now()
where status = 'queued' and created_at < now() - interval '72 hours';

-- ─────────────────── 7. Revoke default PUBLIC grants ─────────────────────
-- pg_net ships with EXECUTE/SELECT granted to PUBLIC by default, so every
-- anon/authenticated session could queue arbitrary outbound HTTP requests
-- or read other callers' request/response rows. Only the migration role
-- (which owns the SECURITY DEFINER cron dispatcher) needs it.

do $$
begin
  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is not null then
    revoke execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) from anon, authenticated;
  end if;
  if to_regprocedure('net.http_get(text, jsonb, jsonb, integer)') is not null then
    revoke execute on function net.http_get(text, jsonb, jsonb, integer) from anon, authenticated;
  end if;
  if to_regprocedure('net.http_delete(text, jsonb, jsonb, integer, jsonb)') is not null then
    revoke execute on function net.http_delete(text, jsonb, jsonb, integer, jsonb) from anon, authenticated;
  end if;
  if to_regclass('net.http_request_queue') is not null then
    revoke select on net.http_request_queue from anon, authenticated;
  end if;
  if to_regclass('net._http_response') is not null then
    revoke select on net._http_response from anon, authenticated;
  end if;
exception when others then
  raise notice 'net.* revoke skipped: %', sqlerrm;
end $$;

revoke usage, update, select on sequence public.payment_receipt_seq from anon, authenticated;

-- ─────────── 8. Drop the public listing policy on blog-covers ────────────
-- The bucket stays public (storage.buckets.public = true), so direct object
-- URLs keep working; this only removes anon/authenticated's ability to run
-- storage.objects SELECT queries (e.g. list()) against it. blog.manage
-- holders keep full access via blog_covers_manage_all.

drop policy if exists blog_covers_public_read on storage.objects;
