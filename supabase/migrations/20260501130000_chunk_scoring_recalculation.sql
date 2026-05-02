create index if not exists idx_player_week_stats_season_week
on public.player_week_stats (season_year, week);

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

  insert into public.season_scoring_rules (season_year, rules)
  select distinct wps.season, public.default_scoring_rules()
  from public.weekly_player_stats wps
  where wps.season is not null
    and (p_season_year is null or wps.season = p_season_year)
    and (p_week is null or wps.week = p_week)
  on conflict (season_year) do nothing;

  update public.player_week_stats pws
  set fantasy_points = public.derive_player_week_fantasy_points(
    pws.raw_stats,
    players.position,
    public.season_rules_for_year(pws.season_year),
    pws.fantasy_points
  )
  from public.players
  where players.id = pws.player_id
    and (p_season_year is null or pws.season_year = p_season_year)
    and (p_week is null or pws.week = p_week);

  update public.weekly_player_stats wps
  set fantasy_points = public.derive_player_week_fantasy_points(
    to_jsonb(wps),
    case
      when upper(coalesce(wps.position_group, '')) = 'SPEC' then 'K'
      when upper(coalesce(wps.position_group, '')) in ('DL', 'LB', 'DB', 'DEF') then 'DEF'
      when upper(coalesce(wps.position_group, '')) = 'QB' then 'QB'
      else 'OFF'
    end,
    public.season_rules_for_year(wps.season),
    wps.fantasy_points
  )
  where (p_season_year is null or wps.season = p_season_year)
    and (p_week is null or wps.week = p_week);

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

grant execute on function public.recompute_player_week_fantasy_points_chunk(integer, integer, boolean) to authenticated;
grant execute on function public.recompute_player_week_fantasy_points(integer) to authenticated;
