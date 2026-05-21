alter table public.memories enable row level security;

drop policy if exists "Couple members can read memories"
  on public.memories;
create policy "Couple members can read memories"
  on public.memories
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.couples
      where couples.id = memories.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can create memories"
  on public.memories;
create policy "Couple members can create memories"
  on public.memories
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.couples
      where couples.id = memories.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can update memories"
  on public.memories;
create policy "Couple members can update memories"
  on public.memories
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.couples
      where couples.id = memories.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.couples
      where couples.id = memories.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

drop policy if exists "Couple members can delete memories"
  on public.memories;
create policy "Couple members can delete memories"
  on public.memories
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.couples
      where couples.id = memories.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
    )
  );

grant select, insert, update, delete on public.memories to authenticated;
