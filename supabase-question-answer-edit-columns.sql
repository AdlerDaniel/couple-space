alter table public.question_answers
  add column if not exists answer_one_edited_at timestamptz,
  add column if not exists answer_two_edited_at timestamptz;
