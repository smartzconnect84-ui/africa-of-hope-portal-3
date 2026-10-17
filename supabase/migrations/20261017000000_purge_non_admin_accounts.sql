-- Re-run the "keep only the super admin" purge from 20260102000000_live_backend_config.sql.
-- Any accounts created since (self-registration, invites, etc.) other than
-- shedrickknungehn@gmail.com are removed from both auth.users and public.profiles.
do $$
declare
  admin_email text := 'shedrickknungehn@gmail.com';  -- pragma: allowlist secret
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = admin_email limit 1;

  if admin_id is null then
    raise notice 'Super admin % not found in auth.users; skipping purge to avoid deleting everyone.', admin_email;
    return;
  end if;

  begin
    delete from public.profiles where id <> admin_id;
  exception when others then null;
  end;

  begin
    delete from auth.users where id <> admin_id;
  exception when others then null;
  end;
end $$;
