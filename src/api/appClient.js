import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const STORAGE_KEY = "retro_fantasy_football_store_v2";
const CURRENT_USER_KEY = "retro_fantasy_football_current_user_v2";
const now = () => new Date().toISOString();

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
  starters: { QB: 1, OFF: 2, FLEX: 1, K: 1, DEF: 1 },
  bench: 5,
};

export const DEFAULT_DRAFT_CONFIG = {
  type: "snake",
  rounds: 10,
  timer_seconds: 60,
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

const AI_FIRST_NAMES = [
  "Blitz", "Redzone", "Iron", "Gridiron", "Goal Line", "Fourth Down", "Two Minute", "Wildcat", "Pigskin", "Audible",
  "Hail Mary", "End Zone", "Sideline", "Playbook", "Hashmark", "Sunday", "Primetime", "Turbo", "Smashmouth", "Nickel",
  "Power", "Dynasty", "Rumble", "Rocket", "Phantom", "Thunder", "Victory", "Signal", "Turf", "Helmet",
];

const AI_LAST_NAMES = [
  "Bruisers", "Blitzers", "Maulers", "Crushers", "Punishers", "Hit Squad", "Ball Hawks", "Sack Masters", "Chain Movers", "Playmakers",
  "Road Graders", "Linebackers", "Safeties", "Generals", "Captains", "Warriors", "Gladiators", "Bombers", "Rushers", "Defenders",
  "Marauders", "Outlaws", "Renegades", "Stampede", "Avalanche", "Cyclones", "Firebirds", "Ironclads", "Night Shift", "Endzones",
];

const AI_PERSONAS = ["BALANCED", "OFFENSIVE", "DEFENSIVE"];
const PAID_JOIN_FEE_MIN_CENTS = 500;
const PAID_JOIN_FEE_DEFAULT_MAX_CENTS = 5000;
const PROFILE_NAME_PATTERN = /^[A-Za-z0-9]{4,20}$/;

const DEMO_USER = {
  id: "user_demo_commish",
  email: "commissioner@offseasonfantasy.dev",
  full_name: "Demo Commissioner",
  profile_name: "DemoCommish",
  role: "admin",
};

const playerSeed = [
  ["player_jackson", "Lamar Jackson", "BAL", "QB", 2025, 23.7, 38.2, 11.3, 379.2],
  ["player_allen", "Josh Allen", "BUF", "QB", 2025, 24.1, 36.6, 12.7, 385.6],
  ["player_hurts", "Jalen Hurts", "PHI", "QB", 2025, 22.1, 35.9, 9.8, 353.6],
  ["player_henry", "Derrick Henry", "BAL", "OFF", 2025, 18.6, 33.1, 6.8, 297.6],
  ["player_mccaffrey", "Christian McCaffrey", "SF", "OFF", 2025, 20.2, 34.8, 7.2, 323.2],
  ["player_hill", "Tyreek Hill", "MIA", "OFF", 2025, 18.1, 31.5, 5.1, 289.6],
  ["player_lamb", "CeeDee Lamb", "DAL", "OFF", 2025, 17.4, 29.4, 4.9, 278.4],
  ["player_kelce", "Travis Kelce", "KC", "OFF", 2025, 15.4, 25.3, 6.4, 246.4],
  ["player_butker", "Harrison Butker", "KC", "K", 2025, 9.4, 17.0, 3.0, 150.4],
  ["player_tucker", "Justin Tucker", "BAL", "K", 2025, 9.1, 18.0, 2.0, 145.6],
  ["player_cowboys", "Dallas Cowboys DST", "DAL", "DEF", 2025, 10.9, 23.0, 1.0, 174.4],
  ["player_browns", "Cleveland Browns DST", "CLE", "DEF", 2025, 10.2, 21.0, 2.0, 163.2],
].map(([id, full_name, team, position, season_year, avg_points, high_score, low_score, total_points]) => ({
  id,
  player_id: id,
  full_name,
  player_display_name: full_name,
  team,
  position,
  active_years: [season_year],
  avg_points,
  high_score,
  low_score,
  total_points,
  source_season_year: season_year,
  created_date: now(),
}));

const buildPlayerWeeks = () =>
  playerSeed.flatMap((player, playerIndex) =>
    Array.from({ length: 18 }, (_, index) => {
      const week = index + 1;
      const base = player.avg_points + ((playerIndex + 3) * (week % 5) - 4);
      return {
        id: `pw_${player.id}_${week}`,
        player_id: player.id,
        season_year: player.source_season_year,
        week,
        team: player.team,
        fantasy_points: Number(Math.max(0, base).toFixed(2)),
        passing_yards: player.position === "QB" ? 210 + week * 8 : 0,
        passing_tds: player.position === "QB" ? (week % 4) + 1 : 0,
        rushing_yards: player.position === "OFF" ? 55 + week * 4 : 0,
        receiving_yards: player.position === "OFF" ? 48 + week * 5 : 0,
        touchdowns: player.position === "OFF" ? ((week + playerIndex) % 3) + 1 : 0,
        created_date: now(),
      };
    })
  );

const buildWeekRandomizations = () =>
  Array.from({ length: 8 }, (_, index) => ({
    id: `rand_week_${index + 1}`,
    league_id: "league_retro_bowl",
    fantasy_week: index + 1,
    reveal_state: index === 0 ? "revealed" : "hidden",
    source_season_year: 2025,
    assignment_method: "per_player_hidden_week",
    assignments: playerSeed.reduce((acc, player, playerIndex) => {
      acc[player.id] = ((index + playerIndex * 2) % 18) + 1;
      return acc;
    }, {}),
    created_date: now(),
  }));

function createSeedStore() {
  const createdDate = now();
  const leagueId = "league_retro_bowl";
  const memberId = "member_demo_commish";
  const aiMemberId = "member_ai_pixels";

  return {
    UserProfile: [
      {
        id: "profile_demo_commish",
        user_email: DEMO_USER.email,
        profile_name: "DemoCommish",
        display_name: "Commissioner Demo",
        favorite_team: "DET",
        theme_primary: "#00D9FF",
        theme_secondary: "#000000",
        created_date: createdDate,
      },
    ],
    League: [
      {
        id: leagueId,
        name: "Retro Bowl Invitational",
        description:
          "Draft from last season's NFL player pool and survive hidden, scrambled weekly stat reveals.",
        commissioner_email: DEMO_USER.email,
        is_public: true,
        is_sponsored: true,
        league_status: "ACTIVE",
        mode: "traditional",
        ...DEFAULT_LEAGUE_PLAY_SETTINGS,
        player_retention_mode: "two_use_release",
        ranking_system: "offl",
        season_length_weeks: 8,
        max_members: 8,
        join_fee_cents: 0,
        join_fee_currency: "usd",
        source_season_year: 2025,
        scoring_rules: DEFAULT_SCORING_RULES,
        roster_rules: DEFAULT_ROSTER_RULES,
        draft_config: DEFAULT_DRAFT_CONFIG,
        created_date: createdDate,
      },
      {
        id: "league_redraft_arcade",
        name: "Arcade Redraft",
        description:
          "Fresh draft every fantasy week. Once you draft a player, they are gone from your board until the playoffs.",
        commissioner_email: DEMO_USER.email,
        is_public: true,
        is_sponsored: false,
        league_status: "RECRUITING",
        mode: "weekly_redraft",
        ...DEFAULT_LEAGUE_PLAY_SETTINGS,
        draft_mode: "weekly_redraft",
        player_retention_mode: "retained",
        season_length_weeks: 8,
        max_members: 10,
        join_fee_cents: 0,
        join_fee_currency: "usd",
        source_season_year: 2025,
        scoring_rules: DEFAULT_SCORING_RULES,
        roster_rules: DEFAULT_ROSTER_RULES,
        draft_config: { ...DEFAULT_DRAFT_CONFIG, rounds: 7 },
        created_date: createdDate,
      },
    ],
    LeagueMember: [
      {
        id: memberId,
        league_id: leagueId,
        user_email: DEMO_USER.email,
        team_name: "Pixel Blitz",
        role_in_league: "COMMISSIONER",
        is_active: true,
        is_ai: false,
        created_date: createdDate,
      },
      {
        id: aiMemberId,
        league_id: leagueId,
        user_email: "ai.pixel@retro.local",
        team_name: "Arcade Automatons",
        role_in_league: "MANAGER",
        is_active: true,
        is_ai: true,
        ai_persona: "DEFENSIVE",
        created_date: createdDate,
      },
      {
        id: "member_redraft_commish",
        league_id: "league_redraft_arcade",
        user_email: DEMO_USER.email,
        team_name: "Weekly Glitch",
        role_in_league: "COMMISSIONER",
        is_active: true,
        is_ai: false,
        created_date: createdDate,
      },
    ],
    Season: [
      {
        id: "season_retro_bowl_2026",
        league_id: leagueId,
        status: "ACTIVE",
        current_week: 2,
        season_year: 2026,
        source_season_year: 2025,
        reveal_state: "partial",
        mode: "traditional",
        created_date: createdDate,
      },
      {
        id: "season_arcade_2026",
        league_id: "league_redraft_arcade",
        status: "DRAFTING",
        current_week: 1,
        season_year: 2026,
        source_season_year: 2025,
        reveal_state: "hidden",
        mode: "weekly_redraft",
        created_date: createdDate,
      },
    ],
    Week: [
      { id: "week_retro_1", league_id: leagueId, week_number: 1, status: "RESOLVED", reveal_state: "revealed", created_date: createdDate },
      { id: "week_retro_2", league_id: leagueId, week_number: 2, status: "LINEUPS_OPEN", reveal_state: "hidden", created_date: createdDate },
      { id: "week_arcade_1", league_id: "league_redraft_arcade", week_number: 1, status: "DRAFT_OPEN", reveal_state: "hidden", created_date: createdDate },
    ],
    Matchup: [
      {
        id: "matchup_retro_2",
        league_id: leagueId,
        week_number: 2,
        home_member_id: memberId,
        away_member_id: aiMemberId,
        home_score: 124.5,
        away_score: 110.2,
        created_date: createdDate,
      },
    ],
    Player: playerSeed,
    PlayerWeek: buildPlayerWeeks(),
    Draft: [{ id: "draft_arcade_w1", league_id: "league_redraft_arcade", week_number: 1, status: "OPEN", type: "weekly_redraft", created_date: createdDate }],
    DraftRoom: [],
    DraftPick: [],
    Roster: [
      { id: "roster_demo_qb", league_member_id: memberId, player_id: "player_allen", slot_type: "QB", week_number: null, created_date: createdDate },
      { id: "roster_demo_off1", league_member_id: memberId, player_id: "player_hill", slot_type: "OFF", week_number: null, created_date: createdDate },
      { id: "roster_demo_off2", league_member_id: memberId, player_id: "player_henry", slot_type: "OFF", week_number: null, created_date: createdDate },
      { id: "roster_demo_k", league_member_id: memberId, player_id: "player_tucker", slot_type: "K", week_number: null, created_date: createdDate },
      { id: "roster_demo_def", league_member_id: memberId, player_id: "player_cowboys", slot_type: "DEF", week_number: null, created_date: createdDate },
      { id: "roster_redraft_qb", league_member_id: "member_redraft_commish", player_id: "player_jackson", slot_type: "QB", week_number: 1, created_date: createdDate },
    ],
    ManagerSeason: [],
    Standing: [
      { id: "standing_demo_commish", league_id: leagueId, league_member_id: memberId, wins: 2, losses: 0, ties: 0, points_for: 248.7, points_against: 221.1, league_points: 12, weekly_rank_points: 4, created_date: createdDate },
      { id: "standing_ai_pixels", league_id: leagueId, league_member_id: aiMemberId, wins: 1, losses: 1, ties: 0, points_for: 232.3, points_against: 226.4, league_points: 7, weekly_rank_points: 3, created_date: createdDate },
    ],
    ImportJob: [
      {
        id: "job_seed_import",
        job_type: "HISTORICAL_STATS",
        status: "COMPLETED",
        progress: 100,
        parameters: { source_season_year: 2025 },
        logs: ["Loaded 2025 player-week history into the demo store.", "Calculated player aggregates and randomized week assignments."],
        summary: "Demo source season loaded.",
        created_date: createdDate,
      },
    ],
    AITeamNamePart: [
      ...AI_FIRST_NAMES.map((value, index) => ({ id: `ai_first_${index}`, part_type: "FIRST", value, created_date: createdDate })),
      ...AI_LAST_NAMES.map((value, index) => ({ id: `ai_last_${index}`, part_type: "LAST", value, created_date: createdDate })),
    ],
    UsedAITeamName: [{ id: "used_ai_arcade_automatons", league_id: leagueId, name: "Arcade Automatons", created_date: createdDate }],
    LeagueInvite: [
      {
        id: "invite_retro_demo",
        league_id: leagueId,
        code: "RETRODEMO",
        created_by: DEMO_USER.id,
        expires_at: null,
        max_uses: null,
        used_count: 0,
        is_active: true,
        created_date: createdDate,
      },
    ],
    OfficialLeague: [{ id: "official_retro_bowl", league_id: leagueId, label: "Featured demo league", created_date: createdDate }],
    Global: [
      { id: "global_scoring_rules", key: "SCORING_RULES", value: DEFAULT_SCORING_RULES, created_date: createdDate },
      { id: "global_roster_rules", key: "ROSTER_RULES", value: DEFAULT_ROSTER_RULES, created_date: createdDate },
      { id: "global_source_season", key: "SOURCE_SEASON_YEAR", value_number: 2025, created_date: createdDate },
      { id: "global_count_qb", key: "COUNT_PLAYERS_QB", value_number: playerSeed.filter((p) => p.position === "QB").length, created_date: createdDate },
      { id: "global_count_k", key: "COUNT_PLAYERS_K", value_number: playerSeed.filter((p) => p.position === "K").length, created_date: createdDate },
      { id: "global_count_off", key: "COUNT_PLAYERS_OFF", value_number: playerSeed.filter((p) => p.position === "OFF").length, created_date: createdDate },
      { id: "global_count_def", key: "COUNT_PLAYERS_DEF", value_number: playerSeed.filter((p) => p.position === "DEF").length, created_date: createdDate },
    ],
    SiteSetting: [
      { id: "site_scoring_rules", key: "SCORING_RULES", value: DEFAULT_SCORING_RULES, created_date: createdDate },
      { id: "site_roster_rules", key: "ROSTER_RULES", value: DEFAULT_ROSTER_RULES, created_date: createdDate },
      { id: "site_paid_join_fee_max", key: "PAID_LEAGUE_JOIN_FEE_MAX_CENTS", value: PAID_JOIN_FEE_DEFAULT_MAX_CENTS, description: "Maximum paid league join fee in cents.", created_date: createdDate },
    ],
    SeasonScoringRule: [
      { id: "season_scoring_2025", season_year: 2025, rules: DEFAULT_SCORING_RULES, created_date: createdDate },
    ],
    WeekRandomization: buildWeekRandomizations(),
    ManagerPlayerUsage: [
      {
        id: "usage_redraft_jackson",
        league_id: "league_redraft_arcade",
        league_member_id: "member_redraft_commish",
        player_id: "player_jackson",
        used_in_week: 1,
        created_date: createdDate,
      },
    ],
    GameSchedule: [
      { id: "schedule_retro_1", league_id: leagueId, week_number: 1, game_number: 1, scheduled_at: createdDate, phase: "regular", advancement_mode: "manual", status: "RESOLVED", created_date: createdDate },
      { id: "schedule_retro_2", league_id: leagueId, week_number: 2, game_number: 1, scheduled_at: createdDate, phase: "regular", advancement_mode: "manual", status: "SCHEDULED", created_date: createdDate },
    ],
    PlayerReleaseEvent: [],
    LeagueWeekResult: [],
    PlayoffRosterDecision: [],
    PlayerPositionYearCount: [],
    Lineup: [
      {
        id: "lineup_retro_w2",
        league_id: leagueId,
        league_member_id: memberId,
        week_number: 2,
        slots: [
          { slot: "QB", player_id: "player_allen" },
          { slot: "OFF1", player_id: "player_hill" },
          { slot: "OFF2", player_id: "player_henry" },
          { slot: "K", player_id: "player_tucker" },
          { slot: "DEF", player_id: "player_cowboys" },
        ],
        finalized_at: null,
        created_date: createdDate,
      },
    ],
  };
}

const entityTableMap = {
  UserProfile: "profiles",
  League: "leagues",
  LeagueMember: "league_members",
  Season: "league_seasons",
  Week: "league_weeks",
  Matchup: "matchups",
  Player: "players",
  PlayerWeek: "player_week_stats",
  Draft: "drafts",
  DraftRoom: "draft_rooms",
  DraftPick: "draft_picks",
  Roster: "roster_slots",
  ManagerSeason: "manager_seasons",
  Standing: "standings",
  ImportJob: "import_jobs",
  AITeamNamePart: "ai_team_name_parts",
  UsedAITeamName: "used_ai_team_names",
  LeagueInvite: "league_invites",
  OfficialLeague: "official_leagues",
  Global: "global_settings",
  SiteSetting: "site_settings",
  WeekRandomization: "week_randomizations",
  ManagerPlayerUsage: "manager_player_usage",
  GameSchedule: "league_game_schedule",
  PlayerReleaseEvent: "player_release_events",
  LeagueWeekResult: "league_week_results",
  PlayoffRosterDecision: "playoff_roster_decisions",
  Lineup: "lineups",
  PlayerPositionYearCount: "player_position_year_counts",
  SeasonScoringRule: "season_scoring_rules",
};

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function normalizeProfileName(value) {
  return String(value || "").trim();
}

function validateProfilePayload(entityName, data, store, currentId = null) {
  if (entityName !== "UserProfile" || !Object.prototype.hasOwnProperty.call(data, "profile_name")) return;
  const profileName = normalizeProfileName(data.profile_name);
  if (!PROFILE_NAME_PATTERN.test(profileName)) {
    throw new Error("Profile name must be 4-20 letters or numbers with no spaces or special characters.");
  }
  const duplicate = (store.UserProfile || []).find(
    (profile) =>
      profile.id !== currentId &&
      String(profile.profile_name || "").toLowerCase() === profileName.toLowerCase()
  );
  if (duplicate) throw new Error("That profile name is already taken.");
  data.profile_name = profileName;
}

function sortRecords(records, sortArgs = []) {
  const fields = sortArgs
    .filter(Boolean)
    .flatMap((arg) => String(arg).split(","))
    .map((field) => field.trim())
    .filter(Boolean);
  if (!fields.length) return [...records];
  return [...records].sort((a, b) => {
    for (const field of fields) {
      const desc = field.startsWith("-");
      const key = desc ? field.slice(1) : field;
      const left = a?.[key];
      const right = b?.[key];
      if (left === right) continue;
      if (left === undefined || left === null) return desc ? 1 : -1;
      if (right === undefined || right === null) return desc ? -1 : 1;
      return left > right ? (desc ? -1 : 1) : (desc ? 1 : -1);
    }
    return 0;
  });
}

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (Array.isArray(value)) return value.includes(record[key]);
    return record[key] === value;
  });
}

function readLocalStore() {
  if (typeof window === "undefined") return createSeedStore();
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    const store = JSON.parse(existing);
    store.UserProfile = (store.UserProfile || []).map((profile) =>
      profile.user_email === DEMO_USER.email && !profile.profile_name
        ? { ...profile, profile_name: DEMO_USER.profile_name }
        : profile
    );
    store.League = (store.League || []).map((league) => ({
      ...DEFAULT_LEAGUE_PLAY_SETTINGS,
      ...league,
      draft_mode: league.draft_mode || (league.mode === "weekly_redraft" ? "weekly_redraft" : "season_snake"),
      schedule_config: { ...DEFAULT_SCHEDULE_CONFIG, ...(league.schedule_config || {}) },
    }));
    store.Standing = (store.Standing || []).map((standing) => ({
      league_points: 0,
      weekly_rank_points: 0,
      ...standing,
    }));
    store.ManagerPlayerUsage = (store.ManagerPlayerUsage || []).map((usage) => ({
      usage_count: 1,
      first_used_week: usage.used_in_week,
      last_used_week: usage.used_in_week,
      released_at: null,
      use_context: "regular",
      ...usage,
    }));
    store.GameSchedule = store.GameSchedule || [];
    store.PlayerReleaseEvent = store.PlayerReleaseEvent || [];
    store.LeagueWeekResult = store.LeagueWeekResult || [];
    store.PlayoffRosterDecision = store.PlayoffRosterDecision || [];
    store.PlayerPositionYearCount = store.PlayerPositionYearCount || [];
    store.SeasonScoringRule = store.SeasonScoringRule || [];
    store.DraftRoom = store.DraftRoom || [];
    return store;
  }
  const seed = createSeedStore();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(DEMO_USER));
  return seed;
}

function writeLocalStore(store) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function mapSupabaseError(error) {
  const err = new Error(error?.message || "Supabase request failed");
  err.details = error;
  return err;
}

function applyQuery(builder, query = {}) {
  let next = builder;
  Object.entries(query).forEach(([key, value]) => {
    next = Array.isArray(value) ? next.in(key, value) : next.eq(key, value);
  });
  return next;
}

function applySort(builder, sort) {
  if (!sort) return builder;
  return String(sort)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, field) => acc.order(field.replace(/^-/, ""), { ascending: !field.startsWith("-") }), builder);
}

function applyPagination(builder, limit, skip = 0) {
  if (!limit) return builder;
  const start = Number(skip) || 0;
  const end = start + Number(limit) - 1;
  return builder.range(start, end);
}

function makeLocalEntityApi(entityName) {
  return {
    async list(sort, limit, skip = 0) {
      const store = readLocalStore();
      const records = sortRecords(store[entityName] || [], [sort]);
      const start = Number(skip) || 0;
      const end = limit ? start + Number(limit) : undefined;
      return records.slice(start, end);
    },
    async filter(query, ...options) {
      const [firstSort, secondSort, maybeLimit, maybeSkip] = options;
      let limit = maybeLimit;
      let skip = maybeSkip;
      const sortArgs = [firstSort];
      if (typeof secondSort === "string") sortArgs.push(secondSort);
      else if (typeof secondSort === "number") {
        limit = secondSort;
        skip = maybeLimit;
      }
      const store = readLocalStore();
      const records = (store[entityName] || []).filter((record) => matchesQuery(record, query));
      const sorted = sortRecords(records, sortArgs);
      const start = Number(skip) || 0;
      const end = limit ? start + Number(limit) : undefined;
      return sorted.slice(start, end);
    },
    async get(id) {
      const store = readLocalStore();
      return (store[entityName] || []).find((record) => record.id === id) || null;
    },
    async create(data) {
      const store = readLocalStore();
      validateProfilePayload(entityName, data, store);
      const record = { ...data, id: data.id || makeId(entityName.toLowerCase()), created_date: data.created_date || now() };
      store[entityName] = [...(store[entityName] || []), record];
      writeLocalStore(store);
      return record;
    },
    async update(id, data) {
      const store = readLocalStore();
      const records = store[entityName] || [];
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) throw new Error(`${entityName} record not found: ${id}`);
      validateProfilePayload(entityName, data, store, id);
      const updated = { ...records[index], ...data, updated_date: now() };
      store[entityName] = records.map((record) => (record.id === id ? updated : record));
      writeLocalStore(store);
      return updated;
    },
    async delete(id) {
      const store = readLocalStore();
      store[entityName] = (store[entityName] || []).filter((record) => record.id !== id);
      writeLocalStore(store);
      return { success: true };
    },
    async bulkCreate(items) {
      const created = [];
      for (const item of items) created.push(await this.create(item));
      return created;
    },
  };
}

function makeSupabaseEntityApi(entityName) {
  const table = entityTableMap[entityName];
  return {
    async list(sort, limit, skip = 0) {
      let query = supabase.from(table).select("*");
      query = applySort(query, sort);
      query = applyPagination(query, limit, skip);
      const { data, error } = await query;
      if (error) throw mapSupabaseError(error);
      return data || [];
    },
    async filter(filters, ...options) {
      const [firstSort, secondSort, maybeLimit, maybeSkip] = options;
      let limit = maybeLimit;
      let skip = maybeSkip;
      const sorts = [firstSort];
      if (typeof secondSort === "string") sorts.push(secondSort);
      else if (typeof secondSort === "number") {
        limit = secondSort;
        skip = maybeLimit;
      }
      let query = supabase.from(table).select("*");
      query = applyQuery(query, filters);
      sorts.filter(Boolean).forEach((sort) => {
        query = applySort(query, sort);
      });
      query = applyPagination(query, limit, skip);
      const { data, error } = await query;
      if (error) throw mapSupabaseError(error);
      return data || [];
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data || null;
    },
    async create(data) {
      const payload = { ...data, created_date: data.created_date || now() };
      const { data: created, error } = await supabase.from(table).insert(payload).select("*").single();
      if (error) throw mapSupabaseError(error);
      return created;
    },
    async update(id, data) {
      const { data: updated, error } = await supabase
        .from(table)
        .update({ ...data, updated_date: now() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw mapSupabaseError(error);
      return updated;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw mapSupabaseError(error);
      return { success: true };
    },
    async bulkCreate(items) {
      const created = [];
      for (const item of items) created.push(await this.create(item));
      return created;
    },
  };
}

const entityNames = [
  "UserProfile",
  "League",
  "LeagueMember",
  "Season",
  "Week",
  "Matchup",
  "Player",
  "PlayerWeek",
  "Draft",
  "DraftRoom",
  "DraftPick",
  "Roster",
  "ManagerSeason",
  "Standing",
  "ImportJob",
  "AITeamNamePart",
  "UsedAITeamName",
  "LeagueInvite",
  "OfficialLeague",
  "Global",
  "SiteSetting",
  "WeekRandomization",
  "ManagerPlayerUsage",
  "GameSchedule",
  "PlayerReleaseEvent",
  "LeagueWeekResult",
  "PlayoffRosterDecision",
  "Lineup",
  "PlayerPositionYearCount",
  "SeasonScoringRule",
];

const localEntities = Object.fromEntries(entityNames.map((name) => [name, makeLocalEntityApi(name)]));
const supabaseEntities = Object.fromEntries(entityNames.map((name) => [name, makeSupabaseEntityApi(name)]));
const entities = isSupabaseConfigured ? supabaseEntities : localEntities;

async function uploadFile({ file, bucket = import.meta.env.VITE_SUPABASE_UPLOAD_BUCKET || "uploads", path } = {}) {
  if (!file) throw new Error("No file provided");
  if (!isSupabaseConfigured) {
    const fileUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { file_url: fileUrl };
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw mapSupabaseError(sessionError);
  const user = sessionData?.session?.user;
  if (!user) throw new Error("You must be signed in to upload files");

  const safeName = String(file.name || "upload")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  const requestedPath = path || `${Date.now()}-${safeName}`;
  const filePath = requestedPath.startsWith(`${user.id}/`) ? requestedPath : `${user.id}/${requestedPath}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
  if (error) throw mapSupabaseError(error);
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { file_url: data.publicUrl, path: filePath };
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function localCurrentUser() {
  return auth.me();
}

async function nextLocalAiTeamName(leagueId) {
  const firstParts = await entities.AITeamNamePart.filter({ part_type: "FIRST" });
  const lastParts = await entities.AITeamNamePart.filter({ part_type: "LAST" });
  const used = await entities.UsedAITeamName.filter({ league_id: leagueId });
  const usedNames = new Set(used.map((row) => row.name));
  const firsts = firstParts.length ? firstParts.map((part) => part.value) : AI_FIRST_NAMES;
  const lasts = lastParts.length ? lastParts.map((part) => part.value) : AI_LAST_NAMES;

  for (const first of firsts) {
    for (const last of lasts) {
      const name = `${first} ${last}`;
      if (usedNames.has(name)) continue;
      await entities.UsedAITeamName.create({ league_id: leagueId, name });
      return name;
    }
  }
  throw new Error("No unused AI team names remain.");
}

async function localCreateStanding(leagueId, memberId) {
  const existing = await entities.Standing.filter({ league_id: leagueId, league_member_id: memberId });
  if (!existing[0]) {
    await entities.Standing.create({ league_id: leagueId, league_member_id: memberId, wins: 0, losses: 0, ties: 0, points_for: 0, points_against: 0 });
  }
}

async function localPaidLeagueJoinFeeMaxCents() {
  const settings = await entities.SiteSetting.filter({ key: "PAID_LEAGUE_JOIN_FEE_MAX_CENTS" });
  const rawValue = settings[0]?.value;
  const parsed = typeof rawValue === "number"
    ? rawValue
    : typeof rawValue === "string"
      ? Number(rawValue)
      : Number(rawValue?.amount_cents || rawValue?.value || PAID_JOIN_FEE_DEFAULT_MAX_CENTS);
  return Number.isFinite(parsed) && parsed >= PAID_JOIN_FEE_MIN_CENTS ? parsed : PAID_JOIN_FEE_DEFAULT_MAX_CENTS;
}

async function localValidateJoinFee(leagueTier, payload = {}) {
  const isPaidLeague = String(leagueTier || "FREE").toUpperCase() === "PAID";
  const joinFeeCents = Number(payload.join_fee_cents || 0);
  const joinFeeCurrency = String(payload.join_fee_currency || "usd").toLowerCase();

  if (!Number.isInteger(joinFeeCents) || joinFeeCents < 0) {
    throw new Error("Join fee must be a valid USD amount.");
  }

  if (!isPaidLeague) {
    if (joinFeeCents !== 0) throw new Error("Free leagues cannot have a join fee.");
    return { join_fee_cents: 0, join_fee_currency: "usd" };
  }

  const maxCents = await localPaidLeagueJoinFeeMaxCents();
  if (joinFeeCurrency !== "usd") throw new Error("Paid league join fee currency must be USD.");
  if (joinFeeCents < PAID_JOIN_FEE_MIN_CENTS) throw new Error("Paid league join fee must be at least $5.00.");
  if (joinFeeCents > maxCents) throw new Error(`Paid league join fee cannot exceed $${(maxCents / 100).toFixed(2)}.`);
  return { join_fee_cents: joinFeeCents, join_fee_currency: joinFeeCurrency };
}

async function localCreateMembership(league, user, teamName) {
  const members = await entities.LeagueMember.filter({ league_id: league.id });
  if (members.some((member) => member.user_email === user.email && member.is_active !== false)) throw new Error("You are already in this league.");
  if (members.filter((member) => member.is_active !== false).length >= league.max_members) throw new Error("League is full.");
  const profiles = await entities.UserProfile.filter({ user_email: user.email });
  const profile = profiles[0];
  const defaultTeamName = `${profile?.profile_name || profile?.display_name || user.full_name || "Manager"}'s Team`;
  const member = await entities.LeagueMember.create({
    league_id: league.id,
    profile_id: user.id,
    user_email: user.email,
    team_name: teamName || defaultTeamName,
    role_in_league: "MANAGER",
    is_active: true,
    is_ai: false,
  });
  await localCreateStanding(league.id, member.id);
  return member;
}

async function localRequireLeagueControl(leagueId) {
  const user = await localCurrentUser();
  const league = await entities.League.get(leagueId);
  if (!league) throw new Error("League not found");
  if (user?.role === "admin" || league.commissioner_email === user?.email || league.commissioner_id === user?.id) {
    return { user, league };
  }
  const members = await entities.LeagueMember.filter({ league_id: leagueId });
  const commissioner = members.find((member) =>
    member.role_in_league === "COMMISSIONER" &&
    member.is_active !== false &&
    (member.user_email === user?.email || member.profile_id === user?.id)
  );
  if (!commissioner) throw new Error("Commissioner access required");
  return { user, league };
}

function normalizeLeaguePlaySettings(payload = {}) {
  payload = payload || {};
  const draftMode = payload.draft_mode || (payload.mode === "weekly_redraft" ? "weekly_redraft" : "season_snake");
  return {
    ...DEFAULT_LEAGUE_PLAY_SETTINGS,
    ...payload,
    mode: draftMode === "weekly_redraft" ? "weekly_redraft" : "traditional",
    draft_mode: draftMode,
    schedule_config: { ...DEFAULT_SCHEDULE_CONFIG, ...(payload.schedule_config || {}) },
  };
}

function scheduleDatesForLeague(league) {
  const config = { ...DEFAULT_SCHEDULE_CONFIG, ...(league.schedule_config || {}) };
  const regularWeeks = Math.max(1, Number(league.playoff_start_week || league.season_length_weeks + 1) - 1);
  const totalWeeks = Math.max(Number(league.season_length_weeks || regularWeeks), regularWeeks);
  if (config.type === "one_day") {
    const date = config.start_date || new Date().toISOString().slice(0, 10);
    return Array.from({ length: totalWeeks }, () => date);
  }
  if (config.type === "preset" && Array.isArray(config.preset_dates) && config.preset_dates.length) {
    return Array.from({ length: totalWeeks }, (_, index) => config.preset_dates[index % config.preset_dates.length]);
  }
  const start = new Date(`${config.start_date || new Date().toISOString().slice(0, 10)}T12:00:00`);
  const gamesPerPeriod = Math.max(1, Number(config.games_per_period || 1));
  const periodDays = Math.max(1, Number(config.period_days || 7));
  return Array.from({ length: totalWeeks }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + Math.floor(index / gamesPerPeriod) * periodDays);
    return date.toISOString();
  });
}

async function localGenerateGameSchedule(league) {
  const dates = scheduleDatesForLeague(league);
  const existing = await entities.GameSchedule.filter({ league_id: league.id });
  await Promise.all(existing.map((row) => entities.GameSchedule.delete(row.id)));
  const regularWeeks = Math.max(1, Number(league.playoff_start_week || league.season_length_weeks + 1) - 1);
  return entities.GameSchedule.bulkCreate(dates.map((scheduledAt, index) => ({
    league_id: league.id,
    week_number: index + 1,
    game_number: 1,
    scheduled_at: scheduledAt,
    phase: index + 1 >= Number(league.playoff_start_week || 999) ? "playoff" : "regular",
    advancement_mode: league.advancement_mode || "manual",
    status: index + 1 <= regularWeeks ? "SCHEDULED" : "SCHEDULED",
  })));
}

async function localEnsureWeekRandomization(league, weekNumber, sourceSeasonYear) {
  const existing = (await entities.WeekRandomization.filter({ league_id: league.id, fantasy_week: weekNumber }))[0];
  if (existing) return existing;
  const players = await entities.Player.list();
  return entities.WeekRandomization.create({
    league_id: league.id,
    fantasy_week: weekNumber,
    source_season_year: sourceSeasonYear,
    reveal_state: "hidden",
    assignment_method: "per_player_hidden_week",
    assignments: players.reduce((acc, player, index) => {
      acc[player.id] = ((weekNumber + index * 2) % 18) + 1;
      return acc;
    }, {}),
  });
}

async function localLineupTotals(league, weekNumber) {
  const randomization = await localEnsureWeekRandomization(league, weekNumber, league.source_season_year || 2025);
  const assignments = randomization.assignments || {};
  const lineups = await entities.Lineup.filter({ league_id: league.id, week_number: weekNumber });
  const members = await entities.LeagueMember.filter({ league_id: league.id });
  const playerWeeks = await entities.PlayerWeek.list();
  const totals = [];
  for (const lineup of lineups) {
    let total = 0;
    for (const slot of lineup.slots || []) {
      const sourceWeek = assignments[slot.player_id] || weekNumber;
      const playerWeek = playerWeeks.find((row) => row.player_id === slot.player_id && Number(row.week) === Number(sourceWeek));
      total += Number(playerWeek?.fantasy_points || 0);
    }
    totals.push({
      league_member_id: lineup.league_member_id,
      team_name: members.find((member) => member.id === lineup.league_member_id)?.team_name || null,
      total: Number(total.toFixed(2)),
      slots: lineup.slots || [],
    });
  }
  return { randomization, totals };
}

async function localRecordPlayerUsage(league, weekNumber, totals) {
  const releases = [];
  const isPlayoff = Number(weekNumber) >= Number(league.playoff_start_week || 999);
  for (const lineup of totals) {
    for (const slot of lineup.slots || []) {
      const existing = (await entities.ManagerPlayerUsage.filter({
        league_id: league.id,
        league_member_id: lineup.league_member_id,
        player_id: slot.player_id,
      }))[0];
      const usageCount = Number(existing?.usage_count || 0) + 1;
      const payload = {
        league_id: league.id,
        league_member_id: lineup.league_member_id,
        player_id: slot.player_id,
        used_in_week: existing?.used_in_week || weekNumber,
        usage_count: usageCount,
        first_used_week: existing?.first_used_week || weekNumber,
        last_used_week: weekNumber,
        use_context: isPlayoff ? "playoff" : "regular",
      };
      const usage = existing ? await entities.ManagerPlayerUsage.update(existing.id, payload) : await entities.ManagerPlayerUsage.create(payload);
      if (league.player_retention_mode === "two_use_release" && usageCount >= 2 && !existing?.released_at) {
        const roster = await entities.Roster.filter({ league_member_id: lineup.league_member_id, player_id: slot.player_id });
        await Promise.all(roster.map((row) => entities.Roster.delete(row.id)));
        await entities.ManagerPlayerUsage.update(usage.id, { released_at: now() });
        releases.push(await entities.PlayerReleaseEvent.create({
          league_id: league.id,
          league_member_id: lineup.league_member_id,
          player_id: slot.player_id,
          week_number: weekNumber,
          release_reason: "two_use_limit",
          available_at: now(),
        }));
      }
    }
  }
  return releases;
}

async function localApplyResultsAndStandings(league, weekNumber, totals) {
  const members = await entities.LeagueMember.filter({ league_id: league.id });
  const activeMembers = members.filter((member) => member.is_active !== false);
  const existingResults = await entities.LeagueWeekResult.filter({ league_id: league.id, week_number: weekNumber });
  await Promise.all(existingResults.map((row) => entities.LeagueWeekResult.delete(row.id)));
  const sorted = [...totals].sort((a, b) => b.total - a.total);
  const rankPoints = [4, 3, 2, 1];
  const resultRows = sorted.map((row, index) => ({
    league_id: league.id,
    league_member_id: row.league_member_id,
    week_number: weekNumber,
    total_points: row.total,
    weekly_rank: index + 1,
    head_to_head_points: 0,
    rank_points: league.ranking_system === "offl" ? (rankPoints[index] || 0) : 0,
    league_points: league.schedule_type === "league_wide" || league.ranking_system === "offl" ? (rankPoints[index] || 0) : 0,
  }));

  if (league.schedule_type === "head_to_head") {
    const matchups = await entities.Matchup.filter({ league_id: league.id, week_number: weekNumber });
    for (const matchup of matchups) {
      const home = resultRows.find((row) => row.league_member_id === matchup.home_member_id);
      const away = resultRows.find((row) => row.league_member_id === matchup.away_member_id);
      if (!home || !away) continue;
      await entities.Matchup.update(matchup.id, { home_score: home.total_points, away_score: away.total_points });
      if (home.total_points > away.total_points) home.head_to_head_points += 4;
      else if (away.total_points > home.total_points) away.head_to_head_points += 4;
      else {
        home.head_to_head_points += 2;
        away.head_to_head_points += 2;
      }
    }
  }

  for (const row of resultRows) {
    row.league_points = league.ranking_system === "offl" ? row.head_to_head_points + row.rank_points : row.league_points;
    await entities.LeagueWeekResult.create(row);
  }

  const allResults = await entities.LeagueWeekResult.filter({ league_id: league.id });
  const matchups = await entities.Matchup.filter({ league_id: league.id });
  const standings = [];
  for (const member of activeMembers) {
    const memberResults = allResults.filter((row) => row.league_member_id === member.id);
    const memberMatchups = matchups.filter((matchup) => matchup.home_member_id === member.id || matchup.away_member_id === member.id);
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let pointsAgainst = 0;
    for (const matchup of memberMatchups) {
      const isHome = matchup.home_member_id === member.id;
      const own = Number(isHome ? matchup.home_score : matchup.away_score);
      const opp = Number(isHome ? matchup.away_score : matchup.home_score);
      if (!Number.isFinite(own) || !Number.isFinite(opp)) continue;
      pointsAgainst += opp;
      if (own > opp) wins += 1;
      else if (own < opp) losses += 1;
      else ties += 1;
    }
    standings.push({
      league_id: league.id,
      league_member_id: member.id,
      wins,
      losses,
      ties,
      points_for: Number(memberResults.reduce((sum, row) => sum + Number(row.total_points || 0), 0).toFixed(2)),
      points_against: Number(pointsAgainst.toFixed(2)),
      league_points: Number(memberResults.reduce((sum, row) => sum + Number(row.league_points || 0), 0).toFixed(2)),
      weekly_rank_points: Number(memberResults.reduce((sum, row) => sum + Number(row.rank_points || 0), 0).toFixed(2)),
    });
  }

  for (const row of standings) {
    const existing = (await entities.Standing.filter({ league_id: row.league_id, league_member_id: row.league_member_id }))[0];
    if (existing) await entities.Standing.update(existing.id, row);
    else await entities.Standing.create(row);
  }
  return standings;
}

async function localGenerateMatchups(league, weekNumber) {
  if (league.schedule_type !== "head_to_head") return [];
  const existing = await entities.Matchup.filter({ league_id: league.id, week_number: weekNumber });
  if (existing.length) return existing;
  const members = (await entities.LeagueMember.filter({ league_id: league.id })).filter((member) => member.is_active !== false);
  const rotated = [...members.slice(weekNumber - 1), ...members.slice(0, weekNumber - 1)];
  const matchups = [];
  for (let index = 0; index < rotated.length - 1; index += 2) {
    matchups.push(await entities.Matchup.create({
      league_id: league.id,
      week_number: weekNumber,
      home_member_id: rotated[index].id,
      away_member_id: rotated[index + 1].id,
      home_score: 0,
      away_score: 0,
    }));
  }
  return matchups;
}

const localFunctions = {
  async generateAiTeamName() {
    return { teamName: await nextLocalAiTeamName("preview") };
  },
  async create_league(payload = {}) {
    const user = await localCurrentUser();
    const feeFields = await localValidateJoinFee(payload.league_tier || "FREE", payload);
    const league = await entities.League.create({
      ...normalizeLeaguePlaySettings(payload),
      ...feeFields,
      commissioner_id: user?.id || DEMO_USER.id,
      commissioner_email: payload.commissioner_email || user?.email || DEMO_USER.email,
      league_status: payload.league_status || "RECRUITING",
    });
    const member = await entities.LeagueMember.create({
      league_id: league.id,
      profile_id: user?.id || DEMO_USER.id,
      user_email: payload.commissioner_email || user?.email || DEMO_USER.email,
      team_name: payload.team_name || "Commissioner Team",
      role_in_league: "COMMISSIONER",
      is_active: true,
    });
    await localCreateStanding(league.id, member.id);
    return { league, member };
  },
  async join_league({ league_id, team_name } = {}) {
    const user = await localCurrentUser();
    const league = await entities.League.get(league_id);
    if (!league) throw new Error("League not found");
    if (league.archived_at) throw new Error("This league is archived.");
    if (!league.is_public) throw new Error("This league requires an invite code.");
    const member = await localCreateMembership(league, user, team_name);
    return { league, member };
  },
  async join_league_by_invite({ code, team_name } = {}) {
    const invites = await entities.LeagueInvite.filter({ code: normalizeCode(code), is_active: true });
    const invite = invites[0];
    if (!invite) throw new Error("Invite code is invalid or inactive.");
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Invite code has expired.");
    if (invite.max_uses && invite.used_count >= invite.max_uses) throw new Error("Invite code has no uses remaining.");
    const user = await localCurrentUser();
    const league = await entities.League.get(invite.league_id);
    if (!league || league.archived_at) throw new Error("League not found");
    const member = await localCreateMembership(league, user, team_name);
    await entities.LeagueInvite.update(invite.id, { used_count: (invite.used_count || 0) + 1 });
    return { league, member };
  },
  async create_league_invite({ league_id, max_uses = null, expires_at = null } = {}) {
    const { user } = await localRequireLeagueControl(league_id);
    const invite = await entities.LeagueInvite.create({
      league_id,
      code: makeInviteCode(),
      created_by: user.id,
      expires_at,
      max_uses,
      used_count: 0,
      is_active: true,
    });
    return { invite };
  },
  async disable_league_invite({ invite_id } = {}) {
    const invite = await entities.LeagueInvite.get(invite_id);
    if (!invite) throw new Error("Invite not found");
    await localRequireLeagueControl(invite.league_id);
    return { invite: await entities.LeagueInvite.update(invite.id, { is_active: false }) };
  },
  async rename_league_member_team({ member_id, team_name } = {}) {
    const member = await entities.LeagueMember.get(member_id);
    if (!member) throw new Error("Member not found");
    await localRequireLeagueControl(member.league_id);
    return { member: await entities.LeagueMember.update(member.id, { team_name }) };
  },
  async remove_league_member({ member_id } = {}) {
    const member = await entities.LeagueMember.get(member_id);
    if (!member) throw new Error("Member not found");
    const { league } = await localRequireLeagueControl(member.league_id);
    if (member.role_in_league === "COMMISSIONER" || member.user_email === league.commissioner_email) {
      throw new Error("Transfer commissioner before removing this member.");
    }
    return { member: await entities.LeagueMember.update(member.id, { is_active: false }) };
  },
  async transfer_commissioner({ member_id } = {}) {
    const target = await entities.LeagueMember.get(member_id);
    if (!target || target.is_ai || target.is_active === false) throw new Error("Commissioner must be an active human member.");
    await localRequireLeagueControl(target.league_id);
    const members = await entities.LeagueMember.filter({ league_id: target.league_id });
    await Promise.all(members.filter((member) => member.role_in_league === "COMMISSIONER").map((member) => entities.LeagueMember.update(member.id, { role_in_league: "MANAGER" })));
    const member = await entities.LeagueMember.update(target.id, { role_in_league: "COMMISSIONER" });
    const league = await entities.League.update(target.league_id, { commissioner_id: target.profile_id, commissioner_email: target.user_email });
    return { league, member };
  },
  async add_ai_team({ league_id, ai_persona = "BALANCED" } = {}) {
    const { league } = await localRequireLeagueControl(league_id);
    const members = await entities.LeagueMember.filter({ league_id });
    if (members.filter((member) => member.is_active !== false).length >= league.max_members) throw new Error("League is full.");
    const teamName = await nextLocalAiTeamName(league_id);
    const member = await entities.LeagueMember.create({
      league_id,
      user_email: `ai-${league_id}-${Date.now()}@offseason.fantasy`,
      team_name: teamName,
      role_in_league: "MANAGER",
      is_active: true,
      is_ai: true,
      ai_persona: AI_PERSONAS.includes(ai_persona) ? ai_persona : "BALANCED",
    });
    await localCreateStanding(league_id, member.id);
    return { member, teamName };
  },
  async update_ai_team({ member_id, team_name, ai_persona } = {}) {
    const member = await entities.LeagueMember.get(member_id);
    if (!member?.is_ai) throw new Error("Only AI teams can be edited here.");
    await localRequireLeagueControl(member.league_id);
    return { member: await entities.LeagueMember.update(member.id, { team_name, ai_persona }) };
  },
  async remove_ai_team({ member_id } = {}) {
    const member = await entities.LeagueMember.get(member_id);
    if (!member?.is_ai) throw new Error("Only AI teams can be removed here.");
    await localRequireLeagueControl(member.league_id);
    return { member: await entities.LeagueMember.update(member.id, { is_active: false }) };
  },
  async archive_league({ league_id, archive_reason } = {}) {
    const { user } = await localRequireLeagueControl(league_id);
    const league = await entities.League.get(league_id);
    const seasons = await entities.Season.filter({ league_id });
    const members = await entities.LeagueMember.filter({ league_id });
    const paidJoinedMembers = members.filter((member) =>
      member.is_active !== false &&
      !member.is_ai &&
      member.role_in_league !== "COMMISSIONER" &&
      member.user_email !== league.commissioner_email
    );
    if (user?.role !== "admin" && seasons.length > 0) throw new Error("League has begun and cannot be deleted by commissioner.");
    if (user?.role !== "admin" && league.league_tier === "PAID" && paidJoinedMembers.length > 0) {
      throw new Error("Paid members joined; only an admin can force delete this league.");
    }
    return {
      league: await entities.League.update(league_id, {
        archived_at: now(),
        archived_by: user.id,
        archive_reason: archive_reason || "Deleted by commissioner",
      }),
    };
  },
  async force_delete_league({ league_id, archive_reason } = {}) {
    const user = await localCurrentUser();
    if (user?.role !== "admin") throw new Error("Admin access required");
    const league = await entities.League.get(league_id);
    const members = await entities.LeagueMember.filter({ league_id });
    const paidJoinedMembers = members.filter((member) =>
      member.is_active !== false &&
      !member.is_ai &&
      member.role_in_league !== "COMMISSIONER" &&
      member.user_email !== league.commissioner_email
    );
    const refundPending = league?.league_tier === "PAID" && paidJoinedMembers.length > 0;
    return {
      league: await entities.League.update(league_id, {
        archived_at: now(),
        archived_by: user.id,
        archive_reason: archive_reason || "Admin force delete",
        refund_status: refundPending ? "PENDING" : "NOT_REQUIRED",
        refund_required_at: refundPending ? now() : null,
        refund_reason: refundPending ? "Admin force delete after paid members joined" : null,
      }),
      refund_pending: refundPending,
    };
  },
  async restore_league({ league_id } = {}) {
    const user = await localCurrentUser();
    if (user?.role !== "admin") throw new Error("Admin access required");
    return { league: await entities.League.update(league_id, { archived_at: null, archived_by: null, archive_reason: null }) };
  },
  async pause_league({ league_id } = {}) {
    await localRequireLeagueControl(league_id);
    return { league: await entities.League.update(league_id, { league_status: "PAUSED", paused_at: now() }) };
  },
  async resume_league({ league_id } = {}) {
    await localRequireLeagueControl(league_id);
    return { league: await entities.League.update(league_id, { league_status: "ACTIVE", paused_at: null }) };
  },
  async start_season({ league_id, source_season_year } = {}) {
    const league = normalizeLeaguePlaySettings(await entities.League.get(league_id));
    if (!league) throw new Error("League not found");
    const season = await entities.Season.create({
      league_id,
      status: "ACTIVE",
      current_week: 1,
      season_year: new Date().getFullYear(),
      source_season_year: source_season_year || league.source_season_year || 2025,
      reveal_state: "hidden",
      mode: league.draft_mode === "weekly_redraft" ? "weekly_redraft" : "traditional",
    });
    await entities.Week.create({
      league_id,
      week_number: 1,
      status: league.draft_mode === "weekly_redraft" ? "DRAFT_OPEN" : "LINEUPS_OPEN",
      reveal_state: "hidden",
    });
    await localEnsureWeekRandomization(league, 1, source_season_year || league.source_season_year || 2025);
    await localGenerateGameSchedule(league);
    await localGenerateMatchups(league, 1);
    await entities.League.update(league_id, { league_status: "ACTIVE" });
    return { season };
  },
  async open_week_draft({ league_id, week_number = 1, type, timer_seconds } = {}) {
    const league = normalizeLeaguePlaySettings(await entities.League.get(league_id));
    const draft = await entities.Draft.create({ league_id, week_number, status: "OPEN", type: type || league.draft_mode || "weekly_redraft" });
    const room = await entities.DraftRoom.create({ draft_id: draft.id, timer_seconds: timer_seconds || league.draft_config?.timer_seconds || 60, state: {} });
    return { draft, room };
  },
  async submit_pick(payload = {}) {
    const league = payload.league_id ? normalizeLeaguePlaySettings(await entities.League.get(payload.league_id)) : null;
    if (league?.draft_mode === "weekly_redraft") {
      const used = await entities.ManagerPlayerUsage.filter({
        league_id: payload.league_id,
        league_member_id: payload.league_member_id,
        player_id: payload.player_id,
      });
      if (used.length) throw new Error("This manager has already used that player this season.");
    }
    const pick = await entities.DraftPick.create({ ...payload, submitted_at: now() });
    if (payload.track_usage) {
      await entities.ManagerPlayerUsage.create({
        league_id: payload.league_id,
        league_member_id: payload.league_member_id,
        player_id: payload.player_id,
        used_in_week: payload.week_number,
      });
    }
    return { pick };
  },
  async finalize_lineup({ league_id, league_member_id, week_number, slots = [] } = {}) {
    const existing = await entities.Lineup.filter({ league_id, league_member_id, week_number });
    if (existing[0]) {
      return { lineup: await entities.Lineup.update(existing[0].id, { slots, finalized_at: now() }) };
    }
    return { lineup: await entities.Lineup.create({ league_id, league_member_id, week_number, slots, finalized_at: now() }) };
  },
  async resolve_week({ league_id, week_number } = {}) {
    const league = normalizeLeaguePlaySettings(await entities.League.get(league_id));
    const { randomization, totals } = await localLineupTotals(league, Number(week_number));
    const existingResults = await entities.LeagueWeekResult.filter({ league_id, week_number });
    const releases = existingResults.length ? [] : await localRecordPlayerUsage(league, Number(week_number), totals);
    const standings = await localApplyResultsAndStandings(league, Number(week_number), totals);
    const weeks = await entities.Week.filter({ league_id, week_number });
    if (weeks[0]) await entities.Week.update(weeks[0].id, { status: "RESOLVED" });
    const schedules = await entities.GameSchedule.filter({ league_id, week_number });
    await Promise.all(schedules.map((row) => entities.GameSchedule.update(row.id, { status: "RESOLVED" })));
    return {
      week_number,
      randomized_assignments: randomization?.assignments || {},
      matchup_totals: totals,
      standings_delta: standings,
      releases,
      reveal_state: randomization?.reveal_state || "hidden",
    };
  },
  async advance_week({ league_id } = {}) {
    const league = normalizeLeaguePlaySettings(await entities.League.get(league_id));
    const seasons = await entities.Season.filter({ league_id });
    const season = seasons[0];
    if (!season) throw new Error("Season not found");
    const nextWeek = (season.current_week || 1) + 1;
    await entities.Season.update(season.id, { current_week: nextWeek });
    await entities.Week.create({
      league_id,
      week_number: nextWeek,
      status: league.draft_mode === "weekly_redraft" ? "DRAFT_OPEN" : "LINEUPS_OPEN",
      reveal_state: "hidden",
    });
    await localEnsureWeekRandomization(league, nextWeek, season.source_season_year || league.source_season_year || 2025);
    await localGenerateMatchups(league, nextWeek);
    return { current_week: nextWeek };
  },
  async reveal_week_results({ league_id, week_number } = {}) {
    const records = await entities.WeekRandomization.filter({ league_id, fantasy_week: week_number });
    if (!records[0]) return { revealed: false };
    return { revealed: true, randomized: await entities.WeekRandomization.update(records[0].id, { reveal_state: "revealed" }) };
  },
  async recalculate_standings({ league_id } = {}) {
    const league = normalizeLeaguePlaySettings(await entities.League.get(league_id));
    const results = await entities.LeagueWeekResult.filter({ league_id });
    const weeks = [...new Set(results.map((row) => row.week_number))];
    let standings = [];
    for (const week of weeks) {
      const totals = results.filter((row) => row.week_number === week).map((row) => ({
        league_member_id: row.league_member_id,
        total: Number(row.total_points || 0),
        slots: [],
      }));
      standings = await localApplyResultsAndStandings(league, Number(week), totals);
    }
    const sort = league.ranking_system === "offl" ? "-league_points,-wins,-points_for" : "-wins,-points_for";
    return { standings: standings.length ? standings : await entities.Standing.filter({ league_id }, sort) };
  },
  async createOfficialLeague() {
    return localFunctions.create_official_league();
  },
  async create_official_league(payload = {}) {
    const result = await localFunctions.create_league({
      ...payload,
      name: "Official Retro League",
      description: "A public league seeded from the current source season.",
      is_public: true,
      is_sponsored: true,
      mode: "traditional",
      draft_mode: "season_snake",
      player_retention_mode: "retained",
      schedule_type: "head_to_head",
      ranking_system: "standard",
      advancement_mode: "manual",
      playoff_mode: "roster_only",
      season_length_weeks: 8,
      max_members: 8,
      join_fee_cents: 0,
      join_fee_currency: "usd",
      source_season_year: 2025,
      scoring_rules: DEFAULT_SCORING_RULES,
      roster_rules: DEFAULT_ROSTER_RULES,
      draft_config: DEFAULT_DRAFT_CONFIG,
    });
    await entities.OfficialLeague.create({ league_id: result.league.id, label: "Official league" });
    return result;
  },
  async fillLeagueWithAI({ league_id } = {}) {
    const league = await entities.League.get(league_id);
    const members = await entities.LeagueMember.filter({ league_id });
    const openSpots = Math.max(0, (league?.max_members || 0) - members.filter((member) => member.is_active !== false).length);
    for (let i = 0; i < openSpots; i += 1) {
      await localFunctions.add_ai_team({ league_id, ai_persona: "BALANCED" });
    }
    return { created: openSpots };
  },
  async fill_league_with_ai(payload = {}) {
    return localFunctions.fillLeagueWithAI(payload);
  },
  async processImportJobs(payload = {}) {
    const jobs = await entities.ImportJob.list("-created_date");
    const requestedJobId = payload?.job_id ? String(payload.job_id) : null;
    const pending = requestedJobId
      ? jobs.find((job) => String(job.id) === requestedJobId)
      : jobs.find((job) => job.status === "PENDING" || job.status === "RUNNING");
    if (!pending) return { processed: 0 };
    if (String(pending.job_type || "").toUpperCase() === "SCORING_UPDATE") {
      const seasonYear = pending.parameters?.season_year ? Number(pending.parameters.season_year) : null;
      localRecalculateFantasyPoints(seasonYear);
      const scope = seasonYear ? `${seasonYear}` : "all stored seasons";
      await entities.ImportJob.update(pending.id, {
        status: "COMPLETED",
        progress: 100,
        summary: `Recalculated fantasy points for ${scope}.`,
        logs: [...(pending.logs || []), `Recalculated fantasy points for ${scope}.`, "Updated player aggregates and player pool counts."],
      });
      return { processed: 1, job_type: "SCORING_UPDATE", season_year: seasonYear };
    }
    await entities.ImportJob.update(pending.id, {
      status: "COMPLETED",
      progress: 100,
      summary: "Job completed in demo mode.",
      logs: [...(pending.logs || []), "Processed in the local adapter."],
    });
    return { processed: 1 };
  },
  async diagnosticPlayerData() {
    const players = await entities.Player.list();
    return {
      total_players: players.length,
      positions: players.reduce((acc, player) => {
        acc[player.position] = (acc[player.position] || 0) + 1;
        return acc;
      }, {}),
      source_season_year: 2025,
    };
  },
  async testPagination() {
    const firstPage = await entities.Player.list("-avg_points", 5, 0);
    const secondPage = await entities.Player.list("-avg_points", 5, 5);
    return {
      first_page_count: firstPage.length,
      second_page_count: secondPage.length,
      first_page_first_player: firstPage[0]?.full_name || null,
    };
  },
  async importHistoricalStats({ source_season_year = 2025 } = {}) {
    const existingRules = await entities.SeasonScoringRule.filter({ season_year: Number(source_season_year) });
    if (!existingRules[0]) {
      const defaultRules = (await entities.Global.filter({ key: "SCORING_RULES" }))[0]?.value || DEFAULT_SCORING_RULES;
      await entities.SeasonScoringRule.create({
        season_year: Number(source_season_year),
        rules: defaultRules,
      });
    }
    const job = await entities.ImportJob.create({
      job_type: "HISTORICAL_STATS",
      status: "COMPLETED",
      progress: 100,
      parameters: { source_season_year },
      summary: `Loaded source season ${source_season_year}.`,
      logs: [`Imported normalized players and weekly stats for ${source_season_year}.`],
    });
    return { imported: playerSeed.length, job };
  },
  async cleanAll() {
    const seed = createSeedStore();
    writeLocalStore(seed);
    return { reset: true };
  },
  async invoke(name, payload = {}) {
    const fn = localFunctions[name];
    if (!fn) throw new Error(`Unknown function: ${name}`);
    return { data: await fn(payload) };
  },
};

const functions = isSupabaseConfigured
  ? {
      ...localFunctions,
      async invoke(name, payload = {}) {
        const { data, error } = await supabase.functions.invoke(name, { body: payload });
        if (error) throw mapSupabaseError(error);
        return { data };
      },
    }
  : localFunctions;

const auth = isSupabaseConfigured
  ? {
      async login({ email, password } = {}) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw mapSupabaseError(error);
        return data;
      },
      async signup({ email, password, first_name, last_name, display_name, profile_name, full_name, favorite_city, favorite_team, theme_primary, theme_secondary } = {}) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name,
              last_name,
              display_name,
              profile_name,
              full_name,
              favorite_city,
              favorite_team,
              theme_primary,
              theme_secondary,
            },
          },
        });
        if (error) throw mapSupabaseError(error);
        return data;
      },
      async resetPassword({ email } = {}) {
        const redirectTo = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw mapSupabaseError(error);
        return data;
      },
      async me() {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw mapSupabaseError(error);
        const user = sessionData?.session?.user;
        if (!user) return null;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        return {
          id: user.id,
          email: user.email,
          role: profile?.role || "manager",
          first_name: profile?.first_name || user.user_metadata?.first_name,
          last_name: profile?.last_name || user.user_metadata?.last_name,
          full_name: profile?.display_name || user.user_metadata?.full_name || user.email,
          profile_name: profile?.profile_name || user.user_metadata?.profile_name,
        };
      },
      async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw mapSupabaseError(error);
        return { success: true };
      },
      async isAuthenticated() {
        const { data } = await supabase.auth.getSession();
        return Boolean(data.session);
      },
    }
  : {
      async login() {
        if (typeof window !== "undefined") window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(DEMO_USER));
        return { user: DEMO_USER };
      },
      async signup() {
        if (typeof window !== "undefined") window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(DEMO_USER));
        return { user: DEMO_USER };
      },
      async resetPassword() {
        return { success: true };
      },
      async me() {
        if (typeof window === "undefined") return DEMO_USER;
        const existing = window.localStorage.getItem(CURRENT_USER_KEY);
        if (existing) return JSON.parse(existing);
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(DEMO_USER));
        return DEMO_USER;
      },
      async logout() {
        if (typeof window !== "undefined") window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(DEMO_USER));
        return { success: true };
      },
      async isAuthenticated() {
        return true;
      },
    };

function buildLocalPlayerPositionYearCounts(store) {
  const playersById = new Map((store.Player || []).map((player) => [player.id, player]));
  const grouped = new Map();

  (store.PlayerWeek || []).forEach((week) => {
    const player = playersById.get(week.player_id);
    if (!player) return;
    const seasonYear = Number(week.season_year);
    const position = String(player.position || "OFF").toUpperCase();
    if (!seasonYear) return;
    const key = `${seasonYear}:${position}`;
    const group = grouped.get(key) || {
      season_year: seasonYear,
      position,
      playerIds: new Set(),
      playersWithStats: new Set(),
      stat_weeks: 0,
      updated_date: now(),
    };
    group.playerIds.add(player.id);
    if (Number(week.fantasy_points || 0) !== 0) {
      group.playersWithStats.add(player.id);
      group.stat_weeks += 1;
    }
    grouped.set(key, group);
  });

  return [...grouped.values()].map((group) => ({
    id: `player_count_${group.season_year}_${group.position}`,
    season_year: group.season_year,
    position: group.position,
    total_players: group.playerIds.size,
    players_with_stats: group.playersWithStats.size,
    stat_weeks: group.stat_weeks,
    updated_date: group.updated_date,
  }));
}

function localStatNumber(stats = {}, key) {
  const parsed = Number(stats?.[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localRuleNumber(rules = DEFAULT_SCORING_RULES, category, key, fallback) {
  const parsed = Number(rules?.[category]?.[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function localCalculateFantasyPoints(stats = {}, position = "OFF", rules = DEFAULT_SCORING_RULES) {
  const n = (key) => localStatNumber(stats, key);
  const pos = String(position || "OFF").toUpperCase();

  if (pos === "K") {
    return (
      (n("fg_made_0_19") + n("fg_made_20_29") + n("fg_made_30_39")) * localRuleNumber(rules, "KICKER", "fg_0_39", 3) +
      n("fg_made_40_49") * localRuleNumber(rules, "KICKER", "fg_40_49", 4) +
      (n("fg_made_50_59") + n("fg_made_60_")) * localRuleNumber(rules, "KICKER", "fg_50_plus", 5) +
      n("pat_made") * localRuleNumber(rules, "KICKER", "xp_made", 1) +
      n("fg_missed") * localRuleNumber(rules, "KICKER", "fg_miss", -1) +
      n("pat_missed") * localRuleNumber(rules, "KICKER", "xp_miss", -1)
    );
  }

  if (pos === "DEF") {
    return (
      n("def_tackles_solo") * localRuleNumber(rules, "DEFENSE", "solo_tackle", 1.5) +
      n("def_tackle_assists") * localRuleNumber(rules, "DEFENSE", "assist_tackle", 0.75) +
      n("def_tackles_for_loss") * localRuleNumber(rules, "DEFENSE", "tackle_for_loss", 1) +
      n("def_sacks") * localRuleNumber(rules, "DEFENSE", "sack", 3) +
      n("def_qb_hits") * localRuleNumber(rules, "DEFENSE", "qb_hit", 0.5) +
      n("def_interceptions") * localRuleNumber(rules, "DEFENSE", "interception", 4) +
      n("def_pass_defended") * localRuleNumber(rules, "DEFENSE", "pass_defended", 1) +
      n("def_fumbles_forced") * localRuleNumber(rules, "DEFENSE", "fumble_forced", 2) +
      (n("fumble_recovery_own") + n("fumble_recovery_opp")) * localRuleNumber(rules, "DEFENSE", "fumble_recovered", 2) +
      n("def_safeties") * localRuleNumber(rules, "DEFENSE", "safety", 2) +
      (n("def_tds") + n("fumble_recovery_tds") + n("special_teams_tds")) * localRuleNumber(rules, "DEFENSE", "touchdown", 6)
    );
  }

  return (
    n("completions") * localRuleNumber(rules, "OFFENSE", "completion", 0.2) +
    Math.max(n("attempts") - n("completions"), 0) * localRuleNumber(rules, "OFFENSE", "incompletion", -0.3) +
    n("passing_yards") * localRuleNumber(rules, "OFFENSE", "passing_yard", 0.04) +
    n("passing_tds") * localRuleNumber(rules, "OFFENSE", "passing_td", 4) +
    n("passing_interceptions") * localRuleNumber(rules, "OFFENSE", "passing_int", -2) +
    n("passing_first_downs") * localRuleNumber(rules, "OFFENSE", "passing_first_down", 0.5) +
    n("rushing_yards") * localRuleNumber(rules, "OFFENSE", "rushing_yard", 0.1) +
    n("rushing_tds") * localRuleNumber(rules, "OFFENSE", "rushing_td", 6) +
    n("rushing_first_downs") * localRuleNumber(rules, "OFFENSE", "rushing_first_down", 0.5) +
    n("receptions") * localRuleNumber(rules, "OFFENSE", "reception", 1) +
    n("receiving_yards") * localRuleNumber(rules, "OFFENSE", "receiving_yard", 0.1) +
    n("receiving_tds") * localRuleNumber(rules, "OFFENSE", "receiving_td", 6) +
    n("receiving_first_downs") * localRuleNumber(rules, "OFFENSE", "receiving_first_down", 0.5) +
    (n("rushing_fumbles") + n("receiving_fumbles")) * localRuleNumber(rules, "OFFENSE", "fumble", -1) +
    (n("rushing_fumbles_lost") + n("receiving_fumbles_lost")) * localRuleNumber(rules, "OFFENSE", "fumble_lost", -2) +
    n("fumble_recovery_tds") * localRuleNumber(rules, "OFFENSE", "rushing_td", 6) +
    (n("passing_2pt_conversions") + n("rushing_2pt_conversions") + n("receiving_2pt_conversions")) * localRuleNumber(rules, "OFFENSE", "two_pt_conversion", 2) +
    (n("rushing_yards") + n("receiving_yards") >= 100 ? localRuleNumber(rules, "OFFENSE", "bonus_100_rush_rec_yards", 3) : 0) +
    (n("passing_yards") >= 300 ? localRuleNumber(rules, "OFFENSE", "bonus_300_pass_yards", 3) : 0)
  );
}

function localRefreshPlayerAggregates(store) {
  const grouped = new Map();
  (store.PlayerWeek || []).forEach((week) => {
    const current = grouped.get(week.player_id) || { total: 0, high: null, low: null, count: 0, years: new Set() };
    const points = Number(week.fantasy_points || 0);
    current.total += points;
    current.high = current.high === null ? points : Math.max(current.high, points);
    current.low = current.low === null ? points : Math.min(current.low, points);
    current.count += 1;
    if (week.season_year) current.years.add(Number(week.season_year));
    grouped.set(week.player_id, current);
  });

  store.Player = (store.Player || []).map((player) => {
    const aggregate = grouped.get(player.id);
    if (!aggregate) return player;
    const activeYears = [...aggregate.years].sort((a, b) => a - b);
    return {
      ...player,
      active_years: activeYears,
      source_season_year: activeYears[activeYears.length - 1] || player.source_season_year,
      avg_points: aggregate.count ? aggregate.total / aggregate.count : 0,
      high_score: aggregate.high ?? 0,
      low_score: aggregate.low ?? 0,
      total_points: aggregate.total,
      updated_date: now(),
    };
  });
  store.PlayerPositionYearCount = buildLocalPlayerPositionYearCounts(store);
}

function localRecalculateFantasyPoints(seasonYear = null) {
  const store = readLocalStore();
  const defaultRules = (store.Global || []).find((row) => row.key === "SCORING_RULES")?.value || DEFAULT_SCORING_RULES;
  const playersById = new Map((store.Player || []).map((player) => [player.id, player]));
  const selectedYear = seasonYear ? Number(seasonYear) : null;

  store.SeasonScoringRule = store.SeasonScoringRule || [];
  const ensureRules = (year) => {
    let record = store.SeasonScoringRule.find((row) => Number(row.season_year) === Number(year));
    if (!record) {
      record = {
        id: `season_scoring_${year}`,
        season_year: Number(year),
        rules: defaultRules,
        created_date: now(),
      };
      store.SeasonScoringRule.push(record);
    }
    return record.rules || defaultRules;
  };

  store.PlayerWeek = (store.PlayerWeek || []).map((week) => {
    if (selectedYear && Number(week.season_year) !== selectedYear) return week;
    const player = playersById.get(week.player_id);
    const stats = { ...(week.raw_stats || {}), ...week };
    const fantasyPoints = localCalculateFantasyPoints(stats, player?.position, ensureRules(week.season_year));
    return { ...week, fantasy_points: Number(fantasyPoints.toFixed(2)), updated_date: now() };
  });

  localRefreshPlayerAggregates(store);
  writeLocalStore(store);
}

function normalizePlayerPoolSort(sortBy) {
  return ["-avg_points", "avg_points", "-total_points", "total_points", "-high_score", "high_score", "-low_score", "low_score"].includes(sortBy)
    ? sortBy
    : "-avg_points";
}

function localPlayerPoolList({ seasonYear, position, searchTerm, sortBy = "-avg_points", limit = 20, offset = 0 } = {}) {
  const store = readLocalStore();
  const weeks = store.PlayerWeek || [];
  const normalizedPosition = String(position || "ALL").toUpperCase();
  const normalizedSearch = String(searchTerm || "").trim().toLowerCase();
  const selectedYear = seasonYear ? Number(seasonYear) : null;

  const filtered = (store.Player || []).filter((player) => {
    if (Number(player.total_points || 0) === 0) return false;
    if (normalizedPosition !== "ALL" && String(player.position || "").toUpperCase() !== normalizedPosition) return false;
    if (normalizedSearch) {
      const playerName = `${player.player_display_name || ""} ${player.full_name || ""}`.toLowerCase();
      if (!playerName.includes(normalizedSearch)) return false;
    }
    if (selectedYear) {
      return weeks.some((week) => week.player_id === player.id && Number(week.season_year) === selectedYear);
    }
    return true;
  });

  const sorted = sortRecords(filtered, [normalizePlayerPoolSort(sortBy)]);
  const start = Number(offset) || 0;
  const end = start + (Number(limit) || 20);
  return {
    data: sorted.slice(start, end),
    totalCount: sorted.length,
    hasMore: sorted.length > end,
  };
}

const playerPool = isSupabaseConfigured
  ? {
      async listPlayers({ seasonYear, position, searchTerm, sortBy = "-avg_points", limit = 20, offset = 0 } = {}) {
        const { data, error } = await supabase.rpc("search_player_pool", {
          p_season_year: seasonYear ? Number(seasonYear) : null,
          p_position: position && position !== "ALL" ? position : null,
          p_search_term: searchTerm || null,
          p_sort_by: normalizePlayerPoolSort(sortBy),
          p_limit: limit,
          p_offset: offset,
        });
        if (error) throw mapSupabaseError(error);
        const rows = data || [];
        const totalCount = Number(rows[0]?.total_count || 0);
        return {
          data: rows.map(({ total_count, ...player }) => player),
          totalCount,
          hasMore: totalCount > Number(offset || 0) + rows.length,
        };
      },
      async listYears() {
        const { data, error } = await supabase
          .from("player_position_year_counts")
          .select("season_year")
          .order("season_year", { ascending: false });
        if (error) throw mapSupabaseError(error);
        return [...new Set((data || []).map((row) => Number(row.season_year)).filter(Boolean))];
      },
      async getPositionYearCount({ seasonYear, position } = {}) {
        if (!seasonYear || !position || position === "ALL") return null;
        const { data, error } = await supabase
          .from("player_position_year_counts")
          .select("*")
          .eq("season_year", Number(seasonYear))
          .eq("position", String(position).toUpperCase())
          .maybeSingle();
        if (error) throw mapSupabaseError(error);
        return data || null;
      },
    }
  : {
      async listPlayers(args = {}) {
        return localPlayerPoolList(args);
      },
      async listYears() {
        const store = readLocalStore();
        return [...new Set(buildLocalPlayerPositionYearCounts(store).map((row) => row.season_year))]
          .filter(Boolean)
          .sort((a, b) => b - a);
      },
      async getPositionYearCount({ seasonYear, position } = {}) {
        if (!seasonYear || !position || position === "ALL") return null;
        const store = readLocalStore();
        return buildLocalPlayerPositionYearCounts(store).find(
          (row) => Number(row.season_year) === Number(seasonYear) && row.position === String(position).toUpperCase()
        ) || null;
      },
    };

export const appClient = {
  isSupabaseConfigured,
  entities,
  auth,
  functions,
  playerPool,
  integrations: {
    Core: {
      UploadFile: uploadFile,
      UploadPrivateFile: uploadFile,
      CreateFileSignedUrl: async ({ file_url }) => ({ signed_url: file_url }),
      SendEmail: async (payload) => ({ sent: true, payload }),
      InvokeLLM: async ({ prompt }) => ({ response: `Stubbed response for: ${prompt || "empty prompt"}` }),
      GenerateImage: async () => ({ url: "" }),
      ExtractDataFromUploadedFile: async () => ({ data: [] }),
    },
  },
  resetLocalData() {
    const seed = createSeedStore();
    writeLocalStore(seed);
    return seed;
  },
};
