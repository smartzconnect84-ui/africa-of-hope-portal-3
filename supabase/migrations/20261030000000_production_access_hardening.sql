-- REVIEW / STAGING FIRST. Prepared only; does not delete records or objects.
-- Requires the versioned roles, storage and certificate-controls migrations.
begin;

-- Public verification must not require downloading the whole student register.
alter table public.certificates enable row level security;
revoke select on public.certificates from anon;
grant select on public.certificates to authenticated;
drop policy if exists certificates_private_register on public.certificates;
create policy certificates_private_register on public.certificates as restrictive
  for select to authenticated using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'Active')
    and (student_id = auth.uid() or (select public.has_permission('certificates.manage')))
  );

-- Exactly one serial; no internal account IDs, contact details, staff identity
-- or private revocation reason. Revoked credentials remain verifiable as revoked.
create or replace function public.verify_public_certificate(p_serial text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb;
begin
  if p_serial is null or length(btrim(p_serial)) not between 1 and 80 then
    raise exception 'A certificate serial between 1 and 80 characters is required';
  end if;
  select jsonb_build_object(
    'serial', c.serial, 'issueDate', c.issue_date, 'honors', c.honors,
    'grade', c.grade, 'status', case when c.status = 'Valid' then 'Valid' else 'Revoked' end,
    'holderName', coalesce(p.name, p.full_name, 'Not recorded'),
    'programTitle', coalesce(pr.title, 'Not recorded'),
    'revokedAt', c.revoked_at
  ) into v_result
  from public.certificates c
  left join public.profiles p on p.id = c.student_id
  left join public.programs pr on pr.id = c.program_id
  where lower(btrim(c.serial)) = lower(btrim(p_serial))
  limit 1;
  return v_result;
end $$;
revoke all on function public.verify_public_certificate(text) from public;
grant execute on function public.verify_public_certificate(text) to anon, authenticated;

-- Defense in depth: direct profile writes must not bypass Edge Function target
-- protections. Existing profile-column and row policies still apply.
create or replace function public.guard_administrator_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if not exists (select 1 from public.profiles where id = auth.uid() and status = 'Active') then
      raise exception 'An active account is required';
    end if;
    if (old.role in ('School Admin', 'Super Admin') or new.role in ('School Admin', 'Super Admin'))
       and (new.role is distinct from old.role or new.status is distinct from old.status or new.email is distinct from old.email)
       and not exists (select 1 from public.profiles where id = auth.uid() and role = 'Super Admin' and status = 'Active') then
      raise exception 'Only an active Super Admin may change administrator access';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_administrator_profile_changes() from public;
drop trigger if exists guard_administrator_profile_changes on public.profiles;
create trigger guard_administrator_profile_changes before update of role, status, email on public.profiles
  for each row execute function public.guard_administrator_profile_changes();

-- An old baseline allowed every authenticated user to manage private documents.
drop policy if exists documents_staff_all on storage.objects;
-- Do not change public flags or remove existing files. Existing bucket limits
-- are standardized to the frontend's supported upload formats.
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id in ('avatars', 'program-images', 'site-assets');
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id = 'documents';

-- Existing restrictive policies remain authoritative. Realtime publication is
-- additive and never disables RLS. Surface missing tables instead of swallowing
-- every error as the historical baseline did.
do $$ declare t text; begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime is absent; configure publication in staging.';
    return;
  end if;
  foreach t in array array['profiles','programs','program_modules','cohorts','cohort_students','attendance','assignments','submissions','fee_transactions','certificates','announcements','system_settings','role_permissions'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Required realtime table public.% is missing', t;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
commit;
