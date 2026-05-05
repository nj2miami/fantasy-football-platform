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
  weeks_played
from public.league_player_scores
where position_rank <= 30
  and (
    public.is_league_member(league_id)
    or public.is_commissioner(league_id)
    or public.is_admin()
  );

grant select on public.league_player_draft_tiers to authenticated;

notify pgrst, 'reload schema';
