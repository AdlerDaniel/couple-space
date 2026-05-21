create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, couple_id, user_id)
);

create index if not exists quiz_answers_couple_id_idx
  on public.quiz_answers(couple_id);

create index if not exists quiz_answers_quiz_id_idx
  on public.quiz_answers(quiz_id);

create table if not exists public.quiz_comments (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_comments_couple_id_quiz_id_idx
  on public.quiz_comments(couple_id, quiz_id);

grant select, insert, update, delete on public.quiz_answers to authenticated;
grant select, insert, update, delete on public.quiz_comments to authenticated;
