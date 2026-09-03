begin;

-- Preserve mixed legacy rows and apply check-in privacy consistently to both
-- partners. No existing user rows are rewritten by this migration itself.

create or replace function public.tracker_lock_checkin_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_couple uuid;
  row_date date;
begin
  if tg_op = 'UPDATE' and (
    new.couple_id <> old.couple_id or new.user_id <> old.user_id or new.date <> old.date
  ) then
    raise exception 'Check-in identity cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    row_couple := old.couple_id;
    row_date := old.date;
  else
    row_couple := new.couple_id;
    row_date := new.date;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tracker-day:' || row_couple::text || ':' || row_date::text, 0)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.sync_tracker_checkin_legacy_day(
  p_couple_id uuid,
  p_date date,
  p_removed_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
  checkin public.tracker_checkins;
  target_event public.tracker_events;
  publish_mood boolean;
  category_id uuid;
  marker constant text := '[[day-mood]]';
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tracker-day:' || p_couple_id::text || ':' || p_date::text, 0)
  );

  for member_id in
    select distinct member.user_id
    from public.couples couple
    cross join lateral unnest(array[couple.partner_one_id, couple.partner_two_id]) member(user_id)
    where couple.id = p_couple_id and member.user_id is not null
  loop
    select c.* into checkin
    from public.tracker_checkins c
    where c.couple_id = p_couple_id and c.user_id = member_id and c.date = p_date;

    -- A partner who has not used check-in can still have an independently
    -- selected legacy emoji. Do not overwrite it merely because the other
    -- partner saved a check-in.
    if checkin.id is null and member_id is distinct from p_removed_user_id then
      continue;
    end if;

    publish_mood := checkin.id is not null
      and checkin.visibility in ('summary', 'full')
      and (
        not checkin.reveal_after_both
        or exists (
          select 1 from public.tracker_checkins other
          where other.couple_id = p_couple_id
            and other.date = p_date
            and other.user_id <> member_id
            and public.is_tracker_couple_member(p_couple_id, other.user_id)
        )
      );

    if not coalesce(publish_mood, false) then
      -- A marker may be attached to a real activity and a user-written note.
      -- Strip only the marker and its one formatting newline; never delete the
      -- row, count, duration, time or note. Neutralize the shared mood field so
      -- it cannot disclose the now-private check-in via direct table reads.
      update public.tracker_events event
      set note = nullif(
            case
              when substring(event.note from char_length(marker) + 1 for 1) = E'\n'
                then substring(event.note from char_length(marker) + 2)
              else substring(event.note from char_length(marker) + 1)
            end,
            ''
          ),
          mood = 'good',
          updated_at = now()
      where event.couple_id = p_couple_id
        and event.created_by = member_id
        and event.date = p_date
        and left(coalesce(event.note, ''), char_length(marker)) = marker;
      continue;
    end if;

    -- Update every existing marker consistently, preserving its note verbatim.
    update public.tracker_events event
    set mood = checkin.mood, updated_at = now()
    where event.couple_id = p_couple_id
      and event.created_by = member_id
      and event.date = p_date
      and left(coalesce(event.note, ''), char_length(marker)) = marker;
    if found then continue; end if;

    select event.* into target_event
    from public.tracker_events event
    where event.couple_id = p_couple_id
      and event.created_by = member_id
      and event.date = p_date
    order by event.created_at, event.id
    limit 1
    for update;

    if target_event.id is not null then
      update public.tracker_events
      set mood = checkin.mood,
          note = marker || case
            when target_event.note is null or target_event.note = '' then ''
            else E'\n' || target_event.note
          end,
          updated_at = now()
      where id = target_event.id;
    else
      select category.id into category_id
      from public.tracker_categories category
      order by category.sort_order, category.id
      limit 1;
      if category_id is not null then
        insert into public.tracker_events (
          couple_id, category_id, date, count, duration_minutes,
          note, mood, participants, created_by
        ) values (
          p_couple_id, category_id, p_date, 0, 0,
          marker, checkin.mood, 'me', member_id
        );
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.tracker_sync_checkin_legacy_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_tracker_checkin_legacy_day(old.couple_id, old.date, old.user_id);
    return old;
  end if;
  perform public.sync_tracker_checkin_legacy_day(new.couple_id, new.date);
  return new;
end;
$$;

drop trigger if exists tracker_checkins_lock_day on public.tracker_checkins;
create trigger tracker_checkins_lock_day
before insert or update or delete on public.tracker_checkins
for each row execute function public.tracker_lock_checkin_day();

drop trigger if exists tracker_checkins_sync_legacy on public.tracker_checkins;
create trigger tracker_checkins_sync_legacy
after insert or update or delete on public.tracker_checkins
for each row execute function public.tracker_sync_checkin_legacy_trigger();

create or replace function public.save_tracker_checkin(
  p_couple_id uuid,
  p_date date,
  p_mood text,
  p_energy integer default null,
  p_relationship integer default null,
  p_visibility text default 'private',
  p_note text default null,
  p_reveal_after_both boolean default false
)
returns public.tracker_checkins
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result_checkin public.tracker_checkins;
begin
  if caller_id is null or not public.is_tracker_couple_member(p_couple_id, caller_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_date is null or p_mood is null or p_mood not in ('great','good','normal','tired','bad') then
    raise exception 'Invalid date or mood' using errcode = '22023';
  end if;
  if p_visibility is null or p_visibility not in ('private','summary','full') then
    raise exception 'Invalid visibility' using errcode = '22023';
  end if;
  if (p_energy is not null and p_energy not between 1 and 5)
     or (p_relationship is not null and p_relationship not between 1 and 5)
     or (p_note is not null and char_length(p_note) > 2000)
     or p_reveal_after_both is null then
    raise exception 'Invalid check-in value' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tracker-day:' || p_couple_id::text || ':' || p_date::text, 0)
  );

  insert into public.tracker_checkins (
    couple_id, user_id, date, mood, energy, relationship, visibility, note, reveal_after_both
  ) values (
    p_couple_id, caller_id, p_date, p_mood, p_energy, p_relationship,
    p_visibility, nullif(btrim(p_note), ''), p_reveal_after_both
  )
  on conflict (couple_id, user_id, date) do update set
    mood = excluded.mood,
    energy = excluded.energy,
    relationship = excluded.relationship,
    visibility = excluded.visibility,
    note = excluded.note,
    reveal_after_both = excluded.reveal_after_both,
    updated_at = now()
  returning * into result_checkin;

  -- The row trigger synchronizes both sides, including when the second partner
  -- unlocks mutual reveal or an existing check-in changes visibility.
  return result_checkin;
end;
$$;

create or replace function public.adjust_tracker_event_count(
  p_couple_id uuid,
  p_category_id uuid,
  p_date date,
  p_delta integer
)
returns public.tracker_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  existing_event public.tracker_events;
  result_event public.tracker_events;
begin
  if caller_id is null or not public.is_tracker_couple_member(p_couple_id, caller_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_date is null or p_category_id is null or p_delta is null or p_delta not in (-1, 1) then
    raise exception 'Invalid counter adjustment' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tracker-day:' || p_couple_id::text || ':' || p_date::text, 0)
  );

  -- Mixed marker/activity rows are real counts. Prefer a positive row when
  -- decrementing, and never create another row merely because a marker exists.
  select event.* into existing_event
  from public.tracker_events event
  where event.couple_id = p_couple_id
    and event.created_by = caller_id
    and event.date = p_date
    and event.category_id = p_category_id
    and (p_delta > 0 or event.count > 0)
  order by (event.count > 0) desc, event.created_at, event.id
  limit 1
  for update;

  if existing_event.id is null then
    if p_delta < 0 then return null; end if;
    insert into public.tracker_events (
      couple_id, category_id, date, count, duration_minutes, mood, participants, created_by
    ) values (
      p_couple_id, p_category_id, p_date, 1, 0, 'good', 'me', caller_id
    ) returning * into result_event;
  else
    -- Keep the row at zero: a note, mood marker, duration or timestamp may carry
    -- user data, and deleting it is outside the meaning of a counter decrement.
    update public.tracker_events
    set count = greatest(0, count + p_delta), updated_at = now()
    where id = existing_event.id
    returning * into result_event;
  end if;
  return result_event;
end;
$$;

revoke all on function public.tracker_lock_checkin_day() from public, anon, authenticated;
revoke all on function public.sync_tracker_checkin_legacy_day(uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.tracker_sync_checkin_legacy_trigger() from public, anon, authenticated;
revoke all on function public.save_tracker_checkin(uuid, date, text, integer, integer, text, text, boolean) from public, anon;
revoke all on function public.adjust_tracker_event_count(uuid, uuid, date, integer) from public, anon;
grant execute on function public.save_tracker_checkin(uuid, date, text, integer, integer, text, text, boolean) to authenticated, service_role;
grant execute on function public.adjust_tracker_event_count(uuid, uuid, date, integer) to authenticated, service_role;

commit;
