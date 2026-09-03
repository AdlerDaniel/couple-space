begin;
set local search_path = public, extensions, pg_catalog;
select plan(14);

insert into public.tracker_plans
(id,couple_id,title,kind,created_by,start_date,participant_scope,assignee_id,edit_scope,repeat_mode,repeat_interval,repeat_weekdays,repeat_until)
values
('fd000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Assigned once','task','10000000-0000-4000-8000-000000000001','2026-09-07','both','20000000-0000-4000-8000-000000000002','creator','none',1,'{}',null),
('fd000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Assigned repeat','task','10000000-0000-4000-8000-000000000001','2026-09-07','both','20000000-0000-4000-8000-000000000002','creator','weekly',1,array[1]::smallint[],'2026-10-31'),
('fd000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','Pending task','task','10000000-0000-4000-8000-000000000001','2026-09-07','both','20000000-0000-4000-8000-000000000002','creator','none',1,'{}',null);

insert into public.tracker_plan_participants(plan_id,couple_id,user_id,role,response)
values
('fd000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','responsible','accepted'),
('fd000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','responsible','accepted'),
('fd000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','responsible','pending');

insert into public.tracker_plan_occurrence_overrides
(plan_id,couple_id,occurrence_date,override_start_date,status,updated_by)
values
('fd000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','2026-09-14','2026-09-16','planned','10000000-0000-4000-8000-000000000001');

select ok(not has_function_privilege('anon','public.complete_tracker_assigned_task(uuid,date)','EXECUTE'),'anonymous task completion is revoked');
select ok(has_function_privilege('authenticated','public.complete_tracker_assigned_task(uuid,date)','EXECUTE'),'authenticated assignees may call completion RPC');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000001',null)$$,'42501',null,'author cannot complete a task assigned to the partner');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000001',null)$$,'accepted assignee completes a creator-only task');
select is((select status from public.tracker_plans where id='fd000000-0000-4000-8000-000000000001'),'done','non-repeating assigned task is done');
select throws_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000002',null)$$,'22023',null,'repeating task requires the original occurrence date');
select throws_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000002','2026-09-15')$$,'22023',null,'date outside recurrence cannot be completed');
select lives_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000002','2026-09-14')$$,'assignee completes one moved occurrence by its original date');
select results_eq($$select status,override_start_date from public.tracker_plan_occurrence_overrides where plan_id='fd000000-0000-4000-8000-000000000002' and occurrence_date='2026-09-14'$$,$$values ('done'::text,date '2026-09-16')$$,'completion preserves moved date and changes only status');
select lives_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000002','2026-09-14')$$,'completion is idempotent');
select results_eq($$select count(*) from public.tracker_plan_activity where plan_id='fd000000-0000-4000-8000-000000000002' and activity_type='completed'$$,$$values (1::bigint)$$,'repeated call does not duplicate activity');
select throws_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000003',null)$$,'42501',null,'pending invite cannot complete assigned task');

select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000001',null)$$,'42501',null,'another pair cannot complete the task');

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update public.tracker_plan_occurrence_overrides set status='cancelled' where plan_id='fd000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.complete_tracker_assigned_task('fd000000-0000-4000-8000-000000000002','2026-09-14')$$,'22023',null,'cancelled occurrence cannot be completed');

select * from finish();
rollback;
