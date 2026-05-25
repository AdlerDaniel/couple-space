create table if not exists public.tracker_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text not null default '♡',
  color text not null default '#d97706',
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  category_id uuid not null references public.tracker_categories(id) on delete cascade,
  date date not null,
  time time,
  count integer not null default 1 check (count >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  note text,
  mood text not null default 'good' check (mood in ('great', 'good', 'normal', 'tired', 'bad')),
  participants text not null default 'me' check (participants in ('both', 'me', 'partner')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracker_events_couple_date_idx
  on public.tracker_events(couple_id, date);

create index if not exists tracker_events_couple_category_date_idx
  on public.tracker_events(couple_id, category_id, date);

insert into public.tracker_categories (name, slug, icon, color, sort_order, is_default)
values
  ('Поели', 'food', '🍽️', '#f97316', 10, true),
  ('Секс', 'sex', '❤️', '#f59e0b', 20, true),
  ('Спорт', 'sport', '🏃', '#ca8a04', 30, true),
  ('Игры', 'games', '🎮', '#eab308', 40, true),
  ('Рисунки', 'drawings', '🎨', '#84cc16', 50, true)
on conflict (slug) do update
set
  name = excluded.name,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_default = excluded.is_default;

update public.tracker_events
set participants = 'me'
where participants = 'both';

alter table public.tracker_categories enable row level security;
alter table public.tracker_events enable row level security;

drop policy if exists "Authenticated users can read tracker categories"
  on public.tracker_categories;
create policy "Authenticated users can read tracker categories"
  on public.tracker_categories
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can update tracker categories"
  on public.tracker_categories;
create policy "Authenticated users can update tracker categories"
  on public.tracker_categories
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Couple members can read tracker events"
  on public.tracker_events;
create policy "Couple members can read tracker events"
  on public.tracker_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.couples
      where couples.id = tracker_events.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can add tracker events"
  on public.tracker_events;
create policy "Couple members can add tracker events"
  on public.tracker_events
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.couples
      where couples.id = tracker_events.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can update tracker events"
  on public.tracker_events;
drop policy if exists "Event authors can update tracker events"
  on public.tracker_events;
create policy "Event authors can update tracker events"
  on public.tracker_events
  for update
  to authenticated
  using (
    created_by = auth.uid()
    and
    exists (
      select 1
      from public.couples
      where couples.id = tracker_events.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  )
  with check (
    created_by = auth.uid()
    and
    exists (
      select 1
      from public.couples
      where couples.id = tracker_events.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can delete tracker events"
  on public.tracker_events;
drop policy if exists "Event authors can delete tracker events"
  on public.tracker_events;
create policy "Event authors can delete tracker events"
  on public.tracker_events
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    and
    exists (
      select 1
      from public.couples
      where couples.id = tracker_events.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

grant select, update on public.tracker_categories to authenticated;
grant select, insert, update, delete on public.tracker_events to authenticated;
