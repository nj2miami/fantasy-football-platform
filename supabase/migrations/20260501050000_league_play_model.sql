alter table public.leagues
  add column if not exists draft_mode text not null default 'season_snake',
  add column if not exists player_retention_mode text not null default 'retained',
  add column if not exists schedule_type text not null default 'head_to_head',
  add column if not exists ranking_system text not null default 'standard',
  add column if not exists advancement_mode text not null default 'manual',
  add column if not exists playoff_mode text not null default 'roster_only',
  add column if not exists playoff_start_week integer not null default 9,
  add column if not exists playoff_team_count integer not null default 4,
  add column if not exists schedule_config jsonb not null default '{"type":"interval","games_per_period":1,"period_days":7}'::jsonb;

update public.leagues
set draft_mode = case when mode = 'weekly_redraft' then 'weekly_redraft' else 'season_snake' end
where draft_mode is null or draft_mode = 'season_snake';

alter table public.leagues
  drop constraint if exists leagues_draft_mode_check,
  drop constraint if exists leagues_player_retention_mode_check,
  drop constraint if exists leagues_schedule_type_check,
  drop constraint if exists leagues_ranking_system_check,
  drop constraint if exists leagues_advancement_mode_check,
  drop constraint if exists leagues_playoff_mode_check;

alter table public.leagues
  add constraint leagues_draft_mode_check check (draft_mode in ('season_snake', 'weekly_redraft')),
  add constraint leagues_player_retention_mode_check check (player_retention_mode in ('retained', 'two_use_release')),
  add constraint leagues_schedule_type_check check (schedule_type in ('head_to_head', 'league_wide')),
  add constraint leagues_ranking_system_check check (ranking_system in ('standard', 'offl')),
  add constraint leagues_advancement_mode_check check (advancement_mode in ('manual', 'automatic')),
  add constraint leagues_playoff_mode_check check (playoff_mode in ('redraft', 'roster_only'));

alter table public.standings
  add column if not exists league_points numeric not null default 0,
  add column if not exists weekly_rank_points numeric not null default 0,
  add column if not exists playoff_seed integer;

alter table public.manager_player_usage
  add column if not exists usage_count integer not null default 1,
  add column if not exists first_used_week integer,
  add column if not exists last_used_week integer,
  add column if not exists released_at timestamptz,
  add column if not exists use_context text not null default 'regular';

update public.manager_player_usage
set first_used_week = coalesce(first_used_week, used_in_week),
    last_used_week = coalesce(last_used_week, used_in_week)
where first_used_week is null or last_used_week is null;

create table if not exists public.league_game_schedule (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer not null,
  game_number integer not null default 1,
  scheduled_at timestamptz,
  phase text not null default 'regular' check (phase in ('regular', 'playoff')),
  advancement_mode text not null default 'manual' check (advancement_mode in ('manual', 'automatic')),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'DUE', 'LOCKED', 'RESOLVED', 'SKIPPED')),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, week_number, game_number)
);

create table if not exists public.player_release_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  week_number integer not null,
  release_reason text not null default 'two_use_limit',
  available_at timestamptz not null default now(),
  created_date timestamptz not null default now()
);

create table if not exists public.league_week_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  week_number integer not null,
  total_points numeric not null default 0,
  weekly_rank integer,
  head_to_head_points numeric not null default 0,
  rank_points numeric not null default 0,
  league_points numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, league_member_id, week_number)
);

create table if not exists public.playoff_roster_decisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  decision text not null check (decision in ('keep', 'release')),
  decided_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  unique (league_id, league_member_id, player_id)
);

create index if not exists idx_game_schedule_league_week on public.league_game_schedule (league_id, week_number);
create index if not exists idx_release_events_league_available on public.player_release_events (league_id, available_at desc);
create index if not exists idx_week_results_league_week on public.league_week_results (league_id, week_number);

alter table public.league_game_schedule enable row level security;
alter table public.player_release_events enable row level security;
alter table public.league_week_results enable row level security;
alter table public.playoff_roster_decisions enable row level security;

drop policy if exists "game schedule readable by visible league" on public.league_game_schedule;
create policy "game schedule readable by visible league"
on public.league_game_schedule for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

drop policy if exists "commissioners manage game schedule" on public.league_game_schedule;
create policy "commissioners manage game schedule"
on public.league_game_schedule for all
to authenticated
using (public.is_commissioner(league_id) or public.is_admin())
with check (public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "release events readable by visible league" on public.player_release_events;
create policy "release events readable by visible league"
on public.player_release_events for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

drop policy if exists "week results readable by visible league" on public.league_week_results;
create policy "week results readable by visible league"
on public.league_week_results for select
to anon, authenticated
using (
  exists (select 1 from public.leagues where id = league_id and (is_public = true or public.is_league_member(id) or public.is_commissioner(id) or public.is_admin()))
);

drop policy if exists "playoff decisions managed by owners and commissioners" on public.playoff_roster_decisions;
create policy "playoff decisions managed by owners and commissioners"
on public.playoff_roster_decisions for all
to authenticated
using (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin())
with check (public.owns_league_member(league_member_id) or public.is_commissioner(league_id) or public.is_admin());
