alter table public.league_player_scores
  add column if not exists traits jsonb not null default '[]'::jsonb,
  add column if not exists trait_effects jsonb not null default '{}'::jsonb,
  add column if not exists trait_assignment_version text;

alter table public.league_player_scores
  drop constraint if exists league_player_scores_traits_array,
  add constraint league_player_scores_traits_array
    check (jsonb_typeof(traits) = 'array');

alter table public.league_player_scores
  drop constraint if exists league_player_scores_trait_effects_object,
  add constraint league_player_scores_trait_effects_object
    check (jsonb_typeof(trait_effects) = 'object');

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
  scoring_rules_hash,
  traits,
  trait_effects,
  trait_assignment_version
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

notify pgrst, 'reload schema';
