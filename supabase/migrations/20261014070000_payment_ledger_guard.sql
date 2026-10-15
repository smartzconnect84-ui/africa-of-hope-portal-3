-- Payment ledger guard. Idempotent: safe to re-run.
--
-- 1. review_payment() checks p_ledger_amount_usd > 0 before it is rounded to
--    numeric(12,2). A value such as 0.004 passes that check and then rounds
--    to 0.00. This constraint rejects a zero ledger amount, so the whole
--    review_payment() call rolls back instead of crediting USD 0.00.
--
-- 2. Correction to 20261014060000_payments_email_hardening.sql, section 7:
--    pg_net grants EXECUTE/SELECT to PUBLIC as supabase_admin. The postgres
--    migration role cannot revoke a PUBLIC grant it did not make, so anon and
--    authenticated keep those privileges at the SQL level. The `net` schema
--    is not exposed by the Data API (PostgREST answers PGRST106 "Only the
--    following schemas are exposed: public, graphql_public"), so API clients
--    cannot reach net.http_* or the request queue. Keep `net` out of the
--    exposed schemas.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_submissions_ledger_amount_positive'
      and conrelid = 'public.payment_submissions'::regclass
  ) then
    alter table public.payment_submissions
      add constraint payment_submissions_ledger_amount_positive
      check (ledger_amount_usd is null or ledger_amount_usd > 0);
  end if;
end $$;
