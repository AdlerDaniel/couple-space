alter table public.memories
  add column if not exists title text,
  add column if not exists caption text,
  add column if not exists event_date date,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists reactions jsonb not null default '{}'::jsonb;

create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists memory_comments_memory_id_idx
  on public.memory_comments(memory_id, created_at);

alter table public.memory_comments enable row level security;

drop policy if exists "Couple members can read memory comments"
  on public.memory_comments;
create policy "Couple members can read memory comments"
  on public.memory_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.couples
      where couples.id = memory_comments.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can add memory comments"
  on public.memory_comments;
create policy "Couple members can add memory comments"
  on public.memory_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.couples
      where couples.id = memory_comments.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Comment authors can update memory comments"
  on public.memory_comments;
create policy "Comment authors can update memory comments"
  on public.memory_comments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Comment authors can delete memory comments"
  on public.memory_comments;
create policy "Comment authors can delete memory comments"
  on public.memory_comments
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.memory_comments to authenticated;
