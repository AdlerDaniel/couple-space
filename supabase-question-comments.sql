create table if not exists public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_answer_id uuid not null references public.question_answers(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists question_comments_answer_id_idx
  on public.question_comments(question_answer_id);

create index if not exists question_comments_couple_id_idx
  on public.question_comments(couple_id);

create index if not exists question_comments_user_id_idx
  on public.question_comments(user_id);

alter table public.question_comments enable row level security;

drop policy if exists "Couple members can read question comments" on public.question_comments;
create policy "Couple members can read question comments"
  on public.question_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.couples
      where couples.id = question_comments.couple_id
        and (
          couples.partner_one_id = (select auth.uid())
          or couples.partner_two_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Couple members can add question comments" on public.question_comments;
create policy "Couple members can add question comments"
  on public.question_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.couples
      where couples.id = question_comments.couple_id
        and (
          couples.partner_one_id = (select auth.uid())
          or couples.partner_two_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Comment authors can delete question comments" on public.question_comments;
create policy "Comment authors can delete question comments"
  on public.question_comments
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.question_comments to authenticated;
