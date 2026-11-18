-- AFRICA OF HOPE — push without the one-minute wait, and retry what fails.
--
-- Two gaps in 20261118090000_push_all_notifications.sql:
--
--   1. LATENCY. The only thing that woke the dispatcher was the pg_cron job
--      `aoh-dispatch-push` running every minute, so a message could sit in the
--      outbox for up to 60 seconds. The notification trigger now calls the
--      dispatcher itself (net.http_post is asynchronous, so the insert is not
--      held up), and pg_cron stays as the safety net.
--
--   2. RETRIES. A claim that failed — "All included players are not subscribed",
--      a device that has not opened the app yet, a transient OneSignal error —
--      was written as `failed` and never looked at again. Failed rows are now
--      retried with backoff (1m, 2m, 5m, 15m, 5 attempts) and rows stuck in
--      `sending` because a dispatch died mid-flight are reclaimed after ten
--      minutes.
--
-- A notification that the browser already pushed (the admin composer and the
-- direct-message sender do their own OneSignal call) is inserted with
-- `push_suppressed = true`, so the new instant dispatch cannot send it twice.

begin;

alter table public.notification_outbox
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_error text;

alter table public.notifications
  add column if not exists push_suppressed boolean not null default false;

create index if not exists notification_outbox_retry_idx
  on public.notification_outbox (coalesce(next_attempt_at, created_at))
  where status in ('queued', 'failed', 'sending');

-- Atomic claim: only one dispatcher can take a row, and the candidates are
-- exactly the rows that are due — fresh, failed-but-retryable, or abandoned.
create or replace function public._claim_push_rows(p_limit integer default 25)
returns table (id uuid, title text, body text, url text, recipient_id uuid, attempts integer)
language sql
security definer
set search_path to 'public'
as $$
  with candidate as (
    select o.id
    from public.notification_outbox o
    where o.recipient_id is not null
      and (
        o.status = 'queued'
        or (o.status = 'failed' and o.attempts < 5
            and coalesce(o.next_attempt_at, o.created_at) <= now())
        or (o.status = 'sending'
            and coalesce(o.last_attempt_at, o.created_at) < now() - interval '10 minutes')
      )
    order by o.created_at
    limit greatest(1, least(coalesce(p_limit, 25), 50))
    for update skip locked
  )
  update public.notification_outbox o
     set status = 'sending',
         attempts = o.attempts + 1,
         last_attempt_at = now(),
         next_attempt_at = null
    from candidate c
   where o.id = c.id
  returning o.id, o.title, o.body, o.url, o.recipient_id, o.attempts;
$$;

revoke all on function public._claim_push_rows(integer) from public, anon, authenticated;
grant execute on function public._claim_push_rows(integer) to service_role;

-- Queue the push, then wake the dispatcher immediately instead of waiting for
-- the next cron tick. Failures here must never block the notification itself.
create or replace function public._queue_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recipient uuid := coalesce(new.recipient_id, new.user_id);
  v_queued boolean := false;
begin
  if coalesce(new.push_suppressed, false) then
    return new;
  end if;

  if v_recipient is null then
    return new;
  end if;

  insert into public.notification_outbox
    (idempotency_key, title, body, url, audience, recipient_id, notification_id, status)
  values (
    'notif:' || new.id::text,
    coalesce(nullif(btrim(coalesce(new.title, '')), ''), 'AFRICA OF HOPE'),
    coalesce(nullif(btrim(coalesce(new.body, '')), ''), 'You have a new update in the portal.'),
    coalesce(nullif(btrim(coalesce(new.url, '')), ''), '#notifications'),
    'user',
    v_recipient,
    new.id,
    'queued'
  )
  on conflict (notification_id) do nothing;
  v_queued := found;

  if v_queued then
    perform public._cron_dispatch_push();
  end if;

  return new;
exception when others then
  return new;
end;
$$;

-- Safety-net sweep: also fires for retries that have come due.
create or replace function public._cron_dispatch_push()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url text := 'https://gatnzfjpuokopqyksqoy.supabase.co/functions/v1/onesignal-send';
  v_token text;
begin
  if not exists (
    select 1 from public.notification_outbox o
    where o.recipient_id is not null
      and (
        o.status = 'queued'
        or (o.status = 'failed' and o.attempts < 5
            and coalesce(o.next_attempt_at, o.created_at) <= now())
        or (o.status = 'sending'
            and coalesce(o.last_attempt_at, o.created_at) < now() - interval '10 minutes')
      )
  ) then
    return;
  end if;

  select token into v_token from public.push_dispatch_token where id limit 1;
  if v_token is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-dispatch', v_token),
    body := jsonb_build_object('action', 'dispatch', 'limit', 25)
  );
end;
$$;

revoke all on function public._queue_push_for_notification() from public, anon, authenticated;
revoke all on function public._cron_dispatch_push() from public, anon, authenticated;

-- Re-arm rows the old dispatcher left behind so the sweep can pick them up.
update public.notification_outbox
   set status = 'queued', next_attempt_at = null
 where status = 'failed'
   and attempts < 5
   and recipient_id is not null
   and coalesce(last_attempt_at, created_at) > now() - interval '2 days'
   and (last_error is null or last_error ilike '%not subscribed%');

commit;
