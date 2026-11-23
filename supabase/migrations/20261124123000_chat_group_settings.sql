-- Group chat settings: join policy and permissions.
alter table public.chat_groups
  add column if not exists join_policy text not null default 'invite',
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Allow group updates to set these columns (already covered by chat_groups_update policy).