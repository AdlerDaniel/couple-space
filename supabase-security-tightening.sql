drop policy if exists "Allow insert for everyone" on public.couple_profiles;
drop policy if exists "Allow update for everyone" on public.couple_profiles;
drop policy if exists "Allow insert memories for everyone" on public.memories;
drop policy if exists "Allow delete memories for everyone" on public.memories;
drop policy if exists "Authenticated users can update tracker categories" on public.tracker_categories;

drop policy if exists "Couple members can update couple profiles" on public.couple_profiles;
create policy "Couple members can update couple profiles"
on public.couple_profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.couples c
    where c.id = couple_profiles.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
)
with check (
  exists (
    select 1
    from public.couples c
    where c.id = couple_profiles.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

drop policy if exists "Users can update their couples" on public.couples;
create policy "Users can update their couples"
on public.couples
for update
to authenticated
using (
  partner_one_id = (select auth.uid())
  or partner_two_id = (select auth.uid())
  or partner_two_id is null
)
with check (
  partner_one_id = (select auth.uid())
  or partner_two_id = (select auth.uid())
  or partner_two_id is null
);

drop policy if exists "Users can leave couples" on public.couples;
create policy "Users can leave couples"
on public.couples
for update
to authenticated
using (
  partner_one_id = (select auth.uid())
  or partner_two_id = (select auth.uid())
)
with check (
  partner_one_id = (select auth.uid())
  or partner_two_id = (select auth.uid())
  or partner_one_id is null
  or partner_two_id is null
);

drop policy if exists "Anyone can read chat media" on storage.objects;
drop policy if exists "Allow authenticated read memory images" on storage.objects;
drop policy if exists "Allow public read memory images" on storage.objects;
drop policy if exists "Anyone can read memory images" on storage.objects;
drop policy if exists "Anyone can read profile avatars" on storage.objects;
drop policy if exists "Anyone can read question media" on storage.objects;
