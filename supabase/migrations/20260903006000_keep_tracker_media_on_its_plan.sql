begin;

-- A file index may reference only a comment on the same plan. A plain FK does
-- not enforce this and could otherwise couple unrelated cascade deletions.
create or replace function public.enforce_tracker_attachment_comment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.comment_id is not null and not exists (
    select 1 from public.tracker_plan_comments comment
    where comment.id = new.comment_id
      and comment.plan_id = new.plan_id
      and comment.couple_id = new.couple_id
  ) then
    raise exception 'Attachment and comment must belong to the same plan' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tracker_attachment_comment_guard
before insert or update on public.tracker_plan_attachments
for each row execute function public.enforce_tracker_attachment_comment();

-- Moving a comment after files have been attached would circumvent the insert
-- guard and could also silently change its privacy boundary.
create or replace function public.protect_tracker_comment_identity()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id <> old.id or new.plan_id <> old.plan_id or new.couple_id <> old.couple_id
     or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'Comment identity cannot be changed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tracker_comment_identity_guard
before update on public.tracker_plan_comments
for each row execute function public.protect_tracker_comment_identity();

revoke all on function public.enforce_tracker_attachment_comment() from public, anon, authenticated;
revoke all on function public.protect_tracker_comment_identity() from public, anon, authenticated;
commit;
