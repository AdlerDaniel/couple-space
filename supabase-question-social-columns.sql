alter table public.question_answers
  add column if not exists answer_one_reactions jsonb not null default '{}'::jsonb,
  add column if not exists answer_two_reactions jsonb not null default '{}'::jsonb,
  add column if not exists answer_one_likes jsonb not null default '{}'::jsonb,
  add column if not exists answer_two_likes jsonb not null default '{}'::jsonb,
  add column if not exists favorite_answers jsonb not null default '{}'::jsonb;
