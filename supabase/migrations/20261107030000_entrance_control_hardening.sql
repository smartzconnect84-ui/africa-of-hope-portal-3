-- Backend control hardening for mandatory entrance tests.
-- Allows staff to create/update the singleton settings row via upsert(id=1)
-- and keeps applicant PII readable only by staff roles.

alter table public.entrance_settings enable row level security;

drop policy if exists entrance_settings_write_staff on public.entrance_settings;
create policy entrance_settings_write_staff on public.entrance_settings
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Director of Education'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Director of Education'))
  );

-- Staff read for gating approvals; inserts stay open so guests/applicants can record results.
drop policy if exists entrance_results_read_staff on public.entrance_test_results;
create policy entrance_results_read_staff on public.entrance_test_results
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('School Admin','Registrar','Admission Officer','Teacher','Executive Assistant','Research Officer','Data Entry Officer','Customer Care Officer','Public Relations Officer','Director of Education','Finance Officer'))
  );
