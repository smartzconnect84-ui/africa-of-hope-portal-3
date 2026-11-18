-- ── Africa of Hope · welcome emails + notification integrity ────────────────
--
-- Fixes found while auditing direct messaging, live notifications and push:
--
--  1. Welcome emails had one generic body for everybody. They are now driven by
--     two editable templates (staff/volunteers and student/applicants) that the
--     admin backend can change without a deploy.
--  2. `notifications` carries both `recipient_id` (NOT NULL) and `user_id`, so
--     senders that only supplied `user_id` failed the insert, and readers that
--     only updated `read_at` left rows looking unread forever. A before-trigger
--     now mirrors the two pairs in both directions.
--  3. New direct messages created no notification at all: the browser insert was
--     rejected by RLS (there is no INSERT policy on `notifications`). A security
--     definer trigger on `direct_messages` now raises the recipient's notification
--     server-side, and it can never block the message itself.
--
-- Additive and idempotent. No rows are deleted.

-- ── 1. Welcome email templates ───────────────────────────────────────────────
create table if not exists public.welcome_email_templates (
  audience text primary key check (audience in ('staff', 'student')),
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.welcome_email_templates enable row level security;

drop policy if exists welcome_templates_read on public.welcome_email_templates;
create policy welcome_templates_read on public.welcome_email_templates
  for select to authenticated using (true);

drop policy if exists welcome_templates_write on public.welcome_email_templates;
create policy welcome_templates_write on public.welcome_email_templates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'Active'
        and p.role in ('Super Admin', 'School Admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'Active'
        and p.role in ('Super Admin', 'School Admin')
    )
  );

grant select, insert, update on public.welcome_email_templates to authenticated;

insert into public.welcome_email_templates (audience, subject, body) values
  ('student',
   'Welcome to AFRICA OF HOPE — next steps for your application',
   E'Hello {{name}},\n\n{{event_line}}\n\nOur admissions team reviews every application. This message is not an admission or account approval; we will write to you as soon as a decision is made.\n\nWhat happens next\n1. We review your details and the programmes you chose.\n2. Admissions contacts you with the decision and any documents still needed.\n3. Approved applicants receive enrolment and payment instructions.\n\nKeep this email address active — it is where we send every update. If you need help, contact the admissions office.\n\nAFRICA OF HOPE — Empowering People. Transforming Communities. Inspiring Hope.'),
  ('staff',
   'Welcome to AFRICA OF HOPE — your staff account',
   E'Hello {{name}},\n\n{{event_line}}\n\nYour staff account opens the portal tools for your role. An administrator controls which modules you can use, so ask them if something you need is missing.\n\nGetting started\n1. Sign in with this email address; use "Forgot password" if you need a new one.\n2. Complete your profile so colleagues can reach you.\n3. Read the school policies and the modules assigned to your role.\n\nVolunteers: thank you for giving your time. Your coordinator will confirm your schedule and any training you need.\n\nAFRICA OF HOPE — Empowering People. Transforming Communities. Inspiring Hope.')
on conflict (audience) do nothing;

-- ── 2. Notification read-state integrity ────────────────────────────────────
-- Old rows drifted: read_at set while read stayed false, which kept them in the
-- unread badge forever.
update public.notifications
   set read = true
 where read_at is not null and coalesce(read, false) = false;

update public.notifications
   set read_at = coalesce(read_at, created_at)
 where coalesce(read, false) = true and read_at is null;

create or replace function public.notifications_sync_read_state()
returns trigger language plpgsql set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    -- recipient_id is NOT NULL and user_id is nullable legacy; mirror whichever
    -- one the caller supplied so no insert can fail on the pair.
    if new.recipient_id is null and new.user_id is not null then
      new.recipient_id := new.user_id;
    end if;
    if new.user_id is null then
      new.user_id := new.recipient_id;
    end if;
    if new.read_at is not null then
      new.read := true;
    elsif coalesce(new.read, false) then
      new.read_at := now();
    else
      new.read := false;
    end if;
  else
    if new.read_at is distinct from old.read_at and new.read_at is not null then
      new.read := true;
    elsif new.read is distinct from old.read and coalesce(new.read, false) and new.read_at is null then
      new.read_at := now();
    elsif new.read is distinct from old.read and coalesce(new.read, false) = false then
      new.read_at := null;
    end if;
  end if;
  return new;
end
$fn$;
revoke all on function public.notifications_sync_read_state() from public, anon, authenticated;

drop trigger if exists notifications_sync_read_state on public.notifications;
create trigger notifications_sync_read_state
  before insert or update on public.notifications
  for each row execute function public.notifications_sync_read_state();

-- ── 3. Direct messages raise a real notification ────────────────────────────
create or replace function public._notify_direct_message()
returns trigger language plpgsql security definer set search_path = public
as $fn$
declare
  v_name text;
begin
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''), 'A portal user')
    into v_name
    from public.profiles p
   where p.id = new.sender_id;

  insert into public.notifications (recipient_id, user_id, kind, title, body, entity_type, entity_id, url, read)
  values (
    new.receiver_id,
    new.receiver_id,
    'direct_message',
    'New message from ' || coalesce(v_name, 'a portal user'),
    left(new.body, 200),
    'direct_message',
    new.id,
    '#messages',
    false
  );
  return new;
exception when others then
  -- A notification must never stop the message from being stored.
  return new;
end
$fn$;
revoke all on function public._notify_direct_message() from public, anon, authenticated;

drop trigger if exists direct_message_notification on public.direct_messages;
create trigger direct_message_notification
  after insert on public.direct_messages
  for each row execute function public._notify_direct_message();

-- ── 4. Welcome emails use the audience templates ─────────────────────────────
create or replace function public._queue_account_congratulations(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $fn$
declare
  v_profile public.profiles%rowtype;
  v_email text;
  v_event text;
  v_audience text;
  v_subject text;
  v_body text;
  v_template_subject text;
  v_template_body text;
  v_event_line text;
  v_name text;
  v_key text;
  v_id uuid;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.status not in ('Pending Approval', 'Active') then return null; end if;
  select email into v_email from auth.users where id = p_user_id and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  v_event := case when v_profile.status = 'Active' then 'approved' else 'registered' end;
  v_key := 'account-congratulations:' || v_event || ':' || p_user_id::text;

  v_name := coalesce(nullif(btrim(v_profile.full_name), ''), nullif(btrim(v_profile.name), ''), 'there');
  -- Staff, volunteers and every non-student role get the staff welcome.
  v_audience := case when v_profile.role = 'Student' then 'student' else 'staff' end;
  v_event_line := case
    when v_event = 'approved' then 'Your AFRICA OF HOPE account has been approved and is ready to use.'
    else 'Your account has been created and is waiting for review.'
  end;

  select t.subject, t.body into v_template_subject, v_template_body
    from public.welcome_email_templates t where t.audience = v_audience;

  if v_template_body is not null and btrim(v_template_body) <> '' then
    v_subject := replace(replace(v_template_subject, '{{name}}', v_name), '{{event_line}}', v_event_line);
    v_body := replace(replace(v_template_body, '{{name}}', v_name), '{{event_line}}', v_event_line);
  elsif v_event = 'approved' then
    v_subject := 'Congratulations — your AFRICA OF HOPE account is approved';
    v_body := 'Congratulations, ' || v_name || E'!\n\nYour AFRICA OF HOPE account has been approved. Sign in with your registered email to view the services and next steps available to your account.\n\nIf you are a learner, please review your programme and payment information in the portal or contact admissions for guidance. Account approval does not by itself confirm payment, course completion or certification.\n\nWe look forward to supporting your journey.\nAFRICA OF HOPE — Empowering People. Transforming Communities. Inspiring Hope.';
  else
    v_subject := 'Welcome to AFRICA OF HOPE — registration received';
    v_body := 'Congratulations on taking the first step, ' || v_name || E'!\n\nYour AFRICA OF HOPE registration has been received. Your application is pending review; this message is not an admission or account approval. Our team will notify you when a decision is made.\n\nPlease keep your registered email available and contact admissions if you need help.\n\nThank you for choosing to grow with us.\nAFRICA OF HOPE — Empowering People. Transforming Communities. Inspiring Hope.';
  end if;

  v_id := public.enqueue_email(
    v_email,
    coalesce(v_profile.full_name, v_profile.name, ''),
    case when v_event = 'approved' then 'account_approved' else 'account_registration' end,
    v_subject,
    jsonb_build_object('body', v_body, 'event', v_event, 'audience', v_audience),
    p_user_id,
    v_key
  );
  if v_id is null then select id into v_id from public.email_outbox where dedupe_key = v_key; end if;
  return v_id;
end;
$fn$;
revoke all on function public._queue_account_congratulations(uuid) from public, anon, authenticated;

-- Templates are settings, not live data: nothing to add to the Realtime publication.
