insert into storage.buckets (id, name, public)
values ('memory-images', 'memory-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "Anyone can read memory images"
  on storage.objects;
create policy "Anyone can read memory images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'memory-images');

-- The app uploads with upsert: true, so this bucket must keep SELECT and UPDATE
-- policies in addition to INSERT. Without SELECT, Storage can fail with an RLS
-- error before the memory card is created.
drop policy if exists "Authenticated users can upload memory images"
  on storage.objects;
create policy "Authenticated users can upload memory images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'memory-images');

drop policy if exists "Authenticated users can update memory images"
  on storage.objects;
create policy "Authenticated users can update memory images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'memory-images')
  with check (bucket_id = 'memory-images');

drop policy if exists "Authenticated users can delete memory images"
  on storage.objects;
create policy "Authenticated users can delete memory images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'memory-images');
