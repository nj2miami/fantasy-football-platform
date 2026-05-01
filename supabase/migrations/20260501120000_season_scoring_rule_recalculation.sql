create table if not exists public.season_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null unique,
  rules jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

drop trigger if exists set_season_scoring_rules_updated_date on public.season_scoring_rules;
create trigger set_season_scoring_rules_updated_date
  before update on public.season_scoring_rules
  for each row execute function public.set_updated_date();

alter table public.season_scoring_rules enable row level security;

drop policy if exists "season scoring rules are public" on public.season_scoring_rules;
create policy "season scoring rules are public"
on public.season_scoring_rules for select
to anon, authenticated
using (true);

drop policy if exists "admins manage season scoring rules" on public.season_scoring_rules;
create policy "admins manage season scoring rules"
on public.season_scoring_rules for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.default_scoring_rules()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select value from public.global_settings where key = 'SCORING_RULES' limit 1),
    '{
      "OFFENSE": {
        "passing_yard": 0.04,
        "passing_td": 4,
        "passing_int": -2,
        "passing_first_down": 0.5,
        "rushing_yard": 0.1,
        "rushing_td": 6,
        "rushing_first_down": 0.5,
        "fumble": -1,
        "fumble_lost": -2,
        "reception": 1,
        "receiving_yard": 0.1,
        "receiving_td": 6,
        "receiving_first_down": 0.5,
        "two_pt_conversion": 2,
        "bonus_100_rush_rec_yards": 3,
        "bonus_300_pass_yards": 3
      },
      "KICKER": {
        "fg_0_39": 3,
        "fg_40_49": 4,
        "fg_50_plus": 5,
        "fg_miss": -1,
        "xp_made": 1,
        "xp_miss": -1
      },
      "DEFENSE": {
        "solo_tackle": 1.5,
        "assist_tackle": 0.75,
        "tackle_for_loss": 1,
        "sack": 3,
        "qb_hit": 0.5,
        "interception": 4,
        "pass_defended": 1,
        "fumble_forced": 2,
        "fumble_recovered": 2,
        "touchdown": 6,
        "safety": 2
      }
    }'::jsonb
  );
$$;

insert into public.season_scoring_rules (season_year, rules)
select distinct pws.season_year, public.default_scoring_rules()
from public.player_week_stats pws
where pws.season_year is not null
on conflict (season_year) do nothing;

insert into public.season_scoring_rules (season_year, rules)
select distinct wps.season, public.default_scoring_rules()
from public.weekly_player_stats wps
where wps.season is not null
on conflict (season_year) do nothing;

create or replace function public.scoring_rule_number(
  rules jsonb,
  category text,
  rule_key text,
  fallback numeric default 0
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(rules #>> array[category, rule_key], '')::numeric, fallback, 0);
$$;

create or replace function public.derive_player_week_fantasy_points(
  stats jsonb,
  player_position text,
  rules jsonb,
  fallback numeric default 0
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when upper(coalesce(player_position, '')) = 'K' then
      (public.player_stat_number(stats, 'fg_made_0_19') +
        public.player_stat_number(stats, 'fg_made_20_29') +
        public.player_stat_number(stats, 'fg_made_30_39')) * public.scoring_rule_number(rules, 'KICKER', 'fg_0_39', 3) +
      public.player_stat_number(stats, 'fg_made_40_49') * public.scoring_rule_number(rules, 'KICKER', 'fg_40_49', 4) +
      (public.player_stat_number(stats, 'fg_made_50_59') +
        public.player_stat_number(stats, 'fg_made_60_')) * public.scoring_rule_number(rules, 'KICKER', 'fg_50_plus', 5) +
      public.player_stat_number(stats, 'pat_made') * public.scoring_rule_number(rules, 'KICKER', 'xp_made', 1) +
      public.player_stat_number(stats, 'fg_missed') * public.scoring_rule_number(rules, 'KICKER', 'fg_miss', -1) +
      public.player_stat_number(stats, 'pat_missed') * public.scoring_rule_number(rules, 'KICKER', 'xp_miss', -1)
    when upper(coalesce(player_position, '')) = 'DEF' then
      public.player_stat_number(stats, 'def_tackles_solo') * public.scoring_rule_number(rules, 'DEFENSE', 'solo_tackle', 1.5) +
      public.player_stat_number(stats, 'def_tackle_assists') * public.scoring_rule_number(rules, 'DEFENSE', 'assist_tackle', 0.75) +
      public.player_stat_number(stats, 'def_tackles_for_loss') * public.scoring_rule_number(rules, 'DEFENSE', 'tackle_for_loss', 1) +
      public.player_stat_number(stats, 'def_sacks') * public.scoring_rule_number(rules, 'DEFENSE', 'sack', 3) +
      public.player_stat_number(stats, 'def_qb_hits') * public.scoring_rule_number(rules, 'DEFENSE', 'qb_hit', 0.5) +
      public.player_stat_number(stats, 'def_interceptions') * public.scoring_rule_number(rules, 'DEFENSE', 'interception', 4) +
      public.player_stat_number(stats, 'def_pass_defended') * public.scoring_rule_number(rules, 'DEFENSE', 'pass_defended', 1) +
      public.player_stat_number(stats, 'def_fumbles_forced') * public.scoring_rule_number(rules, 'DEFENSE', 'fumble_forced', 2) +
      (public.player_stat_number(stats, 'fumble_recovery_own') +
        public.player_stat_number(stats, 'fumble_recovery_opp')) * public.scoring_rule_number(rules, 'DEFENSE', 'fumble_recovered', 2) +
      public.player_stat_number(stats, 'def_safeties') * public.scoring_rule_number(rules, 'DEFENSE', 'safety', 2) +
      (public.player_stat_number(stats, 'def_tds') +
        public.player_stat_number(stats, 'fumble_recovery_tds') +
        public.player_stat_number(stats, 'special_teams_tds')) * public.scoring_rule_number(rules, 'DEFENSE', 'touchdown', 6)
    else
      public.player_stat_number(stats, 'passing_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_yard', 0.04) +
      public.player_stat_number(stats, 'passing_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_td', 4) +
      public.player_stat_number(stats, 'passing_interceptions') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_int', -2) +
      public.player_stat_number(stats, 'passing_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_first_down', 0.5) +
      public.player_stat_number(stats, 'rushing_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_yard', 0.1) +
      public.player_stat_number(stats, 'rushing_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_td', 6) +
      public.player_stat_number(stats, 'rushing_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'rushing_first_down', 0.5) +
      public.player_stat_number(stats, 'receptions') * public.scoring_rule_number(rules, 'OFFENSE', 'reception', 1) +
      public.player_stat_number(stats, 'receiving_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_yard', 0.1) +
      public.player_stat_number(stats, 'receiving_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_td', 6) +
      public.player_stat_number(stats, 'receiving_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_first_down', 0.5) +
      (public.player_stat_number(stats, 'rushing_fumbles') +
        public.player_stat_number(stats, 'receiving_fumbles')) * public.scoring_rule_number(rules, 'OFFENSE', 'fumble', -1) +
      (public.player_stat_number(stats, 'rushing_fumbles_lost') +
        public.player_stat_number(stats, 'receiving_fumbles_lost')) * public.scoring_rule_number(rules, 'OFFENSE', 'fumble_lost', -2) +
      (public.player_stat_number(stats, 'passing_2pt_conversions') +
        public.player_stat_number(stats, 'rushing_2pt_conversions') +
        public.player_stat_number(stats, 'receiving_2pt_conversions')) * public.scoring_rule_number(rules, 'OFFENSE', 'two_pt_conversion', 2) +
      case
        when public.player_stat_number(stats, 'rushing_yards') + public.player_stat_number(stats, 'receiving_yards') >= 100
        then public.scoring_rule_number(rules, 'OFFENSE', 'bonus_100_rush_rec_yards', 3)
        else 0
      end +
      case
        when public.player_stat_number(stats, 'passing_yards') >= 300
        then public.scoring_rule_number(rules, 'OFFENSE', 'bonus_300_pass_yards', 3)
        else 0
      end
  end;
$$;

create or replace function public.season_rules_for_year(p_season_year integer)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select rules from public.season_scoring_rules where season_year = p_season_year limit 1),
    public.default_scoring_rules()
  );
$$;

drop function if exists public.recompute_player_week_fantasy_points();

create or replace function public.recompute_player_week_fantasy_points(p_season_year integer default null)
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
  on conflict (season_year) do nothing;

  insert into public.season_scoring_rules (season_year, rules)
  select distinct wps.season, public.default_scoring_rules()
  from public.weekly_player_stats wps
  where wps.season is not null
    and (p_season_year is null or wps.season = p_season_year)
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
    and (p_season_year is null or pws.season_year = p_season_year);

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
  where p_season_year is null or wps.season = p_season_year;

  perform public.refresh_player_aggregates();
end;
$$;

grant execute on function public.default_scoring_rules() to anon, authenticated;
grant execute on function public.scoring_rule_number(jsonb, text, text, numeric) to anon, authenticated;
grant execute on function public.derive_player_week_fantasy_points(jsonb, text, jsonb, numeric) to anon, authenticated;
grant execute on function public.season_rules_for_year(integer) to anon, authenticated;
grant execute on function public.recompute_player_week_fantasy_points(integer) to authenticated;
