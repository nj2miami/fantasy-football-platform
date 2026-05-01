insert into storage.buckets (id, name, public)
values ('headshots', 'headshots', true)
on conflict (id) do update set public = excluded.public;

create table if not exists public.player_master (
  player_id text primary key,
  player_display_name text not null,
  headshot_url text,
  headshot_storage_path text,
  headshot_public_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create table if not exists public.weekly_player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_master(player_id) on delete cascade,
  season integer not null,
  week integer not null,
  season_type text not null check (season_type in ('REG', 'POST')),
  position_group text,
  team text,
  game_id text not null,
  completions numeric,
  attempts numeric,
  passing_yards numeric,
  passing_tds numeric,
  passing_interceptions numeric,
  sacks_suffered numeric,
  sack_yards_lost numeric,
  sack_fumbles numeric,
  sack_fumbles_lost numeric,
  passing_air_yards numeric,
  passing_yards_after_catch numeric,
  passing_first_downs numeric,
  passing_epa numeric,
  passing_cpoe numeric,
  passing_2pt_conversions numeric,
  pacr numeric,
  carries numeric,
  rushing_yards numeric,
  rushing_tds numeric,
  rushing_fumbles numeric,
  rushing_fumbles_lost numeric,
  rushing_first_downs numeric,
  rushing_epa numeric,
  rushing_2pt_conversions numeric,
  receptions numeric,
  targets numeric,
  receiving_yards numeric,
  receiving_tds numeric,
  receiving_fumbles numeric,
  receiving_fumbles_lost numeric,
  receiving_air_yards numeric,
  receiving_yards_after_catch numeric,
  receiving_first_downs numeric,
  receiving_epa numeric,
  receiving_2pt_conversions numeric,
  racr numeric,
  target_share numeric,
  air_yards_share numeric,
  wopr numeric,
  special_teams_tds numeric,
  def_tackles_solo numeric,
  def_tackles_with_assist numeric,
  def_tackle_assists numeric,
  def_tackles_for_loss numeric,
  def_tackles_for_loss_yards numeric,
  def_fumbles_forced numeric,
  def_sacks numeric,
  def_sack_yards numeric,
  def_qb_hits numeric,
  def_interceptions numeric,
  def_interception_yards numeric,
  def_pass_defended numeric,
  def_tds numeric,
  def_fumbles numeric,
  def_safeties numeric,
  misc_yards numeric,
  fumble_recovery_own numeric,
  fumble_recovery_yards_own numeric,
  fumble_recovery_opp numeric,
  fumble_recovery_yards_opp numeric,
  fumble_recovery_tds numeric,
  penalties numeric,
  penalty_yards numeric,
  punt_returns numeric,
  punt_return_yards numeric,
  kickoff_returns numeric,
  kickoff_return_yards numeric,
  fg_made numeric,
  fg_att numeric,
  fg_missed numeric,
  fg_blocked numeric,
  fg_long numeric,
  fg_pct numeric,
  fg_made_0_19 numeric,
  fg_made_20_29 numeric,
  fg_made_30_39 numeric,
  fg_made_40_49 numeric,
  fg_made_50_59 numeric,
  fg_made_60_ numeric,
  fg_missed_0_19 numeric,
  fg_missed_20_29 numeric,
  fg_missed_30_39 numeric,
  fg_missed_40_49 numeric,
  fg_missed_50_59 numeric,
  fg_missed_60_ numeric,
  fg_made_list text,
  fg_missed_list text,
  fg_blocked_list text,
  fg_made_distance text,
  fg_missed_distance text,
  fg_blocked_distance text,
  pat_made numeric,
  pat_att numeric,
  pat_missed numeric,
  pat_blocked numeric,
  pat_pct numeric,
  gwfg_made numeric,
  gwfg_att numeric,
  gwfg_missed numeric,
  gwfg_blocked numeric,
  gwfg_distance text,
  fantasy_points numeric,
  fantasy_points_ppr numeric,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (player_id, season, week, season_type, game_id)
);

create index if not exists idx_weekly_player_stats_player on public.weekly_player_stats (player_id);
create index if not exists idx_weekly_player_stats_season_week on public.weekly_player_stats (season, week, season_type);
create index if not exists idx_weekly_player_stats_game on public.weekly_player_stats (game_id);

drop trigger if exists set_player_master_updated_date on public.player_master;
create trigger set_player_master_updated_date
  before update on public.player_master
  for each row execute function public.set_updated_date();

drop trigger if exists set_weekly_player_stats_updated_date on public.weekly_player_stats;
create trigger set_weekly_player_stats_updated_date
  before update on public.weekly_player_stats
  for each row execute function public.set_updated_date();

alter table public.player_master enable row level security;
alter table public.weekly_player_stats enable row level security;

drop policy if exists "player master is public" on public.player_master;
create policy "player master is public"
on public.player_master for select
to anon, authenticated
using (true);

drop policy if exists "weekly player stats are public" on public.weekly_player_stats;
create policy "weekly player stats are public"
on public.weekly_player_stats for select
to anon, authenticated
using (true);

drop policy if exists "admins manage player master" on public.player_master;
create policy "admins manage player master"
on public.player_master for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage weekly player stats" on public.weekly_player_stats;
create policy "admins manage weekly player stats"
on public.weekly_player_stats for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "headshots public read" on storage.objects;
create policy "headshots public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'headshots');

