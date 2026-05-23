alter table public.couple_profiles
add column if not exists time_zone text not null default 'Europe/Moscow';

create table if not exists public.user_notification_settings (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null default '{"chat":true,"questions":true,"quizzes":true,"goals":true,"reactions":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create index if not exists user_notification_settings_couple_id_idx
on public.user_notification_settings(couple_id);

create index if not exists user_notification_settings_user_id_idx
on public.user_notification_settings(user_id);

alter table public.user_notification_settings enable row level security;

drop policy if exists "Couple members can read notification settings" on public.user_notification_settings;
create policy "Couple members can read notification settings"
on public.user_notification_settings
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.couples c
    where c.id = user_notification_settings.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

drop policy if exists "Couple members can add notification settings" on public.user_notification_settings;
create policy "Couple members can add notification settings"
on public.user_notification_settings
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.couples c
    where c.id = user_notification_settings.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

drop policy if exists "Couple members can update own notification settings" on public.user_notification_settings;
create policy "Couple members can update own notification settings"
on public.user_notification_settings
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.couples c
    where c.id = user_notification_settings.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.couples c
    where c.id = user_notification_settings.couple_id
      and ((select auth.uid()) = c.partner_one_id or (select auth.uid()) = c.partner_two_id)
  )
);

grant select, insert, update on public.user_notification_settings to authenticated;

alter table public.question_comments
add column if not exists updated_at timestamptz;

drop policy if exists "Comment authors can update question comments" on public.question_comments;
create policy "Comment authors can update question comments"
on public.question_comments
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
