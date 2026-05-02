insert into public.global_settings (key, value, description)
values (
  'SCORING_RULES',
  '{
    "OFFENSE": {
      "completion": 0.2,
      "incompletion": -0.3,
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
  }'::jsonb,
  'Default scoring rules for all fantasy matchups.'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_date = now()
where jsonb_typeof(public.global_settings.value -> 'OFFENSE') is distinct from 'object';

insert into public.site_settings (key, value, description)
values (
  'SCORING_RULES',
  '{
    "OFFENSE": {
      "completion": 0.2,
      "incompletion": -0.3,
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
  }'::jsonb,
  'Default site scoring rules.'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_date = now()
where jsonb_typeof(public.site_settings.value -> 'OFFENSE') is distinct from 'object';
