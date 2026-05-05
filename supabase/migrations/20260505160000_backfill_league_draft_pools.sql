with default_position_config as (
  select *
  from jsonb_to_recordset(
    '[
        {"position":"QB","group":"QB","enabled":true},
        {"position":"OFF","group":"OFFENSE","enabled":true},
        {"position":"RB","group":"OFFENSE","enabled":true},
        {"position":"FB","group":"OFFENSE","enabled":true},
        {"position":"WR","group":"OFFENSE","enabled":true},
        {"position":"TE","group":"OFFENSE","enabled":true},
        {"position":"K","group":"K","enabled":true},
        {"position":"DEF","group":"DEFENSE","enabled":true},
        {"position":"DST","group":"DEFENSE","enabled":true},
        {"position":"D/ST","group":"DEFENSE","enabled":true},
        {"position":"DL","group":"DEFENSE","enabled":true},
        {"position":"DE","group":"DEFENSE","enabled":true},
        {"position":"DT","group":"DEFENSE","enabled":true},
        {"position":"NT","group":"DEFENSE","enabled":true},
        {"position":"LB","group":"DEFENSE","enabled":true},
        {"position":"ILB","group":"DEFENSE","enabled":true},
        {"position":"MLB","group":"DEFENSE","enabled":true},
        {"position":"OLB","group":"DEFENSE","enabled":true},
        {"position":"DB","group":"DEFENSE","enabled":true},
        {"position":"CB","group":"DEFENSE","enabled":true},
        {"position":"S","group":"DEFENSE","enabled":true},
        {"position":"SAF","group":"DEFENSE","enabled":true},
        {"position":"FS","group":"DEFENSE","enabled":true}
      ]'::jsonb
  ) as config(position text, "group" text, enabled boolean)
),
saved_position_config as (
  select *
  from jsonb_to_recordset(
    coalesce((select value from public.global_settings where key = 'POSITION_CONFIG'), '[]'::jsonb)
  ) as config(position text, "group" text, enabled boolean)
),
position_config as (
  select distinct on (upper(position)) position, "group", enabled
  from (
    select position, "group", enabled, 0 as priority from saved_position_config
    union all
    select position, "group", enabled, 1 as priority from default_position_config
  ) merged
  order by upper(position), priority
),
ranked_players as (
  select
    l.id as league_id,
    p.id as player_id,
    p.source_season_year,
    case
      when upper(p.position) = 'QB' then 'QB'
      when upper(p.position) = 'K' then 'K'
      when upper(p.position) = 'OFF' then 'OFF'
      when upper(p.position) in ('DEF', 'DST', 'D/ST') then 'DEF'
      when upper(pc."group") = 'DEFENSE' then 'DEF'
      when upper(pc."group") = 'OFFENSE' then 'OFF'
      else null
    end as draft_position,
    coalesce(p.avg_points, 0) as expected_avg_points,
    coalesce(p.total_points, 0) as total_points,
    row_number() over (
      partition by l.id,
        case
          when upper(p.position) = 'QB' then 'QB'
          when upper(p.position) = 'K' then 'K'
          when upper(p.position) = 'OFF' then 'OFF'
          when upper(p.position) in ('DEF', 'DST', 'D/ST') then 'DEF'
          when upper(pc."group") = 'DEFENSE' then 'DEF'
          when upper(pc."group") = 'OFFENSE' then 'OFF'
          else null
        end
      order by coalesce(p.total_points, 0) desc, coalesce(p.avg_points, 0) desc, p.full_name asc
    ) as position_rank
  from public.leagues l
  join public.players p
    on p.source_season_year = l.source_season_year
  join position_config pc
    on upper(pc.position) = upper(p.position)
  where l.archived_at is null
    and pc.enabled is not false
    and not exists (
      select 1
      from public.league_player_scores existing
      where existing.league_id = l.id
    )
)
insert into public.league_player_scores (
  league_id,
  player_id,
  source_season_year,
  position,
  position_rank,
  tier_value,
  expected_avg_points,
  total_points,
  weeks_played,
  scoring_rules_hash
)
select
  league_id,
  player_id,
  source_season_year,
  draft_position,
  position_rank,
  case
    when position_rank <= 6 then 5
    when position_rank <= 12 then 4
    when position_rank <= 18 then 3
    when position_rank <= 24 then 2
    else 1
  end,
  expected_avg_points,
  total_points,
  0,
  'fallback-player-aggregates'
from ranked_players
where draft_position is not null
  and position_rank <= 30
on conflict (league_id, player_id) do nothing;

with durability_seed as (
  select
    scores.league_id,
    scores.player_id,
    floor(random() * 4)::integer as durability
  from public.league_player_scores scores
  where not exists (
    select 1
    from public.league_player_durability durability
    where durability.league_id = scores.league_id
      and durability.player_id = scores.player_id
  )
)
insert into public.league_player_durability (
  league_id,
  player_id,
  durability,
  initial_durability,
  revealed_at
)
select
  durability_seed.league_id,
  durability_seed.player_id,
  durability_seed.durability,
  durability_seed.durability,
  now()
from durability_seed
on conflict (league_id, player_id) do nothing;
