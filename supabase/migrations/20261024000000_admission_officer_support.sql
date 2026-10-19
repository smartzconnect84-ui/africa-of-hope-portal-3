-- Additive upgrade; apply after the existing roles and support migrations.
begin;
insert into public.roles(name, label, description, sort)
values ('Admission Officer', 'Admission Officer', 'Reviews applicants, manages student admissions and follows up study-plan enquiries.', 45)
on conflict (name) do nothing;
insert into public.role_permissions(role, permission)
select 'Admission Officer', key from public.permissions
where key in ('people.view', 'students.manage', 'assistant.use', 'assistant.admin_help')
on conflict do nothing;

-- Existing roles retain access; admissions permission now drives admission access.
drop policy if exists "study plans staff read" on public.study_plans;
create policy "study plans staff read" on public.study_plans for select to authenticated
using (public.has_permission('students.manage') or public.has_permission('fees.manage'));
drop policy if exists "study plans staff update" on public.study_plans;
create policy "study plans staff update" on public.study_plans for update to authenticated
using (public.has_permission('students.manage') or public.has_permission('fees.manage'))
with check (public.has_permission('students.manage') or public.has_permission('fees.manage'));

-- Staff-interest requests use the same office inbox; submitting never creates an account.
alter table public.support_pledges drop constraint if exists support_pledges_kind_check;
alter table public.support_pledges add constraint support_pledges_kind_check
check (kind in ('donation', 'volunteer', 'partner', 'staff'));
drop policy if exists "support pledges staff read" on public.support_pledges;
create policy "support pledges staff read" on public.support_pledges for select to authenticated
using (public.has_permission('students.manage') or public.has_permission('fees.manage'));
drop policy if exists "support pledges staff update" on public.support_pledges;
create policy "support pledges staff update" on public.support_pledges for update to authenticated
using (public.has_permission('students.manage') or public.has_permission('fees.manage'))
with check (public.has_permission('students.manage') or public.has_permission('fees.manage'));
commit;
