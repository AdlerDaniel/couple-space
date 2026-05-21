alter table public.couple_profiles
  add column if not exists status_one_text text,
  add column if not exists status_one_emoji text not null default '❤️',
  add column if not exists status_two_text text,
  add column if not exists status_two_emoji text not null default '❤️',
  add column if not exists status_updates_one integer not null default 0,
  add column if not exists status_updates_two integer not null default 0;

alter table public.couple_profiles
  drop constraint if exists couple_profiles_status_one_text_length,
  drop constraint if exists couple_profiles_status_two_text_length;

alter table public.couple_profiles
  add constraint couple_profiles_status_one_text_length
    check (status_one_text is null or char_length(status_one_text) <= 20),
  add constraint couple_profiles_status_two_text_length
    check (status_two_text is null or char_length(status_two_text) <= 20);
