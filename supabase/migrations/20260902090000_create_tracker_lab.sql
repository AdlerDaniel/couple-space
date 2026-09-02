begin;

create or replace function public.is_tracker_couple_member(p_couple_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couples c
    where c.id = p_couple_id
      and p_user_id in (c.partner_one_id, c.partner_two_id)
  );
$$;

create table if not exists public.tracker_plans (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text,
  kind text not null default 'event' check (kind in ('event','date','task','reminder')),
  start_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default true,
  participant_scope text not null default 'both' check (participant_scope in ('me','partner','both')),
  assignee_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'couple' check (visibility in ('couple','private')),
  status text not null default 'planned' check (status in ('idea','planned','tentative','done','cancelled')),
  repeat_mode text not null default 'none' check (repeat_mode in ('none','daily','weekly','monthly','yearly')),
  repeat_interval integer not null default 1 check (repeat_interval between 1 and 365),
  repeat_weekdays smallint[] not null default '{}'::smallint[],
  repeat_until date,
  category_id uuid references public.tracker_categories(id) on delete set null,
  color text,
  edit_scope text not null default 'participants' check (edit_scope in ('creator','participants')),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (all_day and start_date is not null)
    or
    (not all_day and starts_at is not null)
  ),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists tracker_plans_couple_start_date_idx
  on public.tracker_plans(couple_id, start_date);
create index if not exists tracker_plans_couple_starts_at_idx
  on public.tracker_plans(couple_id, starts_at);
create index if not exists tracker_plans_created_by_idx
  on public.tracker_plans(created_by);
create index if not exists tracker_plans_assignee_id_idx
  on public.tracker_plans(assignee_id);

create table if not exists public.tracker_plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.tracker_plans(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('participant','responsible')),
  response text not null default 'accepted' check (response in ('pending','accepted','tentative','declined')),
  created_at timestamptz not null default now(),
  unique(plan_id, user_id)
);
create index if not exists tracker_plan_participants_couple_idx
  on public.tracker_plan_participants(couple_id, user_id);

create table if not exists public.tracker_plan_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.tracker_plans(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  occurrence_date date not null,
  override_start_date date,
  override_starts_at timestamptz,
  override_ends_at timestamptz,
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique(plan_id, occurrence_date)
);
create index if not exists tracker_plan_occurrences_couple_date_idx
  on public.tracker_plan_occurrence_overrides(couple_id, occurrence_date);

create table if not exists public.tracker_plan_reminders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.tracker_plans(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  offset_minutes integer not null default 60 check (offset_minutes between 0 and 525600),
  delivery text not null default 'push' check (delivery in ('in_app','push','ics')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(plan_id, user_id, offset_minutes, delivery)
);
create index if not exists tracker_plan_reminders_user_idx
  on public.tracker_plan_reminders(user_id, last_sent_at);

create table if not exists public.tracker_plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.tracker_plans(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text,
  attachment_url text,
  attachment_name text,
  attachment_type text check (attachment_type is null or attachment_type in ('image','video','audio','file')),
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    nullif(btrim(coalesce(text, '')), '') is not null
    or attachment_url is not null
  )
);
create index if not exists tracker_plan_comments_plan_idx
  on public.tracker_plan_comments(plan_id, created_at);
create index if not exists tracker_plan_comments_couple_idx
  on public.tracker_plan_comments(couple_id, created_at);

create table if not exists public.tracker_plan_attachments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.tracker_plans(id) on delete cascade,
  comment_id uuid references public.tracker_plan_comments(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  url text not null,
  name text not null,
  mime_type text,
  media_type text not null check (media_type in ('image','video','audio','file')),
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 52428800),
  created_at timestamptz not null default now()
);
create index if not exists tracker_plan_attachments_plan_idx
  on public.tracker_plan_attachments(plan_id, created_at);
create index if not exists tracker_plan_attachments_comment_idx
  on public.tracker_plan_attachments(comment_id);

create table if not exists public.tracker_checkins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood text not null check (mood in ('great','good','normal','tired','bad')),
  energy integer check (energy between 1 and 5),
  relationship integer check (relationship between 1 and 5),
  visibility text not null default 'private' check (visibility in ('private','summary','full')),
  note text,
  reveal_after_both boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(couple_id, user_id, date)
);
create index if not exists tracker_checkins_couple_date_idx
  on public.tracker_checkins(couple_id, date desc);

create table if not exists public.tracker_category_preferences (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  category_id uuid not null references public.tracker_categories(id) on delete cascade,
  label text check (label is null or char_length(btrim(label)) between 1 and 40),
  color text,
  icon text,
  sort_order integer,
  hidden boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique(couple_id, category_id)
);
create index if not exists tracker_category_preferences_couple_idx
  on public.tracker_category_preferences(couple_id, sort_order);

create table if not exists public.tracker_plan_memory_links (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.tracker_plans(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(plan_id, memory_id)
);
create index if not exists tracker_plan_memory_links_memory_idx
  on public.tracker_plan_memory_links(memory_id);

create table if not exists public.tracker_plan_activity (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.tracker_plans(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('created','updated','responded','completed','commented','attachment_added','memory_created')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tracker_plan_activity_couple_created_idx
  on public.tracker_plan_activity(couple_id, created_at desc);

alter table public.tracker_goals
  add column if not exists status text not null default 'active'
    check (status in ('active','completed','archived')),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz;

create unique index if not exists tracker_events_activity_unique_idx
  on public.tracker_events(couple_id, created_by, date, category_id)
  where coalesce(note, '') not like '[[day-mood]]%';

create unique index if not exists tracker_events_mood_unique_idx
  on public.tracker_events(couple_id, created_by, date)
  where coalesce(note, '') like '[[day-mood]]%';

create or replace function public.can_view_tracker_plan(p_plan_id uuid, p_user_id uuid default auth.uid())
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
          and public.is_tracker_couple_member(p.couple_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_edit_tracker_plan(p_plan_id uuid, p_user_id uuid default auth.uid())
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
        )
      )
  );
$$;

create or replace function public.tracker_safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.protect_tracker_plan_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.couple_id <> old.couple_id or new.created_by <> old.created_by then
    raise exception 'Plan identity cannot be changed' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger tracker_plans_protect_identity
before update on public.tracker_plans
for each row execute function public.protect_tracker_plan_identity();

create or replace function public.enforce_tracker_child_couple()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_couple_id uuid;
begin
  if new.plan_id is null then
    return new;
  end if;
  select p.couple_id into expected_couple_id
  from public.tracker_plans p
  where p.id = new.plan_id;
  if expected_couple_id is null or expected_couple_id <> new.couple_id then
    raise exception 'Plan and child row must belong to the same couple' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_tracker_memory_link_couple()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tracker_plans p
    join public.memories m on m.id = new.memory_id
    where p.id = new.plan_id
      and p.couple_id = new.couple_id
      and m.couple_id = new.couple_id
  ) then
    raise exception 'Memory and plan must belong to the same couple' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tracker_participants_enforce_couple
before insert or update on public.tracker_plan_participants
for each row execute function public.enforce_tracker_child_couple();
create trigger tracker_occurrences_enforce_couple
before insert or update on public.tracker_plan_occurrence_overrides
for each row execute function public.enforce_tracker_child_couple();
create trigger tracker_reminders_enforce_couple
before insert or update on public.tracker_plan_reminders
for each row execute function public.enforce_tracker_child_couple();
create trigger tracker_comments_enforce_couple
before insert or update on public.tracker_plan_comments
for each row execute function public.enforce_tracker_child_couple();
create trigger tracker_attachments_enforce_couple
before insert or update on public.tracker_plan_attachments
for each row execute function public.enforce_tracker_child_couple();
create trigger tracker_memory_links_enforce_couple
before insert or update on public.tracker_plan_memory_links
for each row execute function public.enforce_tracker_child_couple();
create trigger tracker_memory_links_validate_memory
before insert or update on public.tracker_plan_memory_links
for each row execute function public.enforce_tracker_memory_link_couple();
create trigger tracker_activity_enforce_couple
before insert or update on public.tracker_plan_activity
for each row execute function public.enforce_tracker_child_couple();

alter table public.tracker_plans enable row level security;
alter table public.tracker_plan_participants enable row level security;
alter table public.tracker_plan_occurrence_overrides enable row level security;
alter table public.tracker_plan_reminders enable row level security;
alter table public.tracker_plan_comments enable row level security;
alter table public.tracker_plan_attachments enable row level security;
alter table public.tracker_checkins enable row level security;
alter table public.tracker_category_preferences enable row level security;
alter table public.tracker_plan_memory_links enable row level security;
alter table public.tracker_plan_activity enable row level security;

create policy tracker_plans_select_visible on public.tracker_plans
for select to authenticated
using (
  created_by = (select auth.uid())
  or (
    visibility = 'couple'
    and public.is_tracker_couple_member(couple_id, (select auth.uid()))
  )
);
create policy tracker_plans_insert_own on public.tracker_plans
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
  and (
    assignee_id is null
    or public.is_tracker_couple_member(couple_id, assignee_id)
  )
);
create policy tracker_plans_update_allowed on public.tracker_plans
for update to authenticated
using (public.can_edit_tracker_plan(id, (select auth.uid())))
with check (
  public.is_tracker_couple_member(couple_id, (select auth.uid()))
  and (
    assignee_id is null
    or public.is_tracker_couple_member(couple_id, assignee_id)
  )
);
create policy tracker_plans_delete_creator on public.tracker_plans
for delete to authenticated
using (created_by = (select auth.uid()));

create policy tracker_plan_participants_select on public.tracker_plan_participants
for select to authenticated using (public.can_view_tracker_plan(plan_id, (select auth.uid())));
create policy tracker_plan_participants_insert on public.tracker_plan_participants
for insert to authenticated with check (
  public.can_edit_tracker_plan(plan_id, (select auth.uid()))
  and public.is_tracker_couple_member(couple_id, user_id)
);
create policy tracker_plan_participants_update on public.tracker_plan_participants
for update to authenticated using (
  user_id = (select auth.uid())
  or public.can_edit_tracker_plan(plan_id, (select auth.uid()))
) with check (public.is_tracker_couple_member(couple_id, user_id));
create policy tracker_plan_participants_delete on public.tracker_plan_participants
for delete to authenticated using (public.can_edit_tracker_plan(plan_id, (select auth.uid())));

create policy tracker_occurrences_select on public.tracker_plan_occurrence_overrides
for select to authenticated using (public.can_view_tracker_plan(plan_id, (select auth.uid())));
create policy tracker_occurrences_insert on public.tracker_plan_occurrence_overrides
for insert to authenticated with check (
  updated_by = (select auth.uid())
  and public.can_edit_tracker_plan(plan_id, (select auth.uid()))
);
create policy tracker_occurrences_update on public.tracker_plan_occurrence_overrides
for update to authenticated using (public.can_edit_tracker_plan(plan_id, (select auth.uid())))
with check (updated_by = (select auth.uid()));
create policy tracker_occurrences_delete on public.tracker_plan_occurrence_overrides
for delete to authenticated using (public.can_edit_tracker_plan(plan_id, (select auth.uid())));

create policy tracker_reminders_own_all on public.tracker_plan_reminders
for all to authenticated
using (user_id = (select auth.uid()) and public.can_view_tracker_plan(plan_id, (select auth.uid())))
with check (
  user_id = (select auth.uid())
  and public.can_view_tracker_plan(plan_id, (select auth.uid()))
);

create policy tracker_comments_select on public.tracker_plan_comments
for select to authenticated using (public.can_view_tracker_plan(plan_id, (select auth.uid())));
create policy tracker_comments_insert on public.tracker_plan_comments
for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.can_view_tracker_plan(plan_id, (select auth.uid()))
);
create policy tracker_comments_update_own on public.tracker_plan_comments
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy tracker_comments_delete_own on public.tracker_plan_comments
for delete to authenticated using (user_id = (select auth.uid()));

create policy tracker_attachments_select on public.tracker_plan_attachments
for select to authenticated using (public.can_view_tracker_plan(plan_id, (select auth.uid())));
create policy tracker_attachments_insert on public.tracker_plan_attachments
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and public.can_view_tracker_plan(plan_id, (select auth.uid()))
);
create policy tracker_attachments_delete_own on public.tracker_plan_attachments
for delete to authenticated using (owner_id = (select auth.uid()));

create policy tracker_checkins_own on public.tracker_checkins
for all to authenticated
using (
  user_id = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
);

create policy tracker_category_preferences_select on public.tracker_category_preferences
for select to authenticated using (public.is_tracker_couple_member(couple_id, (select auth.uid())));
create policy tracker_category_preferences_write on public.tracker_category_preferences
for all to authenticated
using (public.is_tracker_couple_member(couple_id, (select auth.uid())))
with check (
  updated_by = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
);

create policy tracker_memory_links_select on public.tracker_plan_memory_links
for select to authenticated using (public.can_view_tracker_plan(plan_id, (select auth.uid())));
create policy tracker_memory_links_insert on public.tracker_plan_memory_links
for insert to authenticated with check (
  created_by = (select auth.uid())
  and public.can_view_tracker_plan(plan_id, (select auth.uid()))
);
create policy tracker_memory_links_delete_own on public.tracker_plan_memory_links
for delete to authenticated using (created_by = (select auth.uid()));

create policy tracker_activity_select on public.tracker_plan_activity
for select to authenticated using (
  public.is_tracker_couple_member(couple_id, (select auth.uid()))
  and (plan_id is null or public.can_view_tracker_plan(plan_id, (select auth.uid())))
);
create policy tracker_activity_insert on public.tracker_plan_activity
for insert to authenticated with check (
  actor_id = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
  and (plan_id is null or public.can_view_tracker_plan(plan_id, (select auth.uid())))
);

create policy tracker_goals_update_own on public.tracker_goals
for update to authenticated
using (
  created_by = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
)
with check (
  created_by = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
);

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
  if p_delta not in (-1, 1) then
    raise exception 'Delta must be -1 or 1' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_couple_id::text || ':' || caller_id::text || ':' || p_date::text || ':' || p_category_id::text,
      0
    )
  );

  select *
    into existing_event
  from public.tracker_events e
  where e.couple_id = p_couple_id
    and e.created_by = caller_id
    and e.date = p_date
    and e.category_id = p_category_id
    and coalesce(e.note, '') not like '[[day-mood]]%'
  limit 1
  for update;

  if existing_event.id is null then
    if p_delta < 0 then
      return null;
    end if;
    insert into public.tracker_events (
      couple_id, category_id, date, count, duration_minutes, mood, participants, created_by
    ) values (
      p_couple_id, p_category_id, p_date, 1, 0, 'good', 'both', caller_id
    )
    returning * into result_event;
    return result_event;
  end if;

  if existing_event.count + p_delta <= 0 then
    delete from public.tracker_events where id = existing_event.id
    returning * into result_event;
  else
    update public.tracker_events
    set count = count + p_delta, updated_at = now()
    where id = existing_event.id
    returning * into result_event;
  end if;
  return result_event;
end;
$$;

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
  mood_event_id uuid;
  default_category_id uuid;
begin
  if caller_id is null or not public.is_tracker_couple_member(p_couple_id, caller_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_mood not in ('great','good','normal','tired','bad') then
    raise exception 'Invalid mood' using errcode = '22023';
  end if;
  if p_visibility not in ('private','summary','full') then
    raise exception 'Invalid visibility' using errcode = '22023';
  end if;

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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_couple_id::text || ':' || caller_id::text || ':' || p_date::text || ':mood', 0)
  );

  select id into mood_event_id
  from public.tracker_events
  where couple_id = p_couple_id
    and created_by = caller_id
    and date = p_date
    and coalesce(note, '') like '[[day-mood]]%'
  limit 1
  for update;

  if p_visibility = 'private' then
    if mood_event_id is not null then
      delete from public.tracker_events where id = mood_event_id;
    end if;
  elsif mood_event_id is not null then
    update public.tracker_events
    set mood = p_mood, note = '[[day-mood]]', updated_at = now()
    where id = mood_event_id;
  else
    select id into default_category_id
    from public.tracker_categories
    order by sort_order, id
    limit 1;

    if default_category_id is not null then
      insert into public.tracker_events (
        couple_id, category_id, date, count, duration_minutes, note, mood, participants, created_by
      ) values (
        p_couple_id, default_category_id, p_date, 0, 0, '[[day-mood]]', p_mood, 'both', caller_id
      );
    end if;
  end if;

  return result_checkin;
end;
$$;

create or replace function public.get_tracker_checkins(
  p_couple_id uuid,
  p_from date,
  p_to date
)
returns table (
  id uuid,
  couple_id uuid,
  user_id uuid,
  date date,
  mood text,
  energy integer,
  relationship integer,
  visibility text,
  note text,
  reveal_after_both boolean,
  is_own boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.couple_id,
    c.user_id,
    c.date,
    case
      when c.user_id = auth.uid() then c.mood
      when c.reveal_after_both and not exists (
        select 1 from public.tracker_checkins mine
        where mine.couple_id = c.couple_id
          and mine.user_id = auth.uid()
          and mine.date = c.date
      ) then null
      when c.visibility in ('summary','full') then c.mood
      else null
    end,
    case
      when c.user_id = auth.uid() then c.energy
      when c.reveal_after_both and not exists (
        select 1 from public.tracker_checkins mine
        where mine.couple_id = c.couple_id
          and mine.user_id = auth.uid()
          and mine.date = c.date
      ) then null
      when c.visibility in ('summary','full') then c.energy
      else null
    end,
    case
      when c.user_id = auth.uid() then c.relationship
      when c.reveal_after_both and not exists (
        select 1 from public.tracker_checkins mine
        where mine.couple_id = c.couple_id
          and mine.user_id = auth.uid()
          and mine.date = c.date
      ) then null
      when c.visibility in ('summary','full') then c.relationship
      else null
    end,
    c.visibility,
    case
      when c.user_id = auth.uid() then c.note
      when c.reveal_after_both and not exists (
        select 1 from public.tracker_checkins mine
        where mine.couple_id = c.couple_id
          and mine.user_id = auth.uid()
          and mine.date = c.date
      ) then null
      when c.visibility = 'full' then c.note
      else null
    end,
    c.reveal_after_both,
    c.user_id = auth.uid(),
    c.created_at,
    c.updated_at
  from public.tracker_checkins c
  where c.couple_id = p_couple_id
    and c.date between p_from and p_to
    and public.is_tracker_couple_member(c.couple_id, auth.uid())
    and (
      c.user_id = auth.uid()
      or c.visibility <> 'private'
    )
  order by c.date desc, c.created_at;
$$;

create or replace function public.list_tracker_plan_occurrences(
  p_couple_id uuid,
  p_from date,
  p_to date
)
returns table (
  plan_id uuid,
  occurrence_date date,
  title text,
  kind text,
  status text,
  all_day boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  participant_scope text,
  visibility text,
  created_by uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible_plans as (
    select p.*
    from public.tracker_plans p
    where p.couple_id = p_couple_id
      and public.can_view_tracker_plan(p.id, auth.uid())
  ),
  expanded as (
    select
      p.*,
      d::date as occurrence_date
    from visible_plans p
    cross join lateral generate_series(
      greatest(coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date), p_from),
      least(coalesce(p.repeat_until, p_to), p_to),
      interval '1 day'
    ) d
    where
      (
        p.repeat_mode = 'none'
        and d::date = coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date)
      )
      or (
        p.repeat_mode = 'daily'
        and (
          d::date - coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date)
        ) % p.repeat_interval = 0
      )
      or (
        p.repeat_mode = 'weekly'
        and extract(isodow from d)::smallint = any(
          case
            when cardinality(p.repeat_weekdays) = 0
              then array[extract(isodow from coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date))::smallint]
            else p.repeat_weekdays
          end
        )
        and floor(
          (d::date - coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date)) / 7.0
        )::integer % p.repeat_interval = 0
      )
      or (
        p.repeat_mode = 'monthly'
        and extract(day from d) = extract(day from coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date))
        and (
          (
            extract(year from age(d::date, coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date)))::integer * 12
            + extract(month from age(d::date, coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date)))::integer
          ) % p.repeat_interval = 0
        )
      )
      or (
        p.repeat_mode = 'yearly'
        and extract(month from d) = extract(month from coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date))
        and extract(day from d) = extract(day from coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date))
        and (
          extract(year from d)::integer
          - extract(year from coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date))::integer
        ) % p.repeat_interval = 0
      )
  )
  select
    e.id,
    coalesce(o.override_start_date, o.occurrence_date, e.occurrence_date),
    e.title,
    e.kind,
    coalesce(o.status, e.status),
    e.all_day,
    coalesce(
      o.override_starts_at,
      e.starts_at + pg_catalog.make_interval(
        days => e.occurrence_date - coalesce(e.start_date, (e.starts_at at time zone 'Europe/Moscow')::date)
      )
    ),
    coalesce(
      o.override_ends_at,
      e.ends_at + pg_catalog.make_interval(
        days => e.occurrence_date - coalesce(e.start_date, (e.starts_at at time zone 'Europe/Moscow')::date)
      )
    ),
    e.participant_scope,
    e.visibility,
    e.created_by
  from expanded e
  left join public.tracker_plan_occurrence_overrides o
    on o.plan_id = e.id
   and o.occurrence_date = e.occurrence_date
  where coalesce(o.status, e.status) <> 'cancelled'
  order by 2, 7 nulls first, 3;
$$;

create or replace function public.find_tracker_common_free_slots(
  p_couple_id uuid,
  p_date date,
  p_duration_minutes integer default 60,
  p_day_start time default '09:00',
  p_day_end time default '22:00'
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select slot_start,
      slot_start + pg_catalog.make_interval(mins => p_duration_minutes) as slot_end
    from generate_series(
      (p_date + p_day_start) at time zone 'Europe/Moscow',
      (p_date + p_day_end) at time zone 'Europe/Moscow' - pg_catalog.make_interval(mins => p_duration_minutes),
      interval '30 minutes'
    ) slot_start
  ),
  busy as (
    select
      p.all_day,
      case
        when p.all_day then null
        else (p_date + (p.starts_at at time zone 'Europe/Moscow')::time) at time zone 'Europe/Moscow'
      end as occurrence_start,
      case
        when p.all_day then null
        else (
          (p_date + (p.starts_at at time zone 'Europe/Moscow')::time) at time zone 'Europe/Moscow'
          + coalesce(p.ends_at - p.starts_at, interval '1 hour')
        )
      end as occurrence_end
    from public.tracker_plans p
    cross join lateral (
      select coalesce(p.start_date, (p.starts_at at time zone 'Europe/Moscow')::date) as base_date
    ) base
    where p.couple_id = p_couple_id
      and p.status not in ('cancelled','done')
      and p_date >= base.base_date
      and (p.repeat_until is null or p_date <= p.repeat_until)
      and (
        (p.repeat_mode = 'none' and p_date = base.base_date)
        or (
          p.repeat_mode = 'daily'
          and (p_date - base.base_date) % p.repeat_interval = 0
        )
        or (
          p.repeat_mode = 'weekly'
          and extract(isodow from p_date)::smallint = any(
            case when cardinality(p.repeat_weekdays) = 0
              then array[extract(isodow from base.base_date)::smallint]
              else p.repeat_weekdays end
          )
          and floor((p_date - base.base_date) / 7.0)::integer % p.repeat_interval = 0
        )
        or (
          p.repeat_mode = 'monthly'
          and extract(day from p_date) = extract(day from base.base_date)
          and (
            extract(year from age(p_date, base.base_date))::integer * 12
            + extract(month from age(p_date, base.base_date))::integer
          ) % p.repeat_interval = 0
        )
        or (
          p.repeat_mode = 'yearly'
          and extract(month from p_date) = extract(month from base.base_date)
          and extract(day from p_date) = extract(day from base.base_date)
          and (
            extract(year from p_date)::integer - extract(year from base.base_date)::integer
          ) % p.repeat_interval = 0
        )
      )
  )
  select c.slot_start, c.slot_end
  from candidates c
  where p_duration_minutes between 15 and 720
    and p_day_start < p_day_end
    and public.is_tracker_couple_member(p_couple_id, auth.uid())
    and not exists (
      select 1
      from busy b
      where b.all_day
        or tstzrange(b.occurrence_start, b.occurrence_end, '[)')
          && tstzrange(c.slot_start, c.slot_end, '[)')
    )
  order by c.slot_start;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('tracker-media', 'tracker-media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy tracker_media_select on storage.objects
for select to authenticated
using (
  bucket_id = 'tracker-media'
  and public.can_view_tracker_plan(public.tracker_safe_uuid((storage.foldername(name))[2]), (select auth.uid()))
);
create policy tracker_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and public.can_view_tracker_plan(public.tracker_safe_uuid((storage.foldername(name))[2]), (select auth.uid()))
);
create policy tracker_media_update on storage.objects
for update to authenticated
using (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
)
with check (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
);
create policy tracker_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'tracker-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
);

grant execute on function public.is_tracker_couple_member(uuid, uuid) to authenticated;
grant execute on function public.can_view_tracker_plan(uuid, uuid) to authenticated;
grant execute on function public.can_edit_tracker_plan(uuid, uuid) to authenticated;
grant execute on function public.tracker_safe_uuid(text) to authenticated;
grant execute on function public.adjust_tracker_event_count(uuid, uuid, date, integer) to authenticated;
grant execute on function public.save_tracker_checkin(uuid, date, text, integer, integer, text, text, boolean) to authenticated;
grant execute on function public.get_tracker_checkins(uuid, date, date) to authenticated;
grant execute on function public.list_tracker_plan_occurrences(uuid, date, date) to authenticated;
grant execute on function public.find_tracker_common_free_slots(uuid, date, integer, time, time) to authenticated;

grant select, insert, update, delete on public.tracker_plans to authenticated;
grant select, insert, update, delete on public.tracker_plan_participants to authenticated;
grant select, insert, update, delete on public.tracker_plan_occurrence_overrides to authenticated;
grant select, insert, update, delete on public.tracker_plan_reminders to authenticated;
grant select, insert, update, delete on public.tracker_plan_comments to authenticated;
grant select, insert, update, delete on public.tracker_plan_attachments to authenticated;
grant select, insert, update, delete on public.tracker_checkins to authenticated;
grant select, insert, update, delete on public.tracker_category_preferences to authenticated;
grant select, insert, update, delete on public.tracker_plan_memory_links to authenticated;
grant select, insert, update, delete on public.tracker_plan_activity to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tracker_plans',
    'tracker_plan_participants',
    'tracker_plan_occurrence_overrides',
    'tracker_plan_comments',
    'tracker_checkins',
    'tracker_category_preferences',
    'tracker_plan_activity'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;

commit;
