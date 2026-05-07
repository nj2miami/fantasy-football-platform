import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SCORING_RULES = {
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

const DEFAULT_ROSTER_RULES = {
  starters: { QB: 1, OFF: 1, FLEX: 1, K: 1, DEF: 1 },
  draft_groups: { QB: 2, OFF: 2, DEF: 2, K: 1, FLEX: 3 },
  position_limits: { QB: 2, OFF: 4, K: 1, DEF: 4 },
  bench: 5,
  total_drafted: 10,
  bench_scoring_multiplier: 0.5,
  treatment_scoring_multiplier: 0.25,
};

const DEFAULT_POSITION_CONFIG = [
  { position: "QB", group: "QB", enabled: true },
  { position: "OFF", group: "OFFENSE", enabled: true },
  { position: "RB", group: "OFFENSE", enabled: true },
  { position: "FB", group: "OFFENSE", enabled: true },
  { position: "WR", group: "OFFENSE", enabled: true },
  { position: "TE", group: "OFFENSE", enabled: true },
  { position: "OL", group: "OFFENSE", enabled: false },
  { position: "C", group: "OFFENSE", enabled: false },
  { position: "G", group: "OFFENSE", enabled: false },
  { position: "OT", group: "OFFENSE", enabled: false },
  { position: "K", group: "K", enabled: true },
  { position: "P", group: "OFFENSE", enabled: false },
  { position: "LS", group: "OFFENSE", enabled: false },
  { position: "DEF", group: "DEFENSE", enabled: true },
  { position: "DST", group: "DEFENSE", enabled: true },
  { position: "D/ST", group: "DEFENSE", enabled: true },
  { position: "DL", group: "DEFENSE", enabled: true },
  { position: "DE", group: "DEFENSE", enabled: true },
  { position: "DT", group: "DEFENSE", enabled: true },
  { position: "NT", group: "DEFENSE", enabled: true },
  { position: "LB", group: "DEFENSE", enabled: true },
  { position: "ILB", group: "DEFENSE", enabled: true },
  { position: "MLB", group: "DEFENSE", enabled: true },
  { position: "OLB", group: "DEFENSE", enabled: true },
  { position: "DB", group: "DEFENSE", enabled: true },
  { position: "CB", group: "DEFENSE", enabled: true },
  { position: "S", group: "DEFENSE", enabled: true },
  { position: "SAF", group: "DEFENSE", enabled: true },
  { position: "FS", group: "DEFENSE", enabled: true },
];

const DEFAULT_DRAFT_CONFIG = {
  type: "snake",
  rounds: 10,
  timer_seconds: 60,
};

const DEFAULT_TEAM_TIER_CAP = 25;
const DEFAULT_MANAGER_POINTS_STARTING = 0;
const DEFAULT_MANAGER_POINT_ACTIONS = {
  treat_bench_player: { label: "Treat Bench Player", active: false, cost: 1 },
  player_enhance: { label: "Player Enhance", active: false, cost: 1 },
  stat_reveal: { label: "Stat Reveal", active: false, cost: 1 },
  bench_productivity: { label: "Bench Productivity", active: false, cost: 1 },
};
const DEFAULT_LEAGUE_VISIBILITY_CONFIG = {
  league_type: "standard",
  fantasy_points_visibility: "hidden",
  draft_player_name_visibility: "shown",
  draft_team_visibility: "hidden_until_drafted",
  durability_mode: "hidden_until_drafted",
  manager_points_enabled: false,
  manager_point_actions: DEFAULT_MANAGER_POINT_ACTIONS,
};

const DURABILITY_LABELS: Record<number, string> = {
  3: "Perfect",
  2: "Healthy",
  1: "Normal",
  0: "Worn",
  [-1]: "Hurt",
  [-2]: "Struggling",
  [-3]: "Injured",
};

const DURABILITY_MULTIPLIERS: Record<number, number> = {
  3: 1.1,
  2: 1.05,
  1: 1,
  0: 0.95,
  [-1]: 0.9,
  [-2]: 0.85,
  [-3]: 0.8,
};

const REQUIRED_DRAFT_BUCKETS = ["QB", "OFF", "DEF", "K"];
const DRAFT_BUCKET_TARGETS: Record<string, number> = { QB: 30, OFF: 30, DEF: 30, K: 24 };
const DRAFT_BUCKET_MINIMUMS: Record<string, number> = { QB: 30, OFF: 30, DEF: 30, K: 1 };
const MIN_DRAFT_STAT_WEEKS = 8;
const PLAYER_TWO_WEEK_ASSIGNMENT = "per_lineup_player_two_week_average_v1";
const LEAGUE_PLAYER_SCORE_METHOD = "league-raw-actual-stat-weeks-v4";
const DRAFT_POOL_CHUNK_SIZE = 200;

const DEFAULT_SCHEDULE_CONFIG = {
  type: "interval",
  start_date: new Date().toISOString().slice(0, 10),
  games_per_period: 1,
  period_days: 7,
  preset_dates: [],
};

const DEFAULT_LEAGUE_PLAY_SETTINGS = {
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

type Json = Record<string, unknown>;
const PREMIUM_LEAGUE_LIMIT = 4;
const PAID_JOIN_FEE_MIN_CENTS = 500;
const PAID_JOIN_FEE_DEFAULT_MAX_CENTS = 5000;
const AI_PERSONAS = new Set(["BALANCED", "OFFENSIVE", "DEFENSIVE"]);
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

export async function parseRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUser(request: Request, supabase: ReturnType<typeof createClient>) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing Authorization bearer token");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error(error?.message || "Invalid user token");
  return data.user;
}

async function ensureProfile(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null; user_metadata?: Json }) {
  if (!user.email) throw new Error("Authenticated user is missing an email address");
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (existingProfileError) throw existingProfileError;
  if (existingProfile) return existingProfile;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      user_email: user.email,
      display_name: (user.user_metadata?.display_name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        "Manager",
      profile_name: user.user_metadata?.profile_name as string | undefined,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getProfile(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAdmin(supabase: ReturnType<typeof createClient>, user: { id: string }) {
  const profile = await getProfile(supabase, user);
  if (String(profile?.role || "").toLowerCase() !== "admin") throw new Error("Admin access required");
  return profile;
}

async function requireLeagueControl(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, leagueId: unknown) {
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();
  if (leagueError) throw leagueError;

  const profile = await getProfile(supabase, user);
  if (String(profile?.role || "").toLowerCase() === "admin") return { league, profile, isAdmin: true };
  if (league.commissioner_id === user.id || league.commissioner_email === user.email) return { league, profile, isAdmin: false };

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("profile_id", user.id)
    .eq("role_in_league", "COMMISSIONER")
    .eq("is_active", true)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw new Error("Commissioner access required");
  return { league, profile, isAdmin: false };
}

async function requireLeagueAccess(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, leagueId: unknown) {
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();
  if (leagueError) throw leagueError;

  const profile = await getProfile(supabase, user);
  if (String(profile?.role || "").toLowerCase() === "admin") return { league, profile, isAdmin: true };
  if (league.commissioner_id === user.id || league.commissioner_email === user.email) return { league, profile, isAdmin: false };

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("is_active", true)
    .or(`profile_id.eq.${user.id},user_email.eq.${user.email || ""}`)
    .maybeSingle();
  if (memberError) throw memberError;
  if (member) return { league, profile, isAdmin: false };

  throw new Error("League access required");
}

function makeInviteCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10)
    .toUpperCase();
}

function normalizeLeaguePlaySettings(payload: Json | null | undefined) {
  const league = payload || {};
  const managerPointsEnabled = league.manager_points_enabled === true;
  const draftMode = String(league.draft_mode || (league.mode === "weekly_redraft" ? "weekly_redraft" : "season_snake"));
  return {
    ...DEFAULT_LEAGUE_VISIBILITY_CONFIG,
    ...DEFAULT_LEAGUE_PLAY_SETTINGS,
    ...league,
    league_type: "standard",
    fantasy_points_visibility: "hidden",
    draft_player_name_visibility: String(league.draft_player_name_visibility || DEFAULT_LEAGUE_VISIBILITY_CONFIG.draft_player_name_visibility),
    draft_team_visibility: String(league.draft_team_visibility || DEFAULT_LEAGUE_VISIBILITY_CONFIG.draft_team_visibility),
    durability_mode: String(league.durability_mode || DEFAULT_LEAGUE_VISIBILITY_CONFIG.durability_mode),
    manager_points_enabled: managerPointsEnabled,
    manager_point_actions: { ...DEFAULT_MANAGER_POINT_ACTIONS, ...((league.manager_point_actions as Json | undefined) || {}) },
    mode: draftMode === "weekly_redraft" ? "weekly_redraft" : "traditional",
    draft_mode: draftMode,
    team_tier_cap: Number(league.team_tier_cap ?? DEFAULT_TEAM_TIER_CAP),
    manager_points_starting: managerPointsEnabled ? Number(league.manager_points_starting ?? DEFAULT_MANAGER_POINTS_STARTING) : 0,
    schedule_config: { ...DEFAULT_SCHEDULE_CONFIG, ...((league.schedule_config as Json | undefined) || {}) },
  };
}

function durabilityLabel(value: unknown) {
  return DURABILITY_LABELS[Number(value)] || "Normal";
}

function applyDurability(points: number, durability: unknown) {
  const multiplier = DURABILITY_MULTIPLIERS[Number(durability)] ?? 1;
  return Number((points * multiplier).toFixed(2));
}

function durabilityEnabled(league: Json) {
  return String(league.durability_mode || DEFAULT_LEAGUE_VISIBILITY_CONFIG.durability_mode) !== "off";
}

function lineupSlotStatus(slot: Json) {
  return String(slot.status || slot.lineup_status || slot.slot_status || slot.role || "active").toLowerCase();
}

function lineupSlotMultiplier(slot: Json) {
  const status = lineupSlotStatus(slot);
  if (status === "treating" || status === "treatment" || status === "treated") return 0.25;
  if (status === "bench" || status === "benched") return 0.5;
  return 1;
}

function draftBucketTarget(position: unknown) {
  return DRAFT_BUCKET_TARGETS[String(position || "").toUpperCase()] || 30;
}

function draftBucketMinimum(position: unknown) {
  return DRAFT_BUCKET_MINIMUMS[String(position || "").toUpperCase()] || draftBucketTarget(position);
}

function playerTierForRank(rank: number, position?: unknown) {
  if (String(position || "").toUpperCase() === "K") {
    if (rank <= 4) return 5;
    if (rank <= 8) return 4;
    if (rank <= 12) return 3;
    if (rank <= 16) return 2;
    return 1;
  }
  if (rank <= 6) return 5;
  if (rank <= 12) return 4;
  if (rank <= 18) return 3;
  if (rank <= 24) return 2;
  return 1;
}

function scoringRuleNumber(rules: Json, category: string, key: string, fallback: number) {
  const categoryRules = (rules?.[category] || {}) as Json;
  const parsed = Number(categoryRules[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeScoringRules(rules: Json | null | undefined) {
  const configured = rules || {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SCORING_RULES).map(([category, defaultRules]) => [
      category,
      {
        ...(defaultRules as Json),
        ...((configured[category] as Json | undefined) || {}),
      },
    ])
  ) as Json;
}

function statNumber(stats: Json, key: string) {
  const parsed = Number(stats?.[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statSum(stats: Json, keys: string[]) {
  return keys.reduce((sum, key) => sum + Math.abs(statNumber(stats, key)), 0);
}

function normalizeTeam(team: unknown) {
  const value = String(team || "").trim().toUpperCase();
  return value && value !== "FA" && value !== "UNK" && value !== "UNKNOWN" ? value : "";
}

async function positionConfig(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "POSITION_CONFIG")
    .maybeSingle();
  if (error) throw error;
  if (!Array.isArray(data?.value)) return DEFAULT_POSITION_CONFIG;
  const configured = new Map((data.value as Json[]).map((item) => [
    String(item.position || "").toUpperCase(),
    item,
  ]));
  const defaultPositions = new Set(DEFAULT_POSITION_CONFIG.map((item) => item.position));
  return DEFAULT_POSITION_CONFIG.map((item) => ({
    ...item,
    ...(configured.get(item.position) || {}),
  })).concat((data.value as Json[]).filter((item) => !defaultPositions.has(String(item.position || "").toUpperCase())));
}

function positionConfigMap(config: Json[] = DEFAULT_POSITION_CONFIG) {
  return new Map(config.map((item) => [
    String(item.position || "").toUpperCase(),
    { group: String(item.group || "").toUpperCase(), enabled: item.enabled !== false },
  ]));
}

function configuredPosition(position: string, config: Json[] = DEFAULT_POSITION_CONFIG) {
  return positionConfigMap(config).get(String(position || "").toUpperCase()) || null;
}

function scoringCategory(playerPosition: string, config: Json[] = DEFAULT_POSITION_CONFIG) {
  const position = String(playerPosition || "").toUpperCase();
  const configured = configuredPosition(position, config);
  if (position === "QB") return configured?.enabled === false ? "UNUSED" : "OFFENSE";
  if (position === "K") return configured?.enabled === false ? "UNUSED" : "KICKER";
  if (position === "OFF") return configured?.enabled === false ? "UNUSED" : "OFFENSE";
  if (position === "DEF" || position === "DST" || position === "D/ST") return configured?.enabled === false ? "UNUSED" : "DEFENSE";
  if (!configured?.enabled) return "UNUSED";
  const group = configured.group;
  if (group === "DEFENSE") return "DEFENSE";
  if (group === "OFFENSE") return "OFFENSE";
  return "UNUSED";
}

function rosterLimitBucket(playerPosition: string, config: Json[] = DEFAULT_POSITION_CONFIG) {
  const position = String(playerPosition || "").toUpperCase();
  const configured = configuredPosition(position, config);
  if ((position === "QB" || position === "K") && configured?.enabled !== false) return position;
  if (position === "OFF" && configured?.enabled !== false) return "OFF";
  if ((position === "DEF" || position === "DST" || position === "D/ST") && configured?.enabled !== false) return "DEF";
  if (!configured?.enabled) return "UNUSED";
  const group = configured.group;
  if (group === "DEFENSE") return "DEF";
  if (group === "OFFENSE") return "OFF";
  return "UNUSED";
}

function hasCompleteDraftBuckets(rows: Json[] = []) {
  const counts = draftBucketCounts(rows);
  return REQUIRED_DRAFT_BUCKETS.every((position) => Number(counts[position] || 0) >= draftBucketMinimum(position));
}

function draftBucketCounts(rows: Json[] = []) {
  return REQUIRED_DRAFT_BUCKETS.reduce((counts, bucket) => {
    counts[bucket] = rows.filter((row) => String(row.position || "").toUpperCase() === bucket).length;
    return counts;
  }, {} as Record<string, number>);
}

function assertCompleteDraftPool(rows: Json[] = []) {
  const counts = draftBucketCounts(rows);
  const missing = REQUIRED_DRAFT_BUCKETS.filter((bucket) => Number(counts[bucket] || 0) < draftBucketMinimum(bucket));
  if (missing.length) {
    throw new Error(
      `Draft pool generation is incomplete for ${missing.map((bucket) => `${bucket} (${counts[bucket] || 0}/${draftBucketMinimum(bucket)})`).join(", ")}. Check Admin Position Configuration and imported player stat data; draft-eligible players need at least ${MIN_DRAFT_STAT_WEEKS} actual stat weeks.`
    );
  }
  return counts;
}

function calculateFantasyPoints(stats: Json, playerPosition: string, rules: Json, config: Json[] = DEFAULT_POSITION_CONFIG) {
  const r = (category: string, key: string, fallback: number) => scoringRuleNumber(rules, category, key, fallback);
  const n = (key: string) => statNumber(stats, key);
  const category = scoringCategory(playerPosition, config);

  if (category === "KICKER") {
    return (
      (n("fg_made_0_19") + n("fg_made_20_29") + n("fg_made_30_39")) * r("KICKER", "fg_0_39", 3) +
      n("fg_made_40_49") * r("KICKER", "fg_40_49", 4) +
      (n("fg_made_50_59") + n("fg_made_60_")) * r("KICKER", "fg_50_plus", 5) +
      n("pat_made") * r("KICKER", "xp_made", 1) +
      n("fg_missed") * r("KICKER", "fg_miss", -1) +
      n("pat_missed") * r("KICKER", "xp_miss", -1)
    );
  }

  if (category === "DEFENSE") {
    return (
      n("def_tackles_solo") * r("DEFENSE", "solo_tackle", 1.5) +
      n("def_tackle_assists") * r("DEFENSE", "assist_tackle", 0.75) +
      n("def_tackles_for_loss") * r("DEFENSE", "tackle_for_loss", 1) +
      n("def_sacks") * r("DEFENSE", "sack", 3) +
      n("def_qb_hits") * r("DEFENSE", "qb_hit", 0.5) +
      n("def_interceptions") * r("DEFENSE", "interception", 4) +
      n("def_pass_defended") * r("DEFENSE", "pass_defended", 1) +
      n("def_fumbles_forced") * r("DEFENSE", "fumble_forced", 2) +
      (n("fumble_recovery_own") + n("fumble_recovery_opp")) * r("DEFENSE", "fumble_recovered", 2) +
      n("def_safeties") * r("DEFENSE", "safety", 2) +
      (n("def_tds") + n("fumble_recovery_tds") + n("special_teams_tds")) * r("DEFENSE", "touchdown", 6)
    );
  }

  if (category !== "OFFENSE") return 0;

  const incompletions = Math.max(n("attempts") - n("completions"), 0);
  return (
    n("completions") * r("OFFENSE", "completion", 0.2) +
    incompletions * r("OFFENSE", "incompletion", -0.3) +
    n("passing_yards") * r("OFFENSE", "passing_yard", 0.04) +
    n("passing_tds") * r("OFFENSE", "passing_td", 4) +
    n("passing_interceptions") * r("OFFENSE", "passing_int", -2) +
    n("passing_first_downs") * r("OFFENSE", "passing_first_down", 0.5) +
    n("rushing_yards") * r("OFFENSE", "rushing_yard", 0.1) +
    n("rushing_tds") * r("OFFENSE", "rushing_td", 6) +
    n("rushing_first_downs") * r("OFFENSE", "rushing_first_down", 0.5) +
    n("receptions") * r("OFFENSE", "reception", 1) +
    n("receiving_yards") * r("OFFENSE", "receiving_yard", 0.1) +
    n("receiving_tds") * r("OFFENSE", "receiving_td", 6) +
    n("receiving_first_downs") * r("OFFENSE", "receiving_first_down", 0.5) +
    (n("rushing_fumbles") + n("receiving_fumbles")) * r("OFFENSE", "fumble", -1) +
    (n("rushing_fumbles_lost") + n("receiving_fumbles_lost")) * r("OFFENSE", "fumble_lost", -2) +
    n("fumble_recovery_tds") * r("OFFENSE", "rushing_td", 6) +
    (n("passing_2pt_conversions") + n("rushing_2pt_conversions") + n("receiving_2pt_conversions")) * r("OFFENSE", "two_pt_conversion", 2) +
    (n("rushing_yards") + n("receiving_yards") >= 100 ? r("OFFENSE", "bonus_100_rush_rec_yards", 3) : 0) +
    (n("passing_yards") >= 300 ? r("OFFENSE", "bonus_300_pass_yards", 3) : 0)
  );
}

function hasActualStatWeek(stats: Json, playerPosition: string, config: Json[] = DEFAULT_POSITION_CONFIG) {
  const category = scoringCategory(playerPosition, config);
  if (category === "KICKER") {
    return statSum(stats, [
      "fg_att",
      "fg_made",
      "fg_made_0_19",
      "fg_made_20_29",
      "fg_made_30_39",
      "fg_made_40_49",
      "fg_made_50_59",
      "fg_made_60_",
      "fg_missed",
      "pat_att",
      "pat_made",
      "pat_missed",
      "gwfg_made",
    ]) > 0;
  }
  if (category === "DEFENSE") {
    return statSum(stats, [
      "def_tackles_solo",
      "def_tackle_assists",
      "def_tackles_for_loss",
      "def_sacks",
      "def_qb_hits",
      "def_interceptions",
      "def_pass_defended",
      "def_fumbles_forced",
      "def_fumbles_recovered",
      "fumble_recovery_own",
      "fumble_recovery_opp",
      "def_safeties",
      "def_tds",
      "special_teams_tds",
    ]) > 0;
  }
  if (category === "OFFENSE") {
    return statSum(stats, [
      "attempts",
      "completions",
      "passing_yards",
      "passing_tds",
      "passing_interceptions",
      "passing_first_downs",
      "carries",
      "rushing_yards",
      "rushing_tds",
      "rushing_first_downs",
      "targets",
      "receptions",
      "receiving_yards",
      "receiving_tds",
      "receiving_first_downs",
      "rushing_fumbles",
      "receiving_fumbles",
      "rushing_fumbles_lost",
      "receiving_fumbles_lost",
    ]) > 0;
  }
  return false;
}

function scheduleDatesForLeague(league: Json) {
  const config = { ...DEFAULT_SCHEDULE_CONFIG, ...((league.schedule_config as Json | undefined) || {}) };
  const regularWeeks = Math.max(1, Number(league.playoff_start_week || Number(league.season_length_weeks || 8) + 1) - 1);
  const totalWeeks = Math.max(Number(league.season_length_weeks || regularWeeks), regularWeeks);
  if (config.type === "one_day") {
    const date = String(config.start_date || new Date().toISOString().slice(0, 10));
    return Array.from({ length: totalWeeks }, () => date);
  }
  if (config.type === "preset" && Array.isArray(config.preset_dates) && config.preset_dates.length) {
    return Array.from({ length: totalWeeks }, (_, index) => String(config.preset_dates[index % config.preset_dates.length]));
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

async function generateGameSchedule(supabase: ReturnType<typeof createClient>, league: Json) {
  await supabase.from("league_game_schedule").delete().eq("league_id", league.id);
  const rows = scheduleDatesForLeague(league).map((scheduledAt, index) => ({
    league_id: league.id,
    week_number: index + 1,
    game_number: 1,
    scheduled_at: scheduledAt,
    phase: index + 1 >= Number(league.playoff_start_week || 999) ? "playoff" : "regular",
    advancement_mode: league.advancement_mode || "manual",
    status: "SCHEDULED",
  }));
  if (!rows.length) return [];
  const { data, error } = await supabase.from("league_game_schedule").insert(rows).select("*");
  if (error) throw error;
  return data || [];
}

async function ensureWeekRandomization(supabase: ReturnType<typeof createClient>, league: Json, weekNumber: number, sourceSeasonYear: number) {
  const { data: existing, error: existingError } = await supabase
    .from("week_randomizations")
    .select("*")
    .eq("league_id", league.id)
    .eq("fantasy_week", weekNumber)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.assignment_method === PLAYER_TWO_WEEK_ASSIGNMENT && Number(existing.source_season_year || 0) === Number(sourceSeasonYear || 0)) return existing;
  if (existing) {
    const { error: staleRandomizationError } = await supabase
      .from("week_randomizations")
      .delete()
      .eq("id", existing.id);
    if (staleRandomizationError) throw staleRandomizationError;
  }

  const { data, error } = await supabase
    .from("week_randomizations")
    .insert({
      league_id: league.id,
      fantasy_week: weekNumber,
      source_season_year: sourceSeasonYear,
      reveal_state: "hidden",
      assignment_method: PLAYER_TWO_WEEK_ASSIGNMENT,
      assignments: {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

function sourceWeekLockSegment(league: Json, weekNumber: number) {
  if (weekNumber >= Number(league.playoff_start_week || 999)) return "playoffs";
  return weekNumber <= 4 ? "regular_1_4" : "regular_5_8";
}

function randomItem<T>(items: T[]) {
  return items[crypto.getRandomValues(new Uint32Array(1))[0] % items.length];
}

function sampleTwoSourceWeeks(weeks: number[], lockedWeeks: Set<number>) {
  const sorted = [...new Set(weeks)].filter(Boolean).sort((a, b) => a - b);
  if (sorted.length < 2) throw new Error("At least two usable source stat weeks are required for weekly scoring.");
  const available = sorted.filter((week) => !lockedWeeks.has(week));
  const pool = available.length >= 2 ? available : sorted;
  const first = randomItem(pool);
  const secondPool = pool.filter((week) => week !== first);
  return [first, randomItem(secondPool)];
}

async function usableSourceWeekScores(
  supabase: ReturnType<typeof createClient>,
  playerId: string,
  sourceSeasonYear: number,
  scoringRules: Json,
  config: Json[],
) {
  const { data, error } = await supabase
    .from("player_week_stats")
    .select("week,raw_stats,players!inner(position,team)")
    .eq("player_id", playerId)
    .eq("season_year", sourceSeasonYear);
  if (error) throw error;
  return (data || [])
    .map((row: Json) => {
      const player = Array.isArray(row.players) ? row.players[0] : row.players;
      const rawStats = (row.raw_stats || {}) as Json;
      const position = String(player?.position || "");
      if (!hasActualStatWeek(rawStats, position, config)) return null;
      return {
        week: Number(row.week || 0),
        points: calculateFantasyPoints(rawStats, position, scoringRules, config),
      };
    })
    .filter((row): row is { week: number; points: number } => Boolean(row?.week))
    .sort((a, b) => a.week - b.week);
}

function lowerValuedSample(samples: Array<{ week: number; points: number }>) {
  return [...samples].sort((a, b) => a.points - b.points || a.week - b.week)[0];
}

function higherValuedSample(samples: Array<{ week: number; points: number }>) {
  return [...samples].sort((a, b) => b.points - a.points || a.week - b.week)[0];
}

async function generateMatchups(supabase: ReturnType<typeof createClient>, league: Json, weekNumber: number) {
  if (league.schedule_type !== "head_to_head" && league.ranking_system !== "offl") return [];
  const { data: existing, error: existingError } = await supabase
    .from("matchups")
    .select("*")
    .eq("league_id", league.id)
    .eq("week_number", weekNumber);
  if (existingError) throw existingError;
  if (existing?.length) return existing;
  const { data: members, error: memberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (memberError) throw memberError;
  const rotated = [...(members || []).slice(weekNumber - 1), ...(members || []).slice(0, weekNumber - 1)];
  const rows = [];
  for (let index = 0; index < rotated.length - 1; index += 2) {
    rows.push({
      league_id: league.id,
      week_number: weekNumber,
      home_member_id: rotated[index].id,
      away_member_id: rotated[index + 1].id,
      home_score: 0,
      away_score: 0,
    });
  }
  if (!rows.length) return [];
  const { data, error } = await supabase.from("matchups").insert(rows).select("*");
  if (error) throw error;
  return data || [];
}

async function createMembershipAndStanding(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  user: { id: string; email?: string | null; user_metadata?: Json },
  teamName?: string,
) {
  if (!user.email) throw new Error("Authenticated user is missing an email address");
  const profile = await ensureProfile(supabase, user);
  const { count: existingCount, error: existingError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .or(`profile_id.eq.${user.id},user_email.eq.${user.email}`);
  if (existingError) throw existingError;
  if ((existingCount || 0) > 0) throw new Error("You are already in this league.");

  const { count: memberCount, error: memberCountError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (memberCountError) throw memberCountError;
  if ((memberCount || 0) >= Number(league.max_members || 0)) throw new Error("League is full.");

  const role = String(profile.role || "manager").toLowerCase();
  const { count: activeCount, error: activeCountError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("user_email", user.email)
    .eq("is_active", true)
    .eq("is_ai", false);
  if (activeCountError) throw activeCountError;
  if (role !== "admin" && role !== "premium" && (activeCount || 0) >= 1) {
    throw new Error("Your league limit is full. Premium managers can join up to 4 leagues.");
  }
  if ((role === "premium" || role === "manager") && (activeCount || 0) >= PREMIUM_LEAGUE_LIMIT) {
    throw new Error("Your league limit is full. Premium managers can join up to 4 leagues.");
  }

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .insert({
      league_id: league.id,
      profile_id: user.id,
      user_email: user.email,
      team_name: teamName || `${profile.profile_name || profile.display_name || "Manager"}'s Team`,
      role_in_league: "MANAGER",
      is_active: true,
      is_ai: false,
    })
    .select("*")
    .single();
  if (memberError) throw memberError;

  await supabase.from("standings").insert({ league_id: league.id, league_member_id: member.id });
  return member;
}

async function nextAiTeamName(supabase: ReturnType<typeof createClient>, leagueId: unknown) {
  const { data: parts } = await supabase.from("ai_team_name_parts").select("part_type,value");
  const firsts = (parts || []).filter((part) => part.part_type === "FIRST").map((part) => part.value);
  const lasts = (parts || []).filter((part) => part.part_type === "LAST").map((part) => part.value);
  const safeFirsts = firsts.length ? firsts : AI_FIRST_NAMES;
  const safeLasts = lasts.length ? lasts : AI_LAST_NAMES;
  const { data: used } = await supabase.from("used_ai_team_names").select("name").eq("league_id", leagueId);
  const usedNames = new Set((used || []).map((row) => row.name));

  for (const first of safeFirsts) {
    for (const last of safeLasts) {
      const name = `${first} ${last}`;
      if (usedNames.has(name)) continue;
      const { error } = await supabase.from("used_ai_team_names").insert({ league_id: leagueId, name });
      if (!error) return name;
    }
  }
  throw new Error("No unused AI team names remain.");
}

async function paidLeagueJoinFeeMaxCents(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "PAID_LEAGUE_JOIN_FEE_MAX_CENTS")
    .maybeSingle();
  const rawValue = data?.value;
  const parsed = typeof rawValue === "number"
    ? rawValue
    : typeof rawValue === "string"
      ? Number(rawValue)
      : Number((rawValue as Json | undefined)?.amount_cents || (rawValue as Json | undefined)?.value || PAID_JOIN_FEE_DEFAULT_MAX_CENTS);
  return Number.isFinite(parsed) && parsed >= PAID_JOIN_FEE_MIN_CENTS ? parsed : PAID_JOIN_FEE_DEFAULT_MAX_CENTS;
}

async function validateJoinFee(supabase: ReturnType<typeof createClient>, leagueTier: string, payload: Json) {
  const isPaidLeague = leagueTier === "PAID";
  const joinFeeCents = Number(payload.join_fee_cents || 0);
  const joinFeeCurrency = String(payload.join_fee_currency || "usd").toLowerCase();

  if (!Number.isInteger(joinFeeCents) || joinFeeCents < 0) {
    throw new Error("Join fee must be a valid USD amount.");
  }

  if (!isPaidLeague) {
    if (joinFeeCents !== 0) throw new Error("Free leagues cannot have a join fee.");
    return { joinFeeCents: 0, joinFeeCurrency: "usd" };
  }

  const maxCents = await paidLeagueJoinFeeMaxCents(supabase);
  if (joinFeeCurrency !== "usd") throw new Error("Paid league join fee currency must be USD.");
  if (joinFeeCents < PAID_JOIN_FEE_MIN_CENTS) throw new Error("Paid league join fee must be at least $5.00.");
  if (joinFeeCents > maxCents) throw new Error(`Paid league join fee cannot exceed $${(maxCents / 100).toFixed(2)}.`);
  return { joinFeeCents, joinFeeCurrency };
}

async function createLeague(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null; user_metadata?: Json }, payload: Json) {
  const profile = await ensureProfile(supabase, user);
  const role = String(profile.role || "manager").toLowerCase();
  const leagueTier = String(payload.league_tier || "FREE").toUpperCase();
  const maxMembers = Number(payload.max_members || 8);
  const isPaidLeague = leagueTier === "PAID";
  const minMembers = 4;
  const maxAllowedMembers = isPaidLeague ? 16 : 8;

  if (maxMembers < minMembers || maxMembers > maxAllowedMembers) {
    throw new Error(`${leagueTier} leagues must have between ${minMembers} and ${maxAllowedMembers} teams.`);
  }
  const { joinFeeCents, joinFeeCurrency } = await validateJoinFee(supabase, leagueTier, payload);

  const { count: membershipCount, error: membershipCountError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("user_email", user.email)
    .eq("is_active", true)
    .eq("is_ai", false);
  if (membershipCountError) throw membershipCountError;

  const { count: createdCount, error: createdCountError } = await supabase
    .from("leagues")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .or(`commissioner_id.eq.${user.id},commissioner_email.eq.${user.email}`);
  if (createdCountError) throw createdCountError;

  const activeMemberships = membershipCount || 0;
  const createdLeagues = createdCount || 0;
  const canCreate = role === "admin"
    || (role === "premium" && activeMemberships < PREMIUM_LEAGUE_LIMIT && createdLeagues < PREMIUM_LEAGUE_LIMIT)
    || (role === "manager" && !isPaidLeague && activeMemberships === 0 && createdLeagues === 0)
    || (role === "manager" && isPaidLeague && activeMemberships < PREMIUM_LEAGUE_LIMIT && createdLeagues < PREMIUM_LEAGUE_LIMIT);

  if (!canCreate) {
    throw new Error("Your league limit is full. Premium managers can create or join up to 4 leagues.");
  }

  const playSettings = normalizeLeaguePlaySettings(payload);
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      commissioner_id: user.id,
      commissioner_email: payload.commissioner_email || user.email,
      league_tier: leagueTier,
      is_public: payload.is_public ?? true,
      is_sponsored: payload.is_sponsored ?? false,
      league_status: payload.league_status || "RECRUITING",
      mode: playSettings.mode,
      draft_mode: playSettings.draft_mode,
      player_retention_mode: playSettings.player_retention_mode,
      schedule_type: playSettings.schedule_type,
      ranking_system: playSettings.ranking_system,
      advancement_mode: playSettings.advancement_mode,
      playoff_mode: playSettings.playoff_mode,
      playoff_start_week: playSettings.playoff_start_week,
      playoff_team_count: playSettings.playoff_team_count,
      schedule_config: playSettings.schedule_config,
      season_length_weeks: payload.season_length_weeks || 8,
      max_members: payload.max_members || 8,
      join_fee_cents: joinFeeCents,
      join_fee_currency: joinFeeCurrency,
      source_season_year: payload.source_season_year || new Date().getFullYear() - 1,
      scoring_rules: payload.scoring_rules || DEFAULT_SCORING_RULES,
      roster_rules: payload.roster_rules || DEFAULT_ROSTER_RULES,
      draft_config: payload.draft_config || DEFAULT_DRAFT_CONFIG,
      team_tier_cap: Number(payload.team_tier_cap ?? DEFAULT_TEAM_TIER_CAP),
      league_type: "standard",
      fantasy_points_visibility: "hidden",
      draft_player_name_visibility: payload.draft_player_name_visibility || DEFAULT_LEAGUE_VISIBILITY_CONFIG.draft_player_name_visibility,
      draft_team_visibility: payload.draft_team_visibility || DEFAULT_LEAGUE_VISIBILITY_CONFIG.draft_team_visibility,
      durability_mode: payload.durability_mode || DEFAULT_LEAGUE_VISIBILITY_CONFIG.durability_mode,
      manager_points_enabled: payload.manager_points_enabled === true,
      manager_points_starting: payload.manager_points_enabled === true ? Number(payload.manager_points_starting ?? DEFAULT_MANAGER_POINTS_STARTING) : 0,
      manager_point_actions: { ...DEFAULT_MANAGER_POINT_ACTIONS, ...((payload.manager_point_actions as Json | undefined) || {}) },
      header_image_url: payload.header_image_url ?? null,
    })
    .select("*")
    .single();
  if (leagueError) throw leagueError;

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .insert({
      league_id: league.id,
      profile_id: user.id,
      user_email: user.email,
      team_name: payload.team_name || `${profile.display_name || user.email?.split("@")[0]}'s Team`,
      role_in_league: "COMMISSIONER",
      is_active: true,
    })
    .select("*")
    .single();
  if (memberError) throw memberError;

  await supabase.from("standings").insert({
    league_id: league.id,
    league_member_id: member.id,
  });
  if (isPaidLeague && role === "manager") {
    await supabase
      .from("profiles")
      .update({ role: "premium" })
      .eq("id", user.id);
  }

  return { league, member };
}

async function joinLeague(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null; user_metadata?: Json }, payload: Json) {
  const { data: league, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", payload.league_id)
    .is("archived_at", null)
    .single();
  if (error) throw error;
  if (!league.is_public) throw new Error("This league requires an invite code.");
  const member = await createMembershipAndStanding(supabase, league, user, payload.team_name as string | undefined);
  return { league, member };
}

async function joinLeagueByInvite(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null; user_metadata?: Json }, payload: Json) {
  const code = String(payload.code || "").trim().toUpperCase();
  const { data: invite, error: inviteError } = await supabase
    .from("league_invites")
    .select("*, leagues(*)")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) throw new Error("Invite code is invalid or inactive.");
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Invite code has expired.");
  if (invite.max_uses && Number(invite.used_count || 0) >= Number(invite.max_uses)) throw new Error("Invite code has no uses remaining.");
  if (invite.leagues?.archived_at) throw new Error("This league is archived.");

  const member = await createMembershipAndStanding(supabase, invite.leagues, user, payload.team_name as string | undefined);
  await supabase
    .from("league_invites")
    .update({ used_count: Number(invite.used_count || 0) + 1, updated_date: new Date().toISOString() })
    .eq("id", invite.id);
  return { league: invite.leagues, member };
}

async function createLeagueInvite(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  await requireLeagueControl(supabase, user, payload.league_id);
  const code = String(payload.code || makeInviteCode()).trim().toUpperCase();
  const { data: invite, error } = await supabase
    .from("league_invites")
    .insert({
      league_id: payload.league_id,
      code,
      created_by: user.id,
      expires_at: payload.expires_at || null,
      max_uses: payload.max_uses || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { invite };
}

async function disableLeagueInvite(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: invite, error: inviteError } = await supabase.from("league_invites").select("*").eq("id", payload.invite_id).single();
  if (inviteError) throw inviteError;
  await requireLeagueControl(supabase, user, invite.league_id);
  const { data, error } = await supabase
    .from("league_invites")
    .update({ is_active: false, updated_date: new Date().toISOString() })
    .eq("id", invite.id)
    .select("*")
    .single();
  if (error) throw error;
  return { invite: data };
}

async function renameLeagueMemberTeam(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: member, error: memberError } = await supabase.from("league_members").select("*").eq("id", payload.member_id).single();
  if (memberError) throw memberError;
  await requireLeagueControl(supabase, user, member.league_id);
  const { data, error } = await supabase
    .from("league_members")
    .update({ team_name: payload.team_name, updated_date: new Date().toISOString() })
    .eq("id", member.id)
    .select("*")
    .single();
  if (error) throw error;
  return { member: data };
}

async function removeLeagueMember(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: member, error: memberError } = await supabase.from("league_members").select("*").eq("id", payload.member_id).single();
  if (memberError) throw memberError;
  const { league } = await requireLeagueControl(supabase, user, member.league_id);
  if (member.user_email === league.commissioner_email || member.role_in_league === "COMMISSIONER") {
    throw new Error("Transfer commissioner before removing this member.");
  }
  const { data, error } = await supabase
    .from("league_members")
    .update({ is_active: false, updated_date: new Date().toISOString() })
    .eq("id", member.id)
    .select("*")
    .single();
  if (error) throw error;
  return { member: data };
}

async function transferCommissioner(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: target, error: targetError } = await supabase.from("league_members").select("*").eq("id", payload.member_id).single();
  if (targetError) throw targetError;
  const { league } = await requireLeagueControl(supabase, user, target.league_id);
  if (!target.is_active || target.is_ai) throw new Error("Commissioner must be an active human member.");
  await supabase.from("league_members").update({ role_in_league: "MANAGER" }).eq("league_id", league.id).eq("role_in_league", "COMMISSIONER");
  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .update({ role_in_league: "COMMISSIONER", updated_date: new Date().toISOString() })
    .eq("id", target.id)
    .select("*")
    .single();
  if (memberError) throw memberError;
  const { data: updatedLeague, error: leagueError } = await supabase
    .from("leagues")
    .update({ commissioner_id: target.profile_id, commissioner_email: target.user_email, updated_date: new Date().toISOString() })
    .eq("id", league.id)
    .select("*")
    .single();
  if (leagueError) throw leagueError;
  return { league: updatedLeague, member };
}

async function addAiTeam(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league } = await requireLeagueControl(supabase, user, payload.league_id);
  const { count, error: countError } = await supabase.from("league_members").select("id", { count: "exact", head: true }).eq("league_id", league.id).eq("is_active", true);
  if (countError) throw countError;
  if ((count || 0) >= Number(league.max_members || 0)) throw new Error("League is full.");
  const persona = AI_PERSONAS.has(String(payload.ai_persona || payload.persona || "BALANCED"))
    ? String(payload.ai_persona || payload.persona || "BALANCED")
    : "BALANCED";
  const name = await nextAiTeamName(supabase, league.id);
  const { data: member, error } = await supabase
    .from("league_members")
    .insert({
      league_id: league.id,
      user_email: `ai-${league.id}-${crypto.randomUUID()}@offseason.fantasy`,
      team_name: name,
      role_in_league: "MANAGER",
      is_active: true,
      is_ai: true,
      ai_persona: persona,
    })
    .select("*")
    .single();
  if (error) throw error;
  await supabase.from("standings").insert({ league_id: league.id, league_member_id: member.id });
  return { member, teamName: name };
}

async function fillLeagueWithAi(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league } = await requireLeagueControl(supabase, user, payload.league_id);
  const { count, error: countError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (countError) throw countError;
  const openSpots = Math.max(0, Number(league.max_members || 0) - (count || 0));
  const members = [];
  for (let i = 0; i < openSpots; i += 1) {
    const result = await addAiTeam(supabase, user, { league_id: league.id, ai_persona: "BALANCED" });
    members.push(result.member);
  }
  return { created: members.length, members };
}

async function updateAiTeam(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: member, error: memberError } = await supabase.from("league_members").select("*").eq("id", payload.member_id).single();
  if (memberError) throw memberError;
  if (!member.is_ai) throw new Error("Only AI teams can be edited here.");
  await requireLeagueControl(supabase, user, member.league_id);
  const update: Json = {};
  if (payload.team_name) update.team_name = payload.team_name;
  if (AI_PERSONAS.has(String(payload.ai_persona))) update.ai_persona = payload.ai_persona;
  const { data, error } = await supabase.from("league_members").update({ ...update, updated_date: new Date().toISOString() }).eq("id", member.id).select("*").single();
  if (error) throw error;
  return { member: data };
}

async function removeAiTeam(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: member, error: memberError } = await supabase.from("league_members").select("*").eq("id", payload.member_id).single();
  if (memberError) throw memberError;
  if (!member.is_ai) throw new Error("Only AI teams can be removed here.");
  await requireLeagueControl(supabase, user, member.league_id);
  const { data, error } = await supabase.from("league_members").update({ is_active: false, updated_date: new Date().toISOString() }).eq("id", member.id).select("*").single();
  if (error) throw error;
  return { member: data };
}

async function archiveLeague(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league, isAdmin } = await requireLeagueControl(supabase, user, payload.league_id);
  const { count: seasonCount, error: seasonCountError } = await supabase
    .from("league_seasons")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);
  if (seasonCountError) throw seasonCountError;

  const { count: paidMemberCount, error: paidMemberCountError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("is_active", true)
    .eq("is_ai", false)
    .neq("role_in_league", "COMMISSIONER");
  if (paidMemberCountError) throw paidMemberCountError;

  if (!isAdmin && (seasonCount || 0) > 0) throw new Error("League has begun and cannot be deleted by commissioner.");
  if (!isAdmin && league.league_tier === "PAID" && (paidMemberCount || 0) > 0) {
    throw new Error("Paid members joined; only an admin can force delete this league.");
  }

  const { data, error } = await supabase
    .from("leagues")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      archive_reason: payload.archive_reason || "Deleted by commissioner",
      is_sponsored: false,
      updated_date: new Date().toISOString(),
    })
    .eq("id", league.id)
    .select("*")
    .single();
  if (error) throw error;

  const { error: memberArchiveError } = await supabase
    .from("league_members")
    .update({ is_active: false, updated_date: new Date().toISOString() })
    .eq("league_id", league.id);
  if (memberArchiveError) throw memberArchiveError;

  return { league: data };
}

async function forceDeleteLeague(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  await requireAdmin(supabase, user);
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", payload.league_id)
    .single();
  if (leagueError) throw leagueError;

  const { count: paidMemberCount, error: paidMemberCountError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("is_active", true)
    .eq("is_ai", false)
    .neq("role_in_league", "COMMISSIONER");
  if (paidMemberCountError) throw paidMemberCountError;

  const refundPending = league.league_tier === "PAID" && (paidMemberCount || 0) > 0;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("leagues")
    .update({
      archived_at: nowIso,
      archived_by: user.id,
      archive_reason: payload.archive_reason || "Admin force delete",
      is_sponsored: false,
      refund_status: refundPending ? "PENDING" : "NOT_REQUIRED",
      refund_required_at: refundPending ? nowIso : null,
      refund_reason: refundPending ? "Admin force delete after paid members joined" : null,
      updated_date: nowIso,
    })
    .eq("id", league.id)
    .select("*")
    .single();
  if (error) throw error;

  const { error: memberArchiveError } = await supabase
    .from("league_members")
    .update({ is_active: false, updated_date: nowIso })
    .eq("league_id", league.id);
  if (memberArchiveError) throw memberArchiveError;

  return { league: data, refund_pending: refundPending };
}

async function restoreLeague(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  await requireAdmin(supabase, user);
  const { data, error } = await supabase
    .from("leagues")
    .update({ archived_at: null, archived_by: null, archive_reason: null, updated_date: new Date().toISOString() })
    .eq("id", payload.league_id)
    .select("*")
    .single();
  if (error) throw error;
  return { league: data };
}

async function createOfficialLeague(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null; user_metadata?: Json }, payload: Json) {
  await requireAdmin(supabase, user);
  const result = await createLeague(supabase, user, {
    name: payload.name || "Official Retro League",
    description: payload.description || "A public league seeded from the current source season.",
    commissioner_email: user.email,
    team_name: "Official Commissioner",
    league_tier: "FREE",
    is_public: true,
    is_sponsored: true,
    mode: payload.mode || "traditional",
    draft_mode: payload.draft_mode || "season_snake",
    player_retention_mode: payload.player_retention_mode || "retained",
    schedule_type: payload.schedule_type || "head_to_head",
    ranking_system: payload.ranking_system || "standard",
    advancement_mode: payload.advancement_mode || "manual",
    playoff_mode: payload.playoff_mode || "roster_only",
    playoff_start_week: payload.playoff_start_week || 9,
    playoff_team_count: payload.playoff_team_count || 4,
    schedule_config: payload.schedule_config || DEFAULT_SCHEDULE_CONFIG,
    season_length_weeks: 8,
    max_members: payload.max_members || 8,
    source_season_year: payload.source_season_year || new Date().getFullYear() - 1,
    scoring_rules: DEFAULT_SCORING_RULES,
    roster_rules: DEFAULT_ROSTER_RULES,
    draft_config: DEFAULT_DRAFT_CONFIG,
    team_tier_cap: Number(payload.team_tier_cap ?? DEFAULT_TEAM_TIER_CAP),
    manager_points_enabled: payload.manager_points_enabled === true,
    manager_points_starting: payload.manager_points_enabled === true ? Number(payload.manager_points_starting ?? DEFAULT_MANAGER_POINTS_STARTING) : 0,
    manager_point_actions: payload.manager_point_actions || DEFAULT_MANAGER_POINT_ACTIONS,
  });
  await supabase.from("official_leagues").insert({ league_id: result.league.id, label: payload.label || "Official league" });
  return result;
}

async function setLeagueStatus(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json, status: string) {
  const { league } = await requireLeagueControl(supabase, user, payload.league_id);
  const update = status === "PAUSED"
    ? { league_status: status, paused_at: new Date().toISOString(), updated_date: new Date().toISOString() }
    : { league_status: status, paused_at: null, updated_date: new Date().toISOString() };
  const { data, error } = await supabase.from("leagues").update(update).eq("id", league.id).select("*").single();
  if (error) throw error;
  return { league: data };
}

const LEAGUE_SETTINGS_UPDATE_KEYS = [
  "name",
  "description",
  "is_public",
  "max_members",
  "league_type",
  "fantasy_points_visibility",
  "draft_player_name_visibility",
  "draft_team_visibility",
  "durability_mode",
  "manager_points_enabled",
  "manager_points_starting",
  "manager_point_actions",
  "commissioner_message_of_day",
  "league_rule_notes",
];

function jsonValueChanged(previous: unknown, next: unknown) {
  return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null);
}

function standardLeagueSettingsPayload(payload: Json) {
  const managerPointsEnabled = payload.manager_points_enabled === true;
  const update: Json = {};
  for (const key of LEAGUE_SETTINGS_UPDATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) update[key] = payload[key];
  }
  update.league_type = "standard";
  update.fantasy_points_visibility = "hidden";
  if (!update.draft_player_name_visibility) update.draft_player_name_visibility = DEFAULT_LEAGUE_VISIBILITY_CONFIG.draft_player_name_visibility;
  if (!update.draft_team_visibility) update.draft_team_visibility = DEFAULT_LEAGUE_VISIBILITY_CONFIG.draft_team_visibility;
  if (!update.durability_mode) update.durability_mode = DEFAULT_LEAGUE_VISIBILITY_CONFIG.durability_mode;
  update.manager_points_enabled = managerPointsEnabled;
  update.manager_points_starting = managerPointsEnabled ? Number(payload.manager_points_starting || 0) : 0;
  update.manager_point_actions = { ...DEFAULT_MANAGER_POINT_ACTIONS, ...((payload.manager_point_actions as Json | undefined) || {}) };
  update.updated_date = new Date().toISOString();
  return update;
}

async function updateLeagueSettings(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league, profile } = await requireLeagueControl(supabase, user, payload.league_id);
  const update = standardLeagueSettingsPayload(payload);
  if (update.manager_points_enabled && Number(update.manager_points_starting || 0) <= 0) {
    throw new Error("Manager Points starting value is required when Manager Points are enabled.");
  }
  const changedKeys = Object.keys(update).filter((key) => key !== "updated_date" && jsonValueChanged(league[key], update[key]));
  if (!changedKeys.length) return { league };

  const previousValues = Object.fromEntries(changedKeys.map((key) => [key, league[key] ?? null]));
  const newValues = Object.fromEntries(changedKeys.map((key) => [key, update[key] ?? null]));
  const { data, error } = await supabase.from("leagues").update(update).eq("id", league.id).select("*").single();
  if (error) throw error;

  if (league.rules_locked_at) {
    const { error: auditError } = await supabase.from("league_audit_events").insert({
      league_id: league.id,
      actor_profile_id: user.id,
      actor_email: user.email || profile?.user_email || null,
      changed_keys: changedKeys,
      previous_values: previousValues,
      new_values: newValues,
    });
    if (auditError) throw auditError;
  }

  if (changedKeys.includes("durability_mode")) await ensureLeagueDurability(supabase, normalizeLeaguePlaySettings(data));
  return { league: data, changed_keys: changedKeys };
}

async function voteLeagueAudit(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const vote = String(payload.vote || "").toLowerCase();
  if (!["up", "down"].includes(vote)) throw new Error("Vote must be up or down.");
  const { data: event, error: eventError } = await supabase
    .from("league_audit_events")
    .select("id,league_id")
    .eq("id", payload.audit_event_id)
    .single();
  if (eventError) throw eventError;
  await requireLeagueAccess(supabase, user, event.league_id);
  const { data, error } = await supabase
    .from("league_audit_feedback")
    .upsert({
      audit_event_id: event.id,
      league_id: event.league_id,
      profile_id: user.id,
      vote,
      updated_date: new Date().toISOString(),
    }, { onConflict: "audit_event_id,profile_id" })
    .select("*")
    .single();
  if (error) throw error;
  return { feedback: data };
}

async function startSeason(supabase: ReturnType<typeof createClient>, payload: Json) {
  const { data: rawLeague, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", payload.league_id)
    .single();
  if (leagueError) throw leagueError;
  const league = normalizeLeaguePlaySettings(rawLeague);

  const sourceSeasonYear = payload.source_season_year || league.source_season_year || new Date().getFullYear() - 1;
  const { data: season, error: seasonError } = await supabase
    .from("league_seasons")
    .insert({
      league_id: league.id,
      status: "ACTIVE",
      current_week: 1,
      season_year: new Date().getFullYear(),
      source_season_year: sourceSeasonYear,
      reveal_state: "hidden",
      mode: league.mode,
    })
    .select("*")
    .single();
  if (seasonError) throw seasonError;

  const { data: week, error: weekError } = await supabase
    .from("league_weeks")
    .upsert(
      {
        league_id: league.id,
        week_number: 1,
        status: league.draft_mode === "weekly_redraft" ? "DRAFT_OPEN" : "LINEUPS_OPEN",
        reveal_state: "hidden",
      },
      { onConflict: "league_id,week_number" },
    )
    .select("*")
    .single();
  if (weekError) throw weekError;

  await supabase.from("leagues").update({ league_status: "ACTIVE", updated_date: new Date().toISOString() }).eq("id", league.id);

  await ensureWeekRandomization(supabase, league, 1, Number(sourceSeasonYear));
  await ensureLeaguePlayerScores(supabase, league);
  await ensureManagerPointAccounts(supabase, league, season.id);
  await generateGameSchedule(supabase, league);
  await generateMatchups(supabase, league, 1);

  return { season, week };
}

async function openWeekDraft(supabase: ReturnType<typeof createClient>, payload: Json) {
  const weekNumber = Number(payload.week_number || 1);
  const { data: draft, error: draftError } = await supabase
    .from("drafts")
    .insert({
      league_id: payload.league_id,
      week_number: weekNumber,
      status: "OPEN",
      type: payload.type || "weekly_redraft",
    })
    .select("*")
    .single();
  if (draftError) throw draftError;

  const { data: room, error: roomError } = await supabase
    .from("draft_rooms")
    .insert({
      draft_id: draft.id,
      timer_seconds: Number(payload.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds),
      state: {},
    })
    .select("*")
    .single();
  if (roomError) throw roomError;

  await supabase.from("league_weeks").upsert(
    {
      league_id: payload.league_id,
      week_number: weekNumber,
      status: "DRAFT_OPEN",
      reveal_state: "hidden",
    },
    { onConflict: "league_id,week_number" },
  );

  return { draft, room };
}

async function scheduleDraft(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  const start = new Date(String(payload.start || ""));
  if (Number.isNaN(start.getTime())) throw new Error("Draft start date/time is required");

  const { data: existing, error: existingError } = await supabase
    .from("drafts")
    .select("*")
    .eq("league_id", league.id)
    .in("status", ["SCHEDULED", "OPEN"])
    .order("created_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === "OPEN") throw new Error("Cannot reschedule an active draft");
  const payloadDraft = {
    league_id: league.id,
    week_number: payload.week_number ? Number(payload.week_number) : null,
    status: "SCHEDULED",
    type: payload.type || ((league.draft_config as Json | undefined)?.type) || DEFAULT_DRAFT_CONFIG.type,
    start: start.toISOString(),
    updated_date: new Date().toISOString(),
  };

  const { data: draft, error } = existing
    ? await supabase.from("drafts").update(payloadDraft).eq("id", existing.id).select("*").single()
    : await supabase.from("drafts").insert(payloadDraft).select("*").single();
  if (error) throw error;
  await ensureLeaguePlayerScores(supabase, league);
  await ensureLeagueDurability(supabase, league);
  return { draft };
}

async function playerWeeksPlayed(supabase: ReturnType<typeof createClient>, playerId: string, seasonYear: number) {
  const { count, error } = await supabase
    .from("player_week_stats")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("season_year", seasonYear);
  if (error) throw error;
  return count || 0;
}

async function isDraftEligible(supabase: ReturnType<typeof createClient>, league: Json, playerId: string) {
  await ensureLeaguePlayerScores(supabase, league);
  const { data, error } = await supabase
    .from("league_player_scores")
    .select("position,position_rank")
    .eq("league_id", league.id)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data) && Number(data.position_rank || 0) <= draftBucketTarget(data.position);
}

async function rosterBucketCountsForMember(supabase: ReturnType<typeof createClient>, leagueMemberId: string, config: Json[]) {
  const { data: roster, error } = await supabase
    .from("roster_slots")
    .select("slot_type, players!inner(position)")
    .eq("league_member_id", leagueMemberId);
  if (error) throw error;
  return (roster || []).reduce((counts: Record<string, number>, slot: Json) => {
    const player = Array.isArray(slot.players) ? slot.players[0] : slot.players;
    const bucket = rosterLimitBucket(String(player?.position || slot.slot_type || ""), config);
    counts[bucket] = (counts[bucket] || 0) + 1;
    return counts;
  }, {});
}

async function canDraftPositionForMember(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string, position: string) {
  const limits = ((league.roster_rules as Json | undefined)?.position_limits || DEFAULT_ROSTER_RULES.position_limits) as Record<string, number>;
  const config = await positionConfig(supabase);
  const bucket = rosterLimitBucket(position, config);
  const limit = Number(limits[bucket] || 0);
  if (limit <= 0) return { allowed: false, bucket, limit, currentCount: 0 };
  const counts = await rosterBucketCountsForMember(supabase, leagueMemberId, config);
  const currentCount = Number(counts[bucket] || 0);
  return { allowed: currentCount < limit, bucket, limit, currentCount };
}

async function enforceRosterPositionLimit(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string, position: string) {
  const { allowed, bucket, limit, currentCount } = await canDraftPositionForMember(supabase, league, leagueMemberId, position);
  if (limit <= 0) throw new Error(`${String(position || "This position").toUpperCase()} is not draftable in this league.`);
  if (currentCount >= limit) throw new Error(`Roster already has ${limit} ${bucket} players.`);
  if (!allowed) throw new Error(`Roster cannot add another ${bucket} player.`);
}

async function ensureLeaguePlayerScores(supabase: ReturnType<typeof createClient>, league: Json) {
  const leagueId = String(league.id || "");
  if (!leagueId) throw new Error("League is required to calculate player scores.");
  const sourceSeasonYear = Number(league.source_season_year || new Date().getFullYear() - 1);
  const scoringRules = mergeScoringRules(league.scoring_rules as Json | undefined);
  const scoringRulesHash = `${LEAGUE_PLAYER_SCORE_METHOD}:${JSON.stringify(scoringRules).length}`;
  const config = await positionConfig(supabase);

  const { data: existing, error: existingError } = await supabase
    .from("league_player_scores")
    .select("id,position,weeks_played,scoring_rules_hash")
    .eq("league_id", leagueId)
    .lte("position_rank", 30);
  if (existingError) throw existingError;
  const existingHashMatches = Boolean(existing?.length) && existing.every((row: Json) => row.scoring_rules_hash === scoringRulesHash);
  const existingWeeksEligible = Boolean(existing?.length) && existing.every((row: Json) => Number(row.weeks_played || 0) >= MIN_DRAFT_STAT_WEEKS);
  if (existingHashMatches && existingWeeksEligible && hasCompleteDraftBuckets(existing || [])) return;
  if (existing?.length) {
    const { error: deleteError } = await supabase.from("league_player_scores").delete().eq("league_id", leagueId);
    if (deleteError) throw deleteError;
  }

  const { data: weeks, error: weeksError } = await supabase
    .from("player_week_stats")
    .select("player_id,season_year,raw_stats,fantasy_points,players!inner(id,position,team,full_name,player_display_name)")
    .eq("season_year", sourceSeasonYear);
  if (weeksError) throw weeksError;

  const aggregates = new Map<string, { player_id: string; position: string; full_name: string; total: number; weeks: number }>();
  for (const week of weeks || []) {
    const player = Array.isArray(week.players) ? week.players[0] : week.players;
    const playerId = String(week.player_id || player?.id || "");
    if (!playerId) continue;
    const rawStats = ((week.raw_stats || {}) as Json);
    const playerPosition = String(player?.position || "");
    const bucket = rosterLimitBucket(playerPosition, config);
    if (bucket === "UNUSED") continue;
    if (!hasActualStatWeek(rawStats, playerPosition, config)) continue;
    const points = calculateFantasyPoints(rawStats, playerPosition, scoringRules, config);
    const current = aggregates.get(playerId) || {
      player_id: playerId,
      position: bucket,
      full_name: String(player?.player_display_name || player?.full_name || ""),
      total: 0,
      weeks: 0,
    };
    current.total += Number(points || 0);
    current.weeks += 1;
    aggregates.set(playerId, current);
  }

  const byPosition = new Map<string, Array<{ player_id: string; position: string; full_name: string; total: number; weeks: number; avg: number }>>();
  for (const aggregate of aggregates.values()) {
    if (aggregate.weeks < MIN_DRAFT_STAT_WEEKS) continue;
    const avg = aggregate.weeks ? aggregate.total / aggregate.weeks : 0;
    const rows = byPosition.get(aggregate.position) || [];
    rows.push({ ...aggregate, avg });
    byPosition.set(aggregate.position, rows);
  }

  const rows: Array<Json> = [];
  for (const [position, players] of byPosition.entries()) {
    players
      .sort((a, b) => b.total - a.total || b.avg - a.avg || a.full_name.localeCompare(b.full_name))
      .slice(0, draftBucketTarget(position))
      .forEach((player, index) => {
        const positionRank = index + 1;
        rows.push({
          league_id: leagueId,
          player_id: player.player_id,
          source_season_year: sourceSeasonYear,
          position: player.position,
          position_rank: positionRank,
          tier_value: playerTierForRank(positionRank, player.position),
          expected_avg_points: Number(player.avg.toFixed(4)),
          total_points: Number(player.total.toFixed(4)),
          weeks_played: player.weeks,
          scoring_rules_hash: scoringRulesHash,
        });
      });
  }

  assertCompleteDraftPool(rows);

  if (rows.length) {
    const { error } = await supabase.from("league_player_scores").upsert(rows, { onConflict: "league_id,player_id" });
    if (error) throw error;
  }
}

async function existingLeaguePlayerScoresComplete(supabase: ReturnType<typeof createClient>, league: Json, scoringRulesHash: string) {
  const { data: existing, error } = await supabase
    .from("league_player_scores")
    .select("id,position,weeks_played,scoring_rules_hash")
    .eq("league_id", league.id)
    .lte("position_rank", 30);
  if (error) throw error;
  const rows = existing || [];
  if (!rows.length) return false;
  const hashMatches = rows.every((row: Json) => row.scoring_rules_hash === scoringRulesHash);
  const weeksEligible = rows.every((row: Json) => Number(row.weeks_played || 0) >= MIN_DRAFT_STAT_WEEKS);
  return hashMatches && weeksEligible && hasCompleteDraftBuckets(rows);
}

async function syncLeagueDurabilityRows(supabase: ReturnType<typeof createClient>, league: Json) {
  if (!durabilityEnabled(league)) {
    const { error } = await supabase.from("league_player_durability").delete().eq("league_id", league.id);
    if (error) throw error;
    return;
  }
  const { data: players, error: playersError } = await supabase
    .from("league_player_scores")
    .select("player_id")
    .eq("league_id", league.id)
    .lte("position_rank", 30);
  if (playersError) throw playersError;
  if (!players?.length) return;
  const playerIds = new Set((players || []).map((player: Json) => player.player_id));

  const { data: existing, error: existingError } = await supabase
    .from("league_player_durability")
    .select("player_id")
    .eq("league_id", league.id);
  if (existingError) throw existingError;
  const staleIds = (existing || []).map((row: Json) => row.player_id).filter((playerId: unknown) => !playerIds.has(playerId));
  if (staleIds.length) {
    const { error: staleDeleteError } = await supabase
      .from("league_player_durability")
      .delete()
      .eq("league_id", league.id)
      .in("player_id", staleIds);
    if (staleDeleteError) throw staleDeleteError;
  }
  const existingIds = new Set((existing || []).map((row: Json) => row.player_id).filter((playerId: unknown) => playerIds.has(playerId)));
  const rows = (players || [])
    .filter((player: Json) => !existingIds.has(player.player_id))
    .map((player: Json) => {
      const durability = crypto.getRandomValues(new Uint32Array(1))[0] % 4;
      return {
        league_id: league.id,
        player_id: player.player_id,
        durability,
        initial_durability: durability,
        revealed_at: String(league.durability_mode || "") === "revealed_at_draft" ? new Date().toISOString() : null,
      };
    });
  if (rows.length) {
    const { error } = await supabase.from("league_player_durability").insert(rows);
    if (error) throw error;
  }
}

async function resetLeagueDraftPoolJob(supabase: ReturnType<typeof createClient>, league: Json, scoringRulesHash: string, totalPlayers: number) {
  await supabase.from("league_draft_pool_candidates").delete().eq("league_id", league.id);
  const { data, error } = await supabase
    .from("league_draft_pool_jobs")
    .upsert({
      league_id: league.id,
      status: "RUNNING",
      progress: 1,
      processed_players: 0,
      total_players: totalPlayers,
      scoring_rules_hash: scoringRulesHash,
      error_details: null,
      summary: "Preparing league draft pool.",
    }, { onConflict: "league_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function loadOrCreateDraftPoolJob(supabase: ReturnType<typeof createClient>, league: Json, scoringRulesHash: string) {
  const { count, error: countError } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  const totalPlayers = count || 0;

  const { data: job, error } = await supabase
    .from("league_draft_pool_jobs")
    .select("*")
    .eq("league_id", league.id)
    .maybeSingle();
  if (error) throw error;
  if (
    !job ||
    job.scoring_rules_hash !== scoringRulesHash ||
    !["PENDING", "RUNNING"].includes(String(job.status || "").toUpperCase())
  ) {
    return resetLeagueDraftPoolJob(supabase, league, scoringRulesHash, totalPlayers);
  }
  if (Number(job.total_players || 0) !== totalPlayers) {
    const { data: updatedJob, error: updateError } = await supabase
      .from("league_draft_pool_jobs")
      .update({ total_players: totalPlayers, updated_date: new Date().toISOString() })
      .eq("id", job.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return updatedJob;
  }
  return job;
}

async function processDraftPoolPlayerChunk(supabase: ReturnType<typeof createClient>, league: Json, job: Json, scoringRules: Json, scoringRulesHash: string, config: Json[]) {
  const sourceSeasonYear = Number(league.source_season_year || new Date().getFullYear() - 1);
  const start = Number(job.processed_players || 0);
  const end = start + DRAFT_POOL_CHUNK_SIZE - 1;
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id,position,team,full_name,player_display_name")
    .order("id", { ascending: true })
    .range(start, end);
  if (playersError) throw playersError;
  const playerRows = players || [];
  const playerById = new Map(playerRows.map((player: Json) => [String(player.id), player]));
  const candidatePlayerIds = playerRows
    .filter((player: Json) => rosterLimitBucket(String(player.position || ""), config) !== "UNUSED")
    .map((player: Json) => player.id);

  const aggregates = new Map<string, { player_id: string; position: string; total: number; weeks: number }>();
  if (candidatePlayerIds.length) {
    const { data: weeks, error: weeksError } = await supabase
      .from("player_week_stats")
      .select("player_id,raw_stats")
      .eq("season_year", sourceSeasonYear)
      .in("player_id", candidatePlayerIds);
    if (weeksError) throw weeksError;
    for (const week of weeks || []) {
      const player = playerById.get(String(week.player_id));
      if (!player) continue;
      const rawStats = ((week.raw_stats || {}) as Json);
      const playerPosition = String(player.position || "");
      if (!hasActualStatWeek(rawStats, playerPosition, config)) continue;
      const bucket = rosterLimitBucket(playerPosition, config);
      if (bucket === "UNUSED") continue;
      const points = calculateFantasyPoints(rawStats, playerPosition, scoringRules, config);
      const current = aggregates.get(String(week.player_id)) || {
        player_id: String(week.player_id),
        position: bucket,
        total: 0,
        weeks: 0,
      };
      current.total += Number(points || 0);
      current.weeks += 1;
      aggregates.set(String(week.player_id), current);
    }
  }

  const candidateRows = [...aggregates.values()]
    .filter((aggregate) => aggregate.weeks >= MIN_DRAFT_STAT_WEEKS)
    .map((aggregate) => ({
      league_id: league.id,
      player_id: aggregate.player_id,
      source_season_year: sourceSeasonYear,
      position: aggregate.position,
      total_points: Number(aggregate.total.toFixed(4)),
      expected_avg_points: Number((aggregate.total / aggregate.weeks).toFixed(4)),
      weeks_played: aggregate.weeks,
      scoring_rules_hash: scoringRulesHash,
    }));
  if (candidateRows.length) {
    const { error: upsertError } = await supabase
      .from("league_draft_pool_candidates")
      .upsert(candidateRows, { onConflict: "league_id,player_id" });
    if (upsertError) throw upsertError;
  }

  const processedPlayers = playerRows.length
    ? Math.min(Number(job.total_players || 0), start + playerRows.length)
    : Number(job.total_players || 0);
  const progress = Number(job.total_players || 0)
    ? Math.min(95, Math.max(1, Math.round((processedPlayers / Number(job.total_players || 1)) * 90)))
    : 95;
  const { data: updatedJob, error: updateError } = await supabase
    .from("league_draft_pool_jobs")
    .update({
      status: "RUNNING",
      progress,
      processed_players: processedPlayers,
      summary: `Processed ${processedPlayers} of ${Number(job.total_players || 0)} players.`,
      updated_date: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return updatedJob;
}

async function loadDraftPoolCandidates(supabase: ReturnType<typeof createClient>, leagueId: unknown, scoringRulesHash: string) {
  const rows: Json[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("league_draft_pool_candidates")
      .select("player_id,position,total_points,expected_avg_points,weeks_played")
      .eq("league_id", leagueId)
      .eq("scoring_rules_hash", scoringRulesHash)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function finalizeLeagueDraftPoolJob(supabase: ReturnType<typeof createClient>, league: Json, job: Json, scoringRulesHash: string) {
  const candidates = await loadDraftPoolCandidates(supabase, league.id, scoringRulesHash);

  const byPosition = new Map<string, Json[]>();
  for (const candidate of candidates || []) {
    const position = String(candidate.position || "").toUpperCase();
    const rows = byPosition.get(position) || [];
    rows.push(candidate);
    byPosition.set(position, rows);
  }

  const rows: Json[] = [];
  for (const [position, players] of byPosition.entries()) {
    players
      .sort((a, b) =>
        Number(b.total_points || 0) - Number(a.total_points || 0) ||
        Number(b.expected_avg_points || 0) - Number(a.expected_avg_points || 0)
      )
      .slice(0, draftBucketTarget(position))
      .forEach((player, index) => {
        const positionRank = index + 1;
        rows.push({
          league_id: league.id,
          player_id: player.player_id,
          source_season_year: Number(league.source_season_year || new Date().getFullYear() - 1),
          position,
          position_rank: positionRank,
          tier_value: playerTierForRank(positionRank, position),
          expected_avg_points: Number(Number(player.expected_avg_points || 0).toFixed(4)),
          total_points: Number(Number(player.total_points || 0).toFixed(4)),
          weeks_played: Number(player.weeks_played || 0),
          scoring_rules_hash: scoringRulesHash,
        });
      });
  }

  assertCompleteDraftPool(rows);
  await supabase.from("league_player_scores").delete().eq("league_id", league.id);
  const { error: upsertError } = await supabase
    .from("league_player_scores")
    .upsert(rows, { onConflict: "league_id,player_id" });
  if (upsertError) throw upsertError;
  await syncLeagueDurabilityRows(supabase, league);
  await supabase.from("league_draft_pool_candidates").delete().eq("league_id", league.id);

  const counts = draftBucketCounts(rows);
  const { data: completedJob, error: updateError } = await supabase
    .from("league_draft_pool_jobs")
    .update({
      status: "COMPLETED",
      progress: 100,
      summary: `Draft pool ready: ${rows.length} players.`,
      error_details: null,
      updated_date: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return { job: completedJob, buckets: counts, eligible_count: rows.length };
}

async function processLeagueDraftPoolJob(supabase: ReturnType<typeof createClient>, league: Json) {
  const scoringRules = mergeScoringRules(league.scoring_rules as Json | undefined);
  const scoringRulesHash = `${LEAGUE_PLAYER_SCORE_METHOD}:${JSON.stringify(scoringRules).length}`;
  const sourceSeasonYear = Number(league.source_season_year || new Date().getFullYear() - 1);
  const { count: sourceWeekCount, error: sourceWeekError } = await supabase
    .from("player_week_stats")
    .select("id", { count: "exact", head: true })
    .eq("season_year", sourceSeasonYear);
  if (sourceWeekError) throw sourceWeekError;
  if (!sourceWeekCount) {
    throw new Error(`No imported player week stats were found for source season ${sourceSeasonYear}. Choose a season with imported data or import that season before preparing the draft pool.`);
  }
  if (await existingLeaguePlayerScoresComplete(supabase, league, scoringRulesHash)) {
    await syncLeagueDurabilityRows(supabase, league);
    const { data: rows, count, error } = await supabase
      .from("league_player_scores")
      .select("id,position", { count: "exact" })
      .eq("league_id", league.id)
      .lte("position_rank", 30);
    if (error) throw error;
    return {
      league_id: league.id,
      status: "COMPLETED",
      complete: true,
      progress: 100,
      eligible_count: count || 0,
      buckets: draftBucketCounts(rows || []),
    };
  }

  const config = await positionConfig(supabase);
  const job = await loadOrCreateDraftPoolJob(supabase, league, scoringRulesHash);
  try {
    const processedJob = await processDraftPoolPlayerChunk(supabase, league, job, scoringRules, scoringRulesHash, config);
    if (Number(processedJob.processed_players || 0) >= Number(processedJob.total_players || 0)) {
      const finalized = await finalizeLeagueDraftPoolJob(supabase, league, processedJob, scoringRulesHash);
      return {
        league_id: league.id,
        status: "COMPLETED",
        complete: true,
        progress: 100,
        ...finalized,
      };
    }
    return {
      league_id: league.id,
      status: "RUNNING",
      complete: false,
      progress: Number(processedJob.progress || 1),
      processed_players: Number(processedJob.processed_players || 0),
      total_players: Number(processedJob.total_players || 0),
      summary: processedJob.summary || "Preparing league draft pool.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("league_draft_pool_jobs")
      .update({
        status: "FAILED",
        error_details: message,
        summary: "Draft pool preparation failed.",
        updated_date: new Date().toISOString(),
      })
      .eq("id", job.id);
    throw error;
  }
}

async function ensureLeagueDurability(supabase: ReturnType<typeof createClient>, league: Json) {
  await ensureLeaguePlayerScores(supabase, league);
  await syncLeagueDurabilityRows(supabase, league);
}

async function getPlayerTierValue(supabase: ReturnType<typeof createClient>, league: Json, playerId: string) {
  await ensureLeaguePlayerScores(supabase, league);
  const { data, error } = await supabase
    .from("league_player_scores")
    .select("tier_value")
    .eq("league_id", league.id)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.tier_value || 1);
}

async function leagueMemberTierTotal(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string) {
  const { data: roster, error: rosterError } = await supabase
    .from("roster_slots")
    .select("player_id")
    .eq("league_member_id", leagueMemberId);
  if (rosterError) throw rosterError;
  const playerIds = [...new Set((roster || []).map((slot: Json) => String(slot.player_id)).filter(Boolean))];
  if (!playerIds.length) return 0;
  await ensureLeaguePlayerScores(supabase, league);
  const { data: tiers, error: tierError } = await supabase
    .from("league_player_scores")
    .select("player_id,tier_value")
    .eq("league_id", league.id)
    .in("player_id", playerIds);
  if (tierError) throw tierError;
  const tiersByPlayer = new Map((tiers || []).map((tier: Json) => [String(tier.player_id), Number(tier.tier_value || 1)]));
  return playerIds.reduce((sum, playerId) => sum + Number(tiersByPlayer.get(playerId) || 1), 0);
}

async function enforceTeamTierCap(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string, playerId: string) {
  const cap = Number(league.team_tier_cap || 0);
  if (cap <= 0) return;
  await ensureLeaguePlayerScores(supabase, league);
  const currentTotal = await leagueMemberTierTotal(supabase, league, leagueMemberId);
  const playerTier = await getPlayerTierValue(supabase, league, playerId);
  if (currentTotal + playerTier > cap) {
    throw new Error(`Drafting this player would exceed the team tier cap (${currentTotal + playerTier}/${cap}).`);
  }
}

async function ensureManagerPointAccounts(supabase: ReturnType<typeof createClient>, league: Json, seasonId: unknown) {
  const startingPoints = Number(league.manager_points_starting || 0);
  if (startingPoints <= 0) return;
  const { data: members, error: memberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (memberError) throw memberError;
  const rows = (members || []).map((member: Json) => ({
    league_id: league.id,
    league_member_id: member.id,
    season_id: seasonId,
    starting_points: startingPoints,
    current_points: startingPoints,
  }));
  if (rows.length) {
    const { error } = await supabase
      .from("manager_point_accounts")
      .upsert(rows, { onConflict: "league_id,league_member_id,season_id" });
    if (error) throw error;
  }
}

function shuffleRows<T>(rows: T[]) {
  const shuffled = [...rows];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function startDraft(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  const { data: draft, error: draftError } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", payload.draft_id)
    .eq("league_id", league.id)
    .single();
  if (draftError) throw draftError;
  if (draft.status === "OPEN") return { draft };
  const start = draft.start ? new Date(draft.start) : null;
  if (!start || Date.now() < start.getTime()) throw new Error("Draft cannot start before its scheduled time");
  const scoringRules = mergeScoringRules(league.scoring_rules as Json | undefined);
  const scoringRulesHash = `${LEAGUE_PLAYER_SCORE_METHOD}:${JSON.stringify(scoringRules).length}`;
  if (!(await existingLeaguePlayerScoresComplete(supabase, league, scoringRulesHash))) {
    throw new Error("Draft pool is still preparing. Wait for the Eligible Players panel to finish before starting the draft.");
  }
  await syncLeagueDurabilityRows(supabase, league);

  const { data: members, error: memberError } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", league.id)
    .eq("is_active", true)
    .order("created_date", { ascending: true });
  if (memberError) throw memberError;
  if (!members?.length) throw new Error("No active teams are in this league");

  const { count: existingTurns, error: countError } = await supabase
    .from("draft_turns")
    .select("id", { count: "exact", head: true })
    .eq("draft_id", draft.id);
  if (countError) throw countError;

  if (!existingTurns) {
    const order = shuffleRows(members);
    const rounds = Math.max(1, Number((league.draft_config as Json | undefined)?.rounds || DEFAULT_DRAFT_CONFIG.rounds));
    const isSnake = String(draft.type || (league.draft_config as Json | undefined)?.type || "snake") === "snake";
    const turns = [];
    for (let round = 1; round <= rounds; round += 1) {
      const roundOrder = isSnake && round % 2 === 0 ? [...order].reverse() : order;
      for (const member of roundOrder) {
        turns.push({
          draft_id: draft.id,
          overall_pick: turns.length + 1,
          round,
          league_member_id: member.id,
        });
      }
    }
    const { error: turnError } = await supabase.from("draft_turns").insert(turns);
    if (turnError) throw turnError;
  }

  const { error: roomError } = await supabase.from("draft_rooms").upsert(
    {
      draft_id: draft.id,
      current_pick: 1,
      timer_seconds: Number((league.draft_config as Json | undefined)?.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds),
      state: { pick_started_at: new Date().toISOString() },
    },
    { onConflict: "draft_id" },
  );
  if (roomError) throw roomError;

  const { data: updatedDraft, error: updateError } = await supabase
    .from("drafts")
    .update({ status: "OPEN", started_at: new Date().toISOString(), updated_date: new Date().toISOString() })
    .eq("id", draft.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  await supabase
    .from("leagues")
    .update({ rules_locked_at: league.rules_locked_at || new Date().toISOString(), updated_date: new Date().toISOString() })
    .eq("id", league.id)
    .is("rules_locked_at", null);
  return { draft: updatedDraft };
}

async function prepareDraftPool(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  return processLeagueDraftPoolJob(supabase, league);
}

async function bestAvailablePlayer(supabase: ReturnType<typeof createClient>, league: Json, draftId: string, memberId?: string) {
  const { data: picks, error: picksError } = await supabase.from("draft_picks").select("player_id").eq("draft_id", draftId);
  if (picksError) throw picksError;
  const pickedIds = new Set((picks || []).map((pick) => pick.player_id));
  await ensureLeaguePlayerScores(supabase, league);

  if (memberId) {
    const { data: board, error: boardError } = await supabase
      .from("draft_board_items")
      .select("player_id, rank")
      .eq("league_id", league.id)
      .eq("league_member_id", memberId)
      .order("rank", { ascending: true });
    if (boardError) throw boardError;
    for (const item of board || []) {
      if (pickedIds.has(item.player_id)) continue;
      if (!(await isDraftEligible(supabase, league, item.player_id))) continue;
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("position")
        .eq("id", item.player_id)
        .single();
      if (playerError) throw playerError;
      const { allowed } = await canDraftPositionForMember(supabase, league, memberId, String(player.position || ""));
      if (allowed) return item.player_id;
    }
  }

  const { data: players, error: playersError } = await supabase
    .from("league_player_scores")
    .select("player_id,total_points,position_rank,players!inner(position)")
    .eq("league_id", league.id)
    .lte("position_rank", 30)
    .order("total_points", { ascending: false })
    .order("position_rank", { ascending: true })
    .limit(1000);
  if (playersError) throw playersError;

  for (const player of players || []) {
    if (pickedIds.has(player.player_id)) continue;
    if (memberId) {
      const playerRow = Array.isArray(player.players) ? player.players[0] : player.players;
      const { allowed } = await canDraftPositionForMember(supabase, league, memberId, String(playerRow?.position || ""));
      if (!allowed) continue;
    }
    return player.player_id;
  }
  throw new Error("No eligible players remain");
}

async function submitDraftPick(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: draft, error: draftError } = await supabase.from("drafts").select("*, leagues(*)").eq("id", payload.draft_id).single();
  if (draftError) throw draftError;
  if (draft.status !== "OPEN") throw new Error("Draft is not open");
  const league = normalizeLeaguePlaySettings(draft.leagues);
  const profile = await getProfile(supabase, user);

  const { data: room, error: roomError } = await supabase.from("draft_rooms").select("*").eq("draft_id", draft.id).single();
  if (roomError) throw roomError;
  const { data: turn, error: turnError } = await supabase
    .from("draft_turns")
    .select("*")
    .eq("draft_id", draft.id)
    .eq("overall_pick", room.current_pick)
    .single();
  if (turnError) throw turnError;

  const { data: member, error: memberError } = await supabase.from("league_members").select("*").eq("id", turn.league_member_id).single();
  if (memberError) throw memberError;
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
  const isCurrentManager = member.profile_id === user.id || member.user_email === user.email;
  const isCommissioner = draft.leagues?.commissioner_id === user.id || draft.leagues?.commissioner_email === user.email;
  const isAutoPick = payload.auto_pick === true;
  if (!isCurrentManager && !isAdmin && !isCommissioner && !isAutoPick) throw new Error("It is not your pick");

  const playerId = String(payload.player_id || "");
  if (!playerId) throw new Error("Player is required");
  if (!(await isDraftEligible(supabase, league, playerId))) throw new Error("Player is not draft eligible");

  const { data: player, error: playerError } = await supabase.from("players").select("position").eq("id", playerId).single();
  if (playerError) throw playerError;
  await enforceRosterPositionLimit(supabase, league, turn.league_member_id, String(player.position || ""));
  await enforceTeamTierCap(supabase, league, turn.league_member_id, playerId);

  const { data: pick, error: pickError } = await supabase
    .from("draft_picks")
    .insert({
      draft_id: draft.id,
      league_id: draft.league_id,
      league_member_id: turn.league_member_id,
      player_id: playerId,
      week_number: draft.week_number,
      overall_pick: turn.overall_pick,
      round: turn.round,
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (pickError) throw pickError;

  const { error: rosterError } = await supabase.from("roster_slots").insert({
    league_member_id: turn.league_member_id,
    player_id: playerId,
    slot_type: player.position || "OFF",
    week_number: null,
  });
  if (rosterError) throw rosterError;

  const { error: boardCleanupError } = await supabase
    .from("draft_board_items")
    .delete()
    .eq("league_id", draft.league_id)
    .eq("player_id", playerId);
  if (boardCleanupError) throw boardCleanupError;

  const { count: turnCount, error: turnCountError } = await supabase
    .from("draft_turns")
    .select("id", { count: "exact", head: true })
    .eq("draft_id", draft.id);
  if (turnCountError) throw turnCountError;
  const nextPick = Number(room.current_pick || 1) + 1;
  if (nextPick > Number(turnCount || 0)) {
    await supabase.from("drafts").update({ status: "COMPLETED", completed_at: new Date().toISOString() }).eq("id", draft.id);
  } else {
    await supabase.from("draft_rooms").update({
      current_pick: nextPick,
      state: { pick_started_at: new Date().toISOString() },
      updated_date: new Date().toISOString(),
    }).eq("draft_id", draft.id);
  }

  return { pick };
}

async function processDraftTimer(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { data: draft, error: draftError } = await supabase.from("drafts").select("*, leagues(*)").eq("id", payload.draft_id).single();
  if (draftError) throw draftError;
  if (draft.status !== "OPEN") return { processed: false };
  const { data: room, error: roomError } = await supabase.from("draft_rooms").select("*").eq("draft_id", draft.id).single();
  if (roomError) throw roomError;
  const startedAt = new Date(String((room.state as Json | undefined)?.pick_started_at || room.updated_date || room.created_date)).getTime();
  const timerMs = Number(room.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds) * 1000;
  if (Date.now() - startedAt < timerMs) return { processed: false };

  const { data: turn, error: turnError } = await supabase
    .from("draft_turns")
    .select("*")
    .eq("draft_id", draft.id)
    .eq("overall_pick", room.current_pick)
    .single();
  if (turnError) throw turnError;
  const playerId = await bestAvailablePlayer(supabase, normalizeLeaguePlaySettings(draft.leagues), draft.id, turn.league_member_id);
  return submitDraftPick(supabase, user, { draft_id: draft.id, player_id: playerId, auto_pick: true });
}

async function submitPick(supabase: ReturnType<typeof createClient>, payload: Json) {
  const { data: draft } = await supabase
    .from("drafts")
    .select("league_id, week_number")
    .eq("id", payload.draft_id)
    .maybeSingle();

  const leagueId = payload.league_id || draft?.league_id;
  const weekNumber = payload.week_number || draft?.week_number;
  const { data: rawLeague } = leagueId
    ? await supabase.from("leagues").select("*").eq("id", leagueId).maybeSingle()
    : { data: null };
  const league = normalizeLeaguePlaySettings(rawLeague);
  if (leagueId && league.draft_mode === "weekly_redraft") {
    const { data: used, error: usedError } = await supabase
      .from("manager_player_usage")
      .select("id")
      .eq("league_id", leagueId)
      .eq("league_member_id", payload.league_member_id)
      .eq("player_id", payload.player_id)
      .maybeSingle();
    if (usedError) throw usedError;
    if (used) throw new Error("This manager has already used that player this season.");
  }
  if (leagueId && payload.league_member_id && payload.player_id) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("position")
      .eq("id", payload.player_id)
      .single();
    if (playerError) throw playerError;
    await enforceRosterPositionLimit(supabase, league, String(payload.league_member_id), String(payload.slot_type || player.position || ""));
    await enforceTeamTierCap(supabase, league, String(payload.league_member_id), String(payload.player_id));
  }
  const { data: pick, error: pickError } = await supabase
    .from("draft_picks")
    .insert({
      draft_id: payload.draft_id,
      league_id: leagueId,
      league_member_id: payload.league_member_id,
      player_id: payload.player_id,
      week_number: weekNumber,
      overall_pick: payload.overall_pick ?? null,
      round: payload.round ?? null,
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (pickError) throw pickError;

  if (leagueId && payload.player_id) {
    const { error: boardCleanupError } = await supabase
      .from("draft_board_items")
      .delete()
      .eq("league_id", leagueId)
      .eq("player_id", payload.player_id);
    if (boardCleanupError) throw boardCleanupError;
  }

  if (payload.track_usage && leagueId && weekNumber) {
    await supabase.from("manager_player_usage").upsert(
      {
        league_id: leagueId,
        league_member_id: payload.league_member_id,
        player_id: payload.player_id,
        used_in_week: weekNumber,
      },
      { onConflict: "league_id,league_member_id,player_id" },
    );
  }

  if (payload.slot_type) {
    await supabase.from("roster_slots").insert({
      league_member_id: payload.league_member_id,
      player_id: payload.player_id,
      slot_type: payload.slot_type,
      week_number: weekNumber ?? null,
    });
  }

  return { pick };
}

async function finalizeLineup(supabase: ReturnType<typeof createClient>, payload: Json) {
  const { data: lineup, error } = await supabase
    .from("lineups")
    .upsert(
      {
        league_id: payload.league_id,
        league_member_id: payload.league_member_id,
        week_number: payload.week_number,
        slots: payload.slots || [],
        finalized_at: new Date().toISOString(),
      },
      { onConflict: "league_id,league_member_id,week_number" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return { lineup };
}

async function resolveWeek(supabase: ReturnType<typeof createClient>, payload: Json) {
  const leagueId = payload.league_id;
  const weekNumber = Number(payload.week_number);
  const { data: rawLeague, error: leagueError } = await supabase.from("leagues").select("*").eq("id", leagueId).single();
  if (leagueError) throw leagueError;
  const league = normalizeLeaguePlaySettings(rawLeague);
  await ensureLeaguePlayerScores(supabase, league);
  const config = await positionConfig(supabase);
  const randomization = await ensureWeekRandomization(supabase, league, weekNumber, Number(league.source_season_year || new Date().getFullYear() - 1));

  const { data: lineups } = await supabase
    .from("lineups")
    .select("*, league_members(team_name)")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);
  const { data: activeMembers, error: activeMembersError } = await supabase
    .from("league_members")
    .select("id,team_name")
    .eq("league_id", leagueId)
    .eq("is_active", true);
  if (activeMembersError) throw activeMembersError;

  const assignments = { ...((randomization?.assignments || {}) as Record<string, Json>) };
  const sourceSeasonYear = Number(randomization?.source_season_year || league.source_season_year || new Date().getFullYear() - 1);
  const scoringRules = mergeScoringRules(league.scoring_rules as Json | undefined);
  const lockSegment = sourceWeekLockSegment(league, weekNumber);
  const lineupEntries = (lineups || []).flatMap((lineup: Json) =>
    Array.isArray(lineup.slots)
      ? lineup.slots
        .map((slot: Json) => ({
          league_member_id: String(lineup.league_member_id || ""),
          player_id: String(slot.player_id || ""),
        }))
        .filter((entry) => entry.league_member_id && entry.player_id)
      : []
  );
  const lineupPlayerIds = [...new Set(lineupEntries.map((entry) => entry.player_id))];
  const lineupLeagueMemberIds = [...new Set(lineupEntries.map((entry) => entry.league_member_id))];
  const { data: lockedRows, error: lockedRowsError } = lineupEntries.length
    ? await supabase
      .from("manager_player_source_week_locks")
      .select("league_member_id,player_id,source_week")
      .eq("league_id", leagueId)
      .eq("segment", lockSegment)
      .in("league_member_id", lineupLeagueMemberIds)
      .in("player_id", lineupPlayerIds)
    : { data: [], error: null };
  if (lockedRowsError) throw lockedRowsError;
  const lockedByLineupPlayer = new Map<string, Set<number>>();
  for (const row of lockedRows || []) {
    const key = `${row.league_member_id}:${row.player_id}`;
    const locked = lockedByLineupPlayer.get(key) || new Set<number>();
    locked.add(Number(row.source_week || 0));
    lockedByLineupPlayer.set(key, locked);
  }
  const sourceWeekScoresByPlayer = new Map<string, Array<{ week: number; points: number }>>();
  const ensureSourceWeekScores = async (playerId: string) => {
    const existing = sourceWeekScoresByPlayer.get(playerId);
    if (existing) return existing;
    const scores = await usableSourceWeekScores(supabase, playerId, sourceSeasonYear, scoringRules, config);
    if (scores.length < 2) throw new Error(`Player ${playerId} does not have at least two usable source stat weeks for weekly scoring.`);
    sourceWeekScoresByPlayer.set(playerId, scores);
    return scores;
  };
  let assignmentsChanged = false;
  for (const entry of lineupEntries) {
    const key = `${entry.league_member_id}:${entry.player_id}`;
    const existingAssignment = assignments[key] || {};
    const existingWeeks = Array.isArray(existingAssignment.source_weeks)
      ? (existingAssignment.source_weeks as unknown[]).map((week) => Number(week || 0)).filter(Boolean)
      : [];
    if (existingWeeks.length === 2 && existingAssignment.segment === lockSegment) continue;
    const sourceScores = await ensureSourceWeekScores(entry.player_id);
    const sourceWeeks = sampleTwoSourceWeeks(sourceScores.map((score) => score.week), lockedByLineupPlayer.get(key) || new Set<number>());
    assignments[key] = {
      league_member_id: entry.league_member_id,
      player_id: entry.player_id,
      source_weeks: sourceWeeks,
      segment: lockSegment,
      source_season_year: sourceSeasonYear,
    };
    assignmentsChanged = true;
  }
  if (assignmentsChanged) {
    const { error: assignmentUpdateError } = await supabase
      .from("week_randomizations")
      .update({ assignments })
      .eq("id", randomization.id);
    if (assignmentUpdateError) throw assignmentUpdateError;
  }

  const { data: durabilityRows, error: durabilityError } = lineupPlayerIds.length && durabilityEnabled(league)
    ? await supabase
      .from("league_player_durability")
      .select("player_id,durability")
      .eq("league_id", leagueId)
      .in("player_id", lineupPlayerIds)
    : { data: [], error: null };
  if (durabilityError) throw durabilityError;
  const durabilityByPlayer = new Map((durabilityRows || []).map((row: Json) => [String(row.player_id), Number(row.durability)]));
  const lineupTotals: Array<{ league_member_id: string; team_name: string | null; total: number; slots: Json[] }> = [];

  for (const lineup of lineups || []) {
    let total = 0;
    const scoredSlots: Json[] = [];
    for (const slot of lineup.slots || []) {
      const playerId = String(slot.player_id || "");
      if (!playerId) continue;
      const assignmentKey = `${lineup.league_member_id}:${playerId}`;
      const assignment = assignments[assignmentKey] || {};
      const sourceWeeks = Array.isArray(assignment.source_weeks)
        ? (assignment.source_weeks as unknown[]).map((week) => Number(week || 0)).filter(Boolean)
        : [];
      if (sourceWeeks.length !== 2) throw new Error(`No two-week source assignment exists for lineup player ${assignmentKey}.`);
      const sourceScores = await ensureSourceWeekScores(playerId);
      const sourceScoreMap = new Map(sourceScores.map((score) => [score.week, score.points]));
      const sourceWeekValues = sourceWeeks.map((week) => ({
        week,
        points: Number((sourceScoreMap.get(week) || 0).toFixed(4)),
      }));
      const baseAverage = sourceWeekValues.reduce((sum, row) => sum + row.points, 0) / sourceWeekValues.length;
      const slotPoints = baseAverage * lineupSlotMultiplier(slot);
      const finalPoints = durabilityEnabled(league) ? applyDurability(slotPoints, durabilityByPlayer.get(playerId)) : Number(slotPoints.toFixed(2));
      total += finalPoints;
      scoredSlots.push({
        ...slot,
        player_id: playerId,
        source_weeks: sourceWeeks,
        source_week_values: sourceWeekValues,
        average_points: Number(baseAverage.toFixed(4)),
        lineup_multiplier: lineupSlotMultiplier(slot),
        scored_points: finalPoints,
      });
    }
    lineupTotals.push({
      league_member_id: lineup.league_member_id,
      team_name: lineup.league_members?.team_name || null,
      total: Number(total.toFixed(2)),
      slots: scoredSlots,
    });
  }
  const lineupMemberIds = new Set(lineupTotals.map((row) => row.league_member_id));
  for (const member of activeMembers || []) {
    if (lineupMemberIds.has(member.id)) continue;
    lineupTotals.push({
      league_member_id: member.id,
      team_name: member.team_name || null,
      total: 0,
      slots: [],
    });
  }

  const releases: Array<Json> = [];
  const { data: existingWeekResults, error: existingWeekResultError } = await supabase
    .from("league_week_results")
    .select("id")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);
  if (existingWeekResultError) throw existingWeekResultError;
  if (!(existingWeekResults || []).length) {
    const isPlayoff = weekNumber >= Number(league.playoff_start_week || 999);
    const durabilityUpdates = new Map<string, number>();
    for (const lineup of lineupTotals) {
      for (const slot of lineup.slots || []) {
        const playerId = String(slot.player_id || "");
        const currentDurability = durabilityByPlayer.get(playerId);
        if (durabilityEnabled(league) && currentDurability !== undefined) {
          const status = lineupSlotStatus(slot);
          const nextDurability = status === "treating" || status === "treatment" || status === "treated"
            ? Math.min(3, currentDurability + 1)
            : status === "bench" || status === "benched"
              ? currentDurability
              : Math.max(-3, currentDurability - 1);
          durabilityUpdates.set(playerId, nextDurability);
        }
        const { data: existing, error: existingError } = await supabase
          .from("manager_player_usage")
          .select("*")
          .eq("league_id", leagueId)
          .eq("league_member_id", lineup.league_member_id)
          .eq("player_id", playerId)
          .maybeSingle();
        if (existingError) throw existingError;
        const usageCount = Number(existing?.usage_count || 0) + 1;
        const usagePayload = {
          league_id: leagueId,
          league_member_id: lineup.league_member_id,
          player_id: playerId,
          used_in_week: existing?.used_in_week || weekNumber,
          usage_count: usageCount,
          first_used_week: existing?.first_used_week || weekNumber,
          last_used_week: weekNumber,
          use_context: isPlayoff ? "playoff" : "regular",
        };
        if (existing) {
          const { error } = await supabase.from("manager_player_usage").update(usagePayload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("manager_player_usage").insert(usagePayload);
          if (error) throw error;
        }
        if (league.player_retention_mode === "two_use_release" && usageCount >= 2 && !existing?.released_at) {
          await supabase
            .from("roster_slots")
            .delete()
            .eq("league_member_id", lineup.league_member_id)
            .eq("player_id", playerId);
          if (existing) await supabase.from("manager_player_usage").update({ released_at: new Date().toISOString() }).eq("id", existing.id);
          const { data: release, error: releaseError } = await supabase
            .from("player_release_events")
            .insert({
              league_id: leagueId,
              league_member_id: lineup.league_member_id,
              player_id: playerId,
              week_number: weekNumber,
              release_reason: "two_use_limit",
              available_at: new Date().toISOString(),
            })
            .select("*")
            .single();
          if (releaseError) throw releaseError;
          releases.push(release);
        }
      }
    }
    for (const [playerId, durability] of durabilityUpdates.entries()) {
      const { error } = await supabase
        .from("league_player_durability")
        .update({ durability })
        .eq("league_id", leagueId)
        .eq("player_id", playerId);
      if (error) throw error;
    }
  }

  await supabase.from("league_week_results").delete().eq("league_id", leagueId).eq("week_number", weekNumber);
  const sortedTotals = [...lineupTotals].sort((a, b) => b.total - a.total);
  const activeTeamCount = sortedTotals.length;
  const resultRows = sortedTotals.map((row, index) => ({
    league_id: leagueId,
    league_member_id: row.league_member_id,
    week_number: weekNumber,
    total_points: row.total,
    weekly_rank: index + 1,
    head_to_head_points: 0,
    rank_points: league.ranking_system === "offl" ? Math.max(activeTeamCount - index, 1) : 0,
    league_points: league.ranking_system === "offl" ? Math.max(activeTeamCount - index, 1) : 0,
    scoring_details: row.slots || [],
  }));

  const { data: matchups } = await supabase.from("matchups").select("*").eq("league_id", leagueId).eq("week_number", weekNumber);
  const matchupOutcomes = new Map<string, "win" | "loss" | "tie">();
  for (const matchup of matchups || []) {
    const home = resultRows.find((row) => row.league_member_id === matchup.home_member_id);
    const away = resultRows.find((row) => row.league_member_id === matchup.away_member_id);
    if (!home || !away) continue;
    if (Number(home.total_points || 0) > Number(away.total_points || 0)) {
      matchupOutcomes.set(String(matchup.home_member_id), "win");
      matchupOutcomes.set(String(matchup.away_member_id), "loss");
    } else if (Number(home.total_points || 0) < Number(away.total_points || 0)) {
      matchupOutcomes.set(String(matchup.home_member_id), "loss");
      matchupOutcomes.set(String(matchup.away_member_id), "win");
    } else {
      matchupOutcomes.set(String(matchup.home_member_id), "tie");
      matchupOutcomes.set(String(matchup.away_member_id), "tie");
    }
    await supabase.from("matchups").update({ home_score: home.total_points, away_score: away.total_points }).eq("id", matchup.id);
  }
  if (!(existingWeekResults || []).length && matchupOutcomes.size) {
    const lockRowsByKey = new Map<string, Json>();
    for (const lineup of lineupTotals) {
      const outcome = matchupOutcomes.get(String(lineup.league_member_id));
      if (!outcome) continue;
      for (const slot of lineup.slots || []) {
        const samples = Array.isArray(slot.source_week_values)
          ? (slot.source_week_values as Json[]).map((sample) => ({
            week: Number(sample.week || 0),
            points: Number(sample.points || 0),
          })).filter((sample) => sample.week)
          : [];
        if (samples.length < 2) continue;
        const lockedSample = outcome === "loss" ? higherValuedSample(samples) : lowerValuedSample(samples);
        lockRowsByKey.set(`${lineup.league_member_id}:${slot.player_id}:${lockSegment}:${lockedSample.week}`, {
          league_id: leagueId,
          league_member_id: lineup.league_member_id,
          player_id: slot.player_id,
          segment: lockSegment,
          source_week: lockedSample.week,
          locked_by_week: weekNumber,
          lock_reason: outcome === "loss" ? "loss_higher" : outcome === "tie" ? "tie_lower" : "win_lower",
        });
      }
    }
    const lockRows = [...lockRowsByKey.values()];
    if (lockRows.length) {
      const { error: lockError } = await supabase
        .from("manager_player_source_week_locks")
        .upsert(lockRows, { onConflict: "league_id,league_member_id,player_id,segment,source_week" });
      if (lockError) throw lockError;
    }
  }
  if (resultRows.length) {
    const { error: resultError } = await supabase.from("league_week_results").insert(resultRows);
    if (resultError) throw resultError;
  }

  const standingsResult = await recalculateStandings(supabase, { league_id: leagueId });

  await supabase
    .from("league_weeks")
    .update({ status: "RESOLVED" })
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);
  await supabase
    .from("league_game_schedule")
    .update({ status: "RESOLVED" })
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);

  return {
    week_number: weekNumber,
    randomized_assignments: assignments,
    matchup_totals: lineupTotals,
    durability: Object.fromEntries([...durabilityByPlayer.entries()].map(([playerId, durability]) => [
      playerId,
      { durability, label: durabilityLabel(durability), multiplier: DURABILITY_MULTIPLIERS[durability] ?? 1 },
    ])),
    standings_delta: standingsResult.standings,
    releases,
    reveal_state: randomization?.reveal_state || "hidden",
  };
}

async function advanceWeek(supabase: ReturnType<typeof createClient>, payload: Json) {
  const { data: rawLeague, error: leagueError } = await supabase.from("leagues").select("*").eq("id", payload.league_id).single();
  if (leagueError) throw leagueError;
  const league = normalizeLeaguePlaySettings(rawLeague);
  const { data: season, error: seasonError } = await supabase
    .from("league_seasons")
    .select("*")
    .eq("league_id", payload.league_id)
    .order("created_date", { ascending: false })
    .limit(1)
    .single();
  if (seasonError) throw seasonError;

  const nextWeek = Number(season.current_week || 1) + 1;
  const { data: updatedSeason, error: updateError } = await supabase
    .from("league_seasons")
    .update({ current_week: nextWeek })
    .eq("id", season.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const { data: week, error: weekError } = await supabase
    .from("league_weeks")
    .upsert(
      {
        league_id: payload.league_id,
        week_number: nextWeek,
        status: league.draft_mode === "weekly_redraft" ? "DRAFT_OPEN" : "LINEUPS_OPEN",
        reveal_state: "hidden",
      },
      { onConflict: "league_id,week_number" },
    )
    .select("*")
    .single();
  if (weekError) throw weekError;
  await ensureWeekRandomization(supabase, league, nextWeek, Number(season.source_season_year || league.source_season_year || new Date().getFullYear() - 1));
  await generateMatchups(supabase, league, nextWeek);

  return { current_week: nextWeek, season: updatedSeason, week };
}

async function revealWeekResults(supabase: ReturnType<typeof createClient>, payload: Json) {
  const { data: randomized, error } = await supabase
    .from("week_randomizations")
    .update({ reveal_state: "revealed" })
    .eq("league_id", payload.league_id)
    .eq("fantasy_week", payload.week_number)
    .select("*")
    .maybeSingle();
  if (error) throw error;

  await supabase
    .from("league_weeks")
    .update({ reveal_state: "revealed" })
    .eq("league_id", payload.league_id)
    .eq("week_number", payload.week_number);

  return { revealed: Boolean(randomized), randomized };
}

async function recalculateStandings(supabase: ReturnType<typeof createClient>, payload: Json) {
  const leagueId = payload.league_id;
  const { data: rawLeague, error: leagueError } = await supabase.from("leagues").select("*").eq("id", leagueId).single();
  if (leagueError) throw leagueError;
  const league = normalizeLeaguePlaySettings(rawLeague);
  const { data: members, error: memberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("is_active", true);
  if (memberError) throw memberError;

  const { data: results, error: resultError } = await supabase.from("league_week_results").select("*").eq("league_id", leagueId);
  if (resultError) throw resultError;
  const { data: matchups, error: matchupError } = await supabase.from("matchups").select("*").eq("league_id", leagueId);
  if (matchupError) throw matchupError;

  const rows = (members || []).map((member) => {
    const memberResults = (results || []).filter((row) => row.league_member_id === member.id);
    const memberMatchups = (matchups || []).filter((matchup) => matchup.home_member_id === member.id || matchup.away_member_id === member.id);
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let pointsAgainst = 0;
    for (const matchup of memberMatchups) {
      const isHome = matchup.home_member_id === member.id;
      const own = Number(isHome ? matchup.home_score : matchup.away_score);
      const opp = Number(isHome ? matchup.away_score : matchup.home_score);
      pointsAgainst += opp;
      if (own > opp) wins += 1;
      else if (own < opp) losses += 1;
      else ties += 1;
    }
    return {
      league_id: leagueId,
      league_member_id: member.id,
      wins,
      losses,
      ties,
      points_for: Number(memberResults.reduce((sum, row) => sum + Number(row.total_points || 0), 0).toFixed(2)),
      points_against: Number(pointsAgainst.toFixed(2)),
      league_points: Number(memberResults.reduce((sum, row) => sum + Number(row.league_points || 0), 0).toFixed(2)),
      weekly_rank_points: Number(memberResults.reduce((sum, row) => sum + Number(row.rank_points || 0), 0).toFixed(2)),
    };
  });

  if (rows.length) {
    const { error } = await supabase.from("standings").upsert(rows, {
      onConflict: "league_id,league_member_id",
    });
    if (error) throw error;
  }

  let standingsQuery = supabase
    .from("standings")
    .select("*")
    .eq("league_id", leagueId)
    .order("wins", { ascending: false })
    .order("ties", { ascending: false });
  standingsQuery = league.ranking_system === "offl"
    ? standingsQuery.order("league_points", { ascending: false }).order("points_for", { ascending: false })
    : standingsQuery.order("points_for", { ascending: false });
  const { data: standings, error: standingsError } = await standingsQuery;
  if (standingsError) throw standingsError;
  return { standings };
}

export async function handleAction(action: string, request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await parseRequest(request);
    const supabase = adminClient();
    const user = await getUser(request, supabase);

    const result = action === "create_league"
      ? await createLeague(supabase, user, payload)
      : action === "join_league"
        ? await joinLeague(supabase, user, payload)
        : action === "join_league_by_invite"
          ? await joinLeagueByInvite(supabase, user, payload)
          : action === "create_league_invite"
            ? await createLeagueInvite(supabase, user, payload)
            : action === "disable_league_invite"
              ? await disableLeagueInvite(supabase, user, payload)
              : action === "rename_league_member_team"
                ? await renameLeagueMemberTeam(supabase, user, payload)
                : action === "remove_league_member"
                  ? await removeLeagueMember(supabase, user, payload)
                  : action === "transfer_commissioner"
                    ? await transferCommissioner(supabase, user, payload)
                    : action === "add_ai_team"
                      ? await addAiTeam(supabase, user, payload)
                      : action === "fill_league_with_ai"
                        ? await fillLeagueWithAi(supabase, user, payload)
                      : action === "update_ai_team"
                        ? await updateAiTeam(supabase, user, payload)
                        : action === "remove_ai_team"
                          ? await removeAiTeam(supabase, user, payload)
                          : action === "archive_league"
                            ? await archiveLeague(supabase, user, payload)
                            : action === "force_delete_league"
                              ? await forceDeleteLeague(supabase, user, payload)
                              : action === "restore_league"
                                ? await restoreLeague(supabase, user, payload)
                                : action === "create_official_league"
                                  ? await createOfficialLeague(supabase, user, payload)
                                  : action === "update_league_settings"
                                    ? await updateLeagueSettings(supabase, user, payload)
                                    : action === "vote_league_audit"
                                      ? await voteLeagueAudit(supabase, user, payload)
                                  : action === "pause_league"
                                    ? await setLeagueStatus(supabase, user, payload, "PAUSED")
                                    : action === "resume_league"
                                      ? await setLeagueStatus(supabase, user, payload, "ACTIVE")
                                      : action === "schedule_draft"
                                        ? await scheduleDraft(supabase, user, payload)
                                        : action === "start_draft"
                                          ? await startDraft(supabase, user, payload)
                                          : action === "prepare_draft_pool"
                                            ? await prepareDraftPool(supabase, user, payload)
                                            : action === "submit_draft_pick"
                                              ? await submitDraftPick(supabase, user, payload)
                                              : action === "process_draft_timer"
                                                ? await processDraftTimer(supabase, user, payload)
        : action === "start_season"
          ? await startSeason(supabase, payload)
        : action === "open_week_draft"
          ? await openWeekDraft(supabase, payload)
          : action === "submit_pick"
            ? await submitPick(supabase, payload)
            : action === "finalize_lineup"
              ? await finalizeLineup(supabase, payload)
              : action === "resolve_week"
                ? await resolveWeek(supabase, payload)
                : action === "advance_week"
                  ? await advanceWeek(supabase, payload)
                  : action === "reveal_week_results"
                    ? await revealWeekResults(supabase, payload)
                    : action === "recalculate_standings"
                      ? await recalculateStandings(supabase, payload)
                      : null;

    if (!result) return json({ error: `Unknown action: ${action}` }, 404);
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}
