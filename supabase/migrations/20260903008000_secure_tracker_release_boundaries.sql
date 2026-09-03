begin;

-- Background verification and server jobs use the built-in service role. RLS is
-- still the authority for browser sessions.
grant select, insert, update, delete on public.tracker_plans to service_role;
grant select, insert, update, delete on public.tracker_plan_participants to service_role;
grant select, insert, update, delete on public.tracker_plan_occurrence_overrides to service_role;
grant select, insert, update, delete on public.tracker_plan_reminders to service_role;
grant select, insert, update, delete on public.tracker_plan_comments to service_role;
grant select, insert, update, delete on public.tracker_plan_attachments to service_role;
grant select, insert, update, delete on public.tracker_checkins to service_role;
grant select, insert, update, delete on public.tracker_category_preferences to service_role;
grant select, insert, update, delete on public.tracker_plan_memory_links to service_role;
grant select, insert, update, delete on public.tracker_plan_activity to service_role;

-- Memory URLs remain stable database pointers, while object delivery becomes
-- authenticated through short-lived signed URLs in the client.
update storage.buckets set public = false where id = 'memory-images';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tracker_plans_duration_limit'
      and conrelid = 'public.tracker_plans'::regclass
  ) then
    alter table public.tracker_plans
      add constraint tracker_plans_duration_limit
      check (ends_at is null or starts_at is null or ends_at <= starts_at + interval '31 days');
  end if;
end
$$;

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
  completed_override_status text;
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
       or not pg_catalog.isfinite(p_occurrence_date)
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

    if not plan_row.all_day and (
      public.tracker_local_instant(
        (plan_row.starts_at at time zone pair_zone) + pg_catalog.make_interval(days => day_difference),
        pair_zone
      ) is null
      or (
        plan_row.ends_at is not null
        and public.tracker_local_instant(
          (plan_row.ends_at at time zone pair_zone) + pg_catalog.make_interval(days => day_difference),
          pair_zone
        ) is null
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
        status = 'done', updated_by = caller_id, updated_at = now()
      where public.tracker_plan_occurrence_overrides.status not in ('cancelled', 'done')
      returning status into completed_override_status;

      if completed_override_status = 'done' then
        did_change := true;
      else
        select override.status into previous_override_status
        from public.tracker_plan_occurrence_overrides override
        where override.plan_id = plan_row.id
          and override.occurrence_date = p_occurrence_date;
        if previous_override_status = 'cancelled' then
          raise exception 'Cancelled task occurrence cannot be completed' using errcode = '22023';
        end if;
      end if;
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

create or replace function public.broadcast_tracker_couple_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_couple_id uuid;
begin
  target_couple_id := case when tg_op = 'DELETE' then old.couple_id else new.couple_id end;
  if target_couple_id is not null then
    perform realtime.send(
      pg_catalog.jsonb_build_object('table', tg_table_name, 'operation', tg_op),
      'changed',
      'tracker:' || target_couple_id::text,
      true
    );
  end if;
  return null;
end;
$$;

revoke all on function public.broadcast_tracker_couple_change() from public, anon, authenticated;

drop policy if exists tracker_couple_broadcast_read on realtime.messages;
create policy tracker_couple_broadcast_read
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.messages.topic = (select realtime.topic())
  and (select realtime.topic()) like 'tracker:%'
  and public.is_tracker_couple_member(
    public.tracker_safe_uuid(pg_catalog.substr((select realtime.topic()), 9)),
    (select auth.uid())
  )
);

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['tracker_events', 'tracker_goals', 'tracker_plans', 'tracker_plan_participants', 'tracker_plan_occurrence_overrides', 'tracker_checkins', 'tracker_plan_comments', 'tracker_plan_attachments', 'tracker_category_preferences', 'tracker_plan_reminders', 'tracker_plan_activity']
  loop
    execute pg_catalog.format(
      'drop trigger if exists tracker_couple_broadcast_change on public.%I',
      relation_name
    );
    execute pg_catalog.format(
      'create trigger tracker_couple_broadcast_change after insert or update or delete on public.%I for each row execute function public.broadcast_tracker_couple_change()',
      relation_name
    );
  end loop;
end
$$;

commit;
