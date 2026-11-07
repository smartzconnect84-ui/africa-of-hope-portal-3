alter table public.reminder_settings
  add column if not exists assignments boolean not null default true;

comment on column public.reminder_settings.assignments is
  'Whether the user wants assignment deadline notifications.';
