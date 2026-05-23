create table if not exists public.tracker_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  category_id uuid references public.tracker_categories(id) on delete set null,
  period text not null default 'week' check (period in ('day', 'week', 'month', 'year')),
  target_count integer not null default 1 check (target_count between 1 and 999),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.tracker_goals
  add column if not exists category_id uuid references public.tracker_categories(id) on delete set null;

alter table public.tracker_goals
  add column if not exists period text not null default 'week';

alter table public.tracker_goals
  add column if not exists target_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracker_goals_period_check'
  ) then
    alter table public.tracker_goals
      add constraint tracker_goals_period_check
      check (period in ('day', 'week', 'month', 'year'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracker_goals_target_count_check'
  ) then
    alter table public.tracker_goals
      add constraint tracker_goals_target_count_check
      check (target_count between 1 and 999);
  end if;
end $$;

alter table public.tracker_goals enable row level security;

create index if not exists tracker_goals_couple_created_at_idx
  on public.tracker_goals (couple_id, created_at desc);

drop policy if exists "tracker_goals_select_pair" on public.tracker_goals;
create policy "tracker_goals_select_pair"
  on public.tracker_goals
  for select
  using (
    exists (
      select 1
      from public.couples c
      where c.id = tracker_goals.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "tracker_goals_insert_pair" on public.tracker_goals;
create policy "tracker_goals_insert_pair"
  on public.tracker_goals
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.couples c
      where c.id = tracker_goals.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "tracker_goals_delete_own" on public.tracker_goals;
create policy "tracker_goals_delete_own"
  on public.tracker_goals
  for delete
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from public.couples c
      where c.id = tracker_goals.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  );
