begin;
set local search_path = public, extensions, pg_catalog;
select plan(11);

select is(
  (select public from storage.buckets where id = 'memory-images'),
  false,
  'memory media bucket is private'
);
select ok(
  has_table_privilege('service_role', 'public.tracker_plan_memory_links', 'DELETE'),
  'service role can clean up tracker fixtures and server jobs'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tracker_plans_duration_limit'
      and conrelid = 'public.tracker_plans'::regclass
  ),
  'timed plans have a bounded duration'
);
select throws_ok(
  $$insert into public.tracker_plans
    (id,couple_id,title,created_by,all_day,starts_at,ends_at)
    values (
      'fc000000-0000-4000-8000-000000000099',
      'a0000000-0000-4000-8000-000000000001',
      'Too long',
      '10000000-0000-4000-8000-000000000001',
      false,
      '2026-09-01 12:00+00',
      '2026-11-01 12:00+00'
    )$$,
  '23514',
  null,
  'unbounded timed plans are rejected'
);

insert into public.tracker_plans
  (id,couple_id,title,created_by,start_date)
values (
  'fc000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Broadcast fixture',
  '10000000-0000-4000-8000-000000000001',
  '2026-09-03'
);
select realtime.send(
  '{"table":"other_pair_fixture","operation":"UPDATE"}'::jsonb,
  'changed',
  'tracker:b0000000-0000-4000-8000-000000000002',
  true
);

select results_eq(
  $$select event, private, payload ->> 'table', payload ->> 'operation'
    from realtime.messages
    where topic = 'tracker:a0000000-0000-4000-8000-000000000001'
      and event = 'changed'
    order by inserted_at desc
    limit 1$$,
  $$values ('changed'::text, true, 'tracker_plans'::text, 'INSERT'::text)$$,
  'database trigger emits a private pair-scoped invalidation'
);
select is(
  (
    select payload - 'id'
    from realtime.messages
    where topic = 'tracker:a0000000-0000-4000-8000-000000000001'
      and event = 'changed'
    order by inserted_at desc
    limit 1
  ),
  '{"table":"tracker_plans","operation":"INSERT"}'::jsonb,
  'invalidation payload contains no private row data or identifier'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('realtime.topic','tracker:a0000000-0000-4000-8000-000000000001',true);
select is(
  (select count(*) from realtime.messages where event = 'changed' and payload ->> 'table' = 'tracker_plans'),
  1::bigint,
  'pair member can receive its private tracker topic'
);

select set_config('realtime.topic','tracker:b0000000-0000-4000-8000-000000000002',true);
select is(
  (select count(*) from realtime.messages where event = 'changed' and payload ->> 'table' = 'other_pair_fixture'),
  0::bigint,
  'member cannot receive another pair tracker topic'
);

select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(
  (select count(*) from realtime.messages where event = 'changed' and payload ->> 'table' = 'other_pair_fixture'),
  1::bigint,
  'second pair member can receive its own topic'
);

select set_config('realtime.topic','tracker:not-a-uuid',true);
select is(
  (select count(*) from realtime.messages where event = 'changed'),
  0::bigint,
  'malformed tracker topics are denied'
);

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
select set_config('realtime.topic','',true);

select ok(
  not has_function_privilege('authenticated','public.broadcast_tracker_couple_change()','EXECUTE'),
  'broadcast trigger cannot be invoked from the client'
);

select * from finish();
rollback;
