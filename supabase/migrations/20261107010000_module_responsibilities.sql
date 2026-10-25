-- Assign programme modules to staff with explicit responsibility scopes.
create table if not exists public.module_responsibilities (
  id uuid primary key default gen_random_uuid(),
  program_module_id uuid not null references public.program_modules(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  responsibility text not null check (responsibility in ('owner', 'teacher', 'reviewer', 'assistant')),
  assigned_by uuid not null default auth.uid() references public.profiles(id),
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  unique (program_module_id, staff_id, responsibility)
);

create index if not exists module_responsibilities_staff_idx
  on public.module_responsibilities (staff_id, active);
create index if not exists module_responsibilities_module_idx
  on public.module_responsibilities (program_module_id, active);

alter table public.module_responsibilities enable row level security;
revoke all on public.module_responsibilities from anon;
grant select, insert, update, delete on public.module_responsibilities to authenticated;

drop policy if exists module_responsibilities_read on public.module_responsibilities;
drop policy if exists module_responsibilities_manage on public.module_responsibilities;
create policy module_responsibilities_read on public.module_responsibilities
  for select to authenticated
  using (staff_id = auth.uid() or (select public.has_permission('academic_plans.approve')));
create policy module_responsibilities_manage on public.module_responsibilities
  for all to authenticated
  using ((select public.has_permission('academic_plans.approve')))
  with check ((select public.has_permission('academic_plans.approve')));

comment on table public.module_responsibilities is 'Role-based staff responsibility assignments for programme modules.';
