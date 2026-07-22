begin;

-- Keep the most complete profile for each couple and merge non-empty fields
-- before removing rows created by earlier SELECT -> INSERT races.
with ranked as (
  select
    id,
    couple_id,
    row_number() over (
      partition by couple_id
      order by (
        (partner_one is not null)::int +
        (partner_two is not null)::int +
        (start_date is not null)::int +
        (avatar is not null)::int +
        (avatar_one is not null)::int +
        (avatar_two is not null)::int +
        (status_one_text is not null)::int +
        (status_two_text is not null)::int
      ) desc, created_at desc, id
    ) as position
  from public.couple_profiles
), keepers as (
  select id, couple_id from ranked where position = 1
)
update public.couple_profiles target
set
  partner_one = coalesce(target.partner_one, (
    select source.partner_one from public.couple_profiles source
    where source.couple_id = target.couple_id and source.partner_one is not null
    order by source.created_at desc limit 1
  )),
  partner_two = coalesce(target.partner_two, (
    select source.partner_two from public.couple_profiles source
    where source.couple_id = target.couple_id and source.partner_two is not null
    order by source.created_at desc limit 1
  )),
  start_date = coalesce(target.start_date, (
    select source.start_date from public.couple_profiles source
    where source.couple_id = target.couple_id and source.start_date is not null
    order by source.created_at desc limit 1
  )),
  avatar = coalesce(target.avatar, (
    select source.avatar from public.couple_profiles source
    where source.couple_id = target.couple_id and source.avatar is not null
    order by source.created_at desc limit 1
  )),
  avatar_one = coalesce(target.avatar_one, (
    select source.avatar_one from public.couple_profiles source
    where source.couple_id = target.couple_id and source.avatar_one is not null
    order by source.created_at desc limit 1
  )),
  avatar_two = coalesce(target.avatar_two, (
    select source.avatar_two from public.couple_profiles source
    where source.couple_id = target.couple_id and source.avatar_two is not null
    order by source.created_at desc limit 1
  )),
  status_one_text = coalesce(target.status_one_text, (
    select source.status_one_text from public.couple_profiles source
    where source.couple_id = target.couple_id and source.status_one_text is not null
    order by source.created_at desc limit 1
  )),
  status_two_text = coalesce(target.status_two_text, (
    select source.status_two_text from public.couple_profiles source
    where source.couple_id = target.couple_id and source.status_two_text is not null
    order by source.created_at desc limit 1
  )),
  status_updates_one = greatest(target.status_updates_one, (
    select max(source.status_updates_one) from public.couple_profiles source
    where source.couple_id = target.couple_id
  )),
  status_updates_two = greatest(target.status_updates_two, (
    select max(source.status_updates_two) from public.couple_profiles source
    where source.couple_id = target.couple_id
  ))
where target.id in (select id from keepers);

with ranked as (
  select
    id,
    row_number() over (
      partition by couple_id
      order by (
        (partner_one is not null)::int +
        (partner_two is not null)::int +
        (start_date is not null)::int +
        (avatar is not null)::int +
        (avatar_one is not null)::int +
        (avatar_two is not null)::int +
        (status_one_text is not null)::int +
        (status_two_text is not null)::int
      ) desc, created_at desc, id
    ) as position
  from public.couple_profiles
)
delete from public.couple_profiles target
using ranked
where target.id = ranked.id and ranked.position > 1;

-- Merge only true duplicate daily-question rows. Different questions on the
-- same date remain valid archive entries.
with ranked as (
  select
    id,
    couple_id,
    date,
    question,
    row_number() over (
      partition by couple_id, date, question
      order by (
        (nullif(btrim(answer_one), '') is not null)::int +
        (nullif(btrim(answer_two), '') is not null)::int +
        (answer_one_voice_url is not null)::int +
        (answer_two_voice_url is not null)::int +
        (answer_one_photo_url is not null)::int +
        (answer_two_photo_url is not null)::int
      ) desc, created_at, id
    ) as position
  from public.question_answers
), keepers as (
  select id, couple_id, date, question from ranked where position = 1
)
update public.question_answers target
set
  answer_one = coalesce(nullif(btrim(target.answer_one), ''), (
    select source.answer_one from public.question_answers source
    where source.couple_id = target.couple_id
      and source.date = target.date
      and source.question = target.question
      and nullif(btrim(source.answer_one), '') is not null
    order by char_length(source.answer_one) desc, source.created_at desc limit 1
  )),
  answer_two = coalesce(nullif(btrim(target.answer_two), ''), (
    select source.answer_two from public.question_answers source
    where source.couple_id = target.couple_id
      and source.date = target.date
      and source.question = target.question
      and nullif(btrim(source.answer_two), '') is not null
    order by char_length(source.answer_two) desc, source.created_at desc limit 1
  )),
  answer_one_voice_url = coalesce(target.answer_one_voice_url, (
    select source.answer_one_voice_url from public.question_answers source
    where source.couple_id = target.couple_id and source.date = target.date
      and source.question = target.question and source.answer_one_voice_url is not null
    order by source.created_at desc limit 1
  )),
  answer_two_voice_url = coalesce(target.answer_two_voice_url, (
    select source.answer_two_voice_url from public.question_answers source
    where source.couple_id = target.couple_id and source.date = target.date
      and source.question = target.question and source.answer_two_voice_url is not null
    order by source.created_at desc limit 1
  )),
  answer_one_photo_url = coalesce(target.answer_one_photo_url, (
    select source.answer_one_photo_url from public.question_answers source
    where source.couple_id = target.couple_id and source.date = target.date
      and source.question = target.question and source.answer_one_photo_url is not null
    order by source.created_at desc limit 1
  )),
  answer_two_photo_url = coalesce(target.answer_two_photo_url, (
    select source.answer_two_photo_url from public.question_answers source
    where source.couple_id = target.couple_id and source.date = target.date
      and source.question = target.question and source.answer_two_photo_url is not null
    order by source.created_at desc limit 1
  )),
  answer_one_edited_at = coalesce(target.answer_one_edited_at, (
    select max(source.answer_one_edited_at) from public.question_answers source
    where source.couple_id = target.couple_id and source.date = target.date
      and source.question = target.question
  )),
  answer_two_edited_at = coalesce(target.answer_two_edited_at, (
    select max(source.answer_two_edited_at) from public.question_answers source
    where source.couple_id = target.couple_id and source.date = target.date
      and source.question = target.question
  ))
where target.id in (select id from keepers);

with ranked as (
  select
    id,
    first_value(id) over (
      partition by couple_id, date, question
      order by (
        (nullif(btrim(answer_one), '') is not null)::int +
        (nullif(btrim(answer_two), '') is not null)::int +
        (answer_one_voice_url is not null)::int +
        (answer_two_voice_url is not null)::int +
        (answer_one_photo_url is not null)::int +
        (answer_two_photo_url is not null)::int
      ) desc, created_at, id
    ) as keeper_id,
    row_number() over (
      partition by couple_id, date, question
      order by (
        (nullif(btrim(answer_one), '') is not null)::int +
        (nullif(btrim(answer_two), '') is not null)::int +
        (answer_one_voice_url is not null)::int +
        (answer_two_voice_url is not null)::int +
        (answer_one_photo_url is not null)::int +
        (answer_two_photo_url is not null)::int
      ) desc, created_at, id
    ) as position
  from public.question_answers
)
update public.question_comments comments
set question_answer_id = ranked.keeper_id
from ranked
where comments.question_answer_id = ranked.id and ranked.position > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by couple_id, date, question
      order by (
        (nullif(btrim(answer_one), '') is not null)::int +
        (nullif(btrim(answer_two), '') is not null)::int +
        (answer_one_voice_url is not null)::int +
        (answer_two_voice_url is not null)::int +
        (answer_one_photo_url is not null)::int +
        (answer_two_photo_url is not null)::int
      ) desc, created_at, id
    ) as position
  from public.question_answers
)
delete from public.question_answers target
using ranked
where target.id = ranked.id and ranked.position > 1;

-- Clear references to already deleted auth users before adding foreign keys.
update public.memories memory
set user_id = null
where memory.user_id is not null
  and not exists (select 1 from auth.users users where users.id = memory.user_id);

update public.couples couple
set partner_one_id = null
where couple.partner_one_id is not null
  and not exists (select 1 from auth.users users where users.id = couple.partner_one_id);

update public.couples couple
set partner_two_id = null
where couple.partner_two_id is not null
  and not exists (select 1 from auth.users users where users.id = couple.partner_two_id);

alter table public.couple_profiles alter column couple_id set not null;
alter table public.memories alter column couple_id set not null;
alter table public.question_answers alter column couple_id set not null;
alter table public.question_answers alter column date set not null;
alter table public.question_answers alter column question set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'couple_profiles_couple_id_key') then
    alter table public.couple_profiles
      add constraint couple_profiles_couple_id_key unique (couple_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couple_profiles_couple_id_fkey') then
    alter table public.couple_profiles
      add constraint couple_profiles_couple_id_fkey foreign key (couple_id)
      references public.couples(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couples_invite_code_key') then
    alter table public.couples
      add constraint couples_invite_code_key unique (invite_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couples_partner_one_id_fkey') then
    alter table public.couples
      add constraint couples_partner_one_id_fkey foreign key (partner_one_id)
      references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couples_partner_two_id_fkey') then
    alter table public.couples
      add constraint couples_partner_two_id_fkey foreign key (partner_two_id)
      references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memories_couple_id_fkey') then
    alter table public.memories
      add constraint memories_couple_id_fkey foreign key (couple_id)
      references public.couples(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memories_user_id_fkey') then
    alter table public.memories
      add constraint memories_user_id_fkey foreign key (user_id)
      references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'question_answers_couple_id_fkey') then
    alter table public.question_answers
      add constraint question_answers_couple_id_fkey foreign key (couple_id)
      references public.couples(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'question_answers_couple_date_question_key') then
    alter table public.question_answers
      add constraint question_answers_couple_date_question_key
      unique (couple_id, date, question);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couple_notifications_title_length_check') then
    alter table public.couple_notifications
      add constraint couple_notifications_title_length_check
      check (char_length(title) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couple_notifications_body_length_check') then
    alter table public.couple_notifications
      add constraint couple_notifications_body_length_check
      check (body is null or char_length(body) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couple_notifications_type_format_check') then
    alter table public.couple_notifications
      add constraint couple_notifications_type_format_check
      check (type ~ '^[a-z][a-z0-9_]{0,47}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'couple_notifications_href_format_check') then
    alter table public.couple_notifications
      add constraint couple_notifications_href_format_check
      check (href is null or (char_length(href) <= 300 and href ~ '^/[^/]'));
  end if;
end $$;

create index if not exists memories_couple_created_idx
  on public.memories (couple_id, created_at desc);
create index if not exists question_answers_couple_date_idx
  on public.question_answers (couple_id, date);
create index if not exists question_answers_couple_created_idx
  on public.question_answers (couple_id, created_at desc);

do $$
begin
  alter publication supabase_realtime add table public.question_answers;
exception
  when duplicate_object then null;
end $$;

-- Server-only rate-limit ledger. No browser role receives table privileges.
create table if not exists public.api_rate_limit_events (
  id bigint generated always as identity primary key,
  route text not null,
  identity_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.api_rate_limit_events enable row level security;
revoke all on table public.api_rate_limit_events from anon, authenticated;
grant select, insert, delete on table public.api_rate_limit_events to service_role;
grant usage, select on sequence public.api_rate_limit_events_id_seq to service_role;
create index if not exists api_rate_limit_events_lookup_idx
  on public.api_rate_limit_events (route, identity_hash, created_at desc);

-- Private relationship tables must never be readable by the anon role.
revoke all on table public.couple_profiles from anon;
revoke all on table public.memories from anon;
revoke all on table public.question_answers from anon;
grant select, insert, update, delete on table public.couple_profiles to authenticated;
grant select, insert, update, delete on table public.memories to authenticated;
grant select, insert, update, delete on table public.question_answers to authenticated;

drop policy if exists "Allow select for everyone" on public.couple_profiles;
drop policy if exists "User can update own profile" on public.couple_profiles;
drop policy if exists "Couple members can view couple profiles" on public.couple_profiles;
drop policy if exists "Couple members can insert couple profiles" on public.couple_profiles;
drop policy if exists "Couple members can update couple profiles" on public.couple_profiles;

create policy "Couple members can view couple profiles"
on public.couple_profiles for select to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = couple_profiles.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can insert couple profiles"
on public.couple_profiles for insert to authenticated
with check (exists (
  select 1 from public.couples couple
  where couple.id = couple_profiles.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can update couple profiles"
on public.couple_profiles for update to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = couple_profiles.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
))
with check (exists (
  select 1 from public.couples couple
  where couple.id = couple_profiles.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));

drop policy if exists "Allow select memories for everyone" on public.memories;
drop policy if exists "Couple members can view memories" on public.memories;
drop policy if exists "Couple members can insert memories" on public.memories;
drop policy if exists "Couple members can update memories" on public.memories;
drop policy if exists "Couple members can delete memories" on public.memories;

create policy "Couple members can view memories"
on public.memories for select to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = memories.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can insert memories"
on public.memories for insert to authenticated
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.couples couple
    where couple.id = memories.couple_id
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);
create policy "Couple members can update memories"
on public.memories for update to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = memories.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
))
with check (exists (
  select 1 from public.couples couple
  where couple.id = memories.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can delete memories"
on public.memories for delete to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = memories.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));

drop policy if exists "Couple members can view question answers" on public.question_answers;
drop policy if exists "Couple members can insert question answers" on public.question_answers;
drop policy if exists "Couple members can update question answers" on public.question_answers;
drop policy if exists "Couple members can delete question answers" on public.question_answers;

create policy "Couple members can view question answers"
on public.question_answers for select to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = question_answers.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can insert question answers"
on public.question_answers for insert to authenticated
with check (exists (
  select 1 from public.couples couple
  where couple.id = question_answers.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can update question answers"
on public.question_answers for update to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = question_answers.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
))
with check (exists (
  select 1 from public.couples couple
  where couple.id = question_answers.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));
create policy "Couple members can delete question answers"
on public.question_answers for delete to authenticated
using (exists (
  select 1 from public.couples couple
  where couple.id = question_answers.couple_id
    and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
));

-- Creating, joining and leaving now run through authenticated server routes.
-- Client roles can only read pairs they already belong to.
drop policy if exists "Authenticated users can find open couples by invite" on public.couples;
drop policy if exists "Couple members can read their couples" on public.couples;
drop policy if exists "Members can update or join couples" on public.couples;
drop policy if exists "Users can create couples" on public.couples;
drop policy if exists "Users can create their own couples" on public.couples;
drop policy if exists "Users can leave couples" on public.couples;
drop policy if exists "Users can update their couples" on public.couples;
drop policy if exists "Users can view their couples" on public.couples;

create policy "Users can view their couples"
on public.couples for select to authenticated
using ((select auth.uid()) in (partner_one_id, partner_two_id));

revoke insert, update, delete on table public.couples from authenticated;
grant select on table public.couples to authenticated;

-- Replace per-row auth.uid() calls in remaining policies with init-plan
-- expressions and make auth-based public policies explicitly authenticated.
do $$
declare
  policy_record record;
  new_using text;
  new_check text;
  alter_sql text;
begin
  for policy_record in
    select schemaname, tablename, policyname, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'
      and (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%select auth.uid()%'
  loop
    new_using := replace(policy_record.qual, 'auth.uid()', '(select auth.uid())');
    new_check := replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())');
    alter_sql := format('alter policy %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);

    if policy_record.roles = array['public']::name[] then
      alter_sql := alter_sql || ' to authenticated';
    end if;
    if new_using is not null then
      alter_sql := alter_sql || format(' using (%s)', new_using);
    end if;
    if new_check is not null then
      alter_sql := alter_sql || format(' with check (%s)', new_check);
    end if;

    execute alter_sql;
  end loop;
end $$;

-- Remove broad bucket-wide policies, then authorize by the couple UUID in the
-- first path segment. Existing legacy objects remain manageable by their owner.
drop policy if exists "Anyone can read memory images" on storage.objects;
drop policy if exists "Authenticated users can upload memory images" on storage.objects;
drop policy if exists "Authenticated users can update memory images" on storage.objects;
drop policy if exists "Authenticated users can delete memory images" on storage.objects;
drop policy if exists "Anyone can read question media" on storage.objects;
drop policy if exists "Authenticated users can upload question media" on storage.objects;
drop policy if exists "Authenticated users can update question media" on storage.objects;
drop policy if exists "Authenticated users can delete question media" on storage.objects;
drop policy if exists "Anyone can read quiz media" on storage.objects;
drop policy if exists "Authenticated users can upload quiz media" on storage.objects;
drop policy if exists "Authenticated users can update quiz media" on storage.objects;
drop policy if exists "Authenticated users can delete quiz media" on storage.objects;
drop policy if exists "Couple members can upload watch posters" on storage.objects;
drop policy if exists "Couple members can update watch posters" on storage.objects;
drop policy if exists "Couple members can delete watch posters" on storage.objects;
drop policy if exists "Anyone can read chat media" on storage.objects;
drop policy if exists "Couple users can upload chat media" on storage.objects;
drop policy if exists "Couple members can read private media" on storage.objects;
drop policy if exists "Couple members can upload private media" on storage.objects;
drop policy if exists "Couple members can update private media" on storage.objects;
drop policy if exists "Couple members can delete private media" on storage.objects;

create policy "Couple members can read private media"
on storage.objects for select to authenticated
using (
  bucket_id in ('memory-images', 'question-media', 'quiz-media', 'watch-posters', 'chat-media')
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
  bucket_id in ('memory-images', 'question-media', 'quiz-media', 'watch-posters', 'chat-media')
  and exists (
    select 1 from public.couples couple
    where couple.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);
create policy "Couple members can update private media"
on storage.objects for update to authenticated
using (
  bucket_id in ('memory-images', 'question-media', 'quiz-media', 'watch-posters', 'chat-media')
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
  bucket_id in ('memory-images', 'question-media', 'quiz-media', 'watch-posters', 'chat-media')
  and exists (
    select 1 from public.couples couple
    where couple.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
  )
);
create policy "Couple members can delete private media"
on storage.objects for delete to authenticated
using (
  bucket_id in ('memory-images', 'question-media', 'quiz-media', 'watch-posters', 'chat-media')
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.couples couple
      where couple.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (couple.partner_one_id, couple.partner_two_id)
    )
  )
);

-- Avatars are user-scoped rather than couple-scoped.
drop policy if exists "Authenticated users can upload profile avatars" on storage.objects;
drop policy if exists "Users can upload their own profile avatars" on storage.objects;
drop policy if exists "Users can update their own profile avatars" on storage.objects;
drop policy if exists "Users can delete their own profile avatars" on storage.objects;
drop policy if exists "Users can read their own profile avatars" on storage.objects;

create policy "Users can read their own profile avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Users can upload their own profile avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Users can update their own profile avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Users can delete their own profile avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
