update public.global_settings
set
  value = '{
    "starters": {"QB": 1, "OFF": 1, "FLEX": 1, "K": 1, "DEF": 1},
    "draft_groups": {"QB": 2, "OFF": 2, "DEF": 2, "K": 1, "FLEX": 3},
    "position_limits": {"QB": 2, "OFF": 4, "K": 1, "DEF": 4},
    "bench": 5,
    "total_drafted": 10,
    "bench_scoring_multiplier": 0.5,
    "treatment_scoring_multiplier": 0.25
  }'::jsonb,
  description = 'Fixed roster rules for leagues.'
where key = 'ROSTER_RULES';

update public.leagues
set roster_rules = '{
  "starters": {"QB": 1, "OFF": 1, "FLEX": 1, "K": 1, "DEF": 1},
  "draft_groups": {"QB": 2, "OFF": 2, "DEF": 2, "K": 1, "FLEX": 3},
  "position_limits": {"QB": 2, "OFF": 4, "K": 1, "DEF": 4},
  "bench": 5,
  "total_drafted": 10,
  "bench_scoring_multiplier": 0.5,
  "treatment_scoring_multiplier": 0.25
}'::jsonb;

notify pgrst, 'reload schema';
