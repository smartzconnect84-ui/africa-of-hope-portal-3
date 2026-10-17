create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email text,
  add column if not exists program_ids uuid[] not null default '{}',
  add column if not exists cohort_ids uuid[] not null default '{}';

alter table public.system_settings
  add column if not exists website_settings jsonb not null default '{}'::jsonb;

create index if not exists profiles_email_idx on public.profiles (lower(email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'member'), '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'Student'),
    coalesce(new.raw_user_meta_data->>'status', 'Pending Approval')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  admin_email text := 'shedrickknungehn@gmail.com';
  admin_password text := 'Afrohope@2021';
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = admin_email limit 1;

  if admin_id is null then
    admin_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      admin_email, crypt(admin_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Shedrick K Nungehn","role":"Super Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  else
    update auth.users
      set encrypted_password = crypt(admin_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = admin_id;
  end if;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), admin_id::text, admin_id,
         jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true),
         'email', now(), now(), now()
  where not exists (
    select 1 from auth.identities i where i.user_id = admin_id and i.provider = 'email'
  );

  insert into public.profiles (id, name, full_name, email, phone, role, status, title, joined_date)
  values (admin_id, 'Shedrick K Nungehn', 'Shedrick K Nungehn', admin_email, '', 'Super Admin', 'Active', 'System Owner', current_date)
  on conflict (id) do update
    set name = 'Shedrick K Nungehn',
        full_name = 'Shedrick K Nungehn',
        email = admin_email,
        role = 'Super Admin',
        status = 'Active',
        title = 'System Owner',
        updated_at = now();
end $$;

insert into public.system_settings (academy_name)
select 'Africa of Hope' where not exists (select 1 from public.system_settings);

do $$
declare
  t text;
  data_tables text[] := array[
    'profiles','programs','program_modules','cohorts','cohort_students','attendance',
    'assignments','submissions','fee_transactions','certificates','announcements','system_settings'
  ];
begin
  foreach t in array data_tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null;
    end;
  end loop;
end $$;

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('certificates', 'certificates', true) on conflict (id) do nothing;

drop policy if exists certificates_public_read on storage.objects;
create policy certificates_public_read on storage.objects for select to anon
  using (bucket_id = 'certificates');