alter table public.question_answers
  add column if not exists answer_one_voice_url text,
  add column if not exists answer_two_voice_url text,
  add column if not exists answer_one_photo_url text,
  add column if not exists answer_two_photo_url text;
