-- SECURITY DEFINER RPCs must not be callable by anonymous clients.
-- Keep authenticated access for the app's signed-in portal and admin flows.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %I.%I(%s) from public', fn.nspname, fn.proname, fn.identity_args);
    execute format('grant execute on function %I.%I(%s) to authenticated', fn.nspname, fn.proname, fn.identity_args);
  end loop;
end $$;
