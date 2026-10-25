-- Additive helpdesk. Apply only after review; uses existing profiles and permission matrix.
begin;
insert into public.permissions(key, grp, label, description, sort)
values ('helpdesk.manage', 'Comms', 'Manage student helpdesk', 'Read all student tickets, reply, close and reopen them.', 175)
on conflict (key) do nothing;
insert into public.role_permissions(role, permission) values ('School Admin', 'helpdesk.manage') on conflict do nothing;

create or replace function public.can_manage_helpdesk()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('helpdesk.manage') and exists (
    select 1 from public.profiles where id = auth.uid() and status = 'Active' and role <> 'Student'
  );
$$;
revoke all on function public.can_manage_helpdesk() from public;
grant execute on function public.can_manage_helpdesk() to authenticated;

create table if not exists public.helpdesk_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  student_name text not null,
  subject text not null check (length(btrim(subject)) between 1 and 200),
  category text not null check (category in ('Study', 'Fees', 'Technology', 'Other')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.helpdesk_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.helpdesk_tickets(id),
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  author_role text not null,
  kind text not null default 'reply' check (kind in ('reply', 'closed', 'reopened')),
  body text not null check (length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists helpdesk_owner_updated on public.helpdesk_tickets(student_id, updated_at desc);
create index if not exists helpdesk_status_updated on public.helpdesk_tickets(status, updated_at desc);
create index if not exists helpdesk_thread on public.helpdesk_messages(ticket_id, created_at);
alter table public.helpdesk_tickets enable row level security;
alter table public.helpdesk_messages enable row level security;
drop policy if exists helpdesk_ticket_read on public.helpdesk_tickets;
drop policy if exists helpdesk_message_read on public.helpdesk_messages;
create policy helpdesk_ticket_read on public.helpdesk_tickets for select to authenticated using (
  public.can_manage_helpdesk() or (student_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and status = 'Active' and role = 'Student'
  ))
);
create policy helpdesk_message_read on public.helpdesk_messages for select to authenticated using (
  exists (select 1 from public.helpdesk_tickets t where t.id = ticket_id)
);
-- No browser DML grants or write policies: all writes below verify identity and authorization.
revoke all on public.helpdesk_tickets, public.helpdesk_messages from anon, authenticated;
grant select on public.helpdesk_tickets, public.helpdesk_messages to authenticated;

create or replace function public.create_helpdesk_ticket(p_id uuid, p_subject text, p_category text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor public.profiles%rowtype; existing public.helpdesk_tickets%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid() and status = 'Active' and role = 'Student';
  if not found then raise exception 'An active student account is required'; end if;
  -- Serialize per-student creation for idempotent retries and rate-limit enforcement.
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text, 0));
  select * into existing from public.helpdesk_tickets where id = p_id;
  if found then
    if existing.student_id <> actor.id then raise exception 'Ticket ID unavailable'; end if;
    return existing.id;
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 10000 then raise exception 'Message must be 1–10000 characters'; end if;
  if (select count(*) from public.helpdesk_tickets where student_id = actor.id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Please wait before creating more tickets (maximum 10 per hour)';
  end if;
  insert into public.helpdesk_tickets(id, student_id, student_name, subject, category)
    values(p_id, actor.id, coalesce(nullif(btrim(to_jsonb(actor)->>'name'), ''), nullif(btrim(actor.full_name), ''), 'Account holder'), btrim(p_subject), p_category);
  insert into public.helpdesk_messages(ticket_id, author_id, author_name, author_role, body)
    values(p_id, actor.id, coalesce(nullif(btrim(to_jsonb(actor)->>'name'), ''), nullif(btrim(actor.full_name), ''), 'Account holder'), actor.role, btrim(p_body));
  return p_id;
end; $$;

create or replace function public.reply_helpdesk_ticket(p_id uuid, p_ticket uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor public.profiles%rowtype; ticket public.helpdesk_tickets%rowtype; existing public.helpdesk_messages%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid() and status = 'Active';
  if not found then raise exception 'Active account required'; end if;
  select * into ticket from public.helpdesk_tickets where id = p_ticket for update;
  if not found or not (public.can_manage_helpdesk() or (actor.role = 'Student' and ticket.student_id = actor.id)) then
    raise exception 'Ticket unavailable or access denied';
  end if;
  select * into existing from public.helpdesk_messages where id = p_id;
  if found then
    if existing.ticket_id <> p_ticket or existing.author_id <> actor.id then raise exception 'Message ID unavailable'; end if;
    return existing.id;
  end if;
  if ticket.status <> 'open' then raise exception 'This ticket is closed. Ask staff to reopen it or create a new ticket'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 10000 then raise exception 'Message must be 1–10000 characters'; end if;
  if (select count(*) from public.helpdesk_messages where ticket_id = p_ticket and author_id = actor.id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Too many messages. Please wait a minute';
  end if;
  insert into public.helpdesk_messages(id, ticket_id, author_id, author_name, author_role, body)
    values(p_id, p_ticket, actor.id, coalesce(nullif(btrim(to_jsonb(actor)->>'name'), ''), nullif(btrim(actor.full_name), ''), 'Account holder'), actor.role, btrim(p_body));
  update public.helpdesk_tickets set updated_at = now() where id = p_ticket;
  return p_id;
end; $$;

create or replace function public.set_helpdesk_status(p_ticket uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles%rowtype; ticket public.helpdesk_tickets%rowtype;
begin
  if not public.can_manage_helpdesk() then raise exception 'Helpdesk permission required'; end if;
  select * into actor from public.profiles where id = auth.uid() and status = 'Active';
  select * into ticket from public.helpdesk_tickets where id = p_ticket for update;
  if not found then raise exception 'Ticket not found'; end if;
  if p_status is null or p_status not in ('open', 'closed') then raise exception 'Invalid status'; end if;
  if ticket.status = p_status then return; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then raise exception 'Provide a reason (up to 2000 characters)'; end if;
  update public.helpdesk_tickets set status = p_status, updated_at = now() where id = p_ticket;
  insert into public.helpdesk_messages(ticket_id, author_id, author_name, author_role, kind, body)
    values(p_ticket, actor.id, coalesce(nullif(btrim(to_jsonb(actor)->>'name'), ''), nullif(btrim(actor.full_name), ''), 'Account holder'), actor.role, case when p_status = 'closed' then 'closed' else 'reopened' end, btrim(p_reason));
end; $$;
revoke all on function public.create_helpdesk_ticket(uuid, text, text, text) from public;
revoke all on function public.reply_helpdesk_ticket(uuid, uuid, text) from public;
revoke all on function public.set_helpdesk_status(uuid, text, text) from public;
grant execute on function public.create_helpdesk_ticket(uuid, text, text, text) to authenticated;
grant execute on function public.reply_helpdesk_ticket(uuid, uuid, text) to authenticated;
grant execute on function public.set_helpdesk_status(uuid, text, text) to authenticated;
commit;
