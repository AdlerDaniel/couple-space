-- Create notifications without exposing a partner's notification row back to
-- the actor. Returning the inserted row through PostgREST would require a
-- broader SELECT policy, including read state and message contents.
create or replace function public.create_couple_notification(
  p_couple_id uuid,
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_href text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  notification_id uuid := gen_random_uuid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.couples couple
    where couple.id = p_couple_id
      and caller_id in (couple.partner_one_id, couple.partner_two_id)
      and p_recipient_id in (couple.partner_one_id, couple.partner_two_id)
  ) then
    raise exception 'Notification recipient is not in the caller''s couple'
      using errcode = '42501';
  end if;

  insert into public.couple_notifications (
    id,
    couple_id,
    recipient_id,
    actor_id,
    type,
    title,
    body,
    href
  )
  values (
    notification_id,
    p_couple_id,
    p_recipient_id,
    caller_id,
    p_type,
    p_title,
    nullif(btrim(p_body), ''),
    nullif(btrim(p_href), '')
  );

  return notification_id;
end;
$$;

revoke all on function public.create_couple_notification(uuid, uuid, text, text, text, text)
  from public, anon;
grant execute on function public.create_couple_notification(uuid, uuid, text, text, text, text)
  to authenticated;
