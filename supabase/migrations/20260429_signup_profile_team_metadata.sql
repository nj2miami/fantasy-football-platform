alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

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
    new.raw_user_meta_data ->> 'favorite_team',
    new.raw_user_meta_data ->> 'favorite_city',
    new.raw_user_meta_data ->> 'theme_primary',
    new.raw_user_meta_data ->> 'theme_secondary'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
