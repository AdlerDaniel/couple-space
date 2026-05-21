create table if not exists public.couple_notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists couple_notifications_recipient_created_idx
  on public.couple_notifications(recipient_id, created_at desc);

alter table public.couple_notifications enable row level security;

drop policy if exists "Users can read own notifications"
  on public.couple_notifications;
create policy "Users can read own notifications"
  on public.couple_notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Users can mark own notifications as read"
  on public.couple_notifications;
create policy "Users can mark own notifications as read"
  on public.couple_notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "Couple members can create partner notifications"
  on public.couple_notifications;
create policy "Couple members can create partner notifications"
  on public.couple_notifications
  for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.couples
      where couples.id = couple_notifications.couple_id
        and (
          couples.partner_one_id = auth.uid()
          or couples.partner_two_id = auth.uid()
        )
        and (
          couples.partner_one_id = couple_notifications.recipient_id
          or couples.partner_two_id = couple_notifications.recipient_id
        )
    )
  );

grant select, insert, update on public.couple_notifications to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.couple_notifications;
exception
  when duplicate_object then null;
end $$;
