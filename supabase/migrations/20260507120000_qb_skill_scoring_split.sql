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
        "completion": 0.2,
        "incompletion": -0.3,
        "passing_yard": 0.04,
        "passing_td": 4,
        "passing_int": -2,
        "passing_first_down": 0.5,
        "qb_rushing_yard": 0.05,
        "qb_rushing_td": 4,
        "qb_rushing_first_down": 0.25,
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

create or replace function public.add_qb_skill_scoring_keys(rules jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(rules, '{}'::jsonb),
        '{OFFENSE,qb_rushing_yard}',
        coalesce(rules #> '{OFFENSE,qb_rushing_yard}', '0.05'::jsonb),
        true
      ),
      '{OFFENSE,qb_rushing_td}',
      coalesce(rules #> '{OFFENSE,qb_rushing_td}', '4'::jsonb),
      true
    ),
    '{OFFENSE,qb_rushing_first_down}',
    coalesce(rules #> '{OFFENSE,qb_rushing_first_down}', '0.25'::jsonb),
    true
  );
$$;

update public.global_settings
set value = public.add_qb_skill_scoring_keys(value),
    updated_date = now()
where key = 'SCORING_RULES'
  and jsonb_typeof(value -> 'OFFENSE') = 'object';

update public.site_settings
set value = public.add_qb_skill_scoring_keys(value),
    updated_date = now()
where key = 'SCORING_RULES'
  and jsonb_typeof(value -> 'OFFENSE') = 'object';

update public.season_scoring_rules
set rules = public.add_qb_skill_scoring_keys(rules),
    updated_date = now()
where jsonb_typeof(rules -> 'OFFENSE') = 'object';

update public.leagues
set scoring_rules = public.add_qb_skill_scoring_keys(scoring_rules),
    updated_date = now()
where jsonb_typeof(scoring_rules -> 'OFFENSE') = 'object';

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
      public.player_stat_number(stats, 'completions') * public.scoring_rule_number(rules, 'OFFENSE', 'completion', 0.2) +
      greatest(public.player_stat_number(stats, 'attempts') - public.player_stat_number(stats, 'completions'), 0) * public.scoring_rule_number(rules, 'OFFENSE', 'incompletion', -0.3) +
      public.player_stat_number(stats, 'passing_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_yard', 0.04) +
      public.player_stat_number(stats, 'passing_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_td', 4) +
      public.player_stat_number(stats, 'passing_interceptions') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_int', -2) +
      public.player_stat_number(stats, 'passing_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'passing_first_down', 0.5) +
      public.player_stat_number(stats, 'rushing_yards') *
        case when upper(coalesce(player_position, '')) = 'QB'
          then public.scoring_rule_number(rules, 'OFFENSE', 'qb_rushing_yard', 0.05)
          else public.scoring_rule_number(rules, 'OFFENSE', 'rushing_yard', 0.1)
        end +
      public.player_stat_number(stats, 'rushing_tds') *
        case when upper(coalesce(player_position, '')) = 'QB'
          then public.scoring_rule_number(rules, 'OFFENSE', 'qb_rushing_td', 4)
          else public.scoring_rule_number(rules, 'OFFENSE', 'rushing_td', 6)
        end +
      public.player_stat_number(stats, 'rushing_first_downs') *
        case when upper(coalesce(player_position, '')) = 'QB'
          then public.scoring_rule_number(rules, 'OFFENSE', 'qb_rushing_first_down', 0.25)
          else public.scoring_rule_number(rules, 'OFFENSE', 'rushing_first_down', 0.5)
        end +
      public.player_stat_number(stats, 'receptions') * public.scoring_rule_number(rules, 'OFFENSE', 'reception', 1) +
      public.player_stat_number(stats, 'receiving_yards') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_yard', 0.1) +
      public.player_stat_number(stats, 'receiving_tds') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_td', 6) +
      public.player_stat_number(stats, 'receiving_first_downs') * public.scoring_rule_number(rules, 'OFFENSE', 'receiving_first_down', 0.5) +
      (public.player_stat_number(stats, 'rushing_fumbles') +
        public.player_stat_number(stats, 'receiving_fumbles')) * public.scoring_rule_number(rules, 'OFFENSE', 'fumble', -1) +
      (public.player_stat_number(stats, 'rushing_fumbles_lost') +
        public.player_stat_number(stats, 'receiving_fumbles_lost')) * public.scoring_rule_number(rules, 'OFFENSE', 'fumble_lost', -2) +
      public.player_stat_number(stats, 'fumble_recovery_tds') *
        case when upper(coalesce(player_position, '')) = 'QB'
          then public.scoring_rule_number(rules, 'OFFENSE', 'qb_rushing_td', 4)
          else public.scoring_rule_number(rules, 'OFFENSE', 'rushing_td', 6)
        end +
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

drop function public.add_qb_skill_scoring_keys(jsonb);
