-- AFRICA OF HOPE — device push for EVERY notification, not just direct messages.
--
-- Before this migration only two things reached a phone: a direct message (the
-- sender's browser called onesignal-send) and an admin broadcast. Payments,
-- grades, attendance, schedule changes, course windows and every other routine
-- that inserts public.notifications wrote an in-app row only, so a member
-- learned about them by opening the portal.
--
-- The chain is now server-side and does not depend on anyone's browser:
--   insert on public.notifications
--     -> notification_outbox row (status 'queued', recipient_id set)
--     -> pg_cron every minute calls _cron_dispatch_push()
--     -> net.http_post to the onesignal-send Edge Function with an internal token
--     -> one targeted OneSignal push per recipient
--
-- No VAPID key pair is involved: OneSignal owns the web-push sender, so a
-- deployment without VITE_VAPID_PUBLIC_KEY still gets real device push.

begin;

-- Per-recipient dispatch needs a recipient and a link back to the notification
-- (also the idempotency guard, so one notification can never push twice).
alter table public.notification_outbox
  add column if not exists recipient_id uuid,
  add column if not exists notification_id uuid,
  add column if not exists attempts integer not null default 0,
  add column if not exists sent_at timestamptz;

create unique index if not exists notification_outbox_notification_id_key
  on public.notification_outbox (notification_id);

create index if not exists notification_outbox_queued_idx
  on public.notification_outbox (created_at)
  where status = 'queued';

-- Token that proves a dispatch request came from this database. Security
-- definer functions and the service role read it; anon/authenticated cannot
-- (RLS on, no policies). It is never exposed in a response or a log line.
create table if not exists public.push_dispatch_token (
  id boolean primary key default true check (id),
  token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.push_dispatch_token enable row level security;
revoke all on public.push_dispatch_token from anon, authenticated;
insert into public.push_dispatch_token (id) values (true) on conflict (id) do nothing;

-- Every notification becomes one queued push. Failures here must never block
-- the notification itself, so the whole body is wrapped.
create or replace function public._queue_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recipient uuid := coalesce(new.recipient_id, new.user_id);
begin
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

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists notifications_queue_push on public.notifications;
create trigger notifications_queue_push
  after insert on public.notifications
  for each row execute function public._queue_push_for_notification();

-- Cron entry point: wakes the Edge Function only when there is work.
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
    select 1 from public.notification_outbox
    where status = 'queued' and recipient_id is not null
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

-- Cron schedule (idempotent: re-running this migration replaces the job).
do $$
begin
  perform cron.unschedule('aoh-dispatch-push');
exception when others then
  null;
end $$;

select cron.schedule('aoh-dispatch-push', '* * * * *', 'select public._cron_dispatch_push();');

commit;
