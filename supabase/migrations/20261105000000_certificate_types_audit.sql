-- Additive only. Prepared for review: back up and test in staging before approved production use.
-- Requires 20261029010000_certificate_controls.sql and 20261030000000_production_access_hardening.sql.
begin;

-- 1. Certificate type and completion date on the register (existing rows keep their serial).
alter table public.certificates
  add column if not exists certificate_type text default 'Certificate of Completion',
  add column if not exists completion_date date;

update public.certificates set certificate_type = 'Certificate of Completion'
where certificate_type is null or btrim(certificate_type) = '';
update public.certificates set completion_date = issue_date where completion_date is null;
alter table public.certificates alter column certificate_type set default 'Certificate of Completion';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'certificates_type_check') then
    alter table public.certificates add constraint certificates_type_check check (certificate_type in (
      'Certificate of Completion', 'Certificate of Achievement', 'Certificate of Participation',
      'Professional Training Certificate', 'Certificate of Excellence', 'Diploma Certificate'));
  end if;
end $$;

-- 2. Audit trail for issuance and revocation. Append-only: no client write grants.
create table if not exists public.certificate_audit (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid references public.certificates(id) on delete set null,
  serial text not null,
  action text not null check (action in ('issued', 'revoked')),
  actor_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists certificate_audit_serial_idx on public.certificate_audit (lower(btrim(serial)));
alter table public.certificate_audit enable row level security;
revoke all on public.certificate_audit from anon, authenticated;
grant select on public.certificate_audit to authenticated;

drop policy if exists certificate_audit_staff_only on public.certificate_audit;
create policy certificate_audit_staff_only on public.certificate_audit as restrictive
  for select to authenticated using (public.has_permission('certificates.manage'));

create or replace function public.log_certificate_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.certificate_audit (certificate_id, serial, action, actor_id, reason)
  values (new.id, new.serial, case when new.status = 'Revoked' then 'revoked' else 'issued' end,
          auth.uid(), case when new.status = 'Revoked' then new.revocation_reason else null end);
  return new;
end $$;
revoke all on function public.log_certificate_event() from public;

drop trigger if exists log_certificate_event on public.certificates;
create trigger log_certificate_event after insert or update of status on public.certificates
  for each row execute function public.log_certificate_event();

-- 3. Issuing accepts an award type and an explicit completion date. The previous
--    three-argument signature is retired so one checked path remains.
drop function if exists public.issue_certificate(uuid, uuid, text);

create or replace function public.issue_certificate(
  p_student_id uuid,
  p_program_id uuid,
  p_honors text default 'Pass',
  p_certificate_type text default 'Certificate of Completion',
  p_completion_date date default null
)
returns public.certificates language plpgsql security definer set search_path = public as $$
declare
  v_certificate public.certificates%rowtype;
  v_student public.profiles%rowtype;
  v_manager boolean;
  v_units bigint;
  v_done bigint;
  v_type text := coalesce(nullif(btrim(p_certificate_type), ''), 'Certificate of Completion');
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and status = 'Active') then
    raise exception 'An active signed-in account is required';
  end if;
  v_manager := public.has_permission('certificates.manage');
  if not v_manager and p_student_id is distinct from auth.uid() then raise exception 'Not authorized'; end if;
  if p_honors is null or p_honors not in ('Pass', 'Merit', 'Distinction') then raise exception 'Invalid award class'; end if;
  if not v_manager and p_honors <> 'Pass' then raise exception 'Only certificate staff can assign honors'; end if;
  if v_type not in ('Certificate of Completion', 'Certificate of Achievement', 'Certificate of Participation',
                    'Professional Training Certificate', 'Certificate of Excellence', 'Diploma Certificate') then
    raise exception 'Invalid certificate type';
  end if;
  -- A diploma is only issued on an administrator's authority.
  if v_type = 'Diploma Certificate' and not v_manager then raise exception 'Not authorized for that certificate type'; end if;
  if p_completion_date is not null and p_completion_date > current_date then
    raise exception 'The completion date cannot be in the future';
  end if;

  select * into v_student from public.profiles where id = p_student_id and status = 'Active';
  if v_student.id is null then raise exception 'The holder must be an active account'; end if;
  if not exists (select 1 from public.programs where id = p_program_id) then raise exception 'Programme not found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_program_id::text, 0));
  select * into v_certificate from public.certificates
    where student_id = p_student_id and program_id = p_program_id
    order by issue_date desc nulls last, id limit 1;
  -- Issuing again for the same holder and programme returns the existing record:
  -- that is the authorised reissue path and it never renumbers a serial.
  if v_certificate.id is not null then return v_certificate; end if;

  if not v_manager then
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

  insert into public.certificates
    (student_id, program_id, serial, issue_date, honors, grade, status, certificate_type, completion_date)
  values
    (p_student_id, p_program_id, public.next_certificate_serial(), current_date, p_honors, '', 'Valid',
     v_type, coalesce(p_completion_date, current_date))
  returning * into v_certificate;
  return v_certificate;
end $$;
revoke all on function public.issue_certificate(uuid, uuid, text, text, date) from public, anon;
grant execute on function public.issue_certificate(uuid, uuid, text, text, date) to authenticated;

-- 4. Public verification also reports the award type, completion date and institution.
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
    'certificateType', coalesce(c.certificate_type, 'Certificate of Completion'),
    'completionDate', c.completion_date,
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

commit;
