alter table public.profiles
  add column if not exists profile_name text;

alter table public.profiles
  drop constraint if exists profiles_profile_name_format;

alter table public.profiles
  add constraint profiles_profile_name_format
  check (
    profile_name is null
    or profile_name ~ '^[A-Za-z0-9]{4,20}$'
  );

create unique index if not exists profiles_profile_name_lower_idx
  on public.profiles (lower(profile_name))
  where profile_name is not null;

create or replace view public.public_profiles as
select
  id,
  profile_name,
  display_name,
  avatar_url,
  favorite_team,
  favorite_city,
  theme_primary,
  theme_secondary,
  created_date
from public.profiles
where profile_name is not null;

grant select on public.public_profiles to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    user_email,
    first_name,
    last_name,
    display_name,
    profile_name,
    favorite_team,
    favorite_city,
    theme_primary,
    theme_secondary
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'profile_name', ''),
    new.raw_user_meta_data ->> 'favorite_team',
    new.raw_user_meta_data ->> 'favorite_city',
    new.raw_user_meta_data ->> 'theme_primary',
    new.raw_user_meta_data ->> 'theme_secondary'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
