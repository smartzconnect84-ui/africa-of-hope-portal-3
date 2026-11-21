-- Group chat, voice notes and file attachments.
--
-- The 1:1 thread table already exists (20261116000000_direct_messages.sql).
-- This adds the missing message payload columns, the group tables, their
-- policies, the notification trigger and the private attachment bucket.
-- It also restores the `weeks` column the Program Builder writes to
-- program_modules (the reconciled table only had `name`/`description`).

-- ── 1:1 messages: attachments and voice notes ─────────────────────────────
alter table public.direct_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text,
  add column if not exists duration_seconds integer;

alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages
  add constraint direct_messages_body_check check (char_length(body) <= 2000);
alter table public.direct_messages drop constraint if exists direct_messages_attachment_type_check;
alter table public.direct_messages
  add constraint direct_messages_attachment_type_check
  check (attachment_type is null or attachment_type in ('image', 'file', 'voice'));

-- ── Groups ────────────────────────────────────────────────────────────────
create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '',
  avatar_url text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  attachment_path text,
  attachment_type text check (attachment_type is null or attachment_type in ('image', 'file', 'voice')),
  attachment_name text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists chat_group_members_user_idx on public.chat_group_members (user_id);
create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at desc);

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace function public.is_chat_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_chat_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members m
    where m.group_id = gid
      and m.user_id = auth.uid()
      and m.member_role in ('owner', 'admin')
  );
$$;

drop policy if exists "chat_groups_read" on public.chat_groups;
create policy "chat_groups_read" on public.chat_groups
  for select using (public.is_chat_group_member(id) or created_by = auth.uid());

drop policy if exists "chat_groups_insert" on public.chat_groups;
create policy "chat_groups_insert" on public.chat_groups
  for insert with check (created_by = auth.uid());

drop policy if exists "chat_groups_update" on public.chat_groups;
create policy "chat_groups_update" on public.chat_groups
  for update using (created_by = auth.uid() or public.is_chat_group_admin(id));

drop policy if exists "chat_groups_delete" on public.chat_groups;
create policy "chat_groups_delete" on public.chat_groups
  for delete using (created_by = auth.uid());

drop policy if exists "chat_group_members_read" on public.chat_group_members;
create policy "chat_group_members_read" on public.chat_group_members
  for select using (user_id = auth.uid() or public.is_chat_group_member(group_id));

drop policy if exists "chat_group_members_insert" on public.chat_group_members;
create policy "chat_group_members_insert" on public.chat_group_members
  for insert with check (
    (user_id = auth.uid() and exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid()))
    or public.is_chat_group_admin(group_id)
  );

drop policy if exists "chat_group_members_update" on public.chat_group_members;
create policy "chat_group_members_update" on public.chat_group_members
  for update using (user_id = auth.uid() or public.is_chat_group_admin(group_id));

drop policy if exists "chat_group_members_delete" on public.chat_group_members;
create policy "chat_group_members_delete" on public.chat_group_members
  for delete using (
    user_id = auth.uid()
    or public.is_chat_group_admin(group_id)
    or exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid())
  );

drop policy if exists "group_messages_read" on public.group_messages;
create policy "group_messages_read" on public.group_messages
  for select using (public.is_chat_group_member(group_id));

drop policy if exists "group_messages_insert" on public.group_messages;
create policy "group_messages_insert" on public.group_messages
  for insert with check (sender_id = auth.uid() and public.is_chat_group_member(group_id));

drop policy if exists "group_messages_delete" on public.group_messages;
create policy "group_messages_delete" on public.group_messages
  for delete using (sender_id = auth.uid() or public.is_chat_group_admin(group_id));

-- ── Notifications for new group messages ──────────────────────────────────
create or replace function public._notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group text;
  v_name text;
begin
  select coalesce(nullif(btrim(g.name), ''), 'group chat') into v_group
  from public.chat_groups g where g.id = new.group_id;
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''), 'A member') into v_name
  from public.profiles p where p.id = new.sender_id;

  insert into public.notifications (recipient_id, user_id, kind, title, body, entity_type, entity_id, url, read)
  select m.user_id, m.user_id, 'group_message',
         coalesce(v_name, 'A member') || ' in ' || coalesce(v_group, 'group chat'),
         left(coalesce(nullif(new.body, ''), '[voice note]'), 200),
         'chat_group', new.group_id, '#messages', false
  from public.chat_group_members m
  where m.group_id = new.group_id and m.user_id <> new.sender_id;
  return new;
exception when others then
  return new;
end
$$;

drop trigger if exists group_message_notification on public.group_messages;
create trigger group_message_notification
  after insert on public.group_messages
  for each row execute function public._notify_group_message();

-- ── Realtime ──────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.group_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_group_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_groups;
  exception when duplicate_object then null;
  end;
end
$$;

-- ── Private attachment bucket ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

drop policy if exists "chat attachments read" on storage.objects;
create policy "chat attachments read" on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and (
      ((storage.foldername(name))[1] = 'dm' and (storage.foldername(name))[2] = (auth.uid())::text)
      or ((storage.foldername(name))[1] = 'dm' and (storage.foldername(name))[3] = (auth.uid())::text)
      or ((storage.foldername(name))[1] = 'group' and public.is_chat_group_member(((storage.foldername(name))[2])::uuid))
    )
  );

drop policy if exists "chat attachments write" on storage.objects;
create policy "chat attachments write" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

drop policy if exists "chat attachments delete" on storage.objects;
create policy "chat attachments delete" on storage.objects
  for delete using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

-- ── Program Builder: module weeks ────────────────────────────────────────
alter table public.program_modules add column if not exists weeks integer not null default 1;
