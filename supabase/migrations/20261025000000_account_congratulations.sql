-- Prepared only; apply after the existing profile/email migrations with owner approval.
-- Reuses email_outbox and the existing protected send-email worker. No historical backfill.
-- Auth email must be confirmed; self-editable profiles.email is never a delivery destination.
begin;

create or replace function public._queue_account_congratulations(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $fn$
declare
  v_profile public.profiles%rowtype;
  v_email text;
  v_event text;
  v_subject text;
  v_body text;
  v_key text;
  v_id uuid;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.status not in ('Pending Approval', 'Active') then return null; end if;
  select email into v_email from auth.users where id = p_user_id and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  v_event := case when v_profile.status = 'Active' then 'approved' else 'registered' end;
  v_key := 'account-congratulations:' || v_event || ':' || p_user_id::text;
  if v_event = 'approved' then
    v_subject := 'Congratulations — your AFRICA OF HOPE account is approved';
    v_body := 'Congratulations, ' || coalesce(nullif(v_profile.full_name, ''), nullif(v_profile.name, ''), 'and welcome') || E'!\n\nYour AFRICA OF HOPE account has been approved. Sign in with your registered email to view the services and next steps available to your account.\n\nIf you are a learner, please review your programme and payment information in the portal or contact admissions for guidance. Account approval does not by itself confirm payment, course completion or certification.\n\nWe look forward to supporting your journey.\nAFRICA OF HOPE — Empowering People. Transforming Communities. Inspiring Hope.';
  else
    v_subject := 'Welcome to AFRICA OF HOPE — registration received';
    v_body := 'Congratulations on taking the first step, ' || coalesce(nullif(v_profile.full_name, ''), nullif(v_profile.name, ''), 'and welcome') || E'!\n\nYour AFRICA OF HOPE registration has been received. Your application is pending review; this message is not an admission or account approval. Our team will notify you when a decision is made.\n\nPlease keep your registered email available and contact admissions if you need help.\n\nThank you for choosing to grow with us.\nAFRICA OF HOPE — Empowering People. Transforming Communities. Inspiring Hope.';
  end if;
  v_id := public.enqueue_email(v_email, coalesce(v_profile.full_name, v_profile.name, ''), case when v_event = 'approved' then 'account_approved' else 'account_registration' end, v_subject,
    jsonb_build_object('body', v_body, 'event', v_event), p_user_id, v_key);
  if v_id is null then select id into v_id from public.email_outbox where dedupe_key = v_key; end if;
  return v_id;
end;
$fn$;
revoke all on function public._queue_account_congratulations(uuid) from public, anon, authenticated;

create or replace function public._profile_congratulations_trigger()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  if TG_OP = 'UPDATE' then
    if new.status is not distinct from old.status then return new; end if;
    if new.status <> 'Active' then return new; end if;
  end if;
  perform public._queue_account_congratulations(new.id);
  return new;
end;
$fn$;
revoke all on function public._profile_congratulations_trigger() from public, anon, authenticated;
drop trigger if exists profile_account_congratulations on public.profiles;
create trigger profile_account_congratulations after insert or update of status on public.profiles
  for each row execute function public._profile_congratulations_trigger();

-- Confirmation may happen after the profile was created. Queue only on the first confirmation.
create or replace function public._confirmed_account_congratulations_trigger()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public._queue_account_congratulations(new.id);
  end if;
  return new;
end;
$fn$;
revoke all on function public._confirmed_account_congratulations_trigger() from public, anon, authenticated;
drop trigger if exists confirmed_account_congratulations on auth.users;
create trigger confirmed_account_congratulations after update of email_confirmed_at on auth.users
  for each row execute function public._confirmed_account_congratulations_trigger();

-- Staff action uses the same idempotent queue path; no email address or approval state from client input.
create or replace function public.queue_account_congratulations(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_role text; v_status text; v_id uuid; v_mail_status text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'Active') then raise exception 'active_account_required'; end if;
  select role, status into v_role, v_status from public.profiles where id = p_user_id;
  if not found then raise exception 'account_not_found'; end if;
  if v_role = 'Student' then
    if not public.has_permission('students.manage') then raise exception 'forbidden'; end if;
  elsif not public.has_permission('staff.manage') then raise exception 'forbidden';
  end if;
  if v_status not in ('Active', 'Pending Approval') then raise exception 'account_not_eligible'; end if;
  v_id := public._queue_account_congratulations(p_user_id);
  if v_id is null then raise exception 'confirmed_email_required'; end if;
  select status into v_mail_status from public.email_outbox where id = v_id;
  return jsonb_build_object('id', v_id, 'status', v_mail_status);
end;
$fn$;
revoke all on function public.queue_account_congratulations(uuid) from public, anon;
grant execute on function public.queue_account_congratulations(uuid) to authenticated;
commit;
