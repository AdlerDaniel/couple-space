create index if not exists couples_partner_one_id_idx
  on public.couples (partner_one_id);

create index if not exists couples_partner_two_id_idx
  on public.couples (partner_two_id);

create index if not exists memories_user_id_idx
  on public.memories (user_id);
