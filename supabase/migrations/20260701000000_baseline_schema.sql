-- Baseline generated read-only from the production schema. No production rows are included.

-- Subsequent versioned migrations remain the source of all changes after this snapshot.

begin;

create table public.api_rate_limit_events (id bigint generated always as identity not null,
  route text not null,
  identity_hash text not null,
  created_at timestamp with time zone default now() not null);

create table public.countdowns (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  title text not null,
  description text,
  icon text default '💗'::text not null,
  target_at timestamp with time zone not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table public.couple_chat_messages (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  sender_id uuid not null,
  body text,
  created_at timestamp with time zone default now() not null,
  reply_to_id uuid,
  reactions jsonb default '[]'::jsonb not null,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  pinned_at timestamp with time zone,
  edited_at timestamp with time zone,
  read_at timestamp with time zone,
  deleted_for uuid[] default '{}'::uuid[] not null,
  deleted_for_everyone boolean default false not null,
  attachments jsonb default '[]'::jsonb not null);

create table public.couple_notifications (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  recipient_id uuid not null,
  actor_id uuid not null,
  type text not null,
  title text not null,
  body text,
  href text,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null);

create table public.couple_profiles (created_at timestamp with time zone default now() not null,
  id uuid default gen_random_uuid() not null,
  partner_one text,
  partner_two text,
  start_date date,
  couple_id uuid not null,
  avatar text,
  avatar_one text,
  avatar_two text,
  status_one_text text,
  status_one_emoji text default '❤️'::text not null,
  status_two_text text,
  status_two_emoji text default '❤️'::text not null,
  status_updates_one integer default 0 not null,
  status_updates_two integer default 0 not null,
  time_zone text default 'Europe/Moscow'::text not null);

create table public.couples (id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  invite_code text,
  partner_one_id uuid default gen_random_uuid(),
  partner_two_id uuid);

create table public.memories (id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  text text,
  image text,
  user_id uuid,
  couple_id uuid not null,
  title text,
  caption text,
  event_date date,
  is_pinned boolean default false not null,
  reactions jsonb default '{}'::jsonb not null);

create table public.memory_comments (id uuid default gen_random_uuid() not null,
  memory_id uuid not null,
  couple_id uuid not null,
  user_id uuid not null,
  text text not null,
  created_at timestamp with time zone default now() not null);

create table public.push_subscriptions (id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  disabled_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table public.question_answers (id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  question text not null,
  answer_one text,
  answer_two text,
  date text not null,
  couple_id uuid not null,
  answer_one_edited_at timestamp with time zone,
  answer_two_edited_at timestamp with time zone,
  answer_one_reactions jsonb default '{}'::jsonb not null,
  answer_two_reactions jsonb default '{}'::jsonb not null,
  answer_one_likes jsonb default '{}'::jsonb not null,
  answer_two_likes jsonb default '{}'::jsonb not null,
  favorite_answers jsonb default '{}'::jsonb not null,
  answer_one_voice_url text,
  answer_two_voice_url text,
  answer_one_photo_url text,
  answer_two_photo_url text);

create table public.question_comments (id uuid default gen_random_uuid() not null,
  question_answer_id uuid not null,
  couple_id uuid not null,
  user_id uuid not null,
  text text default ''::text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  attachment_mime_type text);

create table public.quiz_answers (id uuid default gen_random_uuid() not null,
  quiz_id text not null,
  couple_id uuid not null,
  user_id uuid not null,
  answers jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table public.quiz_comments (id uuid default gen_random_uuid() not null,
  quiz_id text not null,
  couple_id uuid not null,
  user_id uuid not null,
  text text not null,
  created_at timestamp with time zone default now() not null);

create table public.tracker_categories (id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  icon text default '♡'::text not null,
  color text default '#be123c'::text not null,
  sort_order integer default 0 not null,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null);

create table public.tracker_events (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  category_id uuid not null,
  date date not null,
  "time" time without time zone,
  count integer default 1 not null,
  duration_minutes integer default 0 not null,
  note text,
  mood text default 'good'::text not null,
  participants text default 'both'::text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table public.tracker_goals (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  title text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now() not null,
  period text default 'week'::text not null,
  target_count integer default 1 not null,
  category_id uuid);

create table public.user_notification_settings (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  user_id uuid not null,
  settings jsonb default '{"chat": true, "goals": true, "quizzes": true, "questions": true, "reactions": true}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table public.watch_items (id uuid default gen_random_uuid() not null,
  couple_id uuid not null,
  title text not null,
  content_type text not null,
  added_by uuid not null,
  is_watched boolean default false not null,
  watched_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  external_url text,
  poster_url text);

alter table public.couple_profiles add constraint couple_profiles_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.couple_profiles add constraint couple_profiles_couple_id_key UNIQUE (couple_id);
alter table public.couple_profiles add constraint couple_profiles_pkey PRIMARY KEY (id);
alter table public.couple_profiles add constraint couple_profiles_status_one_text_length CHECK (status_one_text IS NULL OR char_length(status_one_text) <= 20);
alter table public.couple_profiles add constraint couple_profiles_status_two_text_length CHECK (status_two_text IS NULL OR char_length(status_two_text) <= 20);
alter table public.couple_profiles add constraint couple_profiles_time_zone_moscow CHECK (time_zone = 'Europe/Moscow'::text);
alter table public.memories add constraint memories_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.memories add constraint memories_pkey PRIMARY KEY (id);
alter table public.memories add constraint memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.question_answers add constraint question_answers_couple_date_question_key UNIQUE (couple_id, date, question);
alter table public.question_answers add constraint question_answers_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.question_answers add constraint question_answers_pkey PRIMARY KEY (id);
alter table public.couples add constraint couples_invite_code_key UNIQUE (invite_code);
alter table public.couples add constraint couples_partner_one_id_fkey FOREIGN KEY (partner_one_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.couples add constraint couples_partner_two_id_fkey FOREIGN KEY (partner_two_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.couples add constraint couples_pkey PRIMARY KEY (id);
alter table public.quiz_answers add constraint quiz_answers_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.quiz_answers add constraint quiz_answers_pkey PRIMARY KEY (id);
alter table public.quiz_answers add constraint quiz_answers_quiz_id_couple_id_user_id_key UNIQUE (quiz_id, couple_id, user_id);
alter table public.quiz_answers add constraint quiz_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.quiz_comments add constraint quiz_comments_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.quiz_comments add constraint quiz_comments_pkey PRIMARY KEY (id);
alter table public.quiz_comments add constraint quiz_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.memory_comments add constraint memory_comments_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.memory_comments add constraint memory_comments_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE;
alter table public.memory_comments add constraint memory_comments_pkey PRIMARY KEY (id);
alter table public.memory_comments add constraint memory_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.couple_notifications add constraint couple_notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.couple_notifications add constraint couple_notifications_body_length_check CHECK (body IS NULL OR char_length(body) <= 500);
alter table public.couple_notifications add constraint couple_notifications_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.couple_notifications add constraint couple_notifications_href_format_check CHECK (href IS NULL OR char_length(href) <= 300 AND href ~ '^/[^/]'::text);
alter table public.couple_notifications add constraint couple_notifications_pkey PRIMARY KEY (id);
alter table public.couple_notifications add constraint couple_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.couple_notifications add constraint couple_notifications_title_length_check CHECK (char_length(title) >= 1 AND char_length(title) <= 120);
alter table public.couple_notifications add constraint couple_notifications_type_format_check CHECK (type ~ '^[a-z][a-z0-9_]{0,47}$'::text);
alter table public.couple_chat_messages add constraint couple_chat_messages_body_check CHECK (char_length(body) >= 1 AND char_length(body) <= 1000);
alter table public.couple_chat_messages add constraint couple_chat_messages_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.couple_chat_messages add constraint couple_chat_messages_pkey PRIMARY KEY (id);
alter table public.couple_chat_messages add constraint couple_chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES couple_chat_messages(id) ON DELETE SET NULL;
alter table public.couple_chat_messages add constraint couple_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tracker_categories add constraint tracker_categories_pkey PRIMARY KEY (id);
alter table public.tracker_categories add constraint tracker_categories_slug_key UNIQUE (slug);
alter table public.tracker_events add constraint tracker_events_category_id_fkey FOREIGN KEY (category_id) REFERENCES tracker_categories(id) ON DELETE CASCADE;
alter table public.tracker_events add constraint tracker_events_count_check CHECK (count >= 0);
alter table public.tracker_events add constraint tracker_events_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.tracker_events add constraint tracker_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tracker_events add constraint tracker_events_duration_minutes_check CHECK (duration_minutes >= 0);
alter table public.tracker_events add constraint tracker_events_mood_check CHECK (mood = ANY (ARRAY['great'::text, 'good'::text, 'normal'::text, 'tired'::text, 'bad'::text]));
alter table public.tracker_events add constraint tracker_events_participants_check CHECK (participants = ANY (ARRAY['both'::text, 'me'::text, 'partner'::text]));
alter table public.tracker_events add constraint tracker_events_pkey PRIMARY KEY (id);
alter table public.tracker_goals add constraint tracker_goals_category_id_fkey FOREIGN KEY (category_id) REFERENCES tracker_categories(id) ON DELETE SET NULL;
alter table public.tracker_goals add constraint tracker_goals_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.tracker_goals add constraint tracker_goals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tracker_goals add constraint tracker_goals_period_check CHECK (period = ANY (ARRAY['day'::text, 'week'::text, 'month'::text, 'year'::text]));
alter table public.tracker_goals add constraint tracker_goals_pkey PRIMARY KEY (id);
alter table public.tracker_goals add constraint tracker_goals_target_count_check CHECK (target_count >= 1 AND target_count <= 999);
alter table public.tracker_goals add constraint tracker_goals_title_check CHECK (char_length(TRIM(BOTH FROM title)) >= 1 AND char_length(TRIM(BOTH FROM title)) <= 80);
alter table public.question_comments add constraint question_comments_attachment_type_check CHECK (attachment_type IS NULL OR (attachment_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text])));
alter table public.question_comments add constraint question_comments_content_check CHECK (NULLIF(btrim(COALESCE(text, ''::text)), ''::text) IS NOT NULL OR attachment_url IS NOT NULL);
alter table public.question_comments add constraint question_comments_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.question_comments add constraint question_comments_pkey PRIMARY KEY (id);
alter table public.question_comments add constraint question_comments_question_answer_id_fkey FOREIGN KEY (question_answer_id) REFERENCES question_answers(id) ON DELETE CASCADE;
alter table public.question_comments add constraint question_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_notification_settings add constraint user_notification_settings_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.user_notification_settings add constraint user_notification_settings_couple_id_user_id_key UNIQUE (couple_id, user_id);
alter table public.user_notification_settings add constraint user_notification_settings_pkey PRIMARY KEY (id);
alter table public.user_notification_settings add constraint user_notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.watch_items add constraint watch_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.watch_items add constraint watch_items_content_type_check CHECK (content_type = ANY (ARRAY['movie'::text, 'series'::text, 'cartoon'::text, 'anime'::text]));
alter table public.watch_items add constraint watch_items_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.watch_items add constraint watch_items_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.api_rate_limit_events add constraint api_rate_limit_events_pkey PRIMARY KEY (id);
alter table public.countdowns add constraint countdowns_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE;
alter table public.countdowns add constraint countdowns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.countdowns add constraint countdowns_description_check CHECK (description IS NULL OR char_length(description) <= 500);
alter table public.countdowns add constraint countdowns_icon_check CHECK (char_length(icon) >= 1 AND char_length(icon) <= 16);
alter table public.countdowns add constraint countdowns_pkey PRIMARY KEY (id);
alter table public.countdowns add constraint countdowns_title_check CHECK (char_length(btrim(title)) >= 1 AND char_length(btrim(title)) <= 80);
alter table public.countdowns add constraint countdowns_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX memories_couple_created_idx ON public.memories USING btree (couple_id, created_at DESC);
CREATE INDEX memories_user_id_idx ON public.memories USING btree (user_id);
CREATE INDEX question_answers_couple_created_idx ON public.question_answers USING btree (couple_id, created_at DESC);
CREATE INDEX question_answers_couple_date_idx ON public.question_answers USING btree (couple_id, date);
CREATE INDEX couples_partner_one_id_idx ON public.couples USING btree (partner_one_id);
CREATE INDEX couples_partner_two_id_idx ON public.couples USING btree (partner_two_id);
CREATE INDEX quiz_answers_couple_id_idx ON public.quiz_answers USING btree (couple_id);
CREATE INDEX quiz_answers_quiz_id_idx ON public.quiz_answers USING btree (quiz_id);
CREATE INDEX quiz_answers_user_id_idx ON public.quiz_answers USING btree (user_id);
CREATE INDEX quiz_comments_couple_id_idx ON public.quiz_comments USING btree (couple_id);
CREATE INDEX quiz_comments_couple_id_quiz_id_idx ON public.quiz_comments USING btree (couple_id, quiz_id);
CREATE INDEX quiz_comments_user_id_idx ON public.quiz_comments USING btree (user_id);
CREATE INDEX memory_comments_couple_id_idx ON public.memory_comments USING btree (couple_id);
CREATE INDEX memory_comments_memory_id_idx ON public.memory_comments USING btree (memory_id, created_at);
CREATE INDEX memory_comments_user_id_idx ON public.memory_comments USING btree (user_id);
CREATE INDEX couple_notifications_actor_id_idx ON public.couple_notifications USING btree (actor_id);
CREATE INDEX couple_notifications_couple_id_idx ON public.couple_notifications USING btree (couple_id);
CREATE INDEX couple_notifications_recipient_created_idx ON public.couple_notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX couple_chat_messages_couple_created_idx ON public.couple_chat_messages USING btree (couple_id, created_at);
CREATE INDEX couple_chat_messages_pinned_idx ON public.couple_chat_messages USING btree (couple_id, pinned_at) WHERE (pinned_at IS NOT NULL);
CREATE INDEX couple_chat_messages_reply_to_id_idx ON public.couple_chat_messages USING btree (reply_to_id);
CREATE INDEX couple_chat_messages_sender_id_idx ON public.couple_chat_messages USING btree (sender_id);
CREATE INDEX tracker_events_category_id_idx ON public.tracker_events USING btree (category_id);
CREATE INDEX tracker_events_couple_category_date_idx ON public.tracker_events USING btree (couple_id, category_id, date);
CREATE INDEX tracker_events_couple_date_idx ON public.tracker_events USING btree (couple_id, date);
CREATE INDEX tracker_events_created_by_idx ON public.tracker_events USING btree (created_by);
CREATE INDEX tracker_goals_category_id_idx ON public.tracker_goals USING btree (category_id);
CREATE INDEX tracker_goals_couple_created_at_idx ON public.tracker_goals USING btree (couple_id, created_at DESC);
CREATE INDEX tracker_goals_created_by_idx ON public.tracker_goals USING btree (created_by);
CREATE INDEX question_comments_answer_id_idx ON public.question_comments USING btree (question_answer_id);
CREATE INDEX question_comments_couple_id_idx ON public.question_comments USING btree (couple_id);
CREATE INDEX question_comments_user_id_idx ON public.question_comments USING btree (user_id);
CREATE INDEX user_notification_settings_couple_id_idx ON public.user_notification_settings USING btree (couple_id);
CREATE INDEX user_notification_settings_user_id_idx ON public.user_notification_settings USING btree (user_id);
CREATE INDEX watch_items_added_by_idx ON public.watch_items USING btree (added_by);
CREATE INDEX watch_items_couple_id_idx ON public.watch_items USING btree (couple_id);
CREATE UNIQUE INDEX watch_items_couple_title_unique ON public.watch_items USING btree (couple_id, lower(btrim(title)));
CREATE INDEX push_subscriptions_user_active_idx ON public.push_subscriptions USING btree (user_id, disabled_at);
CREATE INDEX api_rate_limit_events_lookup_idx ON public.api_rate_limit_events USING btree (route, identity_hash, created_at DESC);
CREATE INDEX countdowns_couple_target_idx ON public.countdowns USING btree (couple_id, target_at);
CREATE INDEX countdowns_couple_updated_idx ON public.countdowns USING btree (couple_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.create_couple_notification(p_couple_id uuid, p_recipient_id uuid, p_type text, p_title text, p_body text DEFAULT NULL::text, p_href text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  notification_id uuid := gen_random_uuid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.couples couple
    where couple.id = p_couple_id
      and caller_id in (couple.partner_one_id, couple.partner_two_id)
      and p_recipient_id in (couple.partner_one_id, couple.partner_two_id)
  ) then
    raise exception 'Notification recipient is not in the caller''s couple'
      using errcode = '42501';
  end if;

  insert into public.couple_notifications (
    id,
    couple_id,
    recipient_id,
    actor_id,
    type,
    title,
    body,
    href
  )
  values (
    notification_id,
    p_couple_id,
    p_recipient_id,
    caller_id,
    p_type,
    p_title,
    nullif(btrim(p_body), ''),
    nullif(btrim(p_href), '')
  );

  return notification_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_route text, p_identity_hash text, p_window_seconds integer, p_limit integer)
 RETURNS TABLE(allowed boolean, request_count bigint, retry_after_seconds integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz;
  current_count bigint;
begin
  if p_route is null or btrim(p_route) = '' then
    raise exception 'p_route must not be empty' using errcode = '22023';
  end if;
  if p_identity_hash is null or p_identity_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'p_identity_hash must be a SHA-256 hex digest' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'p_window_seconds must be between 1 and 86400' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'p_limit must be between 1 and 10000' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_route || ':' || p_identity_hash, 0)
  );

  cutoff := pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => p_window_seconds);

  delete from public.api_rate_limit_events
  where route = p_route
    and identity_hash = p_identity_hash
    and created_at < cutoff;

  insert into public.api_rate_limit_events (route, identity_hash)
  values (p_route, p_identity_hash);

  select count(*)
  into current_count
  from public.api_rate_limit_events
  where route = p_route
    and identity_hash = p_identity_hash
    and created_at >= cutoff;

  return query
  select current_count <= p_limit, current_count, p_window_seconds;
end;
$function$
;

alter table public.couple_profiles enable row level security;
alter table public.memories enable row level security;
alter table public.question_answers enable row level security;
alter table public.couples enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.quiz_comments enable row level security;
alter table public.memory_comments enable row level security;
alter table public.couple_notifications enable row level security;
alter table public.couple_chat_messages enable row level security;
alter table public.tracker_categories enable row level security;
alter table public.tracker_events enable row level security;
alter table public.tracker_goals enable row level security;
alter table public.question_comments enable row level security;
alter table public.user_notification_settings enable row level security;
alter table public.watch_items enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.api_rate_limit_events enable row level security;
alter table public.countdowns enable row level security;

create policy "Couple members can insert couple profiles" on public.couple_profiles as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = couple_profiles.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can update couple profiles" on public.couple_profiles as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = couple_profiles.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))) with check ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = couple_profiles.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can view couple profiles" on public.couple_profiles as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = couple_profiles.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can delete memories" on public.memories as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = memories.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can insert memories" on public.memories as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = memories.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))));
create policy "Couple members can update memories" on public.memories as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = memories.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))) with check ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = memories.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can view memories" on public.memories as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = memories.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can delete question answers" on public.question_answers as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = question_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can insert question answers" on public.question_answers as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = question_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can update question answers" on public.question_answers as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = question_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))) with check ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = question_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can view question answers" on public.question_answers as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = question_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Users can view their couples" on public.couples as permissive for select to authenticated using (((( SELECT auth.uid() AS uid) = partner_one_id) OR (( SELECT auth.uid() AS uid) = partner_two_id)));
create policy quiz_answers_insert_own_pair on public.quiz_answers as permissive for insert to public with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy quiz_answers_select_pair on public.quiz_answers as permissive for select to public using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy quiz_answers_update_own_pair on public.quiz_answers as permissive for update to public using (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_answers.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy quiz_comments_delete_own_pair on public.quiz_comments as permissive for delete to public using (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_comments.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy quiz_comments_insert_own_pair on public.quiz_comments as permissive for insert to public with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_comments.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy quiz_comments_select_pair on public.quiz_comments as permissive for select to public using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = quiz_comments.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Comment authors can delete memory comments" on public.memory_comments as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Comment authors can update memory comments" on public.memory_comments as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Couple members can add memory comments" on public.memory_comments as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = memory_comments.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid))))))));
create policy "Couple members can read memory comments" on public.memory_comments as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = memory_comments.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid)))))));
create policy "Couple members can create partner notifications" on public.couple_notifications as permissive for insert to authenticated with check (((actor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = couple_notifications.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid))) AND ((couples.partner_one_id = couple_notifications.recipient_id) OR (couples.partner_two_id = couple_notifications.recipient_id)))))));
create policy "Users can delete own notifications" on public.couple_notifications as permissive for delete to authenticated using ((recipient_id = ( SELECT auth.uid() AS uid)));
create policy "Users can mark own notifications as read" on public.couple_notifications as permissive for update to authenticated using ((recipient_id = ( SELECT auth.uid() AS uid))) with check ((recipient_id = ( SELECT auth.uid() AS uid)));
create policy "Users can read own notifications" on public.couple_notifications as permissive for select to authenticated using ((recipient_id = ( SELECT auth.uid() AS uid)));
create policy "Couple members can delete chat messages" on public.couple_chat_messages as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = couple_chat_messages.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Couple members can read chat messages" on public.couple_chat_messages as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = couple_chat_messages.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Couple members can send chat messages" on public.couple_chat_messages as permissive for insert to authenticated with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = couple_chat_messages.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy "Couple members can update chat messages" on public.couple_chat_messages as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = couple_chat_messages.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))) with check ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = couple_chat_messages.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Authenticated users can read tracker categories" on public.tracker_categories as permissive for select to authenticated using (true);
create policy "Couple members can add tracker events" on public.tracker_events as permissive for insert to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = tracker_events.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid))))))));
create policy "Couple members can read tracker events" on public.tracker_events as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = tracker_events.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid)))))));
create policy "Event authors can delete tracker events" on public.tracker_events as permissive for delete to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = tracker_events.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid))))))));
create policy "Event authors can update tracker events" on public.tracker_events as permissive for update to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = tracker_events.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid)))))))) with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = tracker_events.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid))))))));
create policy tracker_goals_delete_own on public.tracker_goals as permissive for delete to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = tracker_goals.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy tracker_goals_insert_pair on public.tracker_goals as permissive for insert to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = tracker_goals.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy tracker_goals_select_pair on public.tracker_goals as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = tracker_goals.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Comment authors can delete question comments" on public.question_comments as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Comment authors can update question comments" on public.question_comments as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "Couple members can add question comments" on public.question_comments as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = question_comments.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid))))))));
create policy "Couple members can read question comments" on public.question_comments as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples
  WHERE ((couples.id = question_comments.couple_id) AND ((couples.partner_one_id = ( SELECT auth.uid() AS uid)) OR (couples.partner_two_id = ( SELECT auth.uid() AS uid)))))));
create policy "Couple members can add notification settings" on public.user_notification_settings as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = user_notification_settings.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy "Couple members can read notification settings" on public.user_notification_settings as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = user_notification_settings.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy "Couple members can update own notification settings" on public.user_notification_settings as permissive for update to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = user_notification_settings.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = user_notification_settings.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy "Couple members can add watch items" on public.watch_items as permissive for insert to authenticated with check (((added_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = watch_items.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))));
create policy "Couple members can delete watch items" on public.watch_items as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = watch_items.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Couple members can read watch items" on public.watch_items as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = watch_items.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Couple members can update watch items" on public.watch_items as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = watch_items.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id)))))) with check ((EXISTS ( SELECT 1
   FROM couples c
  WHERE ((c.id = watch_items.couple_id) AND ((( SELECT auth.uid() AS uid) = c.partner_one_id) OR (( SELECT auth.uid() AS uid) = c.partner_two_id))))));
create policy "Users can create own push subscriptions" on public.push_subscriptions as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Users can delete own push subscriptions" on public.push_subscriptions as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Users can read own push subscriptions" on public.push_subscriptions as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Users can update own push subscriptions" on public.push_subscriptions as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Couple members can create countdowns" on public.countdowns as permissive for insert to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = countdowns.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))));
create policy "Couple members can delete countdowns" on public.countdowns as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = countdowns.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));
create policy "Couple members can update countdowns" on public.countdowns as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = countdowns.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))) with check (((updated_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = countdowns.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id)))))));
create policy "Couple members can view countdowns" on public.countdowns as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM couples couple
  WHERE ((couple.id = countdowns.couple_id) AND ((( SELECT auth.uid() AS uid) = couple.partner_one_id) OR (( SELECT auth.uid() AS uid) = couple.partner_two_id))))));

grant delete, insert, references, select, trigger, truncate, update on table public.couple_profiles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_profiles to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.memories to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.memories to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.question_answers to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.question_answers to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.couples to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.couples to service_role;
grant references, select, trigger, truncate on table public.couples to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.quiz_answers to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.quiz_answers to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.quiz_answers to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.quiz_comments to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.quiz_comments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.quiz_comments to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.memory_comments to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.memory_comments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.memory_comments to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_notifications to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_notifications to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_notifications to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_chat_messages to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_chat_messages to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.couple_chat_messages to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_categories to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_categories to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_categories to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_events to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_events to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_events to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_goals to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_goals to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.tracker_goals to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.question_comments to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.question_comments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.question_comments to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.user_notification_settings to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.user_notification_settings to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.user_notification_settings to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.watch_items to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.watch_items to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.watch_items to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.push_subscriptions to anon;
grant delete, insert, references, select, trigger, truncate, update on table public.push_subscriptions to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.push_subscriptions to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.api_rate_limit_events to service_role;
grant delete, insert, references, select, trigger, truncate, update on table public.countdowns to authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.countdowns to service_role;

commit;
