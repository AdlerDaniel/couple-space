-- Synthetic fixtures only; all writes roll back. Run after the full migration chain.
begin;
set local search_path = public, extensions, pg_catalog;
select plan(37);

insert into public.tracker_plans
(id, couple_id, title, created_by, start_date, repeat_mode, repeat_interval, repeat_weekdays, repeat_until)
values
('fe000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Weekly fixture', '10000000-0000-4000-8000-000000000001', '2026-09-04', 'weekly', 2, array[1,5]::smallint[], '2026-09-30'),
('fe000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Monthly fixture', '10000000-0000-4000-8000-000000000001', '2026-01-31', 'monthly', 1, '{}', '2026-05-31'),
('fe000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Leap fixture', '10000000-0000-4000-8000-000000000001', '2024-02-29', 'yearly', 1, '{}', '2028-12-31'),
('fe000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Permissions fixture', '10000000-0000-4000-8000-000000000001', '2040-01-01', 'none', 1, '{}', null);

insert into public.tracker_plans
(id, couple_id, title, created_by, all_day, starts_at, ends_at, visibility, repeat_mode, repeat_until)
values
('fe000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Private fixture', '10000000-0000-4000-8000-000000000001', false, '2026-09-01 09:00+03', '2026-09-01 10:00+03', 'private', 'daily', '2026-09-30'),
('fe000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Overnight fixture', '10000000-0000-4000-8000-000000000001', false, '2026-10-01 23:00+03', '2026-10-02 10:00+03', 'couple', 'none', null);

insert into public.tracker_plan_occurrence_overrides
(plan_id, couple_id, occurrence_date, status, override_starts_at, override_ends_at, updated_by)
values
('fe000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '2026-09-07', 'cancelled', null, null, '10000000-0000-4000-8000-000000000001'),
('fe000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '2026-09-08', 'done', null, null, '10000000-0000-4000-8000-000000000001'),
('fe000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '2026-09-09', 'planned', '2026-09-10 12:00+03', '2026-09-10 13:00+03', '10000000-0000-4000-8000-000000000001');

insert into public.tracker_plan_participants(plan_id, couple_id, user_id, response)
values ('fe000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'accepted');

insert into public.tracker_plan_comments(plan_id, couple_id, user_id, text)
values ('fe000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Private fixture text');

select is(public.tracker_local_instant('2026-03-29 02:30', 'Europe/Berlin'), null::timestamptz, 'nonexistent DST time is skipped');
select is(public.tracker_local_instant('2026-10-25 02:30', 'Europe/Berlin'), '2026-10-25 00:30Z'::timestamptz, 'ambiguous DST time uses the earlier instant like the client');
select is(public.tracker_local_instant('2026-09-07 09:00', 'Europe/Moscow'), '2026-09-07 06:00Z'::timestamptz, 'pair wall clock converts independently of DB timezone');
select ok(not has_function_privilege('authenticated', 'public.tracker_expand_occurrences_internal(uuid,date,date,boolean)', 'EXECUTE'), 'private occurrence expansion cannot be called directly');
select ok(not has_function_privilege('anon', 'public.find_tracker_common_free_slots(uuid,date,integer,time,time)', 'EXECUTE'), 'anonymous free-time access is revoked');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select results_eq($$select occurrence_date from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-01', '2026-09-30') where plan_id = 'fe000000-0000-4000-8000-000000000001'$$, $$values (date '2026-09-04'), (date '2026-09-14'), (date '2026-09-18'), (date '2026-09-28')$$, 'biweekly days are anchored to Monday, not the base weekday');
select results_eq($$select occurrence_date from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-01-01', '2026-05-31') where plan_id = 'fe000000-0000-4000-8000-000000000002'$$, $$values (date '2026-01-31'), (date '2026-03-31'), (date '2026-05-31')$$, 'monthly recurrence skips months without the original day');
select results_eq($$select occurrence_date from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2024-01-01', '2028-12-31') where plan_id = 'fe000000-0000-4000-8000-000000000003'$$, $$values (date '2024-02-29'), (date '2028-02-29')$$, 'yearly leap recurrence keeps its real date');
select results_eq($$select count(*) from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-10', '2026-09-10') where plan_id = 'fe000000-0000-4000-8000-000000000004'$$, $$values (2::bigint)$$, 'moved-in repetition is included even when the original day is outside the window');
select results_eq($$select starts_at from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-10', '2026-09-10') where plan_id = 'fe000000-0000-4000-8000-000000000004' order by starts_at$$, $$values (timestamptz '2026-09-10 09:00+03'), (timestamptz '2026-09-10 12:00+03')$$, 'moved repetition uses its new start time');
select results_eq($$select count(*) from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-09', '2026-09-09') where plan_id = 'fe000000-0000-4000-8000-000000000004'$$, $$values (0::bigint)$$, 'moved-out repetition leaves its original day');
select results_eq($$select count(*) from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-07', '2026-09-07') where plan_id = 'fe000000-0000-4000-8000-000000000004'$$, $$values (0::bigint)$$, 'cancelled repetition is not listed');
select results_eq($$select status from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-08', '2026-09-08') where plan_id = 'fe000000-0000-4000-8000-000000000004'$$, $$values ('done'::text)$$, 'completed repetition remains visible as done');
select throws_ok($$insert into public.tracker_plan_participants(plan_id,couple_id,user_id,response) values ('fe000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','accepted')$$, '42501', null, 'author cannot fabricate partner acceptance at insertion');
select lives_ok($$insert into public.tracker_plan_participants(plan_id,couple_id,user_id,response) values ('fe000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','pending')$$, 'author may invite partner with a pending response');
select throws_ok($$update public.tracker_plan_participants set response='accepted' where plan_id='fe000000-0000-4000-8000-000000000006' and user_id='20000000-0000-4000-8000-000000000002'$$, '42501', null, 'author cannot answer an existing invitation for the partner');
select lives_ok($$update public.tracker_plan_participants set role='responsible' where plan_id='fe000000-0000-4000-8000-000000000006' and user_id='20000000-0000-4000-8000-000000000002'$$, 'author may assign participant responsibility');
select throws_ok($$update public.tracker_plans set assignee_id='30000000-0000-4000-8000-000000000003' where id='fe000000-0000-4000-8000-000000000006'$$, '42501', null, 'assignee must remain in the actual couple');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select results_eq($$select count(*) from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001', '2026-09-10', '2026-09-10') where plan_id='fe000000-0000-4000-8000-000000000004'$$, $$values (0::bigint)$$, 'private occurrence content is never returned to partner');
select results_eq($$select count(*) from public.tracker_plan_comments where plan_id='fe000000-0000-4000-8000-000000000004'$$, $$values (0::bigint)$$, 'private comments inherit plan visibility');
select results_eq($$select starts_at from public.find_tracker_common_free_slots('a0000000-0000-4000-8000-000000000001','2026-09-10',60,'09:00','14:00')$$, $$values (timestamptz '2026-09-10 10:00+03'), (timestamptz '2026-09-10 10:30+03'), (timestamptz '2026-09-10 11:00+03'), (timestamptz '2026-09-10 13:00+03')$$, 'private standard and moved occurrences block only their busy intervals');
select results_eq($$select count(*) from public.find_tracker_common_free_slots('a0000000-0000-4000-8000-000000000001','2026-09-07',60,'09:00','14:00')$$, $$values (9::bigint)$$, 'cancelled private repetition no longer blocks free time');
select results_eq($$select count(*) from public.find_tracker_common_free_slots('a0000000-0000-4000-8000-000000000001','2026-09-08',60,'09:00','14:00')$$, $$values (9::bigint)$$, 'completed private repetition no longer blocks free time');
select results_eq($$select count(*) from public.find_tracker_common_free_slots('a0000000-0000-4000-8000-000000000001','2026-09-09',60,'09:00','14:00')$$, $$values (9::bigint)$$, 'moved-out private repetition no longer blocks its old day');
select results_eq($$select starts_at from public.find_tracker_common_free_slots('a0000000-0000-4000-8000-000000000001','2026-10-02',60,'09:00','11:00')$$, $$values (timestamptz '2026-10-02 10:00+03')$$, 'overnight events block the following morning');
select is(public.can_edit_tracker_plan('fe000000-0000-4000-8000-000000000006',auth.uid()), false, 'pending participant cannot edit');
select lives_ok($$update public.tracker_plan_participants set response='accepted' where plan_id='fe000000-0000-4000-8000-000000000006' and user_id='20000000-0000-4000-8000-000000000002'$$, 'invitee can accept own invitation');
select is(public.can_edit_tracker_plan('fe000000-0000-4000-8000-000000000006',auth.uid()), true, 'accepted participant can edit');
select throws_ok($$update public.tracker_plan_participants set role='participant' where plan_id='fe000000-0000-4000-8000-000000000006' and user_id='20000000-0000-4000-8000-000000000002'$$, '42501', null, 'invitee cannot self-change assigned responsibility');
select throws_ok($$update public.tracker_plans set visibility='private' where id='fe000000-0000-4000-8000-000000000006'$$, '42501', null, 'participant cannot privatize a shared plan');
select lives_ok($$update public.tracker_plans set title='Edited together' where id='fe000000-0000-4000-8000-000000000006'$$, 'accepted participant can edit agreed fields');
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select results_eq($$select count(*) from public.find_tracker_common_free_slots('a0000000-0000-4000-8000-000000000001','2026-09-10',60,'09:00','14:00')$$, $$values (0::bigint)$$, 'another pair cannot probe availability');
select results_eq($$select count(*) from public.list_tracker_plan_occurrences('a0000000-0000-4000-8000-000000000001','2026-09-01','2026-09-30')$$, $$values (0::bigint)$$, 'another pair cannot expand shared or private content');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update public.couples set partner_one_id=null where id='a0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.can_view_tracker_plan('fe000000-0000-4000-8000-000000000004',auth.uid()), false, 'former author loses private plan access after leaving the couple');
select is(public.can_edit_tracker_plan('fe000000-0000-4000-8000-000000000006',auth.uid()), false, 'former author loses edit permission after leaving');
select results_eq($$select count(*) from public.tracker_plan_comments where plan_id='fe000000-0000-4000-8000-000000000004'$$, $$values (0::bigint)$$, 'former author loses private comment access');
select results_eq($$with removed as (delete from public.tracker_plans where id='fe000000-0000-4000-8000-000000000004' returning id) select count(*) from removed$$, $$values (0::bigint)$$, 'former author cannot delete a retained private plan');
select * from finish();
rollback;
