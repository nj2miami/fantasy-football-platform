drop view if exists public.league_player_draft_tiers;
create view public.league_player_draft_tiers
as
select
  league_id,
  player_id,
  source_season_year,
  position,
  position_rank,
  tier_value,
  weeks_played,
  scoring_rules_hash
from public.league_player_scores
where (
    (position in ('QB', 'OFF', 'DEF') and position_rank <= 36)
    or (position = 'K' and position_rank <= 20)
  )
  and (
    public.is_league_member(league_id)
    or public.is_commissioner(league_id)
    or public.is_admin()
  );

grant select on public.league_player_draft_tiers to authenticated;

drop view if exists public.league_player_tier_ranges;
create view public.league_player_tier_ranges
as
select
  league_id,
  position,
  tier_value,
  min(expected_avg_points) as expected_avg_points_min,
  max(expected_avg_points) as expected_avg_points_max,
  min(total_points) as total_points_min,
  max(total_points) as total_points_max,
  count(*)::integer as player_count
from public.league_player_scores
where (
    (position in ('QB', 'OFF', 'DEF') and position_rank <= 36)
    or (position = 'K' and position_rank <= 20)
  )
  and (
    public.is_league_member(league_id)
    or public.is_commissioner(league_id)
    or public.is_admin()
  )
group by league_id, position, tier_value;

grant select on public.league_player_tier_ranges to authenticated;

notify pgrst, 'reload schema';
