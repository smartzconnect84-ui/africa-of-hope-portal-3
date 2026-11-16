-- Additive newsletter upgrade. Apply explicitly after the existing email outbox migrations.
begin;
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  subject text not null check (length(subject) between 1 and 200 and subject !~ E'[\r\n]'),
  body text not null check (length(body) between 1 and 20000),
  updated_at timestamptz not null default now()
);
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254),
  name text not null default '' check (length(name) <= 120),
  status text not null default 'pending' check (status in ('pending','active','unsubscribed')),
  consent_text text not null,
  consent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  confirmation_hash text,
  confirmation_expires_at timestamptz,
  last_requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.email_templates(id) on delete set null,
  subject text not null,
  body text not null,
  recipient_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Short-lived, hashed IP buckets; no raw IP addresses are retained.
create table if not exists public.newsletter_signup_limits (
  bucket text primary key,
  hits int not null default 1,
  expires_at timestamptz not null
);
alter table public.email_templates enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_signup_limits enable row level security;
create policy "email templates managers" on public.email_templates for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy "newsletter subscribers managers read" on public.newsletter_subscribers for select to authenticated
  using (public.has_permission('settings.manage'));
create policy "newsletter campaigns managers read" on public.newsletter_campaigns for select to authenticated
  using (public.has_permission('settings.manage'));
grant select, insert, update, delete on public.email_templates to authenticated;
grant select on public.newsletter_subscribers, public.newsletter_campaigns to authenticated;

-- Only the public Edge Function's service role may reserve a signup. Atomically
-- throttles by IP bucket and email, stores explicit consent, and queues confirmation.
create or replace function public.request_newsletter_signup(
  p_email text, p_name text, p_consent text, p_hash text, p_link text, p_bucket text
) returns void language plpgsql security definer set search_path = public as $fn$
declare v_hits int; v_row public.newsletter_subscribers%rowtype;
begin
  delete from public.newsletter_signup_limits where expires_at < now();
  insert into public.newsletter_signup_limits(bucket, hits, expires_at)
  values (p_bucket, 1, now() + interval '1 hour')
  on conflict (bucket) do update set hits = newsletter_signup_limits.hits + 1
  returning hits into v_hits;
  if v_hits > 10 then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(p_email), 0));
  select * into v_row from public.newsletter_subscribers where email = lower(p_email) for update;
  if found and (v_row.status = 'active' or v_row.last_requested_at > now() - interval '15 minutes') then return; end if;
  insert into public.newsletter_subscribers(email, name, consent_text, confirmation_hash, confirmation_expires_at)
  values (lower(p_email), p_name, p_consent, p_hash, now() + interval '24 hours')
  on conflict (email) do update set name = excluded.name, status = 'pending',
    consent_text = excluded.consent_text, consent_at = now(), confirmed_at = null, unsubscribed_at = null,
    confirmation_hash = excluded.confirmation_hash, confirmation_expires_at = excluded.confirmation_expires_at,
    last_requested_at = now();
  perform public.enqueue_email(lower(p_email), p_name, 'newsletter_confirmation', 'Confirm your Africa of Hope newsletter subscription',
    jsonb_build_object('confirmation_url', p_link, 'confirmation_hash', p_hash), null, 'newsletter-confirm:' || p_hash);
end; $fn$;
revoke all on function public.request_newsletter_signup(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.request_newsletter_signup(text,text,text,text,text,text) to service_role;

-- One transaction snapshots the saved template and active recipients. Reusing the
-- client-generated campaign id cannot enqueue the same campaign a second time.
create or replace function public.queue_newsletter_campaign(p_template_id uuid, p_campaign_id uuid)
returns int language plpgsql security definer set search_path = public as $fn$
declare v_template public.email_templates%rowtype; v_sub public.newsletter_subscribers%rowtype; v_count int := 0; v_inserted uuid;
begin
  if not public.has_permission('settings.manage') then raise exception 'Not authorized'; end if;
  select * into v_template from public.email_templates where id = p_template_id;
  if not found then raise exception 'Save a valid template first'; end if;
  insert into public.newsletter_campaigns(id, template_id, subject, body, created_by)
  values (p_campaign_id, v_template.id, v_template.subject, v_template.body, auth.uid())
  on conflict (id) do nothing returning id into v_inserted;
  if v_inserted is null then
    select recipient_count into v_count from public.newsletter_campaigns where id = p_campaign_id;
    return v_count;
  end if;
  for v_sub in select * from public.newsletter_subscribers where status = 'active' loop
    perform public.enqueue_email(v_sub.email, v_sub.name, 'newsletter', v_template.subject,
      jsonb_build_object('body', v_template.body, 'subscriber_id', v_sub.id, 'campaign_id', p_campaign_id),
      null, 'newsletter:' || p_campaign_id::text || ':' || v_sub.id::text);
    v_count := v_count + 1;
  end loop;
  update public.newsletter_campaigns set recipient_count = v_count where id = p_campaign_id;
  return v_count;
end; $fn$;
revoke all on function public.queue_newsletter_campaign(uuid,uuid) from public, anon;
grant execute on function public.queue_newsletter_campaign(uuid,uuid) to authenticated;
insert into public.email_templates(name, subject, body)
select 'Academy newsletter', 'News from Africa of Hope', E'Hello {{name}},\n\nAdd your approved academy news here before sending.\n\nThank you for supporting Africa of Hope.'
where not exists (select 1 from public.email_templates);
commit;
