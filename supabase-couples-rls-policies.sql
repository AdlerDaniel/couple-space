alter table public.couples enable row level security;

drop policy if exists "Couple members can read their couples"
  on public.couples;
create policy "Couple members can read their couples"
  on public.couples
  for select
  to authenticated
  using (
    partner_one_id = auth.uid()
    or partner_two_id = auth.uid()
    or partner_two_id is null
  );

drop policy if exists "Users can create their own couples"
  on public.couples;
create policy "Users can create their own couples"
  on public.couples
  for insert
  to authenticated
  with check (
    partner_one_id = auth.uid()
    and partner_two_id is null
  );

drop policy if exists "Members can update or join couples"
  on public.couples;
create policy "Members can update or join couples"
  on public.couples
  for update
  to authenticated
  using (
    partner_one_id = auth.uid()
    or partner_two_id = auth.uid()
    or partner_two_id is null
  )
  with check (
    partner_one_id is null
    or partner_one_id = auth.uid()
    or partner_two_id = auth.uid()
    or partner_two_id is null
  );
