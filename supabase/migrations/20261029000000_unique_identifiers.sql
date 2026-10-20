-- Review and apply only with owner approval. Existing UUID primary keys stay unchanged.
-- PostgreSQL assigns distinct numbers to existing rows when adding an identity column.
begin;

alter table public.profiles add column if not exists account_number bigint generated always as identity;
alter table public.programs add column if not exists course_number bigint generated always as identity;
create unique index if not exists profiles_account_number_unique on public.profiles (account_number);
create unique index if not exists programs_course_number_unique on public.programs (course_number);

-- Numbers are not editable even by a client with profile/program write permission.
create or replace function public.protect_record_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'profiles' and (to_jsonb(new)->'account_number') is distinct from (to_jsonb(old)->'account_number') then
    raise exception 'Account numbers cannot be changed';
  elsif tg_table_name = 'programs' and (to_jsonb(new)->'course_number') is distinct from (to_jsonb(old)->'course_number') then
    raise exception 'Course numbers cannot be changed';
  end if;
  return new;
end $$;
revoke all on function public.protect_record_number() from public;
drop trigger if exists protect_account_number on public.profiles;
create trigger protect_account_number before update on public.profiles for each row execute function public.protect_record_number();
drop trigger if exists protect_course_number on public.programs;
create trigger protect_course_number before update on public.programs for each row execute function public.protect_record_number();

commit;
