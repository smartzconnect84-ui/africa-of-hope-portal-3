-- Discussion edit/delete and Aptitude Control inserts are offered in the portal
-- but had no RLS policy. Postgres therefore rejected every one of those writes
-- while the screens still showed "updated/deleted", and the change disappeared
-- on the next reload.
--
-- This migration only adds the missing write paths. It does not widen who can
-- read a discussion, change any stored role, or grant new table privileges
-- (authenticated already holds INSERT/UPDATE/DELETE on these tables).
begin;

-- ── 1. Discussion guard ─────────────────────────────────────────────────────
-- INSERT behaviour is unchanged. UPDATE is now split by table:
--   threads — the author or a moderator may change the question text only.
--   replies — the author may edit the text; only the cohort teacher or an
--             academic administrator may set/unset the answer flag.
-- Identity columns (id, author, cohort, thread, created_at) are immutable so a
-- client cannot re-parent a post or impersonate another author.
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
  elsif tg_table_name = 'discussion_threads' then
    if new.id <> old.id
       or new.author_id <> old.author_id
       or new.cohort_id <> old.cohort_id
       or new.unit_id is distinct from old.unit_id
       or new.created_at <> old.created_at
       or new.author_name <> old.author_name
       or new.author_role <> old.author_role then
      raise exception 'Only the question title and details can be updated';
    end if;
  else
    if new.id <> old.id
       or new.author_id <> old.author_id
       or new.thread_id <> old.thread_id
       or new.created_at <> old.created_at
       or new.author_name <> old.author_name
       or new.author_role <> old.author_role then
      raise exception 'Only the reply text or answer flag can be updated';
    end if;
    if (to_jsonb(new) - 'is_answer') is distinct from (to_jsonb(old) - 'is_answer') then
      -- The author corrects their own text; a cohort instructor or academic
      -- administrator may also moderate it (the same people the UI lets edit).
      select cohort_id into c from public.discussion_threads where id = new.thread_id;
      if auth.uid() is null or (old.author_id <> auth.uid() and not (public.is_cohort_teacher(c) or public.has_permission('academic_plans.approve'))) then
        raise exception 'Only the author or a cohort instructor can edit this reply';
      end if;
    end if;
    if new.is_answer is distinct from old.is_answer then
      select cohort_id into c from public.discussion_threads where id = new.thread_id;
      if not public.can_read_discussion(c) or not (public.is_cohort_teacher(c) or public.has_permission('academic_plans.approve')) then
        raise exception 'Only the cohort teacher or an academic administrator can mark answers';
      end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists discussion_thread_guard on public.discussion_threads;
create trigger discussion_thread_guard before insert or update on public.discussion_threads
  for each row execute function public.discussion_guard();

-- ── 2. Thread edit/delete: author or moderator ──────────────────────────────
drop policy if exists discussion_threads_edit on public.discussion_threads;
create policy discussion_threads_edit on public.discussion_threads for update to authenticated
using (
  author_id = auth.uid()
  or public.is_cohort_teacher(cohort_id)
  or public.has_permission('academic_plans.approve')
)
with check (
  author_id = auth.uid()
  or public.is_cohort_teacher(cohort_id)
  or public.has_permission('academic_plans.approve')
);

drop policy if exists discussion_threads_delete on public.discussion_threads;
create policy discussion_threads_delete on public.discussion_threads for delete to authenticated
using (
  author_id = auth.uid()
  or public.is_cohort_teacher(cohort_id)
  or public.has_permission('academic_plans.approve')
);

-- ── 3. Reply edit/delete: author, or a moderator of the thread's cohort ─────
-- Replaces the answer-only policy: the guard above still limits the answer
-- flag to instructors, while this covers a student correcting their own text.
drop policy if exists discussion_replies_answer on public.discussion_replies;
drop policy if exists discussion_replies_edit on public.discussion_replies;
create policy discussion_replies_edit on public.discussion_replies for update to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.discussion_threads t
    where t.id = thread_id
      and (public.is_cohort_teacher(t.cohort_id) or public.has_permission('academic_plans.approve'))
  )
)
with check (
  author_id = auth.uid()
  or exists (
    select 1 from public.discussion_threads t
    where t.id = thread_id
      and (public.is_cohort_teacher(t.cohort_id) or public.has_permission('academic_plans.approve'))
  )
);

drop policy if exists discussion_replies_delete on public.discussion_replies;
create policy discussion_replies_delete on public.discussion_replies for delete to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.discussion_threads t
    where t.id = thread_id
      and (public.is_cohort_teacher(t.cohort_id) or public.has_permission('academic_plans.approve'))
  )
);

-- ── 4. Aptitude Control settings ────────────────────────────────────────────
-- The editor writes with `upsert`, which Postgres treats as INSERT ... ON
-- CONFLICT DO UPDATE and therefore requires an INSERT policy. The row is a
-- single fixed row (id = 1), but the insert path is still checked.
-- Super Admin was missing from the role list and could not publish the rules.
drop policy if exists aptitude_settings_write_staff on public.aptitude_control_settings;
create policy aptitude_settings_write_staff on public.aptitude_control_settings for update to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'Active'
    and p.role in ('Super Admin','School Admin','Registrar','Director of Education'))
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'Active'
    and p.role in ('Super Admin','School Admin','Registrar','Director of Education'))
);

drop policy if exists aptitude_settings_insert_staff on public.aptitude_control_settings;
create policy aptitude_settings_insert_staff on public.aptitude_control_settings for insert to authenticated
with check (
  id = 1
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'Active'
    and p.role in ('Super Admin','School Admin','Registrar','Director of Education'))
);

commit;
