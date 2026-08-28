begin;

-- Remove quiz-specific notification data and preferences.
delete from public.couple_notifications
where type like 'quiz_%'
   or href like '/quizzes%';

update public.user_notification_settings
set settings = settings - 'quizzes'
where settings ? 'quizzes';

alter table public.user_notification_settings
  alter column settings set default
  '{"chat": true, "goals": true, "questions": true, "reactions": true}'::jsonb;

-- Rebuild the shared private-media policies without the retired bucket.
drop policy if exists "Couple members can read private media" on storage.objects;
drop policy if exists "Couple members can upload private media" on storage.objects;
drop policy if exists "Couple members can update private media" on storage.objects;
drop policy if exists "Couple members can delete private media" on storage.objects;

create policy "Couple members can read private media"
on storage.objects for select to authenticated
using (
  bucket_id in ('memory-images', 'question-media', 'watch-posters', 'chat-media')
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.couples couple
      where couple.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
    )
  )
);

create policy "Couple members can upload private media"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('memory-images', 'question-media', 'watch-posters', 'chat-media')
  and exists (
    select 1 from public.couples couple
    where couple.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);

create policy "Couple members can update private media"
on storage.objects for update to authenticated
using (
  bucket_id in ('memory-images', 'question-media', 'watch-posters', 'chat-media')
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.couples couple
      where couple.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
    )
  )
)
with check (
  bucket_id in ('memory-images', 'question-media', 'watch-posters', 'chat-media')
  and exists (
    select 1 from public.couples couple
    where couple.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);

create policy "Couple members can delete private media"
on storage.objects for delete to authenticated
using (
  bucket_id in ('memory-images', 'question-media', 'watch-posters', 'chat-media')
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.couples couple
      where couple.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
    )
  )
);

-- Delete quiz uploads and the bucket after access policies no longer reference it.
delete from storage.objects where bucket_id = 'quiz-media';
delete from storage.buckets where id = 'quiz-media';

drop table if exists public.quiz_comments;
drop table if exists public.quiz_answers;

commit;
