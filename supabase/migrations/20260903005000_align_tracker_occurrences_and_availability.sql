begin;

-- Only the invitee may accept an invitation, including its initial insertion.
-- Service-role fixture/import paths can still preserve historical responses.
alter table public.tracker_plan_participants alter column response set default 'pending';
alter policy tracker_plan_participants_insert on public.tracker_plan_participants
with check (
  public.is_tracker_couple_member(couple_id, (select auth.uid()))
  and public.is_tracker_couple_member(couple_id, user_id)
  and (user_id = (select auth.uid()) or response = 'pending')
  and exists (
    select 1 from public.tracker_plans plan
    where plan.id = plan_id and plan.created_by = (select auth.uid())
  )
);

-- Match the client: skip nonexistent local times and choose the earlier instant
-- when a clock repeats at a DST boundary. Never depend on the DB session zone.
create or replace function public.tracker_local_instant(p_local timestamp, p_time_zone text)
returns timestamptz
language sql stable set search_path = ''
as $$
  with probes as (
    select (p_local at time zone 'UTC') + pg_catalog.make_interval(hours => hours) as instant
    from unnest(array[-36, -12, 0, 12, 36]) hours
  ), candidates as (
    select (
      p_local - ((instant at time zone p_time_zone) - (instant at time zone 'UTC'))
    ) at time zone 'UTC' as instant
    from probes
  )
  select min(instant) from candidates
  where instant at time zone p_time_zone = p_local;
$$;

-- Internal only: may include private busy records. Public list/free-time RPCs
-- below are the only callers and apply different, explicit disclosure rules.
create or replace function public.tracker_expand_occurrences_internal(
  p_couple_id uuid, p_from date, p_to date, p_include_overlaps boolean default false
)
returns table (
  plan_id uuid, original_date date, occurrence_date date, status text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with settings as (
    select coalesce((
      select profile.time_zone
      from public.couple_profiles profile
      where profile.couple_id = p_couple_id
        and exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = profile.time_zone)
    ), 'Europe/Moscow') as time_zone
  ), plans as (
    select plan.*, settings.time_zone,
      case when plan.all_day then plan.start_date
        else (plan.starts_at at time zone settings.time_zone)::date end as base_date,
      plan.starts_at at time zone settings.time_zone as local_start,
      plan.ends_at at time zone settings.time_zone as local_end
    from public.tracker_plans plan cross join settings
    where plan.couple_id = p_couple_id and plan.status <> 'cancelled'
      and p_from <= p_to and p_to - p_from <= 3700
  ), candidates as (
    select plan.id, day.date_key
    from plans plan
    cross join lateral (
      select plan.base_date as date_key where plan.repeat_mode = 'none'
      union all
      select greatest(plan.base_date, p_from - case when p_include_overlaps
        then greatest(1, coalesce(plan.local_end::date - plan.local_start::date, 1)) else 0 end) + day_offset
      from generate_series(0, p_to - greatest(plan.base_date, p_from - case when p_include_overlaps
        then greatest(1, coalesce(plan.local_end::date - plan.local_start::date, 1)) else 0 end)) day_offset
      where plan.repeat_mode <> 'none'
    ) day
    union
    -- A moved repetition must be considered even when its original date is
    -- outside the requested window (and outside the series repeat_until).
    select plan.id, override.occurrence_date
    from plans plan
    join public.tracker_plan_occurrence_overrides override on override.plan_id = plan.id
  ), expanded as (
    select plan.*, candidate.date_key as original_date,
      coalesce(override.override_start_date,
        (override.override_starts_at at time zone plan.time_zone)::date,
        candidate.date_key) as effective_date,
      coalesce(override.status, plan.status) as effective_status,
      override.override_starts_at, override.override_ends_at
    from plans plan
    join candidates candidate on candidate.id = plan.id
    left join public.tracker_plan_occurrence_overrides override
      on override.plan_id = plan.id and override.occurrence_date = candidate.date_key
    where candidate.date_key >= plan.base_date
      and (plan.repeat_until is null or candidate.date_key <= plan.repeat_until)
      and (
        (plan.repeat_mode = 'none' and candidate.date_key = plan.base_date)
        or (plan.repeat_mode = 'daily' and (candidate.date_key - plan.base_date) % plan.repeat_interval = 0)
        or (
          plan.repeat_mode = 'weekly'
          and extract(isodow from candidate.date_key)::smallint = any(
            case when cardinality(plan.repeat_weekdays) = 0
              then array[extract(isodow from plan.base_date)::smallint]
              else plan.repeat_weekdays end
          )
          and (
            ((candidate.date_key - (extract(isodow from candidate.date_key)::integer - 1))
              - (plan.base_date - (extract(isodow from plan.base_date)::integer - 1))) / 7
          ) % plan.repeat_interval = 0
        )
        or (
          plan.repeat_mode = 'monthly'
          and extract(day from candidate.date_key) = extract(day from plan.base_date)
          and (
            (extract(year from candidate.date_key)::integer - extract(year from plan.base_date)::integer) * 12
              + extract(month from candidate.date_key)::integer - extract(month from plan.base_date)::integer
          ) % plan.repeat_interval = 0
        )
        or (
          plan.repeat_mode = 'yearly'
          and extract(day from candidate.date_key) = extract(day from plan.base_date)
          and extract(month from candidate.date_key) = extract(month from plan.base_date)
          and (extract(year from candidate.date_key)::integer - extract(year from plan.base_date)::integer)
            % plan.repeat_interval = 0
        )
      )
  ), localized as (
    select expanded.*,
      case when expanded.all_day then null else coalesce(expanded.override_starts_at,
        public.tracker_local_instant(expanded.local_start + pg_catalog.make_interval(days => expanded.effective_date - expanded.base_date), expanded.time_zone))
      end as effective_start,
      case when expanded.all_day then null else coalesce(expanded.override_ends_at,
        public.tracker_local_instant(expanded.local_end + pg_catalog.make_interval(days => expanded.effective_date - expanded.base_date), expanded.time_zone))
      end as effective_end
    from expanded
    where expanded.effective_status <> 'cancelled'
      and (
        expanded.all_day
        or (
          public.tracker_local_instant(expanded.local_start + pg_catalog.make_interval(days => expanded.original_date - expanded.base_date), expanded.time_zone) is not null
          and (expanded.local_end is null or
            public.tracker_local_instant(expanded.local_end + pg_catalog.make_interval(days => expanded.original_date - expanded.base_date), expanded.time_zone) is not null)
        )
      )
  )
  select localized.id, localized.original_date, localized.effective_date,
    localized.effective_status, localized.all_day, localized.effective_start, localized.effective_end
  from localized
  where (
    localized.all_day or (
      localized.effective_start is not null
      and (localized.local_end is null or localized.effective_end is not null)
      and (localized.effective_end is null or localized.effective_end >= localized.effective_start)
    )
  ) and (
    ((not p_include_overlaps or localized.all_day) and localized.effective_date between p_from and p_to)
    or (
      p_include_overlaps and not localized.all_day
      and localized.effective_start < ((p_to + 1)::timestamp at time zone localized.time_zone)
      and coalesce(localized.effective_end, localized.effective_start + interval '1 hour')
        > (p_from::timestamp at time zone localized.time_zone)
    )
  );
$$;

create or replace function public.list_tracker_plan_occurrences(p_couple_id uuid, p_from date, p_to date)
returns table (
  plan_id uuid, occurrence_date date, title text, kind text, status text,
  all_day boolean, starts_at timestamptz, ends_at timestamptz,
  participant_scope text, visibility text, created_by uuid
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_tracker_couple_member(p_couple_id, auth.uid())
    or p_from is null or p_to is null
    or not isfinite(p_from) or not isfinite(p_to) then
    return;
  end if;
  if p_from > p_to or p_to - p_from > 3700 then return; end if;
  return query
  select occurrence.plan_id, occurrence.occurrence_date, plan.title, plan.kind,
    occurrence.status, occurrence.all_day, occurrence.starts_at, occurrence.ends_at,
    plan.participant_scope, plan.visibility, plan.created_by
  from public.tracker_expand_occurrences_internal(p_couple_id, p_from, p_to, false) occurrence
  join public.tracker_plans plan on plan.id = occurrence.plan_id
  where public.can_view_tracker_plan(plan.id, auth.uid())
  order by occurrence.occurrence_date, occurrence.starts_at nulls first, plan.title;
end;
$$;

create or replace function public.find_tracker_common_free_slots(
  p_couple_id uuid, p_date date, p_duration_minutes integer default 60,
  p_day_start time default '09:00', p_day_end time default '22:00'
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  pair_time_zone text;
begin
  if not public.is_tracker_couple_member(p_couple_id, auth.uid())
    or p_date is null or not isfinite(p_date)
    or p_duration_minutes is null or p_duration_minutes not between 15 and 720
    or p_day_start is null or p_day_end is null or p_day_start >= p_day_end then
    return;
  end if;
  select coalesce((
    select profile.time_zone from public.couple_profiles profile
    where profile.couple_id = p_couple_id
      and exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = profile.time_zone)
  ), 'Europe/Moscow') into pair_time_zone;

  return query
  with candidates as (
    select slot_start, slot_start + pg_catalog.make_interval(mins => p_duration_minutes) as slot_end
    from generate_series(
      public.tracker_local_instant(p_date + p_day_start, pair_time_zone),
      public.tracker_local_instant(p_date + p_day_end, pair_time_zone) - pg_catalog.make_interval(mins => p_duration_minutes),
      interval '30 minutes'
    ) slot_start
  ), busy as materialized (
    select occurrence.*
    from public.tracker_expand_occurrences_internal(p_couple_id, p_date, p_date, true) occurrence
    where occurrence.status not in ('cancelled', 'done')
  )
  select candidate.slot_start, candidate.slot_end
  from candidates candidate
  where not exists (
    select 1 from busy
    where busy.all_day or (
      busy.starts_at < candidate.slot_end
      and coalesce(busy.ends_at, busy.starts_at + interval '1 hour') > candidate.slot_start
    )
  )
  order by candidate.slot_start;
end;
$$;

revoke all on function public.tracker_local_instant(timestamp, text) from public, anon, authenticated;
revoke all on function public.tracker_expand_occurrences_internal(uuid, date, date, boolean) from public, anon, authenticated;
revoke all on function public.list_tracker_plan_occurrences(uuid, date, date) from public, anon;
revoke all on function public.find_tracker_common_free_slots(uuid, date, integer, time, time) from public, anon;
grant execute on function public.list_tracker_plan_occurrences(uuid, date, date) to authenticated;
grant execute on function public.find_tracker_common_free_slots(uuid, date, integer, time, time) to authenticated;

-- Individual reminders still use user-scoped RLS; publishing does not broaden it.
do $publication$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'tracker_plan_reminders'
  ) then
    alter publication supabase_realtime add table public.tracker_plan_reminders;
  end if;
end;
$publication$;

commit;
