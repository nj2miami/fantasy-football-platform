create extension if not exists pgcrypto;

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_email text unique not null,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  favorite_team text,
  favorite_city text,
  role text not null default 'manager',
  theme_primary text,
  theme_secondary text,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.ensure_profile_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null and auth.uid() is not null then
    new.id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_profile_id on public.profiles;
create trigger ensure_profile_id
  before insert on public.profiles
  for each row execute function public.ensure_profile_id();

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  commissioner_id uuid references public.profiles(id) on delete set null,
  commissioner_email text,
  is_public boolean not null default true,
  is_sponsored boolean not null default false,
  mode text not null check (mode in ('traditional', 'weekly_redraft')),
  season_length_weeks integer not null default 8 check (season_length_weeks > 0),
  max_members integer not null default 8 check (max_members > 0),
  source_season_year integer not null,
  scoring_rules jsonb not null default '{}'::jsonb,
  roster_rules jsonb not null default '{}'::jsonb,
  draft_config jsonb not null default '{}'::jsonb,
  header_image_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  user_email text not null,
  team_name text not null,
  role_in_league text not null default 'MANAGER',
  is_active boolean not null default true,
  is_ai boolean not null default false,
  ai_persona text,
  team_avatar_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, user_email)
);

create table if not exists public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  source_season_year integer not null,
  status text not null default 'DRAFTING' check (status in ('DRAFTING', 'ACTIVE', 'PLAYOFFS', 'COMPLETED')),
  current_week integer not null default 1,
  reveal_state text not null default 'hidden' check (reveal_state in ('hidden', 'partial', 'revealed')),
  mode text not null check (mode in ('traditional', 'weekly_redraft')),
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.league_weeks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer not null,
  status text not null check (status in ('DRAFT_OPEN', 'LINEUPS_OPEN', 'LOCKED', 'RESOLVED')),
  reveal_state text not null default 'hidden' check (reveal_state in ('hidden', 'partial', 'revealed')),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, week_number)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  player_key text unique,
  full_name text not null,
  player_display_name text,
  team text,
  position text not null,
  active_years integer[] not null default '{}'::integer[],
  source_season_year integer not null,
  avg_points numeric,
  high_score numeric,
  low_score numeric,
  total_points numeric,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_year integer not null,
  totals jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (player_id, season_year)
);

create table if not exists public.player_week_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_year integer not null,
  week integer not null,
  team text,
  fantasy_points numeric not null default 0,
  passing_yards numeric not null default 0,
  passing_tds numeric not null default 0,
  rushing_yards numeric not null default 0,
  receiving_yards numeric not null default 0,
  touchdowns numeric not null default 0,
  raw_stats jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (player_id, season_year, week)
);

create table if not exists public.matchups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer not null,
  home_member_id uuid not null references public.league_members(id) on delete cascade,
  away_member_id uuid not null references public.league_members(id) on delete cascade,
  home_score numeric not null default 0,
  away_score numeric not null default 0,
  scoring_snapshot_id uuid,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer,
  status text not null default 'OPEN',
  type text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.draft_rooms (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  current_pick integer not null default 1,
  timer_seconds integer not null default 60,
  state jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.draft_turns (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  overall_pick integer not null,
  round integer not null,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  created_date timestamptz not null default now(),
  unique (draft_id, overall_pick)
);

create table if not exists public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  week_number integer,
  overall_pick integer,
  round integer,
  submitted_at timestamptz,
  created_date timestamptz not null default now()
);

create table if not exists public.roster_slots (
  id uuid primary key default gen_random_uuid(),
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  slot_type text not null,
  week_number integer,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  week_number integer not null,
  slots jsonb not null default '[]'::jsonb,
  finalized_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, league_member_id, week_number)
);

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  points_for numeric not null default 0,
  points_against numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, league_member_id)
);

create table if not exists public.manager_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  league_member_id uuid references public.league_members(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.season_source_pool (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.league_seasons(id) on delete cascade,
  source_season_year integer not null,
  created_date timestamptz not null default now()
);

create table if not exists public.week_randomizations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  fantasy_week integer not null,
  source_season_year integer not null,
  assignment_method text not null default 'per_player_hidden_week',
  reveal_state text not null default 'hidden' check (reveal_state in ('hidden', 'partial', 'revealed')),
  assignments jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, fantasy_week)
);

create table if not exists public.manager_player_usage (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  used_in_week integer not null,
  created_date timestamptz not null default now(),
  unique (league_id, league_member_id, player_id)
);

create table if not exists public.scoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer not null,
  payload jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'PENDING',
  progress integer not null default 0,
  parameters jsonb not null default '{}'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  summary text,
  error_details text,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.official_leagues (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  label text,
  created_date timestamptz not null default now(),
  unique (league_id)
);

create table if not exists public.global_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  value_number numeric,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.ai_team_name_parts (
  id uuid primary key default gen_random_uuid(),
  part_type text not null,
  value text not null,
  created_date timestamptz not null default now(),
  unique (part_type, value)
);

create table if not exists public.used_ai_team_names (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  name text not null,
  created_date timestamptz not null default now(),
  unique (league_id, name)
);

create index if not exists idx_leagues_public on public.leagues (is_public, created_date desc);
create index if not exists idx_league_members_league on public.league_members (league_id);
create index if not exists idx_league_members_profile on public.league_members (profile_id);
create index if not exists idx_players_position_points on public.players (position, avg_points desc);
create index if not exists idx_player_week_stats_player on public.player_week_stats (player_id, season_year, week);
create index if not exists idx_drafts_league_week on public.drafts (league_id, week_number);
create index if not exists idx_lineups_member_week on public.lineups (league_member_id, week_number);
create index if not exists idx_import_jobs_created on public.import_jobs (created_date desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'leagues', 'league_members', 'league_seasons', 'league_weeks',
    'players', 'player_season_stats', 'player_week_stats', 'matchups', 'drafts',
    'draft_rooms', 'roster_slots', 'lineups', 'standings', 'manager_seasons',
    'week_randomizations', 'manager_player_usage', 'import_jobs',
    'official_leagues', 'global_settings', 'site_settings'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_date on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_date before update on public.%I for each row execute function public.set_updated_date()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

insert into public.global_settings (key, value, description)
values
  ('SCORING_RULES', '{"passing_yards":0.04,"passing_td":4,"rushing_yards":0.1,"receiving_yards":0.1,"touchdown":6,"field_goal":3,"defense_turnover":2,"defense_td":6}'::jsonb, 'Default scoring rules for new leagues.'),
  ('ROSTER_RULES', '{"starters":{"QB":1,"OFF":1,"FLEX":1,"K":1,"DEF":1},"position_limits":{"QB":2,"OFF":4,"K":2,"DEF":2},"bench":5,"total_drafted":10,"bench_scoring_multiplier":0.5,"treatment_scoring_multiplier":0.25}'::jsonb, 'Fixed roster rules for new leagues.'),
  ('POSITION_CONFIG', '[{"position":"QB","group":"QB","enabled":true},{"position":"RB","group":"OFFENSE","enabled":true},{"position":"FB","group":"OFFENSE","enabled":true},{"position":"WR","group":"OFFENSE","enabled":true},{"position":"TE","group":"OFFENSE","enabled":true},{"position":"OL","group":"OFFENSE","enabled":false},{"position":"C","group":"OFFENSE","enabled":false},{"position":"G","group":"OFFENSE","enabled":false},{"position":"OT","group":"OFFENSE","enabled":false},{"position":"K","group":"K","enabled":true},{"position":"P","group":"OFFENSE","enabled":false},{"position":"LS","group":"OFFENSE","enabled":false},{"position":"DL","group":"DEFENSE","enabled":true},{"position":"DE","group":"DEFENSE","enabled":true},{"position":"DT","group":"DEFENSE","enabled":true},{"position":"NT","group":"DEFENSE","enabled":true},{"position":"LB","group":"DEFENSE","enabled":true},{"position":"ILB","group":"DEFENSE","enabled":true},{"position":"MLB","group":"DEFENSE","enabled":true},{"position":"OLB","group":"DEFENSE","enabled":true},{"position":"DB","group":"DEFENSE","enabled":true},{"position":"CB","group":"DEFENSE","enabled":true},{"position":"S","group":"DEFENSE","enabled":true},{"position":"SAF","group":"DEFENSE","enabled":true},{"position":"FS","group":"DEFENSE","enabled":true}]'::jsonb, 'Raw backend player position grouping used by import, scoring, draft eligibility, and roster limits.')
on conflict (key) do nothing;

insert into public.site_settings (key, value, description)
values
  ('SCORING_RULES', '{"passing_yards":0.04,"passing_td":4,"rushing_yards":0.1,"receiving_yards":0.1,"touchdown":6,"field_goal":3,"defense_turnover":2,"defense_td":6}'::jsonb, 'Default site scoring rules.'),
  ('ROSTER_RULES', '{"starters":{"QB":1,"OFF":1,"FLEX":1,"K":1,"DEF":1},"position_limits":{"QB":2,"OFF":4,"K":2,"DEF":2},"bench":5,"total_drafted":10,"bench_scoring_multiplier":0.5,"treatment_scoring_multiplier":0.25}'::jsonb, 'Fixed site roster rules.')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = excluded.public;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_seasons enable row level security;
alter table public.league_weeks enable row level security;
alter table public.players enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.player_week_stats enable row level security;
alter table public.matchups enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_rooms enable row level security;
alter table public.draft_turns enable row level security;
alter table public.draft_picks enable row level security;
alter table public.roster_slots enable row level security;
alter table public.lineups enable row level security;
alter table public.standings enable row level security;
alter table public.manager_seasons enable row level security;
alter table public.season_source_pool enable row level security;
alter table public.week_randomizations enable row level security;
alter table public.manager_player_usage enable row level security;
alter table public.scoring_snapshots enable row level security;
alter table public.import_jobs enable row level security;
alter table public.official_leagues enable row level security;
alter table public.global_settings enable row level security;
alter table public.site_settings enable row level security;
alter table public.ai_team_name_parts enable row level security;
alter table public.used_ai_team_names enable row level security;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'email';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_league_member(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = target_league_id
      and is_active = true
      and (profile_id = auth.uid() or user_email = public.current_user_email())
  );
$$;

create or replace function public.is_commissioner(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leagues
    where id = target_league_id
      and (commissioner_id = auth.uid() or commissioner_email = public.current_user_email())
  );
$$;

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

create policy "profiles are readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "users insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and user_email = public.current_user_email());

create policy "users update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "public leagues are readable"
on public.leagues for select
to anon, authenticated
using (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin());

create policy "authenticated users create leagues"
on public.leagues for insert
to authenticated
with check (
  coalesce(commissioner_id, auth.uid()) = auth.uid()
  and coalesce(commissioner_email, public.current_user_email()) = public.current_user_email()
);

create policy "commissioners update leagues"
on public.leagues for update
to authenticated
using (public.is_commissioner(id) or public.is_admin())
with check (public.is_commissioner(id) or public.is_admin());

create policy "commissioners delete leagues"
on public.leagues for delete
to authenticated
using (public.is_commissioner(id) or public.is_admin());

create policy "members are readable for visible leagues"
on public.league_members for select
to anon, authenticated
using (
  exists (
    select 1 from public.leagues
    where leagues.id = league_members.league_id
      and (leagues.is_public = true or public.is_league_member(leagues.id) or public.is_commissioner(leagues.id) or public.is_admin())
  )
);

create policy "authenticated users join leagues"
on public.league_members for insert
to authenticated
with check (
  (profile_id is null or profile_id = auth.uid())
  and user_email = public.current_user_email()
  and exists (select 1 from public.leagues where id = league_id and is_public = true)
);

create policy "commissioners create league members"
on public.league_members for insert
to authenticated
with check (public.is_commissioner(league_id) or public.is_admin());

create policy "members and commissioners update members"
on public.league_members for update
to authenticated
using (profile_id = auth.uid() or user_email = public.current_user_email() or public.is_commissioner(league_id) or public.is_admin())
with check (profile_id = auth.uid() or user_email = public.current_user_email() or public.is_commissioner(league_id) or public.is_admin());

create policy "commissioners delete members"
on public.league_members for delete
to authenticated
using (public.is_commissioner(league_id) or public.is_admin());

create policy "members can leave leagues"
on public.league_members for delete
to authenticated
using (profile_id = auth.uid() or user_email = public.current_user_email());

create policy "players are public"
on public.players for select
to anon, authenticated
using (true);

create policy "player season stats are public"
on public.player_season_stats for select
to anon, authenticated
using (true);

create policy "player week stats are public"
on public.player_week_stats for select
to anon, authenticated
using (true);

create policy "settings are public"
on public.global_settings for select
to anon, authenticated
using (true);

create policy "site settings are public"
on public.site_settings for select
to anon, authenticated
using (true);

create policy "official leagues are public"
on public.official_leagues for select
to anon, authenticated
using (true);

create policy "ai names are public"
on public.ai_team_name_parts for select
to anon, authenticated
using (true);

create policy "admins manage global settings"
on public.global_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage site settings"
on public.site_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage players"
on public.players for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage player season stats"
on public.player_season_stats for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage player week stats"
on public.player_week_stats for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage import jobs"
on public.import_jobs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "import jobs readable by admins"
on public.import_jobs for select
to authenticated
using (public.is_admin());

create policy "league data readable by visible league"
on public.league_seasons for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

create policy "league weeks readable by visible league"
on public.league_weeks for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

create policy "matchups readable by visible league"
on public.matchups for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

create policy "drafts readable by league participants"
on public.drafts for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "draft rooms readable by league participants"
on public.draft_rooms for select
to authenticated
using (
  exists (select 1 from public.drafts where drafts.id = draft_id and (public.is_league_member(drafts.league_id) or public.is_commissioner(drafts.league_id) or public.is_admin()))
);

create policy "draft turns readable by league participants"
on public.draft_turns for select
to authenticated
using (
  exists (select 1 from public.drafts where drafts.id = draft_id and (public.is_league_member(drafts.league_id) or public.is_commissioner(drafts.league_id) or public.is_admin()))
);

create policy "draft picks readable by league participants"
on public.draft_picks for select
to authenticated
using (
  league_id is not null and (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin())
);

create policy "members create their own draft picks"
on public.draft_picks for insert
to authenticated
with check (
  public.owns_league_member(league_member_id)
  and league_id is not null
  and public.member_league_id(league_member_id) = league_id
  and public.is_league_member(league_id)
);

create policy "members update their own draft picks"
on public.draft_picks for update
to authenticated
using (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin())
with check (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "members delete their own draft picks"
on public.draft_picks for delete
to authenticated
using (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "rosters readable by league participants"
on public.roster_slots for select
to authenticated
using (
  exists (
    select 1 from public.league_members
    where league_members.id = roster_slots.league_member_id
      and (public.is_league_member(league_members.league_id) or public.is_commissioner(league_members.league_id) or public.is_admin())
  )
);

create policy "members add players to their own roster"
on public.roster_slots for insert
to authenticated
with check (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(public.member_league_id(league_member_id))
  or public.is_admin()
);

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

create policy "members remove players from their own roster"
on public.roster_slots for delete
to authenticated
using (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(public.member_league_id(league_member_id))
  or public.is_admin()
);

create policy "lineups readable by league participants"
on public.lineups for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "members create their own lineups"
on public.lineups for insert
to authenticated
with check (
  public.owns_league_member(league_member_id)
  and public.member_league_id(league_member_id) = league_id
  and public.is_league_member(league_id)
);

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

create policy "members delete their own lineups"
on public.lineups for delete
to authenticated
using (
  public.owns_league_member(league_member_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
);

create policy "standings readable by visible league"
on public.standings for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

create policy "manager seasons readable by participants"
on public.manager_seasons for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "week randomizations readable by participants"
on public.week_randomizations for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "manager usage readable by participants"
on public.manager_player_usage for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "snapshots readable by participants"
on public.scoring_snapshots for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "used ai names readable by participants"
on public.used_ai_team_names for select
to authenticated
using (league_id is null or public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());
