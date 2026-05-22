create table if not exists public.couple_chat_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists couple_chat_messages_couple_created_idx
  on public.couple_chat_messages (couple_id, created_at);

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

do $$
begin
  alter publication supabase_realtime add table public.couple_chat_messages;
exception
  when duplicate_object then null;
end $$;
