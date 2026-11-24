-- Remove the blanket authenticated access policies introduced by the
-- reconciliation baseline. Those permissive policies OR together with the
-- intended owner/staff policies and expose private rows to every signed-in user.
-- This migration is prepared for review; it has NOT been applied.
begin;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and left(policyname, 11) = 'reconciled_'
      and right(policyname, 11) = '_portal_all'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  -- Preserve the table-specific public-content policies from earlier
  -- migrations. The blanket policies bypass publication/approval filters.
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and left(policyname, 11) = 'reconciled_'
      and right(policyname, 12) = '_public_read'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- The reconciliation baseline also granted every authenticated user full
-- access to every private storage bucket, bypassing owner-prefix policies.
drop policy if exists reconciled_portal_write on storage.objects;

-- Certificate serials are verified through verify_public_certificate(), which
-- returns a deliberately limited projection. Do not expose the underlying
-- register (student IDs, grades, revocation metadata) to anonymous callers.
alter table public.certificates enable row level security;
revoke select on public.certificates from public, anon;
grant select on public.certificates to authenticated;
drop policy if exists certificates_read on public.certificates;
drop policy if exists certificates_read_authenticated on public.certificates;
drop policy if exists reconciled_certificates_public_read on public.certificates;
drop policy if exists reconciled_certificates_portal_all on public.certificates;
create policy certificates_read_authenticated on public.certificates
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.status = 'Active'
    )
    and (
      student_id = auth.uid()
      or (select public.has_permission('certificates.manage'))
    )
  );

commit;
