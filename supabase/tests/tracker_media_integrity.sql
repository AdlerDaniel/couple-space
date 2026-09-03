begin;
set local search_path = public, extensions, pg_catalog;
select plan(8);

insert into public.tracker_plans(id,couple_id,title,start_date,created_by)
values
('ff000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','First fixture','2041-01-01','10000000-0000-4000-8000-000000000001'),
('ff000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Second fixture','2041-01-01','10000000-0000-4000-8000-000000000001'),
('ff000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','Other pair fixture','2041-01-01','30000000-0000-4000-8000-000000000003');
insert into public.tracker_plan_comments(id,plan_id,couple_id,user_id,text)
values
('ff100000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','First comment fixture'),
('ff100000-0000-4000-8000-000000000002','ff000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Second comment fixture'),
('ff100000-0000-4000-8000-000000000003','ff000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','Other pair comment fixture');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select lives_ok($$
  insert into public.tracker_plan_attachments(plan_id,comment_id,couple_id,owner_id,storage_path,url,name,media_type)
  values ('ff000000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fixture/same-plan.txt','fixture/same-plan.txt','fixture.txt','file')
$$, 'file may reference a comment on its own plan');

select throws_ok($$
  insert into public.tracker_plan_attachments(plan_id,comment_id,couple_id,owner_id,storage_path,url,name,media_type)
  values ('ff000000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fixture/cross-plan.txt','fixture/cross-plan.txt','fixture.txt','file')
$$, '23514', null, 'file cannot reference another plan comment even within the same couple');

select throws_ok($$
  insert into public.tracker_plan_attachments(plan_id,comment_id,couple_id,owner_id,storage_path,url,name,media_type)
  values ('ff000000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fixture/cross-pair.txt','fixture/cross-pair.txt','fixture.txt','file')
$$, '23514', null, 'file cannot reference another couple comment');

select throws_ok($$update public.tracker_plan_comments set plan_id='ff000000-0000-4000-8000-000000000002' where id='ff100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'comment cannot be moved across plans after attachment insertion');

select throws_ok($$update public.tracker_plan_comments set couple_id='b0000000-0000-4000-8000-000000000002' where id='ff100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'comment couple identity is immutable');

select lives_ok($$update public.tracker_plan_comments set text='Edited fixture text' where id='ff100000-0000-4000-8000-000000000001'$$,
  'author can still edit comment text');

select lives_ok($$
  insert into public.tracker_plan_attachments(plan_id,couple_id,owner_id,storage_path,url,name,media_type)
  values ('ff000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fixture/direct.txt','fixture/direct.txt','fixture.txt','file')
$$, 'a direct plan attachment without a comment remains supported');

select results_eq($$select count(*) from public.tracker_plan_attachments where plan_id='ff000000-0000-4000-8000-000000000001'$$,
  $$values (2::bigint)$$, 'rejected cross-links never leave attachment index rows');

select * from finish();
rollback;
