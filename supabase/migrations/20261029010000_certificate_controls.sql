-- Requires academic planning, permissions and AOH 2026 wiring migrations.
-- Prepared only: review, back up and test in staging before approved production use.
begin;

alter table public.certificates
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id),
  add column if not exists revocation_reason text;

-- Preserve existing non-empty serials. Do NOT silently renumber duplicates.
do $$ begin
  if exists (select 1 from public.certificates where nullif(btrim(serial), '') is not null
             group by lower(btrim(serial)) having count(*) > 1) then
    raise exception 'Duplicate certificate serials exist. Review and resolve them with the registrar before applying this migration.';
  end if;
end $$;
update public.certificates set serial = 'AOH-LEGACY-' || upper(id::text)
where nullif(btrim(serial), '') is null;
alter table public.certificates alter column serial set not null;
create unique index if not exists certificates_serial_unique on public.certificates (lower(btrim(serial)));
create index if not exists certificates_holder_program_idx on public.certificates (student_id, program_id);
create sequence if not exists public.certificate_serial_sequence;
revoke all on sequence public.certificate_serial_sequence from public, anon, authenticated;

create or replace function public.next_certificate_serial()
returns text language plpgsql security definer set search_path = public as $$
declare v_serial text;
begin
  loop
    v_serial := 'AOH-CERT-' || extract(year from current_date)::int::text || '-' || lpad(nextval('public.certificate_serial_sequence')::text, 10, '0');
    exit when not exists (select 1 from public.certificates where lower(btrim(serial)) = lower(v_serial));
  end loop;
  return v_serial;
end $$;
revoke all on function public.next_certificate_serial() from public, anon, authenticated;

-- All issuance is serialized by holder/program, including concurrent clicks/tabs.
-- The database, not a random browser value, assigns the serial.
create or replace function public.issue_certificate(p_student_id uuid, p_program_id uuid, p_honors text default 'Pass')
returns public.certificates language plpgsql security definer set search_path = public as $$
declare
  v_certificate public.certificates%rowtype;
  v_student public.profiles%rowtype;
  v_manager boolean;
  v_units bigint;
  v_done bigint;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and status = 'Active') then
    raise exception 'An active signed-in account is required';
  end if;
  v_manager := public.has_permission('certificates.manage');
  if not v_manager and p_student_id is distinct from auth.uid() then raise exception 'Not authorized'; end if;
  if p_honors is null or p_honors not in ('Pass', 'Merit', 'Distinction') then raise exception 'Invalid award class'; end if;
  if not v_manager and p_honors <> 'Pass' then raise exception 'Only certificate staff can assign honors'; end if;
  select * into v_student from public.profiles where id = p_student_id and status = 'Active';
  if v_student.id is null then raise exception 'The holder must be an active account'; end if;
  if not exists (select 1 from public.programs where id = p_program_id) then raise exception 'Programme not found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_program_id::text, 0));
  select * into v_certificate from public.certificates
    where student_id = p_student_id and program_id = p_program_id
    order by issue_date desc nulls last, id limit 1;
  if v_certificate.id is not null then return v_certificate; end if;

  if not v_manager then
    -- Count only approved units available to the holder through active cohort
    -- membership (or their explicitly assigned programme for global units).
    select count(*), count(*) filter (where exists (
      select 1 from public.student_learning_progress pr
      where pr.student_id = p_student_id and pr.learning_unit_id = u.id and pr.status = 'completed'
    )) into v_units, v_done
    from public.learning_units u
    where u.program_id = p_program_id and u.status = 'approved'
      and (u.available_from is null or u.available_from <= now())
      and ((u.cohort_id is null and p_program_id::text in (select jsonb_array_elements_text(to_jsonb(v_student.program_ids))))
           or exists (select 1 from public.cohort_students cs where cs.cohort_id = u.cohort_id and cs.student_id = p_student_id and cs.active));
    if v_units = 0 or v_done <> v_units then raise exception 'Complete all approved lessons before claiming this certificate'; end if;
  end if;

  insert into public.certificates (student_id, program_id, serial, issue_date, honors, grade, status)
  values (p_student_id, p_program_id, public.next_certificate_serial(), current_date, p_honors, '', 'Valid')
  returning * into v_certificate;
  return v_certificate;
end $$;
revoke all on function public.issue_certificate(uuid, uuid, text) from public, anon;
grant execute on function public.issue_certificate(uuid, uuid, text) to authenticated;

-- Revocation is a fixed-role administrative power, NOT a grantable teacher permission.
create or replace function public.revoke_certificate(p_certificate_id uuid, p_reason text)
returns public.certificates language plpgsql security definer set search_path = public as $$
declare v_certificate public.certificates%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and status = 'Active' and role in ('School Admin', 'Super Admin')
  ) then raise exception 'Only active School Admin or Super Admin accounts may revoke certificates'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Provide a revocation reason (5–1000 characters)'; end if;
  select * into v_certificate from public.certificates where id = p_certificate_id for update;
  if v_certificate.id is null then raise exception 'Certificate not found'; end if;
  if v_certificate.status = 'Revoked' then return v_certificate; end if;
  update public.certificates set status = 'Revoked', revoked_at = now(), revoked_by = auth.uid(), revocation_reason = btrim(p_reason)
    where id = p_certificate_id returning * into v_certificate;
  return v_certificate;
end $$;
revoke all on function public.revoke_certificate(uuid, text) from public, anon;
grant execute on function public.revoke_certificate(uuid, text) to authenticated;

-- Existing public SELECT/verification remains intact. Block direct writes even
-- if an earlier permissive RLS policy exists: only checked RPCs write the register.
revoke insert, update, delete on public.certificates from anon, authenticated;
-- Also keep serials/holder identity immutable for privileged writers.
create or replace function public.protect_certificate_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.id, new.serial, new.student_id, new.program_id, new.issue_date) is distinct from
     (old.id, old.serial, old.student_id, old.program_id, old.issue_date) then
    raise exception 'Certificate identity cannot be changed';
  end if;
  if old.status = 'Revoked' and new.status is distinct from old.status then raise exception 'Revocation cannot be reversed'; end if;
  return new;
end $$;
revoke all on function public.protect_certificate_identity() from public;
drop trigger if exists protect_certificate_identity on public.certificates;
create trigger protect_certificate_identity before update on public.certificates for each row execute function public.protect_certificate_identity();
commit;
