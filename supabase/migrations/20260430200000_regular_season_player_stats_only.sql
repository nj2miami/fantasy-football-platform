delete from public.weekly_player_stats
where season_type is distinct from 'REG';

delete from public.player_week_stats
where raw_stats ->> 'season_type' is distinct from 'REG';

alter table public.weekly_player_stats
  drop constraint if exists weekly_player_stats_season_type_check;

alter table public.weekly_player_stats
  add constraint weekly_player_stats_season_type_check check (season_type = 'REG');

