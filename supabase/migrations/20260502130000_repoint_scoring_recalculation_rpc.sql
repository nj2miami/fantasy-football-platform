drop function if exists public.recompute_player_week_fantasy_points();
drop function if exists public.recompute_player_week_fantasy_points(integer);
drop function if exists public.recompute_player_week_fantasy_points_chunk(integer, integer, boolean);

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

grant execute on function public.refresh_player_aggregates() to authenticated;
grant execute on function public.recompute_player_week_fantasy_points_chunk(integer, integer, boolean) to authenticated;
grant execute on function public.recompute_player_week_fantasy_points(integer) to authenticated;

notify pgrst, 'reload schema';
