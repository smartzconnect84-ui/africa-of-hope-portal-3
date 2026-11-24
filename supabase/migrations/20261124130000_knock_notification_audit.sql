create table if not exists public.knock_notification_events (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null,
  recipient_uuid uuid not null,
  actor_uuid uuid,
  category text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.knock_notification_events enable row level security;

create policy knock_events_staff_read on public.knock_notification_events
  for select to authenticated
  using (public.is_staff());

create index if not exists knock_events_recipient_idx on public.knock_notification_events (recipient_uuid, created_at desc);
