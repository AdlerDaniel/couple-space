create table if not exists public.watch_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  content_type text not null check (content_type in ('movie', 'series', 'cartoon', 'anime')),
  added_by uuid not null references auth.users(id) on delete cascade,
  is_watched boolean not null default false,
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watch_items_couple_id_idx
on public.watch_items(couple_id);

create index if not exists watch_items_added_by_idx
on public.watch_items(added_by);

create unique index if not exists watch_items_couple_title_unique
on public.watch_items(couple_id, lower(btrim(title)));

alter table public.watch_items enable row level security;

drop policy if exists "Couple members can read watch items" on public.watch_items;
create policy "Couple members can read watch items"
on public.watch_items
for select
to authenticated
using (
  exists (
    select 1
    from public.couples c
    where c.id = watch_items.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

drop policy if exists "Couple members can add watch items" on public.watch_items;
create policy "Couple members can add watch items"
on public.watch_items
for insert
to authenticated
with check (
  added_by = (select auth.uid())
  and exists (
    select 1
    from public.couples c
    where c.id = watch_items.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

drop policy if exists "Couple members can update watch items" on public.watch_items;
create policy "Couple members can update watch items"
on public.watch_items
for update
to authenticated
using (
  exists (
    select 1
    from public.couples c
    where c.id = watch_items.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
)
with check (
  exists (
    select 1
    from public.couples c
    where c.id = watch_items.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

drop policy if exists "Couple members can delete watch items" on public.watch_items;
create policy "Couple members can delete watch items"
on public.watch_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.couples c
    where c.id = watch_items.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

grant select, insert, update, delete on public.watch_items to authenticated;
