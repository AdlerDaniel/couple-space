begin;

set local search_path = public, extensions;

select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.couples'::regclass),
  'RLS is enabled for couples'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.memories'::regclass),
  'RLS is enabled for memories'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.couple_chat_messages'::regclass),
  'RLS is enabled for chat messages'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.question_answers'::regclass),
  'RLS is enabled for question answers'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  $$select id from public.couples order by id$$,
  $$values ('a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a user sees only their own couple'
);
select results_eq(
  $$select count(*)::bigint from public.memories$$,
  $$values (1::bigint)$$,
  'a user sees only their own couple memories'
);
select results_eq(
  $$select count(*)::bigint from public.couple_chat_messages$$,
  $$values (1::bigint)$$,
  'a user sees only their own couple chat messages'
);
select results_eq(
  $$select count(*)::bigint from public.question_answers$$,
  $$values (1::bigint)$$,
  'a user sees only their own couple answers'
);
select results_eq(
  $$select count(*)::bigint from public.couple_profiles$$,
  $$values (1::bigint)$$,
  'a user sees only their own couple profile'
);
select results_eq(
  $$
    with changed as (
      update public.couple_profiles
      set partner_one = 'Cross-couple write must fail'
      where couple_id = 'b0000000-0000-4000-8000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  'a user cannot update another couple profile'
);
select results_eq(
  $$
    with removed as (
      delete from public.tracker_events
      where couple_id = 'b0000000-0000-4000-8000-000000000002'
      returning 1
    )
    select count(*)::bigint from removed
  $$,
  $$values (0::bigint)$$,
  'a user cannot delete another couple tracker events'
);
select results_eq(
  $$select count(*)::bigint from public.push_subscriptions$$,
  $$values (1::bigint)$$,
  'a user cannot read another user push subscription'
);

select * from finish();
rollback;
