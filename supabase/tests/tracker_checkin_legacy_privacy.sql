-- Run only against an isolated/local Supabase test database after all migrations.
-- Synthetic fixtures are enclosed in a transaction and always rolled back.
begin;

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000a101';
  b constant uuid := '00000000-0000-4000-8000-00000000b102';
  pair_id constant uuid := '00000000-0000-4000-8000-00000000c103';
  fixture_category_id constant uuid := '00000000-0000-4000-8000-00000000d104';
  mixed_id constant uuid := '00000000-0000-4000-8000-00000000e105';
  mutual_id constant uuid := '00000000-0000-4000-8000-00000000e106';
  row_event public.tracker_events;
  row_checkin record;
  n integer;
begin
  insert into auth.users(id) values (a), (b);
  insert into public.couples(id, partner_one_id, partner_two_id) values (pair_id, a, b);
  insert into public.tracker_categories(id, name, slug, sort_order)
  values (fixture_category_id, 'Synthetic tracker privacy fixture', 'test-tracker-privacy-fixture', 999);
  insert into public.tracker_events(
    id, couple_id, category_id, date, count, duration_minutes, note, mood, participants, created_by
  ) values
    (mixed_id, pair_id, fixture_category_id, '2040-01-01', 3, 45,
      E'[[day-mood]]\nOriginal note  ', 'tired', 'me', a),
    (mutual_id, pair_id, fixture_category_id, '2040-01-02', 2, 20,
      E'[[day-mood]]\nMutual original', 'bad', 'me', a);

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.save_tracker_checkin(pair_id, '2040-01-01', 'bad', 2, 3, 'private', 'Private text', false);
  select * into row_event from public.tracker_events where id = mixed_id;
  if row_event.id is null or row_event.count <> 3 or row_event.duration_minutes <> 45
     or row_event.note is distinct from 'Original note  ' or row_event.mood <> 'good' then
    raise exception 'Private check-in must preserve mixed legacy count/duration/note and remove shared mood';
  end if;

  perform public.save_tracker_checkin(pair_id, '2040-01-01', 'great', 4, 5, 'full', 'Full text', false);
  select * into row_event from public.tracker_events where id = mixed_id;
  if row_event.count <> 3 or row_event.note is distinct from E'[[day-mood]]\nOriginal note  '
     or row_event.mood <> 'great' then
    raise exception 'Public check-in must restore marker without overwriting the original note';
  end if;
  perform set_config('request.jwt.claim.sub', b::text, true);
  select * into row_checkin from public.get_tracker_checkins(pair_id, '2040-01-01', '2040-01-01') where user_id = a;
  if row_checkin.mood is distinct from 'great' or row_checkin.note is distinct from 'Full text' then
    raise exception 'Full check-in should be revealed';
  end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.save_tracker_checkin(pair_id, '2040-01-01', 'normal', 3, 4, 'summary', 'Summary private note', false);
  perform set_config('request.jwt.claim.sub', b::text, true);
  select * into row_checkin from public.get_tracker_checkins(pair_id, '2040-01-01', '2040-01-01') where user_id = a;
  if row_checkin.mood is distinct from 'normal' or row_checkin.note is not null then
    raise exception 'Summary must reveal status but redact note';
  end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.save_tracker_checkin(pair_id, '2040-01-02', 'bad', 1, 2, 'full', 'Mutual secret', true);
  select * into row_event from public.tracker_events where id = mutual_id;
  if row_event.count <> 2 or row_event.note is distinct from 'Mutual original' or row_event.mood <> 'good' then
    raise exception 'Unanswered mutual check-in must not leak through legacy events';
  end if;
  perform set_config('request.jwt.claim.sub', b::text, true);
  select * into row_checkin from public.get_tracker_checkins(pair_id, '2040-01-02', '2040-01-02') where user_id = a;
  if row_checkin.mood is not null or row_checkin.note is not null then
    raise exception 'Unanswered mutual check-in must remain redacted';
  end if;

  -- A private partner response satisfies presence without revealing its content.
  perform public.save_tracker_checkin(pair_id, '2040-01-02', 'tired', 2, 1, 'private', 'Partner private secret', false);
  select * into row_event from public.tracker_events where id = mutual_id;
  if row_event.mood <> 'bad' or row_event.note is distinct from E'[[day-mood]]\nMutual original' then
    raise exception 'Second response must synchronize the first partner legacy mood';
  end if;
  if exists (
    select 1 from public.tracker_events
    where couple_id = pair_id and created_by = b and date = '2040-01-02'
      and coalesce(note, '') like '[[day-mood]]%'
  ) then
    raise exception 'Private second response must never publish its own legacy mood';
  end if;
  select * into row_checkin from public.get_tracker_checkins(pair_id, '2040-01-02', '2040-01-02') where user_id = a;
  if row_checkin.note is distinct from 'Mutual secret' then
    raise exception 'Mutual full content should reveal after both responses';
  end if;

  -- Changing visibility and mutuality must resynchronize both existing rows.
  perform public.save_tracker_checkin(pair_id, '2040-01-02', 'tired', 2, 1, 'summary', 'Still not public text', true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.save_tracker_checkin(pair_id, '2040-01-02', 'great', 5, 5, 'private', 'Hidden again', true);
  select * into row_event from public.tracker_events where id = mutual_id;
  if row_event.note is distinct from 'Mutual original' or row_event.count <> 2 or row_event.mood <> 'good' then
    raise exception 'Visibility downgrade must preserve legacy data and revoke legacy disclosure';
  end if;
  if not exists (
    select 1 from public.tracker_events
    where couple_id = pair_id and created_by = b and date = '2040-01-02'
      and coalesce(note, '') like '[[day-mood]]%' and mood = 'tired'
  ) then
    raise exception 'Private presence must still satisfy the other partner mutual setting';
  end if;
  delete from public.tracker_checkins where couple_id = pair_id and user_id = a and date = '2040-01-02';
  if exists (
    select 1 from public.tracker_events
    where couple_id = pair_id and date = '2040-01-02'
      and coalesce(note, '') like '[[day-mood]]%'
  ) then
    raise exception 'Deleting one response must revoke mutual legacy reveal for both sides';
  end if;

  -- Counter operations include a mixed marker row and preserve it at zero.
  perform public.adjust_tracker_event_count(pair_id, fixture_category_id, '2040-01-01', 1);
  select * into row_event from public.tracker_events where id = mixed_id;
  if row_event.count <> 4 then raise exception 'Mixed marker row was ignored by counter'; end if;
  for n in 1..4 loop
    perform public.adjust_tracker_event_count(pair_id, fixture_category_id, '2040-01-01', -1);
  end loop;
  select * into row_event from public.tracker_events where id = mixed_id;
  if row_event.id is null or row_event.count <> 0 or row_event.duration_minutes <> 45
     or row_event.note is distinct from E'[[day-mood]]\nOriginal note  ' then
    raise exception 'Counter at zero must preserve marker, original note and duration';
  end if;
  perform public.adjust_tracker_event_count(pair_id, fixture_category_id, '2040-01-01', 1);
  select count(*) into n from public.tracker_events
  where couple_id = pair_id and created_by = a and category_id = fixture_category_id and date = '2040-01-01';
  if n <> 1 then raise exception 'Counter created duplicate instead of reusing zero row'; end if;

  if has_function_privilege('authenticated', 'public.sync_tracker_checkin_legacy_day(uuid,date,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_tracker_checkin(uuid,date,text,integer,integer,text,text,boolean)', 'EXECUTE') then
    raise exception 'Internal sync or authenticated RPC has overly broad EXECUTE grants';
  end if;
end;
$$;

rollback;
