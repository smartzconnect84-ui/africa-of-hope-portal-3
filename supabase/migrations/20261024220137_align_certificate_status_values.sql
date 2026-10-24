-- Keep the certificate register aligned with the application and RPC contract.
-- Older deployments used lowercase status values; normalize them before enforcing
-- the canonical public values used by verification and certificate issuance.
begin;

update public.certificates
set status = case
  when lower(status) = 'issued' then 'Valid'
  when lower(status) = 'revoked' then 'Revoked'
  else status
end
where lower(status) in ('issued', 'revoked');

alter table public.certificates
  drop constraint if exists certificates_status_check;

alter table public.certificates
  add constraint certificates_status_check
  check (status in ('Valid', 'Revoked'));

commit;
