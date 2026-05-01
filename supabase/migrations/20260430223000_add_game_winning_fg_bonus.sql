create or replace function public.derive_player_week_fantasy_points(stats jsonb, player_position text, fallback numeric default 0)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when upper(coalesce(player_position, '')) = 'K' then
      public.player_stat_number(stats, 'fg_made_0_19') * 3 +
      public.player_stat_number(stats, 'fg_made_20_29') * 3 +
      public.player_stat_number(stats, 'fg_made_30_39') * 3 +
      public.player_stat_number(stats, 'fg_made_40_49') * 4 +
      public.player_stat_number(stats, 'fg_made_50_59') * 5 +
      public.player_stat_number(stats, 'fg_made_60_') * 6 +
      public.player_stat_number(stats, 'gwfg_made') * 3 +
      public.player_stat_number(stats, 'pat_made') -
      public.player_stat_number(stats, 'fg_missed') -
      public.player_stat_number(stats, 'pat_missed')
    when upper(coalesce(player_position, '')) = 'DEF' then
      public.player_stat_number(stats, 'def_tackles_solo') * 1 +
      public.player_stat_number(stats, 'def_tackle_assists') * 0.5 +
      public.player_stat_number(stats, 'def_tackles_for_loss') * 1 +
      public.player_stat_number(stats, 'def_sacks') * 4 +
      public.player_stat_number(stats, 'def_qb_hits') * 0.5 +
      public.player_stat_number(stats, 'def_interceptions') * 3 +
      public.player_stat_number(stats, 'def_pass_defended') * 1 +
      public.player_stat_number(stats, 'def_fumbles_forced') * 2 +
      (public.player_stat_number(stats, 'fumble_recovery_own') + public.player_stat_number(stats, 'fumble_recovery_opp')) * 2 +
      public.player_stat_number(stats, 'def_safeties') * 2 +
      (public.player_stat_number(stats, 'def_tds') + public.player_stat_number(stats, 'fumble_recovery_tds') + public.player_stat_number(stats, 'special_teams_tds')) * 6
    else
      coalesce(fallback, public.player_stat_number(stats, 'fantasy_points_ppr'), public.player_stat_number(stats, 'fantasy_points'), 0)
  end;
$$;

update public.player_week_stats pws
set fantasy_points = public.derive_player_week_fantasy_points(
  pws.raw_stats,
  players.position,
  pws.fantasy_points
)
from public.players
where players.id = pws.player_id
  and players.position = 'K';

update public.weekly_player_stats wps
set fantasy_points = public.derive_player_week_fantasy_points(to_jsonb(wps), 'K', wps.fantasy_points)
where upper(coalesce(wps.position_group, '')) = 'SPEC';

with aggregates as (
  select
    pws.player_id,
    avg(pws.fantasy_points) as avg_points,
    max(pws.fantasy_points) as high_score,
    min(pws.fantasy_points) as low_score,
    sum(pws.fantasy_points) as total_points
  from public.player_week_stats pws
  join public.players p on p.id = pws.player_id
  where p.position = 'K'
  group by pws.player_id
)
update public.players
set
  avg_points = aggregates.avg_points,
  high_score = aggregates.high_score,
  low_score = aggregates.low_score,
  total_points = aggregates.total_points
from aggregates
where players.id = aggregates.player_id;

