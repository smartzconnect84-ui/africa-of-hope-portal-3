-- Shared cohort Q&A; depends on the existing academic-planning migration.
begin;
create or replace function public.can_read_discussion(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'Active')
    and (public.is_cohort_member(c) or public.is_cohort_teacher(c) or public.has_permission('academic_plans.approve'));
$$;
revoke all on function public.can_read_discussion(uuid) from public;
grant execute on function public.can_read_discussion(uuid) to authenticated;

create table if not exists public.discussion_threads (
  id text primary key,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  unit_id uuid references public.learning_units(id) on delete set null,
  author_id uuid not null references public.profiles(id),
  author_name text not null default '',
  author_role text not null default '',
  title text not null check (length(btrim(title)) between 1 and 240),
  body text not null check (length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create table if not exists public.discussion_replies (
  id text primary key,
  thread_id text not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  author_name text not null default '',
  author_role text not null default '',
  body text not null check (length(btrim(body)) between 1 and 10000),
  is_answer boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists discussion_threads_cohort_idx on public.discussion_threads(cohort_id, created_at desc);
create index if not exists discussion_replies_thread_idx on public.discussion_replies(thread_id, created_at);

-- Identity and answer labels cannot be supplied by a browser client.
create or replace function public.discussion_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.author_id <> auth.uid() then raise exception 'Invalid discussion author'; end if;
    select name, role into new.author_name, new.author_role from public.profiles
      where id = auth.uid() and status = 'Active';
    if not found then raise exception 'Active account required'; end if;
    new.created_at := now();
    if tg_table_name = 'discussion_replies' then new.is_answer := false; end if;
    if tg_table_name = 'discussion_threads' and new.unit_id is not null then
      if not exists (select 1 from public.learning_units u where u.id = new.unit_id
        and (u.cohort_id = new.cohort_id or (u.cohort_id is null and u.program_id = (select program_id from public.cohorts where id = new.cohort_id)))) then
        raise exception 'Lesson does not belong to this cohort';
      end if;
    end if;
  else
    if (to_jsonb(new) - 'is_answer') is distinct from (to_jsonb(old) - 'is_answer') then
      raise exception 'Only the answer flag can be updated';
    end if;
    select cohort_id into c from public.discussion_threads where id = new.thread_id;
    if not public.can_read_discussion(c) or not (public.is_cohort_teacher(c) or public.has_permission('academic_plans.approve')) then
      raise exception 'Only the cohort teacher or an academic administrator can mark answers';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists discussion_thread_guard on public.discussion_threads;
create trigger discussion_thread_guard before insert on public.discussion_threads for each row execute function public.discussion_guard();
drop trigger if exists discussion_reply_guard on public.discussion_replies;
create trigger discussion_reply_guard before insert or update on public.discussion_replies for each row execute function public.discussion_guard();

alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;
drop policy if exists discussion_threads_read on public.discussion_threads;
create policy discussion_threads_read on public.discussion_threads for select to authenticated using (public.can_read_discussion(cohort_id));
drop policy if exists discussion_threads_post on public.discussion_threads;
create policy discussion_threads_post on public.discussion_threads for insert to authenticated with check (author_id = auth.uid() and public.can_read_discussion(cohort_id));
drop policy if exists discussion_replies_read on public.discussion_replies;
create policy discussion_replies_read on public.discussion_replies for select to authenticated using (exists (select 1 from public.discussion_threads t where t.id = thread_id and public.can_read_discussion(t.cohort_id)));
drop policy if exists discussion_replies_post on public.discussion_replies;
create policy discussion_replies_post on public.discussion_replies for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.discussion_threads t where t.id = thread_id and public.can_read_discussion(t.cohort_id)));
drop policy if exists discussion_replies_answer on public.discussion_replies;
create policy discussion_replies_answer on public.discussion_replies for update to authenticated
using (exists (select 1 from public.discussion_threads t where t.id = thread_id and public.can_read_discussion(t.cohort_id) and (public.is_cohort_teacher(t.cohort_id) or public.has_permission('academic_plans.approve'))))
with check (exists (select 1 from public.discussion_threads t where t.id = thread_id and public.can_read_discussion(t.cohort_id) and (public.is_cohort_teacher(t.cohort_id) or public.has_permission('academic_plans.approve'))));
grant select, insert on public.discussion_threads, public.discussion_replies to authenticated;
grant update(is_answer) on public.discussion_replies to authenticated;
commit;
