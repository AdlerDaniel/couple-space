insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', true)
on conflict (id) do update
set public = true;

drop policy if exists "Anyone can read question media"
  on storage.objects;
create policy "Anyone can read question media"
  on storage.objects
  for select
  to public
  using (bucket_id = 'question-media');

drop policy if exists "Authenticated users can upload question media"
  on storage.objects;
create policy "Authenticated users can upload question media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'question-media');

drop policy if exists "Authenticated users can update question media"
  on storage.objects;
create policy "Authenticated users can update question media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'question-media')
  with check (bucket_id = 'question-media');

drop policy if exists "Authenticated users can delete question media"
  on storage.objects;
create policy "Authenticated users can delete question media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'question-media');
