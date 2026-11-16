-- 1:1 direct messages (durable storage for the directory chat).
-- The app works without this table (localStorage + realtime broadcast
-- fallback), but deploying it keeps history across devices.
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint direct_messages_no_self check (sender_id <> receiver_id)
);

create index if not exists direct_messages_pair_idx
  on public.direct_messages (sender_id, receiver_id, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "Members read own chats" on public.direct_messages;
create policy "Members read own chats" on public.direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Members send chats" on public.direct_messages;
create policy "Members send chats" on public.direct_messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists "Receivers mark seen" on public.direct_messages;
create policy "Receivers mark seen" on public.direct_messages
  for update using (auth.uid() = receiver_id or auth.uid() = sender_id);
