update public.couple_profiles
set time_zone = 'Europe/Moscow'
where time_zone is distinct from 'Europe/Moscow';

alter table public.couple_profiles
  alter column time_zone set default 'Europe/Moscow';

alter table public.couple_profiles
  drop constraint if exists couple_profiles_time_zone_moscow;

alter table public.couple_profiles
  add constraint couple_profiles_time_zone_moscow
  check (time_zone = 'Europe/Moscow');
