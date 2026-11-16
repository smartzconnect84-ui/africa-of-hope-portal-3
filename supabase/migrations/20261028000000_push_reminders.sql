-- f65 — Push reminders for deadlines
--
-- Three tables, all user-scoped:
--   reminder_settings     the student's switches (mirrors the on-device copy)
--   reminder_items        upcoming lesson/assignment/fee/announcement items the
--                         app has queued while it was last open, so the sender
--                         can alert a closed PWA
--   push_subscriptions    the browser push subscription (endpoint + keys)
--
-- Delivery is performed by supabase/functions/send-deadline-reminders, which
-- needs the VAPID secrets below. Nothing here claims background delivery on its
-- own: without that function deployed and scheduled the app still shows
-- reminders while it is open, and says so in the UI.

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  lessons boolean not null default true,
  fees boolean not null default true,
  announcements boolean not null default true,
  window_hours int not null default 24 check (window_hours between 1 and 168),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  kind text not null check (kind in ('lesson', 'assignment', 'fee', 'announcement')),
  title text not null,
  body text not null default '',
  url text not null default '/',
  due_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, item_key)
);

create index if not exists reminder_items_due_idx
  on public.reminder_items (due_at)
  where sent_at is null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id)
  where enabled;

alter table public.reminder_settings enable row level security;
alter table public.reminder_items enable row level security;
alter table public.push_subscriptions enable row level security;

-- Students (and staff, for their own account) manage only their own rows.
drop policy if exists reminder_settings_own on public.reminder_settings;
create policy reminder_settings_own on public.reminder_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists reminder_items_own on public.reminder_items;
create policy reminder_items_own on public.reminder_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deployment steps (Supabase dashboard / CLI):
--   1. Apply this migration.
--   2. supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:info@africaofhope.org
--   3. supabase functions deploy send-deadline-reminders
--   4. Schedule it (e.g. every 15 minutes) with pg_cron + pg_net, or the dashboard cron.
--   5. Set VITE_VAPID_PUBLIC_KEY in the app's environment to the same public key.
-- Until steps 2-5 are done, reminders fire only while the app is open.
