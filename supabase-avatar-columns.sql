alter table public.couple_profiles
  add column if not exists avatar_one text,
  add column if not exists avatar_two text;
