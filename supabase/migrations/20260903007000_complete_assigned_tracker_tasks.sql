begin;

create or replace function public.complete_tracker_assigned_task(
  p_plan_id uuid,
  p_occurrence_date date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  plan_row public.tracker_plans;
  base_date date;
  pair_zone text;
  interval_value integer;
  day_difference integer;
  week_difference integer;
  previous_override_status text;
  did_change boolean := false;
begin
  if caller_id is null or p_plan_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select plan.* into plan_row
  from public.tracker_plans plan
  where plan.id = p_plan_id
  for update;

  if plan_row.id is null
     or not public.is_tracker_couple_member(plan_row.couple_id, caller_id)
     or not public.can_view_tracker_plan(plan_row.id, caller_id)
     or plan_row.kind <> 'task'
     or plan_row.assignee_id is distinct from caller_id
     or plan_row.status = 'cancelled'
     or not exists (
       select 1 from public.tracker_plan_participants participant
       where participant.plan_id = plan_row.id
         and participant.user_id = caller_id
         and participant.response = 'accepted'
     ) then
    raise exception 'Only the accepted assignee may complete this task' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tracker-plan:' || plan_row.id::text, 0)
  );

  select coalesce((
    select profile.time_zone
    from public.couple_profiles profile
    where profile.couple_id = plan_row.couple_id
      and exists (
        select 1 from pg_catalog.pg_timezone_names zone
        where zone.name = profile.time_zone
      )
  ), 'Europe/Moscow') into pair_zone;

  base_date := case when plan_row.all_day
    then plan_row.start_date
    else (plan_row.starts_at at time zone pair_zone)::date
  end;
  interval_value := greatest(1, plan_row.repeat_interval);

  if plan_row.repeat_mode = 'none' then
    if p_occurrence_date is not null and p_occurrence_date <> base_date then
      raise exception 'Invalid task occurrence' using errcode = '22023';
    end if;
    if plan_row.status <> 'done' then
      update public.tracker_plans
      set status = 'done', updated_by = caller_id, updated_at = now()
      where id = plan_row.id;
      did_change := true;
    end if;
  else
    if p_occurrence_date is null
       or p_occurrence_date < base_date
       or (plan_row.repeat_until is not null and p_occurrence_date > plan_row.repeat_until) then
      raise exception 'Invalid task occurrence' using errcode = '22023';
    end if;
    day_difference := p_occurrence_date - base_date;
    week_difference := (
      (p_occurrence_date - (extract(isodow from p_occurrence_date)::integer - 1))
      - (base_date - (extract(isodow from base_date)::integer - 1))
    ) / 7;
    if not (
      (plan_row.repeat_mode = 'daily' and day_difference % interval_value = 0)
      or (
        plan_row.repeat_mode = 'weekly'
        and extract(isodow from p_occurrence_date)::smallint = any(
          case when cardinality(plan_row.repeat_weekdays) = 0
            then array[extract(isodow from base_date)::smallint]
            else plan_row.repeat_weekdays
          end
        )
        and week_difference % interval_value = 0
      )
      or (
        plan_row.repeat_mode = 'monthly'
        and extract(day from p_occurrence_date) = extract(day from base_date)
        and (
          (extract(year from p_occurrence_date)::integer - extract(year from base_date)::integer) * 12
          + extract(month from p_occurrence_date)::integer - extract(month from base_date)::integer
        ) % interval_value = 0
      )
      or (
        plan_row.repeat_mode = 'yearly'
        and extract(day from p_occurrence_date) = extract(day from base_date)
        and extract(month from p_occurrence_date) = extract(month from base_date)
        and (extract(year from p_occurrence_date)::integer - extract(year from base_date)::integer)
          % interval_value = 0
      )
    ) then
      raise exception 'Invalid task occurrence' using errcode = '22023';
    end if;

    select override.status into previous_override_status
    from public.tracker_plan_occurrence_overrides override
    where override.plan_id = plan_row.id
      and override.occurrence_date = p_occurrence_date
    for update;

    if previous_override_status = 'cancelled' then
      raise exception 'Cancelled task occurrence cannot be completed' using errcode = '22023';
    end if;
    if previous_override_status is distinct from 'done' then
      insert into public.tracker_plan_occurrence_overrides (
        plan_id, couple_id, occurrence_date, status, updated_by, updated_at
      ) values (
        plan_row.id, plan_row.couple_id, p_occurrence_date, 'done', caller_id, now()
      )
      on conflict (plan_id, occurrence_date) do update set
        status = 'done', updated_by = caller_id, updated_at = now();
      did_change := true;
    end if;
  end if;

  if did_change then
    insert into public.tracker_plan_activity (
      plan_id, couple_id, actor_id, activity_type
    ) values (
      plan_row.id, plan_row.couple_id, caller_id, 'completed'
    );
  end if;
end;
$$;

revoke all on function public.complete_tracker_assigned_task(uuid, date) from public, anon;
grant execute on function public.complete_tracker_assigned_task(uuid, date) to authenticated, service_role;

commit;
