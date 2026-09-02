begin;

create or replace function public.can_edit_tracker_plan(
  p_plan_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tracker_plans p
    where p.id = p_plan_id
      and (
        p.created_by = p_user_id
        or (
          p.visibility = 'couple'
          and p.edit_scope = 'participants'
          and public.is_tracker_couple_member(p.couple_id, p_user_id)
          and exists (
            select 1
            from public.tracker_plan_participants participant
            where participant.plan_id = p.id
              and participant.user_id = p_user_id
              and participant.response = 'accepted'
          )
        )
      )
  );
$$;

revoke all on function public.can_edit_tracker_plan(uuid, uuid) from public, anon;
grant execute on function public.can_edit_tracker_plan(uuid, uuid) to authenticated;

commit;
