alter table public.leagues
  add column if not exists league_tier text not null default 'FREE'
  check (league_tier in ('FREE', 'PAID'));

create or replace function public.current_user_membership_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.league_members
  where is_active = true
    and coalesce(is_ai, false) = false
    and (profile_id = auth.uid() or user_email = public.current_user_email());
$$;

create or replace function public.current_user_created_league_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.leagues
  where commissioner_id = auth.uid()
    or commissioner_email = public.current_user_email();
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(role, 'manager'))
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.can_create_league(target_league_tier text, target_max_members integer)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app_role text := coalesce(public.current_profile_role(), 'manager');
  membership_count integer := public.current_user_membership_count();
  created_count integer := public.current_user_created_league_count();
  normalized_tier text := upper(coalesce(target_league_tier, 'FREE'));
  max_allowed_members integer := case when upper(coalesce(target_league_tier, 'FREE')) = 'PAID' then 16 else 8 end;
begin
  if auth.uid() is null then
    return false;
  end if;

  if target_max_members < 4 or target_max_members > max_allowed_members then
    return false;
  end if;

  if app_role = 'admin' then
    return true;
  end if;

  if app_role = 'premium' then
    return membership_count < 4 and created_count < 4;
  end if;

  if app_role = 'manager' and normalized_tier = 'FREE' then
    return membership_count = 0 and created_count = 0;
  end if;

  if app_role = 'manager' and normalized_tier = 'PAID' then
    return membership_count < 4 and created_count < 4;
  end if;

  return false;
end;
$$;

create or replace function public.can_join_public_league(target_league_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app_role text := coalesce(public.current_profile_role(), 'manager');
  membership_count integer := public.current_user_membership_count();
  league_record public.leagues%rowtype;
  member_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into league_record
  from public.leagues
  where id = target_league_id;

  if league_record.id is null or league_record.is_public is not true then
    return false;
  end if;

  select count(*)::integer into member_count
  from public.league_members
  where league_id = target_league_id
    and is_active = true;

  if member_count >= league_record.max_members then
    return false;
  end if;

  if exists (
    select 1
    from public.league_members
    where league_id = target_league_id
      and (profile_id = auth.uid() or user_email = public.current_user_email())
  ) then
    return false;
  end if;

  if app_role = 'admin' then
    return true;
  end if;

  if app_role = 'premium' then
    return membership_count < 4;
  end if;

  return membership_count < 1;
end;
$$;

drop policy if exists "authenticated users create leagues" on public.leagues;
drop policy if exists "commissioners and admins create leagues" on public.leagues;
drop policy if exists "entitled users create leagues" on public.leagues;
create policy "entitled users create leagues"
on public.leagues for insert
to authenticated
with check (
  public.can_create_league(league_tier, max_members)
  and coalesce(commissioner_id, auth.uid()) = auth.uid()
  and coalesce(commissioner_email, public.current_user_email()) = public.current_user_email()
);

drop policy if exists "members join public leagues within entitlement" on public.league_members;
create policy "members join public leagues within entitlement"
on public.league_members for insert
to authenticated
with check (
  public.can_join_public_league(league_id)
  and coalesce(profile_id, auth.uid()) = auth.uid()
  and user_email = public.current_user_email()
  and role_in_league = 'MANAGER'
  and is_active = true
  and coalesce(is_ai, false) = false
);
