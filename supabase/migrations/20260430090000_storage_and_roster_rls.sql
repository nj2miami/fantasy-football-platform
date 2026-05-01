insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = excluded.public;

create or replace function public.owns_league_member(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where id = target_member_id
      and is_active = true
      and (profile_id = auth.uid() or user_email = public.current_user_email())
  );
$$;

create or replace function public.member_league_id(target_member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select league_id from public.league_members where id = target_member_id;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and not public.is_admin()
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Only admins can change profile roles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.protect_league_member_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin()
    or public.is_commissioner(old.league_id)
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
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

drop trigger if exists protect_league_member_privileges on public.league_members;
create trigger protect_league_member_privileges
  before update on public.league_members
  for each row execute function public.protect_league_member_privileges();

drop policy if exists "uploads public read" on storage.objects;
create policy "uploads public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'uploads');

drop policy if exists "authenticated users upload own files" on storage.objects;
create policy "authenticated users upload own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "authenticated users update own files" on storage.objects;
create policy "authenticated users update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "authenticated users delete own files" on storage.objects;
create policy "authenticated users delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "commissioners create league members" on public.league_members;
create policy "commissioners create league members"
on public.league_members for insert
to authenticated
with check (public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "members can leave leagues" on public.league_members;
create policy "members can leave leagues"
on public.league_members for delete
to authenticated
using (profile_id = auth.uid() or user_email = public.current_user_email());

drop policy if exists "members create their own draft picks" on public.draft_picks;
create policy "members create their own draft picks"
on public.draft_picks for insert
to authenticated
with check (
  public.owns_league_member(league_member_id)
  and league_id is not null
  and public.member_league_id(league_member_id) = league_id
  and public.is_league_member(league_id)
);

drop policy if exists "members update their own draft picks" on public.draft_picks;
create policy "members update their own draft picks"
on public.draft_picks for update
to authenticated
using (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin())
with check (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "members delete their own draft picks" on public.draft_picks;
create policy "members delete their own draft picks"
on public.draft_picks for delete
to authenticated
using (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "members add players to their own roster" on public.roster_slots;
create policy "members add players to their own roster"
on public.roster_slots for insert
to authenticated
with check (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(public.member_league_id(league_member_id))
  or public.is_admin()
);

drop policy if exists "members update their own roster" on public.roster_slots;
create policy "members update their own roster"
on public.roster_slots for update
to authenticated
using (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(public.member_league_id(league_member_id))
  or public.is_admin()
)
with check (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(public.member_league_id(league_member_id))
  or public.is_admin()
);

drop policy if exists "members remove players from their own roster" on public.roster_slots;
create policy "members remove players from their own roster"
on public.roster_slots for delete
to authenticated
using (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(public.member_league_id(league_member_id))
  or public.is_admin()
);

drop policy if exists "members create their own lineups" on public.lineups;
create policy "members create their own lineups"
on public.lineups for insert
to authenticated
with check (
  public.owns_league_member(league_member_id)
  and public.member_league_id(league_member_id) = league_id
  and public.is_league_member(league_id)
);

drop policy if exists "members update their own lineups" on public.lineups;
create policy "members update their own lineups"
on public.lineups for update
to authenticated
using (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
)
with check (
  (public.owns_league_member(league_member_id) and public.member_league_id(league_member_id) = league_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
);

drop policy if exists "members delete their own lineups" on public.lineups;
create policy "members delete their own lineups"
on public.lineups for delete
to authenticated
using (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
);
