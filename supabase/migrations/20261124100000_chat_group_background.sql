-- Chat background image for group conversations.
alter table public.chat_groups
  add column if not exists background_url text;