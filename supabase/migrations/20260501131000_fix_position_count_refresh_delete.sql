create or replace function public.refresh_player_position_year_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.player_position_year_counts
  where id is not null;

  insert into public.player_position_year_counts (
    season_year,
    position,
    total_players,
    players_with_stats,
    stat_weeks,
    updated_date
  )
  with player_years as (
    select
      pws.season_year,
      upper(coalesce(p.position, 'OFF')) as position,
      p.id as player_id,
      count(*) filter (where coalesce(pws.fantasy_points, 0) <> 0) as stat_weeks
    from public.player_week_stats pws
    join public.players p on p.id = pws.player_id
    group by pws.season_year, upper(coalesce(p.position, 'OFF')), p.id
  )
  select
    season_year,
    position,
    count(*)::integer as total_players,
    count(*) filter (where stat_weeks > 0)::integer as players_with_stats,
    coalesce(sum(stat_weeks), 0)::integer as stat_weeks,
    now()
  from player_years
  group by season_year, position;
end;
$$;

grant execute on function public.refresh_player_position_year_counts() to authenticated;
