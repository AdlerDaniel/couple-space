begin;

-- Security-definer functions must never inherit the default PUBLIC execute grant.
revoke all on function public.is_tracker_couple_member(uuid, uuid) from public, anon;
revoke all on function public.can_view_tracker_plan(uuid, uuid) from public, anon;
revoke all on function public.can_edit_tracker_plan(uuid, uuid) from public, anon;
revoke all on function public.tracker_safe_uuid(text) from public, anon;
revoke all on function public.adjust_tracker_event_count(uuid, uuid, date, integer) from public, anon;
revoke all on function public.save_tracker_checkin(uuid, date, text, integer, integer, text, text, boolean) from public, anon;
revoke all on function public.get_tracker_checkins(uuid, date, date) from public, anon;
revoke all on function public.list_tracker_plan_occurrences(uuid, date, date) from public, anon;
revoke all on function public.find_tracker_common_free_slots(uuid, date, integer, time, time) from public, anon;
revoke all on function public.enforce_tracker_child_couple() from public, anon, authenticated;
revoke all on function public.enforce_tracker_memory_link_couple() from public, anon, authenticated;
revoke all on function public.enforce_tracker_plan_identity() from public, anon, authenticated;

-- These functions form the authenticated tracker API or are evaluated by RLS.
grant execute on function public.is_tracker_couple_member(uuid, uuid) to authenticated;
grant execute on function public.can_view_tracker_plan(uuid, uuid) to authenticated;
grant execute on function public.can_edit_tracker_plan(uuid, uuid) to authenticated;
grant execute on function public.tracker_safe_uuid(text) to authenticated;
grant execute on function public.adjust_tracker_event_count(uuid, uuid, date, integer) to authenticated;
grant execute on function public.save_tracker_checkin(uuid, date, text, integer, integer, text, text, boolean) to authenticated;
grant execute on function public.get_tracker_checkins(uuid, date, date) to authenticated;
grant execute on function public.list_tracker_plan_occurrences(uuid, date, date) to authenticated;
grant execute on function public.find_tracker_common_free_slots(uuid, date, integer, time, time) to authenticated;

-- Avoid a second permissive SELECT path while retaining pair-scoped writes.
drop policy if exists tracker_category_preferences_write on public.tracker_category_preferences;
create policy tracker_category_preferences_insert on public.tracker_category_preferences
for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
);
create policy tracker_category_preferences_update on public.tracker_category_preferences
for update to authenticated
using (public.is_tracker_couple_member(couple_id, (select auth.uid())))
with check (
  updated_by = (select auth.uid())
  and public.is_tracker_couple_member(couple_id, (select auth.uid()))
);
create policy tracker_category_preferences_delete on public.tracker_category_preferences
for delete to authenticated
using (public.is_tracker_couple_member(couple_id, (select auth.uid())));

create index if not exists tracker_plans_updated_by_idx
  on public.tracker_plans(updated_by)
  where updated_by is not null;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['tracker_events', 'tracker_goals']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end
$$;

commit;
