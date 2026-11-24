create or replace function public._dispatch_knock_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  select token into v_token from public.push_dispatch_token limit 1;
  if v_token is null then
    return new;
  end if;
  begin
    perform net.http_post(
      url := 'https://gatnzfjpuokopqyksqoy.supabase.co/functions/v1/knock-dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-dispatch', v_token),
      body := jsonb_build_object('notification_id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists notifications_dispatch_knock on public.notifications;
create trigger notifications_dispatch_knock
  after insert on public.notifications
  for each row
  execute function public._dispatch_knock_for_notification();
