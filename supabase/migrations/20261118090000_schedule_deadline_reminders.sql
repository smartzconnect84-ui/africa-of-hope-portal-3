-- f66 — Schedule the deadline reminder sender
--
-- supabase/functions/send-deadline-reminders is deployed but nothing calls it, so a
-- closed PWA never receives its "fee balance due" / "lesson tomorrow" / "new
-- announcement" alerts. This adds the same guarded pg_cron + pg_net pattern already
-- used for send-queued-emails (20261014050000_backend_hardening.sql) and course
-- window closure (20261014080000_learning_path_attendance.sql).
--
-- Auth contract, taken from supabase/functions/send-deadline-reminders/index.ts:
-- the function requires `Authorization: Bearer <secret>` where secret is
-- REMINDER_CRON_SECRET, else CRON_SECRET, else SUPABASE_SERVICE_ROLE_KEY, compared in
-- constant time. It does NOT read the `x-cron-secret` header the email worker uses,
-- so sending that header here would produce a silent 401 on every run.
--
-- The job is inert until two Vault secrets exist. Create them from the dashboard SQL
-- editor (never from a migration, so the value never lands in git):
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/send-deadline-reminders',
--     'deadline_reminders_dispatch_url');
--   select vault.create_secret('<REMINDER_CRON_SECRET value>',
--     'deadline_reminders_cron_secret');
--
-- Then set the matching function secret so the bearer actually matches:
--
--   supabase secrets set REMINDER_CRON_SECRET=<same value> \
--     VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:info@africaofhope.org
--
-- Until that is done the schedule exists and is harmless: the dispatcher returns
-- immediately, and reminders keep appearing only while the app is open.

do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  raise notice 'pg_cron unavailable on this project (%); schedule deadline reminders externally.', sqlerrm;
end $$;

do $$
begin
  execute 'create extension if not exists pg_net';
exception when others then
  raise notice 'pg_net unavailable on this project (%); schedule deadline reminders externally.', sqlerrm;
end $$;

create or replace function public._cron_dispatch_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_url text;
  v_secret text;
begin
  -- No-op until both Vault secrets exist (never set from this file).
  if to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'deadline_reminders_dispatch_url'
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'deadline_reminders_cron_secret'
  limit 1;

  if v_url is null or v_secret is null then
    return;
  end if;

  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is null
     and to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb)') is null then
    return;
  end if;

  -- Bearer token, because that is what the function validates.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  );
end;
$fn$;

revoke all on function public._cron_dispatch_deadline_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'aoh-send-deadline-reminders') then
      perform cron.unschedule('aoh-send-deadline-reminders');
    end if;
    perform cron.schedule(
      'aoh-send-deadline-reminders',
      '*/15 * * * *',
      $job$select public._cron_dispatch_deadline_reminders();$job$
    );
  else
    raise notice 'pg_cron not enabled; call send-deadline-reminders on a schedule from outside the database instead.';
  end if;
end $$;
