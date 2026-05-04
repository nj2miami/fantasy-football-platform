create table if not exists public.league_player_scores (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  source_season_year integer not null,
  position text not null,
  position_rank integer not null,
  tier_value integer not null check (tier_value between 1 and 5),
  expected_avg_points numeric not null default 0,
  total_points numeric not null default 0,
  weeks_played integer not null default 0,
  scoring_rules_hash text,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, player_id)
);

drop function if exists public.refresh_player_position_tiers(integer);
drop table if exists public.player_position_tiers;

create index if not exists idx_league_player_scores_league_position_rank
on public.league_player_scores (league_id, position, position_rank);

drop view if exists public.league_player_draft_tiers;
create view public.league_player_draft_tiers
as
select
  league_id,
  player_id,
  source_season_year,
  position,
  position_rank,
  tier_value
from public.league_player_scores
where position_rank <= 30
  and (
    public.is_league_member(league_id)
    or public.is_commissioner(league_id)
    or public.is_admin()
  );

drop trigger if exists set_league_player_scores_updated_date on public.league_player_scores;
create trigger set_league_player_scores_updated_date
  before update on public.league_player_scores
  for each row execute function public.set_updated_date();

alter table public.league_player_scores enable row level security;

drop policy if exists "league player scores service only" on public.league_player_scores;
create policy "league player scores service only"
on public.league_player_scores for all
to service_role
using (true)
with check (true);

grant select on public.league_player_draft_tiers to authenticated;

notify pgrst, 'reload schema';
