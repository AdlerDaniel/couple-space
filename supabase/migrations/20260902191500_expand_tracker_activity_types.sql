begin;

alter table public.tracker_plan_activity
  drop constraint if exists tracker_plan_activity_activity_type_check;

alter table public.tracker_plan_activity
  add constraint tracker_plan_activity_activity_type_check
  check (
    activity_type in (
      'created',
      'updated',
      'responded',
      'completed',
      'commented',
      'attachment_added',
      'occurrence_updated',
      'memory_created',
      'reminder_sent'
    )
  );

commit;
