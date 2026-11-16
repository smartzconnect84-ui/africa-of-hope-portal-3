-- AOH 2026/2027 wiring: education level on registration, certificate
-- verification support, and the storage buckets the portal expects.
--
-- Apply in Supabase Dashboard -> SQL editor (paste this whole file, Run).
-- Safe to re-run: every statement is additive, and the certificate block
-- adapts to the live schema instead of assuming it. A plain
--   create index on public.certificates (serial);
-- failed with 42703 "column serial does not exist" on an older register,
-- which aborted the whole script (so the buckets never got created either).

-- 1) Level of Education captured at registration (replaces ID/Documents).
alter table public.profiles
  add column if not exists education_level text;

-- 2) Certificates register.
--    The portal reads and writes student_id, program_id, serial, issue_date,
--    honors, grade and status. Create the table when it is missing, otherwise
--    add whichever of those columns the live table predates, then give every
--    existing row a serial so the public verification panel can find it.
do $$
declare
  expected text[] := array['serial', 'issue_date', 'honors', 'grade', 'status', 'student_id', 'program_id'];
  added text[] := '{}';
  col text;
begin
  if to_regclass('public.certificates') is null then
    create table public.certificates (
      id uuid primary key default gen_random_uuid(),
      student_id uuid references public.profiles(id) on delete cascade,
      program_id uuid references public.programs(id) on delete set null,
      serial text,
      issue_date date,
      honors text,
      grade text,
      status text not null default 'Valid',
      created_at timestamptz not null default now()
    );

    alter table public.certificates enable row level security;
    grant select on public.certificates to anon, authenticated;

    execute 'drop policy if exists certificates_read on public.certificates';
    execute 'create policy certificates_read on public.certificates for select using (true)';

    if to_regprocedure('public.has_permission(text)') is not null then
      execute 'drop policy if exists certificates_write on public.certificates';
      execute $p$
        create policy certificates_write on public.certificates for all to authenticated
          using ((select public.has_permission('certificates.manage')))
          with check ((select public.has_permission('certificates.manage')))
      $p$;
    else
      execute 'drop policy if exists certificates_write on public.certificates';
      execute 'create policy certificates_write on public.certificates for all to authenticated using (true) with check (true)';
    end if;

    raise notice 'created public.certificates';
  else
    foreach col in array expected loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'certificates'
          and column_name = col
      ) then
        execute format(
          'alter table public.certificates add column if not exists %I %s',
          col,
          case col
            when 'student_id' then 'uuid'
            when 'program_id' then 'uuid'
            when 'issue_date' then 'date'
            else 'text'
          end
        );
        added := added || col;
      end if;
    end loop;

    if array_length(added, 1) > 0 then
      raise notice 'added missing certificates columns: %', array_to_string(added, ', ');
    end if;

    -- Backfill serials for any certificate issued before the column existed.
    execute $p$
      update public.certificates
         set serial = 'AOH-'
                     || extract(year from coalesce(issue_date, current_date))::int
                     || '-'
                     || upper(substr(md5(coalesce(id::text, '') || coalesce(issue_date::text, '')), 1, 5))
       where serial is null or btrim(serial) = ''
    $p$;

    raise notice 'certificates columns: %', (
      select string_agg(column_name, ', ' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'certificates'
    );
  end if;
end $$;

-- 3) Fast certificate serial lookups for the verification panel.
create index if not exists certificates_serial_idx
  on public.certificates (serial);

-- 4) Storage buckets the app uses (avatars, programme images,
--    personal documents, CMS assets like the logo).
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('program-images', 'program-images', true),
  ('documents', 'documents', false),
  ('site-assets', 'site-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public read so the logo and programme images render for visitors.
drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects for select
  using (bucket_id = 'site-assets');
