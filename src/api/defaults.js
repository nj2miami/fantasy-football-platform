export const DEFAULT_SCORING_RULES = {
  OFFENSE: {
    completion: 0.2,
    incompletion: -0.3,
    passing_yard: 0.04,
    passing_td: 4,
    passing_int: -2,
    passing_first_down: 0.5,
    rushing_yard: 0.1,
    rushing_td: 6,
    rushing_first_down: 0.5,
    fumble: -1,
    fumble_lost: -2,
    reception: 1,
    receiving_yard: 0.1,
    receiving_td: 6,
    receiving_first_down: 0.5,
    two_pt_conversion: 2,
    bonus_100_rush_rec_yards: 3,
    bonus_300_pass_yards: 3,
  },
  KICKER: {
    fg_0_39: 3,
    fg_40_49: 4,
    fg_50_plus: 5,
    fg_miss: -1,
    xp_made: 1,
    xp_miss: -1,
  },
  DEFENSE: {
    solo_tackle: 1.5,
    assist_tackle: 0.75,
    tackle_for_loss: 1,
    sack: 3,
    qb_hit: 0.5,
    interception: 4,
    pass_defended: 1,
    fumble_forced: 2,
    fumble_recovered: 2,
    touchdown: 6,
    safety: 2,
  },
};

export const DEFAULT_ROSTER_RULES = {
  starters: { QB: 1, OFF: 1, FLEX: 1, K: 1, DEF: 1 },
  draft_groups: { QB: 2, OFF: 2, DEF: 2, K: 1, FLEX: 3 },
  position_limits: { QB: 2, OFF: 4, K: 1, DEF: 4 },
  bench: 5,
  total_drafted: 10,
  bench_scoring_multiplier: 0.5,
  treatment_scoring_multiplier: 0.25,
};

export const DEFAULT_DRAFT_CONFIG = {
  type: "snake",
  rounds: 10,
  timer_seconds: 60,
};

export const DEFAULT_TEAM_TIER_CAP = 25;
export const DEFAULT_MANAGER_POINTS_STARTING = 0;

export const DEFAULT_MANAGER_POINT_ACTIONS = {
  treat_bench_player: { label: "Treat Bench Player", active: false, cost: 1 },
  player_enhance: { label: "Player Enhance", active: false, cost: 1 },
  stat_reveal: { label: "Stat Reveal", active: false, cost: 1 },
  bench_productivity: { label: "Bench Productivity", active: false, cost: 1 },
};

export const DEFAULT_LEAGUE_VISIBILITY_CONFIG = {
  league_type: "standard",
  fantasy_points_visibility: "hidden",
  draft_player_name_visibility: "shown",
  draft_team_visibility: "hidden_until_drafted",
  durability_mode: "hidden_until_drafted",
  manager_points_enabled: false,
  manager_point_actions: DEFAULT_MANAGER_POINT_ACTIONS,
};

export const DURABILITY_LABELS = {
  3: "Perfect",
  2: "Healthy",
  1: "Normal",
  0: "Worn",
  [-1]: "Hurt",
  [-2]: "Struggling",
  [-3]: "Injured",
};

export const DURABILITY_MULTIPLIERS = {
  3: 1.1,
  2: 1.05,
  1: 1,
  0: 0.95,
  [-1]: 0.9,
  [-2]: 0.85,
  [-3]: 0.8,
};

export const DEFAULT_SCHEDULE_CONFIG = {
  type: "interval",
  start_date: new Date().toISOString().slice(0, 10),
  games_per_period: 1,
  period_days: 7,
  preset_dates: [],
};

export const DEFAULT_LEAGUE_PLAY_SETTINGS = {
  draft_mode: "season_snake",
  player_retention_mode: "retained",
  schedule_type: "head_to_head",
  ranking_system: "standard",
  advancement_mode: "manual",
  playoff_mode: "roster_only",
  playoff_start_week: 9,
  playoff_team_count: 4,
  schedule_config: DEFAULT_SCHEDULE_CONFIG,
};
