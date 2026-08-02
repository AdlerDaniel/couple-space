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
