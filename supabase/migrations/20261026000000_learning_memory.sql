-- Additive only. Apply after the existing academic migrations; no historical data is changed.
create table if not exists public.learning_memory (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  unit_id uuid not null references public.learning_units(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  lesson_title text not null default '' check (length(lesson_title) <= 250),
  bookmarked boolean not null default false,
  last_opened_at timestamptz,
  resource_id uuid references public.training_materials(id) on delete set null,
  position_seconds double precision not null default 0 check (position_seconds between 0 and 864000),
  scroll_top double precision not null default 0 check (scroll_top between 0 and 10000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);
alter table public.learning_memory enable row level security;
grant select, insert, update, delete on public.learning_memory to authenticated;
drop policy if exists learning_memory_read on public.learning_memory;
drop policy if exists learning_memory_insert on public.learning_memory;
drop policy if exists learning_memory_update on public.learning_memory;
drop policy if exists learning_memory_delete on public.learning_memory;
create policy learning_memory_read on public.learning_memory for select to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.learning_units u where u.id = unit_id));
create policy learning_memory_insert on public.learning_memory for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.learning_units u where u.id = unit_id and u.program_id = program_id));
create policy learning_memory_update on public.learning_memory for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.learning_units u where u.id = unit_id and u.program_id = program_id));
create policy learning_memory_delete on public.learning_memory for delete to authenticated using (user_id = auth.uid());
