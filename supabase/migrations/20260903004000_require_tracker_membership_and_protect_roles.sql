begin;

create or replace function public.can_view_tracker_plan(p_plan_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tracker_plans plan
    where plan.id = p_plan_id
      and public.is_tracker_couple_member(plan.couple_id, p_user_id)
      and (plan.created_by = p_user_id or plan.visibility = 'couple')
  );
$$;

create or replace function public.can_edit_tracker_plan(p_plan_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tracker_plans plan
    where plan.id = p_plan_id
      and public.is_tracker_couple_member(plan.couple_id, p_user_id)
      and (
        plan.created_by = p_user_id
        or (
          plan.visibility = 'couple' and plan.edit_scope = 'participants'
          and exists (
            select 1 from public.tracker_plan_participants participant
            where participant.plan_id = plan.id and participant.user_id = p_user_id
              and participant.response = 'accepted'
          )
        )
      )
  );
$$;

create or replace function public.protect_tracker_plan_identity()
returns trigger language plpgsql set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if new.id <> old.id or new.couple_id <> old.couple_id
     or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Plan identity cannot be changed' using errcode = '42501';
  end if;
  if caller_id is not null then
    if not public.is_tracker_couple_member(old.couple_id, caller_id) then
      raise exception 'Current couple membership required' using errcode = '42501';
    end if;
    if caller_id <> old.created_by and (
      new.participant_scope is distinct from old.participant_scope
      or new.assignee_id is distinct from old.assignee_id
      or new.visibility is distinct from old.visibility
      or new.edit_scope is distinct from old.edit_scope
    ) then
      raise exception 'Only the author can change participants, assignee or permissions' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(caller_id, new.updated_by, old.updated_by);
  return new;
end;
$$;

create or replace function public.protect_tracker_participant_identity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  plan_author uuid;
begin
  if new.id <> old.id or new.plan_id <> old.plan_id or new.couple_id <> old.couple_id
     or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'Participant identity cannot be changed' using errcode = '42501';
  end if;
  if caller_id is null then return new; end if;
  select created_by into plan_author from public.tracker_plans where id = old.plan_id;
  if not public.is_tracker_couple_member(old.couple_id, caller_id)
     or not public.can_view_tracker_plan(old.plan_id, caller_id) then
    raise exception 'Current couple membership and plan access required' using errcode = '42501';
  end if;
  if new.response is distinct from old.response and caller_id <> old.user_id then
    raise exception 'Only the invited user can answer an invitation' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and caller_id <> plan_author then
    raise exception 'Only the plan author can assign participant roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tracker_participant_identity_guard on public.tracker_plan_participants;
create trigger tracker_participant_identity_guard before update on public.tracker_plan_participants
for each row execute function public.protect_tracker_participant_identity();

alter policy tracker_plans_select_visible on public.tracker_plans
using (public.can_view_tracker_plan(id, (select auth.uid())));
alter policy tracker_plans_delete_creator on public.tracker_plans
using (created_by = (select auth.uid()) and public.is_tracker_couple_member(couple_id, (select auth.uid())));

alter policy tracker_plan_participants_insert on public.tracker_plan_participants
with check (
  public.is_tracker_couple_member(couple_id, (select auth.uid()))
  and public.is_tracker_couple_member(couple_id, user_id)
  and exists (select 1 from public.tracker_plans plan where plan.id = plan_id and plan.created_by = (select auth.uid()))
);
alter policy tracker_plan_participants_update on public.tracker_plan_participants
using (
  public.can_view_tracker_plan(plan_id, (select auth.uid()))
  and (user_id = (select auth.uid()) or exists (
    select 1 from public.tracker_plans plan where plan.id = plan_id and plan.created_by = (select auth.uid())
  ))
)
with check (
  public.can_view_tracker_plan(plan_id, (select auth.uid()))
  and public.is_tracker_couple_member(couple_id, user_id)
);
alter policy tracker_plan_participants_delete on public.tracker_plan_participants
using (
  public.can_view_tracker_plan(plan_id, (select auth.uid()))
  and (user_id = (select auth.uid()) or exists (
    select 1 from public.tracker_plans plan where plan.id = plan_id and plan.created_by = (select auth.uid())
  ))
);

alter policy tracker_comments_update_own on public.tracker_plan_comments
using (user_id = (select auth.uid()) and public.can_view_tracker_plan(plan_id, (select auth.uid())))
with check (user_id = (select auth.uid()) and public.can_view_tracker_plan(plan_id, (select auth.uid())));
alter policy tracker_comments_delete_own on public.tracker_plan_comments
using (user_id = (select auth.uid()) and public.can_view_tracker_plan(plan_id, (select auth.uid())));
alter policy tracker_attachments_delete_own on public.tracker_plan_attachments
using (
  public.can_view_tracker_plan(plan_id, (select auth.uid()))
  and (owner_id = (select auth.uid()) or exists (
    select 1 from public.tracker_plans plan where plan.id = plan_id and plan.created_by = (select auth.uid())
  ))
);
alter policy tracker_memory_links_delete_own on public.tracker_plan_memory_links
using (created_by = (select auth.uid()) and public.can_view_tracker_plan(plan_id, (select auth.uid())));
alter policy tracker_occurrences_update on public.tracker_plan_occurrence_overrides
with check (updated_by = (select auth.uid()) and public.can_edit_tracker_plan(plan_id, (select auth.uid())));

-- All media paths must agree with the plan's actual couple. Authors may remove
-- partner-uploaded media before deleting the plan; SELECT is not broadened.
alter policy tracker_media_select on storage.objects using (
  bucket_id = 'tracker-media'
  and exists (
    select 1 from public.tracker_plans plan
    where plan.id = public.tracker_safe_uuid((storage.foldername(name))[2])
      and plan.couple_id = public.tracker_safe_uuid((storage.foldername(name))[1])
      and public.can_view_tracker_plan(plan.id, (select auth.uid()))
  )
);
alter policy tracker_media_insert on storage.objects with check (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and exists (
    select 1 from public.tracker_plans plan
    where plan.id = public.tracker_safe_uuid((storage.foldername(name))[2])
      and plan.couple_id = public.tracker_safe_uuid((storage.foldername(name))[1])
      and public.can_view_tracker_plan(plan.id, (select auth.uid()))
  )
);
alter policy tracker_media_update on storage.objects using (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and public.is_tracker_couple_member(public.tracker_safe_uuid((storage.foldername(name))[1]), (select auth.uid()))
  and public.can_view_tracker_plan(public.tracker_safe_uuid((storage.foldername(name))[2]), (select auth.uid()))
) with check (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and exists (
    select 1 from public.tracker_plans plan
    where plan.id = public.tracker_safe_uuid((storage.foldername(name))[2])
      and plan.couple_id = public.tracker_safe_uuid((storage.foldername(name))[1])
      and public.can_view_tracker_plan(plan.id, (select auth.uid()))
  )
);
alter policy tracker_media_delete on storage.objects using (
  bucket_id = 'tracker-media'
  and public.is_tracker_couple_member(public.tracker_safe_uuid((storage.foldername(name))[1]), (select auth.uid()))
  and (
    (storage.foldername(name))[3] = (select auth.uid())::text
    or exists (
      select 1 from public.tracker_plans plan
      where plan.id = public.tracker_safe_uuid((storage.foldername(name))[2])
        and plan.couple_id = public.tracker_safe_uuid((storage.foldername(name))[1])
        and plan.created_by = (select auth.uid())
    )
  )
);

revoke all on function public.protect_tracker_participant_identity() from public, anon, authenticated;
commit;
