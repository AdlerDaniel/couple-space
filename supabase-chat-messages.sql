create table if not exists public.couple_chat_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text check (body is null or char_length(body) between 1 and 1000),
  reply_to_id uuid references public.couple_chat_messages(id) on delete set null,
  reactions jsonb not null default '[]'::jsonb,
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image', 'audio')),
  attachment_name text,
  attachments jsonb not null default '[]'::jsonb,
  pinned_at timestamptz,
  edited_at timestamptz,
  read_at timestamptz,
  deleted_for uuid[] not null default '{}',
  deleted_for_everyone boolean not null default false,
  created_at timestamptz not null default now(),
  constraint couple_chat_messages_content_check check (
    body is not null or attachment_url is not null or deleted_for_everyone = true
  )
);

alter table public.couple_chat_messages
  alter column body drop not null,
  add column if not exists reply_to_id uuid references public.couple_chat_messages(id) on delete set null,
  add column if not exists reactions jsonb not null default '[]'::jsonb,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists pinned_at timestamptz,
  add column if not exists edited_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists deleted_for uuid[] not null default '{}',
  add column if not exists deleted_for_everyone boolean not null default false;

create index if not exists couple_chat_messages_couple_created_idx
  on public.couple_chat_messages (couple_id, created_at);

create index if not exists couple_chat_messages_pinned_idx
  on public.couple_chat_messages (couple_id, pinned_at)
  where pinned_at is not null;

alter table public.couple_chat_messages enable row level security;

drop policy if exists "Couple members can read chat messages"
  on public.couple_chat_messages;

create policy "Couple members can read chat messages"
  on public.couple_chat_messages
  for select
  using (
    exists (
      select 1
      from public.couples c
      where c.id = couple_chat_messages.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "Couple members can send chat messages"
  on public.couple_chat_messages;

create policy "Couple members can send chat messages"
  on public.couple_chat_messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.couples c
      where c.id = couple_chat_messages.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "Couple members can update chat messages"
  on public.couple_chat_messages;

create policy "Couple members can update chat messages"
  on public.couple_chat_messages
  for update
  using (
    exists (
      select 1
      from public.couples c
      where c.id = couple_chat_messages.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  )
  with check (
    exists (
      select 1
      from public.couples c
      where c.id = couple_chat_messages.couple_id
        and auth.uid() in (c.partner_one_id, c.partner_two_id)
    )
  );

drop policy if exists "Couple members can delete chat messages"
  on public.couple_chat_messages;

create policy "Couple members can delete chat messages"
  on public.couple_chat_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.couples c
      where c.id = couple_chat_messages.couple_id
        and (select auth.uid()) in (c.partner_one_id, c.partner_two_id)
    )
  );

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Couple users can upload chat media"
  on storage.objects;

create policy "Couple users can upload chat media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'chat-media'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Anyone can read chat media"
  on storage.objects;

create policy "Anyone can read chat media"
  on storage.objects
  for select
  using (bucket_id = 'chat-media');

do $$
begin
  alter publication supabase_realtime add table public.couple_chat_messages;
exception
  when duplicate_object then null;
end $$;
