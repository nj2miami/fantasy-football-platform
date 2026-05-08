alter table public.leagues
  add column if not exists player_retention_limit integer;

update public.leagues
set player_retention_mode = 'limited_use',
    player_retention_limit = coalesce(player_retention_limit, 2)
where player_retention_mode = 'two_use_release';

update public.leagues
set player_retention_limit = null
where player_retention_mode = 'retained' or draft_mode = 'weekly_redraft';

update public.leagues
set player_retention_mode = 'retained',
    player_retention_limit = null
where draft_mode = 'weekly_redraft';

alter table public.leagues
  drop constraint if exists leagues_player_retention_mode_check,
  drop constraint if exists leagues_player_retention_limit_check;

alter table public.leagues
  add constraint leagues_player_retention_mode_check check (player_retention_mode in ('retained', 'limited_use')),
  add constraint leagues_player_retention_limit_check check (
    (draft_mode = 'season_snake' and player_retention_mode = 'limited_use' and player_retention_limit is not null and player_retention_limit >= 1)
    or (player_retention_mode = 'retained')
  );
