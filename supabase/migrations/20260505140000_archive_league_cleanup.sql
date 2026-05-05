create or replace function public.protect_league_member_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_active is true
    and new.is_active is false
    and old.league_id = new.league_id
    and old.profile_id is not distinct from new.profile_id
    and old.user_email is not distinct from new.user_email
    and old.role_in_league is not distinct from new.role_in_league
    and old.is_ai is not distinct from new.is_ai
    and old.ai_persona is not distinct from new.ai_persona
    and exists (
      select 1
      from public.leagues
      where leagues.id = old.league_id
        and leagues.archived_at is not null
    ) then
    return new;
  end if;

  if public.is_admin()
    or public.is_commissioner(old.league_id)
    or public.owns_league_member(old.id) then
    return new;
  end if;

  if old.league_id is distinct from new.league_id
    or old.profile_id is distinct from new.profile_id
    or old.user_email is distinct from new.user_email
    or old.role_in_league is distinct from new.role_in_league
    or old.is_active is distinct from new.is_active
    or old.is_ai is distinct from new.is_ai
    or old.ai_persona is distinct from new.ai_persona then
    raise exception 'Only commissioners can change league membership privileges';
  end if;

  return new;
end;
$$;

update public.leagues
set
  is_sponsored = false,
  updated_date = now()
where archived_at is not null
  and is_sponsored = true;

update public.league_members
set
  is_active = false,
  updated_date = now()
where is_active = true
  and league_id in (
    select id
    from public.leagues
    where archived_at is not null
  );
