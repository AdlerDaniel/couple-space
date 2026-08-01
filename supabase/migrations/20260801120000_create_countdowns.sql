begin;

create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  icon text not null default '💗' check (char_length(icon) between 1 and 16),
  target_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists countdowns_couple_target_idx
  on public.countdowns (couple_id, target_at);

create index if not exists countdowns_couple_updated_idx
  on public.countdowns (couple_id, updated_at desc);

alter table public.countdowns enable row level security;

revoke all on table public.countdowns from anon;
grant select, delete on table public.countdowns to authenticated;
grant insert (couple_id, title, description, icon, target_at, created_by, updated_by, updated_at)
  on table public.countdowns to authenticated;
grant update (title, description, icon, target_at, updated_by, updated_at)
  on table public.countdowns to authenticated;

drop policy if exists "Couple members can view countdowns" on public.countdowns;
create policy "Couple members can view countdowns"
on public.countdowns for select to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = countdowns.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));

drop policy if exists "Couple members can create countdowns" on public.countdowns;
create policy "Couple members can create countdowns"
on public.countdowns for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1 from public.couples couple
    where couple.id = countdowns.couple_id
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);

drop policy if exists "Couple members can update countdowns" on public.countdowns;
create policy "Couple members can update countdowns"
on public.countdowns for update to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = countdowns.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
))
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.couples couple
    where couple.id = countdowns.couple_id
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);

drop policy if exists "Couple members can delete countdowns" on public.countdowns;
create policy "Couple members can delete countdowns"
on public.countdowns for delete to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = countdowns.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));

do $$
begin
  alter publication supabase_realtime add table public.countdowns;
exception
  when duplicate_object then null;
end $$;

commit;
