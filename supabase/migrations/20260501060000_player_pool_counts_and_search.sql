create table if not exists public.player_position_year_counts (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null,
  position text not null,
  total_players integer not null default 0,
  players_with_stats integer not null default 0,
  stat_weeks integer not null default 0,
  updated_date timestamptz not null default now(),
  unique (season_year, position)
);

create index if not exists idx_player_position_year_counts_year_position
on public.player_position_year_counts (season_year desc, position);

create index if not exists idx_player_week_stats_year_player
on public.player_week_stats (season_year, player_id);

create index if not exists idx_players_position_total_points
on public.players (position, total_points desc);

alter table public.player_position_year_counts enable row level security;

drop policy if exists "player position year counts are public" on public.player_position_year_counts;
create policy "player position year counts are public"
on public.player_position_year_counts for select
to anon, authenticated
using (true);

drop policy if exists "admins manage player position year counts" on public.player_position_year_counts;
create policy "admins manage player position year counts"
on public.player_position_year_counts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.refresh_player_position_year_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.player_position_year_counts;

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

create or replace function public.recompute_player_week_fantasy_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_week_stats pws
  set fantasy_points = public.derive_player_week_fantasy_points(
    pws.raw_stats,
    players.position,
    pws.fantasy_points
  )
  from public.players
  where players.id = pws.player_id;

  update public.weekly_player_stats wps
  set fantasy_points = public.derive_player_week_fantasy_points(
    to_jsonb(wps),
    case
      when upper(coalesce(wps.position_group, '')) = 'SPEC' then 'K'
      when upper(coalesce(wps.position_group, '')) in ('DL', 'LB', 'DB', 'DEF') then 'DEF'
      when upper(coalesce(wps.position_group, '')) = 'QB' then 'QB'
      else 'OFF'
    end,
    wps.fantasy_points
  );
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

  perform public.refresh_player_position_year_counts();
end;
$$;

create or replace function public.search_player_pool(
  p_season_year integer default null,
  p_position text default null,
  p_search_term text default null,
  p_sort_by text default '-avg_points',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  player_key text,
  full_name text,
  player_display_name text,
  team text,
  "position" text,
  active_years integer[],
  source_season_year integer,
  avg_points numeric,
  high_score numeric,
  low_score numeric,
  total_points numeric,
  created_date timestamptz,
  updated_date timestamptz,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select p.*
    from public.players p
    where coalesce(p.total_points, 0) <> 0
      and (
        p_position is null
        or upper(p_position) = 'ALL'
        or upper(p.position) = upper(p_position)
      )
      and (
        nullif(trim(coalesce(p_search_term, '')), '') is null
        or lower(coalesce(p.player_display_name, p.full_name, '')) like '%' || lower(trim(p_search_term)) || '%'
        or lower(coalesce(p.full_name, '')) like '%' || lower(trim(p_search_term)) || '%'
      )
      and (
        p_season_year is null
        or exists (
          select 1
          from public.player_week_stats pws
          where pws.player_id = p.id
            and pws.season_year = p_season_year
        )
      )
  )
  select
    filtered.id,
    filtered.player_key,
    filtered.full_name,
    filtered.player_display_name,
    filtered.team,
    filtered.position as "position",
    filtered.active_years,
    filtered.source_season_year,
    filtered.avg_points,
    filtered.high_score,
    filtered.low_score,
    filtered.total_points,
    filtered.created_date,
    filtered.updated_date,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort_by = '-avg_points' then filtered.avg_points end desc nulls last,
    case when p_sort_by = 'avg_points' then filtered.avg_points end asc nulls last,
    case when p_sort_by = '-total_points' then filtered.total_points end desc nulls last,
    case when p_sort_by = 'total_points' then filtered.total_points end asc nulls last,
    case when p_sort_by = '-high_score' then filtered.high_score end desc nulls last,
    case when p_sort_by = 'high_score' then filtered.high_score end asc nulls last,
    case when p_sort_by = '-low_score' then filtered.low_score end desc nulls last,
    case when p_sort_by = 'low_score' then filtered.low_score end asc nulls last,
    lower(coalesce(filtered.player_display_name, filtered.full_name)),
    filtered.id
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.refresh_player_position_year_counts() to authenticated;
grant execute on function public.recompute_player_week_fantasy_points() to authenticated;
grant execute on function public.refresh_player_aggregates() to authenticated;
grant execute on function public.search_player_pool(integer, text, text, text, integer, integer) to anon, authenticated;

select public.refresh_player_position_year_counts();
