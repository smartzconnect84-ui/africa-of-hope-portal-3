drop policy if exists website_enquiries_staff_all on public.website_enquiries;
create policy website_enquiries_staff_all on public.website_enquiries
  for all to authenticated
  using (
    public.has_permission('students.manage')
    or public.has_permission('fees.manage')
  )
  with check (
    public.has_permission('students.manage')
    or public.has_permission('fees.manage')
  );
