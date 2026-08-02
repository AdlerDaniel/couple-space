create table if not exists public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_answer_id uuid not null references public.question_answers(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text default '',
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image', 'video', 'audio')),
  attachment_name text,
  attachment_mime_type text,
  constraint question_comments_content_check check (
    nullif(btrim(coalesce(text, '')), '') is not null
    or attachment_url is not null
  ),
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

drop policy if exists "Comment authors can update question comments" on public.question_comments;
create policy "Comment authors can update question comments"
  on public.question_comments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.question_comments to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.question_comments;
exception
  when duplicate_object then null;
end $$;
