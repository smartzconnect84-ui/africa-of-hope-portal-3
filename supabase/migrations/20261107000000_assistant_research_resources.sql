create table if not exists public.assistant_research_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 180),
  content text not null check (length(trim(content)) between 1 and 50000),
  source_url text,
  visibility text not null default 'private' check (visibility in ('private','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_research_resources enable row level security;
grant select, insert, update, delete on public.assistant_research_resources to authenticated;
drop policy if exists assistant_research_owner_read on public.assistant_research_resources;
drop policy if exists assistant_research_owner_insert on public.assistant_research_resources;
drop policy if exists assistant_research_owner_update on public.assistant_research_resources;
drop policy if exists assistant_research_owner_delete on public.assistant_research_resources;
create policy assistant_research_owner_read on public.assistant_research_resources for select to authenticated
using (owner_id = auth.uid() or (visibility = 'staff' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'Student' and p.status = 'Active')));
create policy assistant_research_owner_insert on public.assistant_research_resources for insert to authenticated with check (owner_id = auth.uid());
create policy assistant_research_owner_update on public.assistant_research_resources for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy assistant_research_owner_delete on public.assistant_research_resources for delete to authenticated using (owner_id = auth.uid());
