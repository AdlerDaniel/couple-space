insert into storage.buckets (id, name, public)
values ('watch-posters', 'watch-posters', true)
on conflict (id) do update set public = true;

drop policy if exists "Couple members can upload watch posters" on storage.objects;
create policy "Couple members can upload watch posters"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'watch-posters');

drop policy if exists "Couple members can update watch posters" on storage.objects;
create policy "Couple members can update watch posters"
on storage.objects
for update
to authenticated
using (bucket_id = 'watch-posters')
with check (bucket_id = 'watch-posters');
