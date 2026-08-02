alter table public.question_comments
  alter column text drop not null,
  alter column text set default '',
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text;

alter table public.question_comments
  drop constraint if exists question_comments_attachment_type_check,
  add constraint question_comments_attachment_type_check
    check (attachment_type is null or attachment_type in ('image', 'video', 'audio')),
  drop constraint if exists question_comments_content_check,
  add constraint question_comments_content_check
    check (
      nullif(btrim(coalesce(text, '')), '') is not null
      or attachment_url is not null
    );

drop policy if exists "Comment authors can update question comments"
  on public.question_comments;
create policy "Comment authors can update question comments"
  on public.question_comments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.question_comments to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.question_comments;
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read question media"
  on storage.objects;
create policy "Anyone can read question media"
  on storage.objects
  for select
  to public
  using (bucket_id = 'question-media');

drop policy if exists "Authenticated users can upload question media"
  on storage.objects;
drop policy if exists "Couple members can upload question discussion media"
  on storage.objects;
create policy "Couple members can upload question discussion media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.couples c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "Authenticated users can update question media"
  on storage.objects;
drop policy if exists "Couple members can update question discussion media"
  on storage.objects;
create policy "Couple members can update question discussion media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.couples c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.partner_one_id, c.partner_two_id)
    )
  )
  with check (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.couples c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "Authenticated users can delete question media"
  on storage.objects;
drop policy if exists "Couple members can delete question discussion media"
  on storage.objects;
create policy "Couple members can delete question discussion media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.couples c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.partner_one_id, c.partner_two_id)
    )
  );
