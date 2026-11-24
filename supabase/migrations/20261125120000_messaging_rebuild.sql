-- Messaging rebuild: durable rich message fields, reactions and drafts.
--
-- The rebuilt Messages workspace reads and writes the existing
-- `direct_messages` / `group_messages` tables, so every conversation already
-- stored keeps its history. This migration only adds what the new UI offers on
-- top of plain text: replies, edits, soft deletes, pins, stars, reactions and
-- per-thread drafts.
--
-- The app feature-detects each of these. Without this migration the same
-- features keep working from the device cache and over the live broadcast;
-- with it they also follow the account to every device.
--
-- Idempotent: safe to run more than once.

-- ── 1:1 messages ──────────────────────────────────────────────────────────
alter table public.direct_messages
  add column if not exists reply_to uuid references public.direct_messages (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references public.profiles (id) on delete set null,
  add column if not exists starred boolean not null default false;

create index if not exists direct_messages_reply_idx on public.direct_messages (reply_to);
create index if not exists direct_messages_pinned_idx on public.direct_messages (pinned_at)
  where pinned_at is not null;

-- ── Group messages ────────────────────────────────────────────────────────
alter table public.group_messages
  add column if not exists reply_to uuid references public.group_messages (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references public.profiles (id) on delete set null,
  add column if not exists starred boolean not null default false;

create index if not exists group_messages_reply_idx on public.group_messages (reply_to);
create index if not exists group_messages_pinned_idx on public.group_messages (pinned_at)
  where pinned_at is not null;

-- Senders may edit, delete and pin their own group messages. Reading and
-- inserting are already covered by the group migrations.
drop policy if exists "group_messages_sender_update" on public.group_messages;
create policy "group_messages_sender_update" on public.group_messages
  for update using (sender_id = auth.uid() or public.is_chat_group_admin(group_id))
  with check (sender_id = auth.uid() or public.is_chat_group_admin(group_id));

-- ── Reactions ─────────────────────────────────────────────────────────────
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  message_kind text not null check (message_kind in ('dm', 'group')),
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, message_kind, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id, message_kind);

alter table public.message_reactions enable row level security;

drop policy if exists "message_reactions_read" on public.message_reactions;
create policy "message_reactions_read" on public.message_reactions
  for select using (
    user_id = auth.uid()
    or (
      message_kind = 'dm'
      and exists (
        select 1 from public.direct_messages d
        where d.id = message_id and (d.sender_id = auth.uid() or d.receiver_id = auth.uid())
      )
    )
    or (
      message_kind = 'group'
      and public.is_chat_group_member(
        (select g.group_id from public.group_messages g where g.id = message_id)
      )
    )
  );

drop policy if exists "message_reactions_insert" on public.message_reactions;
create policy "message_reactions_insert" on public.message_reactions
  for insert with check (
    user_id = auth.uid()
    and (
      (
        message_kind = 'dm'
        and exists (
          select 1 from public.direct_messages d
          where d.id = message_id and (d.sender_id = auth.uid() or d.receiver_id = auth.uid())
        )
      )
      or (
        message_kind = 'group'
        and public.is_chat_group_member(
          (select g.group_id from public.group_messages g where g.id = message_id)
        )
      )
    )
  );

drop policy if exists "message_reactions_delete" on public.message_reactions;
create policy "message_reactions_delete" on public.message_reactions
  for delete using (user_id = auth.uid());

-- ── Drafts ────────────────────────────────────────────────────────────────
create table if not exists public.chat_drafts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_key text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, thread_key)
);

alter table public.chat_drafts enable row level security;

drop policy if exists "chat_drafts_own" on public.chat_drafts;
create policy "chat_drafts_own" on public.chat_drafts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.chat_drafts is
  'Per-conversation message drafts. The workspace mirrors these locally so a draft survives an offline reload.';
comment on table public.message_reactions is
  'Emoji reactions on 1:1 and group messages, addressed by message_kind + message_id.';
