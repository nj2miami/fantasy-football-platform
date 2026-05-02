alter table public.player_week_stats
  add column if not exists opponent_team text;

alter table public.players
  add column if not exists headshot_url text,
  add column if not exists headshot_storage_path text,
  add column if not exists headshot_public_url text;

update public.players p
set
  player_display_name = coalesce(p.player_display_name, pm.player_display_name),
  headshot_url = coalesce(p.headshot_url, pm.headshot_url),
  headshot_storage_path = coalesce(p.headshot_storage_path, pm.headshot_storage_path),
  headshot_public_url = coalesce(p.headshot_public_url, pm.headshot_public_url)
from public.player_master pm
where p.player_key = pm.player_id;

update public.player_week_stats
set
  opponent_team = coalesce(opponent_team, raw_stats ->> 'opponent_team'),
  raw_stats = coalesce(raw_stats, '{}'::jsonb) - 'fantasy_points' - 'fantasy_points_ppr'
where raw_stats ? 'fantasy_points'
  or raw_stats ? 'fantasy_points_ppr'
  or opponent_team is null;

alter table if exists public.weekly_player_stats
  drop column if exists fantasy_points,
  drop column if exists fantasy_points_ppr;

alter table public.player_season_stats
  add column if not exists total_points numeric not null default 0,
  add column if not exists avg_points numeric not null default 0,
  add column if not exists high_score numeric not null default 0,
  add column if not exists low_score numeric not null default 0,
  add column if not exists weeks_played integer not null default 0;

create index if not exists idx_player_season_stats_player_year
on public.player_season_stats (player_id, season_year);

create or replace function public.derive_player_week_fantasy_points(
  stats jsonb,
  player_position text,
  rules jsonb,
  fallback numeric default 0
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when upper(coalesce(player_position, '')) = 'K' then
      (public.player_stat_number(stats, 'fg_made_0_19') +
        public.player_stat_number(stats, 'fg_made_20_29') +
        public.player_stat_number(stats, 'fg_made_30_39')) * public.scoring_rule_number(rules, 'KICKER', 'fg_0_39', 3) +
      public.player_stat_number(stats, 'fg_made_40_49') * public.scoring_rule_number(rules, 'KICKER', 'fg_40_49', 4) +
      (public.player_stat_number(stats, 'fg_made_50_59') +
        public.player_stat_number(stats, 'fg_made_60_')) * public.scoring_rule_number(rules, 'KICKER', 'fg_50_plus', 5) +
      public.player_stat_number(stats, 'pat_made') * public.scoring_rule_number(rules, 'KICKER', 'xp_made', 1) +
      public.player_stat_number(stats, 'fg_missed') * public.scoring_rule_number(rules, 'KICKER', 'fg_miss', -1) +
      public.player_stat_number(stats, 'pat_missed') * public.scoring_rule_number(rules, 'KICKER', 'xp_miss', -1)
    when upper(coalesce(player_position, '')) = 'DEF' then
      public.player_stat_number(stats, 'def_tackles_solo') * public.scoring_rule_number(rules, 'DEFENSE', 'solo_tackle', 1.5) +
      public.player_stat_number(stats, 'def_tackle_assists') * public.scoring_rule_number(rules, 'DEFENSE', 'assist_tackle', 0.75) +
      public.player_stat_number(stats, 'def_tackles_for_loss') * public.scoring_rule_number(rules, 'DEFENSE', 'tackle_for_loss', 1) +
      public.player_stat_number(stats, 'def_sacks') * public.scoring_rule_number(rules, 'DEFENSE', 'sack', 3) +
      public.player_stat_number(stats, 'def_qb_hits') * public.scoring_rule_number(rules, 'DEFENSE', 'qb_hit', 0.5) +
      public.player_stat_number(stats, 'def_interceptions') * public.scoring_rule_number(rules, 'DEFENSE', 'interception', 4) +
      public.player_stat_number(stats, 'def_pass_defended') * public.scoring_rule_number(rules, 'DEFENSE', 'pass_defended', 1) +
      public.player_stat_number(stats, 'def_fumbles_forced') * public.scoring_rule_number(rules, 'DEFENSE', 'fumble_forced', 2) +
      (public.player_stat_number(stats, 'fumble_recovery_own') +
        public.player_stat_number(stats, 'fumble_recovery_opp')) * public.scoring_rule_number(rules, 'DEFENSE', 'fumble_recovered', 2) +
      public.player_stat_number(stats, 'def_safeties') * public.scoring_rule_number(rules, 'DEFENSE', 'safety', 2) +
      (public.player_stat_number(stats, 'def_tds') +
        public.player_stat_number(stats, 'fumble_recovery_tds') +
        public.player_stat_number(stats, 'special_teams_tds')) * public.scoring_rule_number(rules, 'DEFENSE', 'touchdown', 6)
    else
      public.player_stat_number(stats, 'completions') * public.scoring_rule_number(rules, 'OFFENSE', 'completion', 0.2) +
      greatest(public.player_stat_number(stats, 'attempts') - public.player_stat_number(stats, 'completions'), 0) * public.scoring_rule_number(rules, 'OFFENSE', 'incompletion', -0.3) +
      public.player_stat_number(stats, 'passing_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_yard', 0.04) +
      public.player_stat_number(stats, 'passing_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_td', 4) +
      public.player_stat_number(stats, 'passing_interceptions') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_int', -2) +
      public.player_stat_number(stats, 'passing_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_first_down', 0.5) +
      public.player_stat_number(stats, 'rushing_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_yard', 0.1) +
      public.player_stat_number(stats, 'rushing_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_td', 6) +
      public.player_stat_number(stats, 'rushing_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_first_down', 0.5) +
      public.player_stat_number(stats, 'receptions') * public.scoring_rule_number(rules, 'OFFENSE', 'reception', 1) +
      public.player_stat_number(stats, 'receiving_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_yard', 0.1) +
      public.player_stat_number(stats, 'receiving_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_td', 6) +
      public.player_stat_number(stats, 'receiving_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_first_down', 0.5) +
      (public.player_stat_number(stats, 'rushing_fumbles') +
        public.player_stat_number(stats, 'receiving_fumbles')) * public.scoring_rule_number(rules, 'OFFENSE', 'fumble', -1) +
      (public.player_stat_number(stats, 'rushing_fumbles_lost') +
        public.player_stat_number(stats, 'receiving_fumbles_lost')) * public.scoring_rule_number(rules, 'OFFENSE', 'fumble_lost', -2) +
      public.player_stat_number(stats, 'fumble_recovery_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_td', 6) +
      (public.player_stat_number(stats, 'passing_2pt_conversions') +
        public.player_stat_number(stats, 'rushing_2pt_conversions') +
        public.player_stat_number(stats, 'receiving_2pt_conversions')) * public.scoring_rule_number(rules, 'OFFENSE', 'two_pt_conversion', 2) +
      case
        when public.player_stat_number(stats, 'rushing_yards') + public.player_stat_number(stats, 'receiving_yards') >= 100
        then public.scoring_rule_number(rules, 'OFFENSE', 'bonus_100_rush_rec_yards', 3)
        else 0
      end +
      case
        when public.player_stat_number(stats, 'passing_yards') >= 300
        then public.scoring_rule_number(rules, 'OFFENSE', 'bonus_300_pass_yards', 3)
        else 0
      end
  end;
$$;

create or replace function public.refresh_player_season_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_season_stats (
    player_id,
    season_year,
    totals,
    total_points,
    avg_points,
    high_score,
    low_score,
    weeks_played,
    updated_date
  )
  select
    pws.player_id,
    pws.season_year,
    '{}'::jsonb,
    sum(pws.fantasy_points),
    avg(pws.fantasy_points),
    max(pws.fantasy_points),
    min(pws.fantasy_points),
    count(*)::integer,
    now()
  from public.player_week_stats pws
  group by pws.player_id, pws.season_year
  on conflict (player_id, season_year) do update
  set
    totals = excluded.totals,
    total_points = excluded.total_points,
    avg_points = excluded.avg_points,
    high_score = excluded.high_score,
    low_score = excluded.low_score,
    weeks_played = excluded.weeks_played,
    updated_date = now();
end;
$$;

create or replace function public.refresh_player_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with aggregates as (
    select
      player_id,
      array_agg(distinct season_year order by season_year) as active_years,
      max(season_year) as source_season_year,
      avg(fantasy_points) as avg_points,
      max(fantasy_points) as high_score,
      min(fantasy_points) as low_score,
      sum(fantasy_points) as total_points
    from public.player_week_stats
    group by player_id
  )
  update public.players
  set
    active_years = aggregates.active_years,
    source_season_year = aggregates.source_season_year,
    avg_points = aggregates.avg_points,
    high_score = aggregates.high_score,
    low_score = aggregates.low_score,
    total_points = aggregates.total_points
  from aggregates
  where players.id = aggregates.player_id;

  perform public.refresh_player_season_stats();
  perform public.refresh_player_position_year_counts();
end;
$$;

create or replace function public.recompute_player_week_fantasy_points_chunk(
  p_season_year integer default null,
  p_week integer default null,
  p_refresh_aggregates boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.season_scoring_rules (season_year, rules)
  select distinct pws.season_year, public.default_scoring_rules()
  from public.player_week_stats pws
  where pws.season_year is not null
    and (p_season_year is null or pws.season_year = p_season_year)
    and (p_week is null or pws.week = p_week)
  on conflict (season_year) do nothing;

  update public.player_week_stats pws
  set
    fantasy_points = public.derive_player_week_fantasy_points(
      coalesce(pws.raw_stats, '{}'::jsonb) - 'fantasy_points' - 'fantasy_points_ppr',
      players.position,
      public.season_rules_for_year(pws.season_year),
      pws.fantasy_points
    ),
    raw_stats = coalesce(pws.raw_stats, '{}'::jsonb) - 'fantasy_points' - 'fantasy_points_ppr'
  from public.players
  where players.id = pws.player_id
    and (p_season_year is null or pws.season_year = p_season_year)
    and (p_week is null or pws.week = p_week);

  if p_refresh_aggregates then
    perform public.refresh_player_aggregates();
  end if;
end;
$$;

create or replace function public.recompute_player_week_fantasy_points(p_season_year integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_player_week_fantasy_points_chunk(p_season_year, null, true);
end;
$$;

grant execute on function public.refresh_player_season_stats() to authenticated;
grant execute on function public.refresh_player_aggregates() to authenticated;
grant execute on function public.recompute_player_week_fantasy_points_chunk(integer, integer, boolean) to authenticated;
grant execute on function public.recompute_player_week_fantasy_points(integer) to authenticated;

drop function if exists public.recompute_player_week_fantasy_points();
drop table if exists public.weekly_player_stats;
drop table if exists public.player_master;

select public.refresh_player_aggregates();
