-- Blog, mobile-money payments and the email outbox. Idempotent: safe to re-run.
--
-- Mirrors the shared contract in .plans/public-site-blog-backend-contract.md.
-- New permission keys ('blog.manage', 'payments.submit', 'payments.confirm')
-- are already in src/lib/permissions.ts; this migration seeds the same rows
-- into public.permissions / public.role_permissions.
--
-- All writes to payment_submissions and email_outbox go through
-- SECURITY DEFINER RPCs owned by the migration role (which has BYPASSRLS on
-- this project, same as every other RPC in 20261014030000). Clients never
-- insert/update those two tables directly: no write policy is defined for
-- them, so RLS denies it even though the project's default table grants are
-- broad.

-- ───────────────────────────── 1. public.blog_posts ─────────────────────

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  title text not null check (length(btrim(title)) between 1 and 200),
  excerpt text not null default '' check (length(excerpt) <= 400),
  body text not null default '',
  cover_image_url text,
  cover_image_path text,
  category text not null default 'News',
  tags text[] not null default '{}',
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_published_requires_date check (
    status not in ('scheduled', 'published') or published_at is not null
  )
);

create index if not exists blog_posts_status_published_idx on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_author_id_fk_idx on public.blog_posts(author_id);

alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select
  using (status in ('published', 'scheduled') and published_at <= now());

drop policy if exists blog_posts_manage_all on public.blog_posts;
create policy blog_posts_manage_all on public.blog_posts
  for all to authenticated
  using ((select public.has_permission('blog.manage')))
  with check ((select public.has_permission('blog.manage')));

-- blog-covers storage bucket: public read, blog.manage writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-covers', 'blog-covers', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists blog_covers_public_read on storage.objects;
create policy blog_covers_public_read on storage.objects
  for select using (bucket_id = 'blog-covers');

drop policy if exists blog_covers_manage_all on storage.objects;
create policy blog_covers_manage_all on storage.objects
  for all
  using (bucket_id = 'blog-covers' and (select public.has_permission('blog.manage')))
  with check (bucket_id = 'blog-covers' and (select public.has_permission('blog.manage')));

-- ───────────────────────── 2. public.payment_channels ────────────────────

create table if not exists public.payment_channels (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mtn_momo', 'orange_money')),
  label text not null,
  account_name text not null,
  account_number text not null,
  instructions text not null default '',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_channels_active_sort_idx on public.payment_channels(active, sort);

alter table public.payment_channels enable row level security;

drop policy if exists payment_channels_read on public.payment_channels;
create policy payment_channels_read on public.payment_channels
  for select to authenticated
  using (
    active
    or (select public.has_permission('fees.manage'))
    or (select public.has_permission('payments.confirm'))
  );

drop policy if exists payment_channels_write on public.payment_channels;
create policy payment_channels_write on public.payment_channels
  for all to authenticated
  using ((select public.has_permission('fees.manage')) or (select public.has_permission('payments.confirm')))
  with check ((select public.has_permission('fees.manage')) or (select public.has_permission('payments.confirm')));

-- No channels are seeded here: real MoMo/Orange Money account numbers must
-- come from the school, not from a migration. School Admin / Finance
-- Officer add them from the Payments Center UI.

-- ──────────────────────── 3. public.payment_submissions ──────────────────

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.payment_channels(id) on delete set null,
  provider text not null check (provider in ('mtn_momo', 'orange_money')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'LRD')),
  category text not null default 'Tuition',
  payer_phone text not null,
  transaction_reference text not null check (
    transaction_reference = upper(btrim(transaction_reference))
    and length(transaction_reference) between 4 and 64
  ),
  paid_on date not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  fee_transaction_id uuid references public.fee_transactions(id) on delete set null,
  receipt_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_submissions_provider_reference_key unique (provider, transaction_reference)
);

create index if not exists payment_submissions_student_idx on public.payment_submissions(student_id, created_at desc);
create index if not exists payment_submissions_status_idx on public.payment_submissions(status, created_at desc);
create index if not exists payment_submissions_channel_id_fk_idx on public.payment_submissions(channel_id);
create index if not exists payment_submissions_reviewed_by_fk_idx on public.payment_submissions(reviewed_by);
create index if not exists payment_submissions_fee_transaction_id_fk_idx on public.payment_submissions(fee_transaction_id);

alter table public.payment_submissions enable row level security;

drop policy if exists payment_submissions_read on public.payment_submissions;
create policy payment_submissions_read on public.payment_submissions
  for select to authenticated
  using (
    student_id = auth.uid()
    or (select public.has_permission('payments.confirm'))
    or (select public.has_permission('fees.view'))
  );

-- Intentionally no insert/update/delete policy: submit_payment()/
-- review_payment() below are SECURITY DEFINER and are the only write path.

create sequence if not exists public.payment_receipt_seq start 1;

-- ──────────────────────────── 4. public.email_outbox ─────────────────────

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  to_name text not null default '',
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  provider_message_id text,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  dedupe_key text unique,
  related_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_outbox_status_send_after_idx on public.email_outbox(status, send_after);
create index if not exists email_outbox_related_user_id_fk_idx on public.email_outbox(related_user_id);

alter table public.email_outbox enable row level security;

drop policy if exists email_outbox_read on public.email_outbox;
create policy email_outbox_read on public.email_outbox
  for select to authenticated
  using ((select public.has_permission('settings.manage')));

-- Intentionally no insert/update/delete policy: enqueue_email() (internal),
-- the RPCs below and the send-email edge function (service role) are the
-- only writers.

-- ─────────────────────────── 5. Shared touch trigger ─────────────────────

create or replace function public._blog_payments_touch()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public._blog_payments_touch();

drop trigger if exists payment_channels_touch on public.payment_channels;
create trigger payment_channels_touch before update on public.payment_channels
  for each row execute function public._blog_payments_touch();

drop trigger if exists payment_submissions_touch on public.payment_submissions;
create trigger payment_submissions_touch before update on public.payment_submissions
  for each row execute function public._blog_payments_touch();

drop trigger if exists email_outbox_touch on public.email_outbox;
create trigger email_outbox_touch before update on public.email_outbox
  for each row execute function public._blog_payments_touch();

-- ───────────────────────── 6. enqueue_email() (internal) ─────────────────

create or replace function public.enqueue_email(
  p_to_email text,
  p_to_name text,
  p_template text,
  p_subject text,
  p_payload jsonb,
  p_related_user_id uuid,
  p_dedupe_key text default null,
  p_send_after timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if p_to_email is null or length(btrim(p_to_email)) = 0 then
    return null;
  end if;

  insert into public.email_outbox (
    to_email, to_name, template, subject, payload, related_user_id, dedupe_key, send_after
  ) values (
    btrim(p_to_email), coalesce(p_to_name, ''), p_template, p_subject, coalesce(p_payload, '{}'::jsonb),
    p_related_user_id, p_dedupe_key, coalesce(p_send_after, now())
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id;
exception when unique_violation then
  return null;
end;
$fn$;

revoke all on function public.enqueue_email(text, text, text, text, jsonb, uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.retry_failed_emails()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int;
begin
  if not public.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.email_outbox
    set status = 'queued', attempts = 0, last_error = null, send_after = now(), updated_at = now()
    where status = 'failed';
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke all on function public.retry_failed_emails() from public, anon;
grant execute on function public.retry_failed_emails() to authenticated;

-- Bridge: every notification also becomes a queued email to the
-- recipient's profile email (if they have one), deduped by notification id.
-- This covers academic approval notifications from 20261014030000 too.

create or replace function public._enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text;
  v_name text;
begin
  select email, coalesce(full_name, name, '') into v_email, v_name
  from public.profiles where id = new.recipient_id;

  if v_email is not null and length(btrim(v_email)) > 0 then
    perform public.enqueue_email(
      v_email, v_name, 'notification', new.title,
      jsonb_build_object('title', new.title, 'body', new.body, 'entity_type', new.entity_type, 'entity_id', new.entity_id),
      new.recipient_id,
      'notification:' || new.id::text
    );
  end if;

  return new;
end;
$fn$;

drop trigger if exists notifications_enqueue_email on public.notifications;
create trigger notifications_enqueue_email
  after insert on public.notifications
  for each row execute function public._enqueue_notification_email();

-- ───────────────────── 7. submit_payment() / review_payment() ────────────

create or replace function public.submit_payment(
  p_channel_id uuid,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_payer_phone text,
  p_transaction_reference text,
  p_paid_on date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reference text;
  v_provider text;
  v_submission_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.has_permission('payments.submit') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'Active') then
    raise exception 'active_account_required' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if coalesce(p_currency, '') not in ('USD', 'LRD') then
    raise exception 'invalid_currency' using errcode = 'P0001';
  end if;
  if p_paid_on is null then
    raise exception 'paid_on_required' using errcode = 'P0001';
  end if;
  if p_channel_id is null then
    raise exception 'channel_required' using errcode = 'P0001';
  end if;

  v_reference := upper(btrim(coalesce(p_transaction_reference, '')));
  if length(v_reference) < 4 or length(v_reference) > 64 then
    raise exception 'invalid_transaction_reference' using errcode = 'P0001';
  end if;

  select provider into v_provider from public.payment_channels where id = p_channel_id and active;
  if v_provider is null then
    raise exception 'channel_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.payment_submissions
    where provider = v_provider and transaction_reference = v_reference
  ) then
    raise exception 'payment_reference_used' using errcode = 'P0001';
  end if;

  insert into public.payment_submissions (
    student_id, channel_id, provider, amount, currency, category,
    payer_phone, transaction_reference, paid_on, note
  ) values (
    auth.uid(), p_channel_id, v_provider, p_amount, p_currency,
    coalesce(nullif(btrim(p_category), ''), 'Tuition'),
    btrim(coalesce(p_payer_phone, '')), v_reference, p_paid_on, coalesce(p_note, '')
  )
  returning id into v_submission_id;

  insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
  select p.id, 'payment_submitted', 'New mobile money payment reported',
    'A ' || v_provider || ' payment of ' || p_currency || ' ' || p_amount::text || ' was reported for review.',
    'payment_submission', v_submission_id
  from public.profiles p
  where p.status = 'Active'
    and (p.role = 'Super Admin' or exists (
      select 1 from public.role_permissions rp where rp.role = p.role and rp.permission = 'payments.confirm'
    ));

  return v_submission_id;
exception when unique_violation then
  raise exception 'payment_reference_used' using errcode = 'P0001';
end;
$fn$;

revoke all on function public.submit_payment(uuid, numeric, text, text, text, text, date, text) from public, anon;
grant execute on function public.submit_payment(uuid, numeric, text, text, text, text, date, text) to authenticated;

create or replace function public.review_payment(
  p_submission_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sub public.payment_submissions%rowtype;
  v_method text;
  v_fee_id uuid;
  v_receipt text;
  v_student_email text;
  v_student_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.has_permission('payments.confirm') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if coalesce(p_decision, '') not in ('confirm', 'reject') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'reject' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'rejection_note_required' using errcode = 'P0001';
  end if;

  select * into v_sub from public.payment_submissions where id = p_submission_id for update;
  if v_sub.id is null then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if v_sub.status <> 'pending' then raise exception 'payment_not_pending' using errcode = 'P0001'; end if;

  select email, coalesce(full_name, name, '') into v_student_email, v_student_name
  from public.profiles where id = v_sub.student_id;

  if p_decision = 'confirm' then
    v_method := case v_sub.provider
      when 'mtn_momo' then 'MTN MoMo'
      when 'orange_money' then 'Orange Money'
      else v_sub.provider
    end;

    insert into public.fee_transactions (student_id, category, amount, transaction_date, method, reference)
    values (v_sub.student_id, v_sub.category, v_sub.amount, v_sub.paid_on, v_method, v_sub.transaction_reference)
    returning id into v_fee_id;

    v_receipt := 'AOH-RCPT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.payment_receipt_seq')::text, 6, '0');

    update public.payment_submissions
      set status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = coalesce(p_note, ''), fee_transaction_id = v_fee_id, receipt_number = v_receipt
      where id = p_submission_id;

    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    values (
      v_sub.student_id, 'payment_confirmed', 'Payment confirmed',
      'Your ' || v_method || ' payment of ' || v_sub.currency || ' ' || v_sub.amount::text
        || ' was confirmed. Receipt ' || v_receipt || '.',
      'payment_submission', p_submission_id
    );

    perform public.enqueue_email(
      v_student_email, v_student_name, 'payment_receipt',
      'Your Africa of Hope payment receipt ' || v_receipt,
      jsonb_build_object(
        'receipt_number', v_receipt, 'amount', v_sub.amount, 'currency', v_sub.currency,
        'category', v_sub.category, 'method', v_method, 'paid_on', v_sub.paid_on,
        'transaction_reference', v_sub.transaction_reference
      ),
      v_sub.student_id,
      'payment_receipt:' || p_submission_id::text
    );

    return jsonb_build_object('id', p_submission_id, 'status', 'confirmed', 'receipt_number', v_receipt);
  else
    update public.payment_submissions
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
      where id = p_submission_id;

    insert into public.notifications (recipient_id, kind, title, body, entity_type, entity_id)
    values (
      v_sub.student_id, 'payment_rejected', 'Payment report was rejected',
      coalesce(nullif(p_note, ''), 'Your reported payment could not be confirmed.'),
      'payment_submission', p_submission_id
    );

    perform public.enqueue_email(
      v_student_email, v_student_name, 'payment_rejected',
      'Your Africa of Hope payment report needs attention',
      jsonb_build_object(
        'amount', v_sub.amount, 'currency', v_sub.currency, 'category', v_sub.category,
        'transaction_reference', v_sub.transaction_reference, 'review_note', p_note
      ),
      v_sub.student_id,
      'payment_rejected:' || p_submission_id::text
    );

    return jsonb_build_object('id', p_submission_id, 'status', 'rejected', 'receipt_number', null);
  end if;
end;
$fn$;

revoke all on function public.review_payment(uuid, text, text) from public, anon;
grant execute on function public.review_payment(uuid, text, text) to authenticated;

-- ─────────────────────────── 8. Permission seeds ─────────────────────────
-- Mirrors src/lib/permissions.ts exactly.

insert into public.permissions (key, grp, label, description, sort) values
  ('payments.submit', 'Finance', 'Submit mobile money payments', 'Report own MTN MoMo or Orange Money fee payments for confirmation.', 151),
  ('payments.confirm', 'Finance', 'Confirm mobile money payments', 'Confirm or reject reported payments and issue receipts.', 152),
  ('blog.manage', 'Website', 'Manage blog', 'Write, schedule, publish and archive public blog posts.', 185)
on conflict (key) do update set
  grp = excluded.grp, label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.role_permissions (role, permission) values
  ('School Admin', 'blog.manage'),
  ('School Admin', 'payments.confirm'),
  ('Finance Officer', 'payments.confirm'),
  ('Student', 'payments.submit')
on conflict do nothing;
