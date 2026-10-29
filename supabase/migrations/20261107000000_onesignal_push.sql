-- DEPLOY — 20261107000000_onesignal_push.sql — OneSignal push backend (additive, no data loss).
-- Run AFTER pending earlier migrations. Safe to re-run? No — run once.
-- Creates: notification_outbox (admin send log + idempotency), onesignal_devices
-- (browser subscription registry keyed by external user id), and ensures the
-- in-app notifications table exists for the notification center.

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  title text not null,
  body text not null,
  url text not null default '/',
  audience text not null default 'all',
  course_id text,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  provider_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.onesignal_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  subscription_id text,
  role_tag text,
  opted_in boolean not null default true,
  user_agent text,
  updated_at timestamptz not null default now(),
  unique(user_id, subscription_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/',
  kind text not null default 'announcement',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notification_outbox enable row level security;
alter table public.onesignal_devices enable row level security;
alter table public.notifications enable row level security;

-- Users read/update ONLY their own in-app + device rows.
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "own devices all" on public.onesignal_devices;
create policy "own devices all" on public.onesignal_devices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Outbox: staff may read history; inserts happen via the service-role Edge Function only.
drop policy if exists "staff outbox read" on public.notification_outbox;
create policy "staff outbox read" on public.notification_outbox for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin','super_admin','registrar','support','teacher','instructor','admissions'))
);

create index if not exists idx_outbox_created on public.notification_outbox (created_at desc);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_devices_user on public.onesignal_devices (user_id);
