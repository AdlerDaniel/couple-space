begin;

set local search_path = public, extensions;

select plan(28);

insert into public.tracker_plans (
  id, couple_id, title, start_date, visibility, edit_scope, created_by
)
values
  ('ea100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Shared plan A', '2026-09-07', 'couple', 'participants', '10000000-0000-4000-8000-000000000001'),
  ('ea200000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Private plan A', '2026-09-07', 'private', 'creator', '10000000-0000-4000-8000-000000000001'),
  ('eb100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Shared plan B', '2026-09-07', 'couple', 'participants', '30000000-0000-4000-8000-000000000003');

insert into public.tracker_plan_participants (
  id, plan_id, couple_id, user_id, role, response
)
values
  ('fa100000-0000-4000-8000-000000000001', 'ea100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'participant', 'accepted'),
  ('fa200000-0000-4000-8000-000000000002', 'ea100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'participant', 'pending'),
  ('fb100000-0000-4000-8000-000000000001', 'eb100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'participant', 'accepted');

insert into public.tracker_plan_comments (id, plan_id, couple_id, user_id, text)
values
  ('ca100000-0000-4000-8000-000000000001', 'ea100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Shared comment'),
  ('ca200000-0000-4000-8000-000000000002', 'ea200000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Private comment'),
  ('cb100000-0000-4000-8000-000000000001', 'eb100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Other pair comment');

insert into public.tracker_plan_attachments (
  id, plan_id, comment_id, couple_id, owner_id, storage_path, url, name, media_type
)
values
  ('da100000-0000-4000-8000-000000000001', 'ea100000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pair-a/shared.jpg', 'pair-a/shared.jpg', 'shared.jpg', 'image'),
  ('da200000-0000-4000-8000-000000000002', 'ea200000-0000-4000-8000-000000000002', 'ca200000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pair-a/private.jpg', 'pair-a/private.jpg', 'private.jpg', 'image'),
  ('db100000-0000-4000-8000-000000000001', 'eb100000-0000-4000-8000-000000000001', 'cb100000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'pair-b/other.jpg', 'pair-b/other.jpg', 'other.jpg', 'image');

insert into public.tracker_checkins (
  id, couple_id, user_id, date, mood, energy, relationship, visibility, note
)
values
  ('aa100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-07', 'good', 4, 5, 'private', 'Private note'),
  ('aa200000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '2026-09-07', 'normal', 3, 4, 'summary', 'Summary hides note'),
  ('ab100000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', '2026-09-07', 'great', 5, 5, 'full', 'Other pair');

insert into public.tracker_category_preferences (
  id, couple_id, category_id, label, updated_by
)
values
  ('ac100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Dinner A', '10000000-0000-4000-8000-000000000001'),
  ('ac200000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Dinner B', '30000000-0000-4000-8000-000000000003');

insert into public.tracker_plan_reminders (
  id, plan_id, couple_id, user_id, offset_minutes, delivery
)
values
  ('ad100000-0000-4000-8000-000000000001', 'ea100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 60, 'push'),
  ('ad200000-0000-4000-8000-000000000002', 'ea100000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 30, 'push');

select ok((select relrowsecurity from pg_class where oid = 'public.tracker_plans'::regclass), 'RLS is enabled for plans');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_plan_participants'::regclass), 'RLS is enabled for participants');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_plan_occurrence_overrides'::regclass), 'RLS is enabled for occurrence overrides');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_plan_comments'::regclass), 'RLS is enabled for plan comments');
select ok((select relrowsecurity from pg_class where oid = 'public.tracker_checkins'::regclass), 'RLS is enabled for check-ins');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select results_eq($$select count(*)::bigint from public.tracker_plans$$, $$values (2::bigint)$$, 'author sees shared and own private plans');
select results_eq($$select count(*)::bigint from public.tracker_plan_comments$$, $$values (2::bigint)$$, 'author sees shared and private comments');
select results_eq($$select count(*)::bigint from public.tracker_plan_attachments$$, $$values (2::bigint)$$, 'author sees shared and private attachments');
select results_eq($$select count(*)::bigint from public.tracker_checkins$$, $$values (1::bigint)$$, 'direct check-in access is own-only');
select results_eq($$select count(*)::bigint from public.get_tracker_checkins('a0000000-0000-4000-8000-000000000001', '2026-09-07', '2026-09-07')$$, $$values (2::bigint)$$, 'privacy RPC reveals own and partner summary check-ins');
select results_eq($$select count(*)::bigint from public.tracker_category_preferences$$, $$values (1::bigint)$$, 'category preferences are pair-scoped');
select results_eq($$select count(*)::bigint from public.tracker_plan_reminders$$, $$values (1::bigint)$$, 'reminders are user-scoped');
select is(public.can_view_tracker_plan('eb100000-0000-4000-8000-000000000001', auth.uid()), false, 'member cannot view another pair plan');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select results_eq($$select count(*)::bigint from public.tracker_plans$$, $$values (1::bigint)$$, 'partner sees shared but not private plan');
select results_eq($$select count(*)::bigint from public.tracker_plan_comments$$, $$values (1::bigint)$$, 'partner sees only shared comments');
select results_eq($$select count(*)::bigint from public.tracker_plan_attachments$$, $$values (1::bigint)$$, 'partner sees only shared attachments');
select results_eq($$select count(*)::bigint from public.tracker_checkins$$, $$values (1::bigint)$$, 'partner direct check-in access remains own-only');
select results_eq($$select count(*)::bigint from public.get_tracker_checkins('a0000000-0000-4000-8000-000000000001', '2026-09-07', '2026-09-07')$$, $$values (1::bigint)$$, 'private partner check-in stays hidden through RPC');
select is(public.can_edit_tracker_plan('ea100000-0000-4000-8000-000000000001', auth.uid()), false, 'pending invite cannot edit plan');
select results_eq(
  $$with changed as (
      update public.tracker_plan_participants set response = 'accepted'
      where id = 'fa200000-0000-4000-8000-000000000002'
      returning 1
    ) select count(*)::bigint from changed$$,
  $$values (1::bigint)$$,
  'participant can accept own invitation'
);
select is(public.can_edit_tracker_plan('ea100000-0000-4000-8000-000000000001', auth.uid()), true, 'accepted participant can edit shared plan');
select results_eq(
  $$with changed as (
      update public.tracker_plans set title = 'Updated together'
      where id = 'ea100000-0000-4000-8000-000000000001'
      returning 1
    ) select count(*)::bigint from changed$$,
  $$values (1::bigint)$$,
  'accepted participant can update shared plan'
);
select results_eq($$select count(*)::bigint from public.tracker_plan_reminders$$, $$values (1::bigint)$$, 'partner sees only own reminders');

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(public.can_view_tracker_plan('ea100000-0000-4000-8000-000000000001', auth.uid()), false, 'other pair cannot view shared plan');
select results_eq(
  $$with changed as (
      update public.tracker_plans set title = 'Cross pair write'
      where id = 'ea100000-0000-4000-8000-000000000001'
      returning 1
    ) select count(*)::bigint from changed$$,
  $$values (0::bigint)$$,
  'other pair cannot update plan'
);
select results_eq($$select count(*)::bigint from public.tracker_plan_comments$$, $$values (1::bigint)$$, 'other pair sees only own comments');
select results_eq($$select count(*)::bigint from public.tracker_category_preferences$$, $$values (1::bigint)$$, 'other pair sees only own preferences');
select results_eq($$select count(*)::bigint from public.tracker_plan_attachments$$, $$values (1::bigint)$$, 'other pair sees only own attachments');

select * from finish();
rollback;
