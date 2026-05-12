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
    qb_rushing_yard: 0.05,
    qb_rushing_td: 4,
    qb_rushing_first_down: 0.25,
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
const AI_DRAFT_PICK_DELAY_MIN_SECONDS = 3;
const AI_DRAFT_PICK_DELAY_MAX_SECONDS = 3;

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

const DURABILITY_MIN = 0;
const DURABILITY_MAX = 110;
const WEEKLY_DURABILITY_LOSS_MIN = 5;
const WEEKLY_DURABILITY_LOSS_MAX = 20;
const WIN_DURABILITY_RECOVERY = 5;
const LOSS_DURABILITY_PENALTY = 5;
const DEFAULT_GAME_PLAN_TYPE = "balanced";
const GAME_PLAN_TYPES = new Set(["balanced", "aggressive", "conservative", "counter"]);

const REQUIRED_DRAFT_BUCKETS = ["QB", "OFF", "DEF", "K"];
const DRAFT_BUCKET_TARGETS: Record<string, number> = { QB: 36, OFF: 36, DEF: 36, K: 20 };
const DRAFT_BUCKET_MINIMUMS: Record<string, number> = { QB: 36, OFF: 36, DEF: 36, K: 20 };
const DRAFT_MAX_BUCKET_TARGET = Math.max(...Object.values(DRAFT_BUCKET_TARGETS));
const MIN_DRAFT_STAT_WEEKS = 8;
const PLAYER_TWO_WEEK_ASSIGNMENT = "per_lineup_player_two_week_average_v1";
const LEAGUE_PLAYER_SCORE_METHOD = "league-qb-skill-positive-production-stat-weeks-v7";
const DRAFT_POOL_ENGINE_VERSION = "draft-pool-low-tier-flex-v3";
const DRAFT_POOL_CHUNK_SIZE = 200;

const DEFAULT_SCHEDULE_CONFIG = {
  type: "interval",
  start_date: new Date().toISOString().slice(0, 10),
  games_per_period: 1,
  period_days: 7,
  preset_dates: [],
};

function randomDurabilityLossPercent() {
  const range = WEEKLY_DURABILITY_LOSS_MAX - WEEKLY_DURABILITY_LOSS_MIN + 1;
  return WEEKLY_DURABILITY_LOSS_MIN + (crypto.getRandomValues(new Uint32Array(1))[0] % range);
}

function durabilityLossModifierFromSchedule(row: Json | null | undefined) {
  if (!row) return 0;
  const direct = Number(row.durability_loss_modifier ?? row.durability_loss_percent ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const conditions = (row.game_conditions || row.conditions || {}) as Json;
  const conditionValue = Number(
    conditions.durability_loss_modifier ??
      conditions.durability_loss_percent ??
      conditions.durability_loss ??
      conditions.weather_durability_loss ??
      0,
  );
  return Number.isFinite(conditionValue) && conditionValue > 0 ? conditionValue : 0;
}

const DEFAULT_LEAGUE_PLAY_SETTINGS = {
  draft_mode: "season_snake",
  player_retention_mode: "retained",
  player_retention_limit: null,
  schedule_type: "head_to_head",
  ranking_system: "standard",
  advancement_mode: "manual",
  playoff_mode: "roster_only",
  playoff_start_week: 9,
  playoff_team_count: 4,
  schedule_config: DEFAULT_SCHEDULE_CONFIG,
};

const PLAYOFF_TEAM_COUNTS = new Set([2, 4, 8]);

type Json = Record<string, unknown>;
const PREMIUM_LEAGUE_LIMIT = 4;
const PAID_JOIN_FEE_MIN_CENTS = 500;
const PAID_JOIN_FEE_DEFAULT_MAX_CENTS = 5000;
const AI_PERSONAS = new Set(["BALANCED", "OFFENSIVE", "DEFENSIVE"]);

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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message || error.name || "Unknown error";
  if (error && typeof error === "object") {
    const payload = error as Json;
    const message = payload.message || payload.error || payload.details || payload.hint || payload.code;
    if (typeof message === "string") return message;
    if (message && typeof message === "object") return errorMessage(message);
    const propertyPayload = Object.fromEntries(
      Object.getOwnPropertyNames(error)
        .map((key) => [key, (error as Record<string, unknown>)[key]])
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
    );
    if (Object.keys(propertyPayload).length) return errorMessage(propertyPayload);
    try {
      const serialized = JSON.stringify(payload);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to the generic message.
    }
    const stringified = String(error);
    if (stringified && stringified !== "[object Object]") return stringified;
    return "Unknown server error";
  }
  return String(error);
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

async function leagueDraftHasStarted(supabase: ReturnType<typeof createClient>, leagueId: unknown) {
  const { data, error } = await supabase
    .from("drafts")
    .select("id,status,started_at,completed_at")
    .eq("league_id", leagueId);
  if (error) throw error;
  return Boolean((data || []).some((draft: Json) => {
    const status = String(draft.status || "").toUpperCase();
    return Boolean(draft.started_at || draft.completed_at || ["OPEN", "COMPLETED"].includes(status));
  }));
}

async function assertLeagueSetupEditable(supabase: ReturnType<typeof createClient>, leagueId: unknown) {
  if (await leagueDraftHasStarted(supabase, leagueId)) {
    throw new Error("League setup is locked after the draft starts.");
  }
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
  const rawRetentionMode = String(league.player_retention_mode || DEFAULT_LEAGUE_PLAY_SETTINGS.player_retention_mode);
  const playerRetentionMode = draftMode === "weekly_redraft"
    ? "retained"
    : rawRetentionMode === "two_use_release"
      ? "limited_use"
      : rawRetentionMode;
  const playerRetentionLimit = playerRetentionMode === "limited_use" ? Math.max(1, Number(league.player_retention_limit || 2)) : null;
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
    player_retention_mode: playerRetentionMode,
    player_retention_limit: playerRetentionLimit,
    team_tier_cap: Number(league.team_tier_cap ?? DEFAULT_TEAM_TIER_CAP),
    manager_points_starting: managerPointsEnabled ? Number(league.manager_points_starting ?? DEFAULT_MANAGER_POINTS_STARTING) : 0,
    schedule_config: { ...DEFAULT_SCHEDULE_CONFIG, ...((league.schedule_config as Json | undefined) || {}) },
  };
}

function recommendedPlayoffTeamCount(teamCount: unknown) {
  const count = Number(teamCount || 0);
  if (count <= 4) return 2;
  if (count <= 10) return 4;
  return 8;
}

function normalizePlayoffTeamCount(value: unknown, teamCount: unknown) {
  const count = Number(value || recommendedPlayoffTeamCount(teamCount));
  if (!PLAYOFF_TEAM_COUNTS.has(count)) throw new Error("Playoff teams must be 2, 4, or 8.");
  return count;
}

function clampDurability(value: unknown) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(DURABILITY_MAX, Math.max(DURABILITY_MIN, Number(numeric.toFixed(2))));
}

function durabilityMultiplierFor(value: unknown) {
  return Number((clampDurability(value) / 100).toFixed(4));
}

function durabilityLabel(value: unknown) {
  const durability = clampDurability(value);
  if (durability >= 105) return "Surging";
  if (durability >= 100) return "Fresh";
  if (durability <= 50) return "Critical";
  if (durability <= 70) return "Strained";
  return "Worn";
}

function applyDurability(points: number, durability: unknown) {
  const multiplier = durabilityMultiplierFor(durability);
  return Number((points * multiplier).toFixed(2));
}

function durabilityEnabled(league: Json) {
  return String(league.durability_mode || DEFAULT_LEAGUE_VISIBILITY_CONFIG.durability_mode) !== "off";
}

function lineupSlotStatus(slot: Json) {
  return String(slot.status || slot.lineup_status || slot.slot_status || slot.role || "active").toLowerCase();
}

function isStartedLineupSlot(slot: Json) {
  const status = lineupSlotStatus(slot);
  return status !== "bench" && status !== "benched" && status !== "treating" && status !== "treatment" && status !== "treated";
}

function isTreatmentLineupSlot(slot: Json) {
  const status = lineupSlotStatus(slot);
  return status === "treating" || status === "treatment" || status === "treated";
}

function normalizeGamePlanType(value: unknown) {
  const gamePlanType = String(value || DEFAULT_GAME_PLAN_TYPE).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return GAME_PLAN_TYPES.has(gamePlanType) ? gamePlanType : DEFAULT_GAME_PLAN_TYPE;
}

function lineupSlotMultiplier(slot: Json) {
  const status = lineupSlotStatus(slot);
  if (status === "treating" || status === "treatment" || status === "treated") return 0.25;
  if (status === "bench" || status === "benched") return 0.5;
  return 1;
}

function lineupPositionBucket(position: unknown) {
  const value = String(position || "").toUpperCase();
  if (value === "QB" || value === "K") return value;
  if (value === "DEF" || value === "DST" || value === "D/ST" || value === "DL" || value === "LB" || value === "DB") return "DEF";
  return "OFF";
}

function draftBucketTarget(position: unknown) {
  return DRAFT_BUCKET_TARGETS[String(position || "").toUpperCase()] || 30;
}

function draftBucketMinimum(position: unknown) {
  return DRAFT_BUCKET_MINIMUMS[String(position || "").toUpperCase()] || draftBucketTarget(position);
}

function playerTierForRank(rank: number, position?: unknown) {
  if (String(position || "").toUpperCase() === "K") {
    if (rank <= 10) return 2;
    return 1;
  }
  if (rank <= 6) return 5;
  if (rank <= 12) return 4;
  if (rank <= 18) return 3;
  if (rank <= 27) return 2;
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Json).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Json)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableContentHash(value: unknown) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function scoringRulesHash(scoringRules: Json, sourceUpdatedAt?: string | null) {
  return `${LEAGUE_PLAYER_SCORE_METHOD}:${stableContentHash({
    scoringRules,
    sourceUpdatedAt: sourceUpdatedAt || null,
    draftPoolEngineVersion: DRAFT_POOL_ENGINE_VERSION,
    draftBucketTargets: DRAFT_BUCKET_TARGETS,
  })}`;
}

async function adminSeasonScoringRules(supabase: ReturnType<typeof createClient>, sourceSeasonYear: number) {
  const { data: seasonRules, error: seasonError } = await supabase
    .from("season_scoring_rules")
    .select("rules,updated_date,created_date")
    .eq("season_year", sourceSeasonYear)
    .maybeSingle();
  if (seasonError) throw seasonError;
  if (seasonRules?.rules) {
    return {
      rules: mergeScoringRules(seasonRules.rules as Json),
      sourceUpdatedAt: String(seasonRules.updated_date || seasonRules.created_date || ""),
      source: "season_default",
    };
  }

  const { data: globalRules, error: globalError } = await supabase
    .from("global_settings")
    .select("value,updated_date,created_date")
    .eq("key", "SCORING_RULES")
    .maybeSingle();
  if (globalError) throw globalError;
  if (globalRules?.value) {
    return {
      rules: mergeScoringRules(globalRules.value as Json),
      sourceUpdatedAt: String(globalRules.updated_date || globalRules.created_date || ""),
      source: "global_default",
    };
  }

  return {
    rules: mergeScoringRules(DEFAULT_SCORING_RULES),
    sourceUpdatedAt: "",
    source: "code_default",
  };
}

async function commissionerScoringOverrideEligible(supabase: ReturnType<typeof createClient>, league: Json) {
  if (String(league.league_tier || "").toUpperCase() === "PAID") return true;
  const commissionerId = String(league.commissioner_id || "");
  const commissionerEmail = String(league.commissioner_email || "");
  let query = supabase.from("profiles").select("role").limit(1);
  if (commissionerId) {
    query = query.eq("id", commissionerId);
  } else if (commissionerEmail) {
    query = query.eq("user_email", commissionerEmail);
  } else {
    return false;
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const role = String(data?.role || "").toLowerCase();
  return role === "premium" || role === "admin";
}

async function effectiveLeagueScoringRules(supabase: ReturnType<typeof createClient>, league: Json) {
  if (league.scoring_rules_locked_at) return mergeScoringRules(league.scoring_rules as Json | undefined);
  if (league.scoring_overrides_enabled === true) {
    return mergeScoringRules(league.scoring_rules as Json | undefined);
  }
  const sourceSeasonYear = Number(league.source_season_year || new Date().getFullYear() - 1);
  return (await adminSeasonScoringRules(supabase, sourceSeasonYear)).rules;
}

async function scoringRulesHashForLeague(supabase: ReturnType<typeof createClient>, league: Json) {
  const scoringRules = await effectiveLeagueScoringRules(supabase, league);
  const usesAdminDefaults = !league.scoring_rules_locked_at &&
    league.scoring_overrides_enabled !== true;
  const sourceUpdatedAt = usesAdminDefaults
    ? (await adminSeasonScoringRules(supabase, Number(league.source_season_year || new Date().getFullYear() - 1))).sourceUpdatedAt
    : String(league.scoring_rules_source_updated_at || league.scoring_rules_locked_at || league.updated_date || "");
  return {
    scoringRules,
    scoringRulesHash: scoringRulesHash(scoringRules, sourceUpdatedAt),
    sourceUpdatedAt,
  };
}

async function lockLeagueScoringRules(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  source: "commissioner" | "draft_start",
) {
  if (league.scoring_rules_locked_at) return normalizeLeaguePlaySettings(league);
  const scoringRules = await effectiveLeagueScoringRules(supabase, league);
  const { sourceUpdatedAt } = await scoringRulesHashForLeague(supabase, league);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("leagues")
    .update({
      scoring_rules: scoringRules,
      scoring_rules_locked_at: now,
      scoring_rules_lock_source: source,
      scoring_rules_source_updated_at: sourceUpdatedAt || now,
      scoring_rules_synced_at: now,
      rules_locked_at: league.rules_locked_at || now,
      updated_date: now,
    })
    .eq("id", league.id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeLeaguePlaySettings(data);
}

function statNumber(stats: Json, key: string) {
  const parsed = Number(stats?.[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statSum(stats: Json, keys: string[]) {
  return keys.reduce((sum, key) => sum + Math.abs(statNumber(stats, key)), 0);
}

function positiveStatSum(stats: Json, keys: string[]) {
  return keys.reduce((sum, key) => sum + Math.max(0, statNumber(stats, key)), 0);
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

function assertCompleteDraftPool(rows: Json[] = [], context: Json = {}) {
  const counts = draftBucketCounts(rows);
  const missing = REQUIRED_DRAFT_BUCKETS.filter((bucket) => Number(counts[bucket] || 0) < draftBucketMinimum(bucket));
  if (missing.length) {
    const details = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join(" | ");
    throw new Error(
      `Draft pool generation is incomplete for ${missing.map((bucket) => `${bucket} (${counts[bucket] || 0}/${draftBucketMinimum(bucket)})`).join(", ")}. Check Admin Position Configuration and imported player stat data; draft-eligible players need at least ${MIN_DRAFT_STAT_WEEKS} actual stat weeks.${details ? ` Diagnostics: ${details}.` : ""}`
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
  const isQuarterback = String(playerPosition || "").toUpperCase() === "QB";
  const rushingYardKey = isQuarterback ? "qb_rushing_yard" : "rushing_yard";
  const rushingTdKey = isQuarterback ? "qb_rushing_td" : "rushing_td";
  const rushingFirstDownKey = isQuarterback ? "qb_rushing_first_down" : "rushing_first_down";
  return (
    n("completions") * r("OFFENSE", "completion", 0.2) +
    incompletions * r("OFFENSE", "incompletion", -0.3) +
    n("passing_yards") * r("OFFENSE", "passing_yard", 0.04) +
    n("passing_tds") * r("OFFENSE", "passing_td", 4) +
    n("passing_interceptions") * r("OFFENSE", "passing_int", -2) +
    n("passing_first_downs") * r("OFFENSE", "passing_first_down", 0.5) +
    n("rushing_yards") * r("OFFENSE", rushingYardKey, isQuarterback ? 0.05 : 0.1) +
    n("rushing_tds") * r("OFFENSE", rushingTdKey, isQuarterback ? 4 : 6) +
    n("rushing_first_downs") * r("OFFENSE", rushingFirstDownKey, isQuarterback ? 0.25 : 0.5) +
    n("receptions") * r("OFFENSE", "reception", 1) +
    n("receiving_yards") * r("OFFENSE", "receiving_yard", 0.1) +
    n("receiving_tds") * r("OFFENSE", "receiving_td", 6) +
    n("receiving_first_downs") * r("OFFENSE", "receiving_first_down", 0.5) +
    (n("rushing_fumbles") + n("receiving_fumbles")) * r("OFFENSE", "fumble", -1) +
    (n("rushing_fumbles_lost") + n("receiving_fumbles_lost")) * r("OFFENSE", "fumble_lost", -2) +
    n("fumble_recovery_tds") * r("OFFENSE", rushingTdKey, isQuarterback ? 4 : 6) +
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
    return positiveStatSum(stats, [
      "passing_yards",
      "passing_tds",
      "passing_first_downs",
      "rushing_yards",
      "rushing_tds",
      "rushing_first_downs",
      "receptions",
      "receiving_yards",
      "receiving_tds",
      "receiving_first_downs",
      "passing_2pt_conversions",
      "rushing_2pt_conversions",
      "receiving_2pt_conversions",
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

function regularSeasonWeeksForLeague(league: Json) {
  return Math.max(1, Number(league.playoff_start_week || Number(league.season_length_weeks || 8) + 1) - 1);
}

function playoffStartWeekForLeague(league: Json) {
  return regularSeasonWeeksForLeague(league) + 1;
}

function scheduleLocked(league: Json) {
  const config = (league.schedule_config || {}) as Json;
  return config.schedule_locked === true;
}

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function matchupKey(first: unknown, second: unknown) {
  return [String(first), String(second)].sort().join(":");
}

function roundRobinRounds(memberIds: string[]) {
  const teams = shuffleArray(memberIds);
  const rounds: Array<Array<{ home_member_id: string; away_member_id: string }>> = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);
  for (let round = 0; round < teams.length - 1; round += 1) {
    const lineup = [fixed, ...rotating];
    const pairs = [];
    for (let index = 0; index < lineup.length / 2; index += 1) {
      const first = lineup[index];
      const second = lineup[lineup.length - 1 - index];
      pairs.push(round % 2 === 0 ? { home_member_id: first, away_member_id: second } : { home_member_id: second, away_member_id: first });
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }
  return rounds;
}

function findRepeatRound(memberIds: string[], pairCounts: Map<string, number>, maxPairCount = 2): Array<{ home_member_id: string; away_member_id: string }> | null {
  const build = (remaining: string[]): Array<{ home_member_id: string; away_member_id: string }> | null => {
    if (!remaining.length) return [];
    const [first, ...rest] = remaining;
    for (const second of shuffleArray(rest)) {
      if ((pairCounts.get(matchupKey(first, second)) || 0) >= maxPairCount) continue;
      const nextRemaining = rest.filter((id) => id !== second);
      const nested = build(nextRemaining);
      if (nested) return [{ home_member_id: first, away_member_id: second }, ...nested];
    }
    return null;
  };
  return build(shuffleArray(memberIds));
}

function balanceHomeAway(
  pairs: Array<{ home_member_id: string; away_member_id: string }>,
  homeCounts: Map<string, number>,
  weekNumber: number,
) {
  return pairs.map((pair, index) => {
    const homeCount = homeCounts.get(pair.home_member_id) || 0;
    const awayHomeCount = homeCounts.get(pair.away_member_id) || 0;
    let home = pair.home_member_id;
    let away = pair.away_member_id;
    if (awayHomeCount < homeCount || (awayHomeCount === homeCount && (weekNumber + index) % 2 === 0)) {
      home = pair.away_member_id;
      away = pair.home_member_id;
    }
    homeCounts.set(home, (homeCounts.get(home) || 0) + 1);
    return { home_member_id: home, away_member_id: away };
  });
}

async function buildFullSeasonMatchupRows(supabase: ReturnType<typeof createClient>, league: Json) {
  if (league.schedule_type !== "head_to_head" && league.ranking_system !== "offl") return [];
  const { data: members, error: memberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (memberError) throw memberError;
  const memberIds = (members || []).map((member) => String(member.id));
  if (memberIds.length < 2) throw new Error("At least two active teams are required to generate a schedule.");
  if (memberIds.length % 2 !== 0) throw new Error("Schedule generation requires an even number of active teams.");

  const regularWeeks = regularSeasonWeeksForLeague(league);
  const baseRounds = roundRobinRounds(memberIds);
  const totalGamesNeeded = regularWeeks * (memberIds.length / 2);
  const uniquePairCount = (memberIds.length * (memberIds.length - 1)) / 2;
  const maxPairCount = Math.max(2, Math.ceil(totalGamesNeeded / uniquePairCount));
  const pairCounts = new Map<string, number>();
  const homeCounts = new Map<string, number>();
  const rows = [];

  for (let weekNumber = 1; weekNumber <= regularWeeks; weekNumber += 1) {
    const rawPairs = weekNumber <= baseRounds.length
      ? baseRounds[weekNumber - 1]
      : findRepeatRound(memberIds, pairCounts, maxPairCount);
    if (!rawPairs?.length) throw new Error(`Unable to create a legal matchup set for week ${weekNumber}.`);
    const pairs = balanceHomeAway(rawPairs, homeCounts, weekNumber);
    for (const pair of pairs) {
      const key = matchupKey(pair.home_member_id, pair.away_member_id);
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      if ((pairCounts.get(key) || 0) > maxPairCount) throw new Error("Generated schedule exceeded the legal repeat limit.");
      rows.push({
        league_id: league.id,
        week_number: weekNumber,
        home_member_id: pair.home_member_id,
        away_member_id: pair.away_member_id,
        home_score: 0,
        away_score: 0,
      });
    }
  }
  return rows;
}

async function generateFullSeasonSchedule(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  options: { respectLock?: boolean; replace?: boolean } = {},
) {
  if (options.respectLock && scheduleLocked(league)) throw new Error("Schedule is locked. Unlock it before regenerating.");
  if (options.replace !== false) {
    await supabase.from("matchups").delete().eq("league_id", league.id);
  }
  const schedule = await generateGameSchedule(supabase, league);
  const matchupRows = await buildFullSeasonMatchupRows(supabase, league);
  if (!matchupRows.length) return { schedule, matchups: [] };
  const { data: matchups, error } = await supabase.from("matchups").insert(matchupRows).select("*");
  if (error) throw error;
  return { schedule, matchups: matchups || [] };
}

async function generateSchedule(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  return await generateFullSeasonSchedule(supabase, league, { respectLock: true, replace: true });
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
  if (available.length < 2) throw new Error("At least two unlocked source stat weeks are required for weekly scoring in the current season segment.");
  const pool = available;
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

function comparePlayoffSeeds(a: Json, b: Json) {
  return Number(a.playoff_seed || 9999) - Number(b.playoff_seed || 9999) ||
    Number(b.wins || 0) - Number(a.wins || 0) ||
    Number(b.ties || 0) - Number(a.ties || 0) ||
    Number(b.league_points || 0) - Number(a.league_points || 0) ||
    Number(b.points_for || 0) - Number(a.points_for || 0);
}

async function playoffSeedRows(supabase: ReturnType<typeof createClient>, league: Json) {
  const teamCount = Math.max(2, Number(league.playoff_team_count || 4));
  const { data: standings, error } = await supabase
    .from("standings")
    .select("*")
    .eq("league_id", league.id)
    .order("wins", { ascending: false })
    .order("ties", { ascending: false })
    .order("league_points", { ascending: false })
    .order("points_for", { ascending: false });
  if (error) throw error;
  const seeded = (standings || []).slice(0, teamCount).map((row: Json, index: number) => ({
    ...row,
    playoff_seed: index + 1,
  }));
  for (const row of seeded) {
    const { error: updateError } = await supabase
      .from("standings")
      .update({ playoff_seed: row.playoff_seed })
      .eq("league_id", league.id)
      .eq("league_member_id", row.league_member_id);
    if (updateError) throw updateError;
  }
  return seeded;
}

async function previousPlayoffWinnerRows(supabase: ReturnType<typeof createClient>, league: Json, weekNumber: number) {
  const previousWeek = weekNumber - 1;
  const { data: previousMatchups, error: matchupError } = await supabase
    .from("matchups")
    .select("*")
    .eq("league_id", league.id)
    .eq("week_number", previousWeek);
  if (matchupError) throw matchupError;
  if (!(previousMatchups || []).length) return [];

  const { data: standings, error: standingsError } = await supabase
    .from("standings")
    .select("*")
    .eq("league_id", league.id);
  if (standingsError) throw standingsError;
  const standingByMember = new Map((standings || []).map((row: Json) => [String(row.league_member_id), row]));
  const winners: Json[] = [];
  for (const matchup of previousMatchups || []) {
    const homeScore = Number(matchup.home_score || 0);
    const awayScore = Number(matchup.away_score || 0);
    const homeStanding = standingByMember.get(String(matchup.home_member_id)) || {};
    const awayStanding = standingByMember.get(String(matchup.away_member_id)) || {};
    const winnerId = homeScore > awayScore
      ? matchup.home_member_id
      : awayScore > homeScore
        ? matchup.away_member_id
        : comparePlayoffSeeds(homeStanding, awayStanding) <= 0
          ? matchup.home_member_id
          : matchup.away_member_id;
    winners.push(standingByMember.get(String(winnerId)) || { league_member_id: winnerId, playoff_seed: 9999 });
  }
  return winners.sort(comparePlayoffSeeds);
}

async function generatePlayoffMatchups(supabase: ReturnType<typeof createClient>, league: Json, weekNumber: number) {
  if (league.schedule_type !== "head_to_head" && league.ranking_system !== "offl") return [];
  const { data: existing, error: existingError } = await supabase
    .from("matchups")
    .select("*")
    .eq("league_id", league.id)
    .eq("week_number", weekNumber);
  if (existingError) throw existingError;
  if (existing?.length) return existing;

  const playoffStartWeek = playoffStartWeekForLeague(league);
  const remaining = weekNumber === playoffStartWeek
    ? await playoffSeedRows(supabase, league)
    : await previousPlayoffWinnerRows(supabase, league, weekNumber);
  const sorted = remaining.sort(comparePlayoffSeeds);
  if (sorted.length <= 1) {
    const now = new Date().toISOString();
    await supabase.from("leagues").update({ league_status: "COMPLETED", updated_date: now }).eq("id", league.id);
    await supabase.from("league_seasons").update({ status: "COMPLETED", updated_date: now }).eq("league_id", league.id);
    return [];
  }
  if (sorted.length % 2 !== 0) throw new Error("Playoff scheduling requires an even number of remaining teams.");

  await supabase
    .from("league_game_schedule")
    .upsert(
      {
        league_id: league.id,
        week_number: weekNumber,
        game_number: 1,
        phase: "playoff",
        advancement_mode: league.advancement_mode || "manual",
        status: "SCHEDULED",
      },
      { onConflict: "league_id,week_number,game_number" },
    );

  const rows = [];
  for (let index = 0; index < sorted.length / 2; index += 1) {
    rows.push({
      league_id: league.id,
      week_number: weekNumber,
      home_member_id: sorted[index].league_member_id,
      away_member_id: sorted[sorted.length - 1 - index].league_member_id,
      home_score: 0,
      away_score: 0,
    });
  }
  const { data, error } = await supabase.from("matchups").insert(rows).select("*");
  if (error) throw error;
  await supabase.from("leagues").update({ league_status: "PLAYOFFS", updated_date: new Date().toISOString() }).eq("id", league.id);
  await supabase.from("league_seasons").update({ status: "PLAYOFFS", updated_date: new Date().toISOString() }).eq("league_id", league.id);
  return data || [];
}

async function generateMatchups(supabase: ReturnType<typeof createClient>, league: Json, weekNumber: number) {
  if (weekNumber >= playoffStartWeekForLeague(league)) {
    return await generatePlayoffMatchups(supabase, league, weekNumber);
  }
  if (league.schedule_type !== "head_to_head" && league.ranking_system !== "offl") return [];
  const { data: existing, error: existingError } = await supabase
    .from("matchups")
    .select("*")
    .eq("league_id", league.id)
    .eq("week_number", weekNumber);
  if (existingError) throw existingError;
  if (existing?.length) return existing;
  await generateFullSeasonSchedule(supabase, league, { respectLock: false, replace: true });
  const { data, error } = await supabase
    .from("matchups")
    .select("*")
    .eq("league_id", league.id)
    .eq("week_number", weekNumber);
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
  const partTypeKey = (value: unknown) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const firsts = (parts || [])
    .filter((part) => partTypeKey(part.part_type) === "FIRST")
    .map((part) => String(part.value || "").trim())
    .filter(Boolean);
  const lasts = (parts || [])
    .filter((part) => partTypeKey(part.part_type) === "LAST")
    .map((part) => String(part.value || "").trim())
    .filter(Boolean);
  if (!firsts.length || !lasts.length) throw new Error("AI team name parts are not configured.");
  const { data: used } = await supabase.from("used_ai_team_names").select("name").eq("league_id", leagueId);
  const usedNames = new Set((used || []).map((row) => row.name));
  const candidates = firsts.flatMap((first) => lasts.map((last) => `${first} ${last}`))
    .sort(() => Math.random() - 0.5);

  for (const name of candidates) {
    if (usedNames.has(name)) continue;
    const { error } = await supabase.from("used_ai_team_names").insert({ league_id: leagueId, name });
    if (!error) return name;
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
  const scoringOverridesEnabled = payload.scoring_overrides_enabled === true && (isPaidLeague || role === "premium" || role === "admin");
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
  playSettings.playoff_team_count = normalizePlayoffTeamCount(playSettings.playoff_team_count, maxMembers);
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
      player_retention_limit: playSettings.player_retention_limit,
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
      scoring_overrides_enabled: scoringOverridesEnabled,
      scoring_rules: scoringOverridesEnabled ? (payload.scoring_rules || DEFAULT_SCORING_RULES) : {},
      scoring_rules_locked_at: null,
      scoring_rules_lock_source: null,
      scoring_rules_source_updated_at: null,
      scoring_rules_synced_at: null,
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
  if (leagueError) throw new Error(`Could not create league record: ${errorMessage(leagueError)}`);
  const activeLeague = payload.lock_scoring_rules === true
    ? await lockLeagueScoringRules(supabase, league, "commissioner")
    : league;

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .insert({
      league_id: activeLeague.id,
      profile_id: user.id,
      user_email: user.email,
      team_name: payload.team_name || `${profile.display_name || user.email?.split("@")[0]}'s Team`,
      role_in_league: "COMMISSIONER",
      is_active: true,
    })
    .select("*")
    .single();
  if (memberError) throw new Error(`League was created, but commissioner membership could not be created: ${errorMessage(memberError)}`);

  const { error: standingError } = await supabase.from("standings").insert({
    league_id: league.id,
    league_member_id: member.id,
  });
  if (standingError) throw new Error(`League was created, but initial standings could not be created: ${errorMessage(standingError)}`);
  if (isPaidLeague && role === "manager") {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ role: "premium" })
      .eq("id", user.id);
    if (profileUpdateError) throw new Error(`League was created, but premium profile update failed: ${errorMessage(profileUpdateError)}`);
  }

  return { league: activeLeague, member };
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
  await assertLeagueSetupEditable(supabase, payload.league_id);
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
  await assertLeagueSetupEditable(supabase, invite.league_id);
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
  await assertLeagueSetupEditable(supabase, member.league_id);
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
  await assertLeagueSetupEditable(supabase, league.id);
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
  await assertLeagueSetupEditable(supabase, league.id);
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
  await assertLeagueSetupEditable(supabase, league.id);
  const persona = AI_PERSONAS.has(String(payload.ai_persona || payload.persona || "BALANCED"))
    ? String(payload.ai_persona || payload.persona || "BALANCED")
    : "BALANCED";
  const result = await createAiLeagueMember(supabase, league, persona);
  return result;
}

async function createAiLeagueMember(supabase: ReturnType<typeof createClient>, league: Json, persona = "BALANCED") {
  const { count, error: countError } = await supabase.from("league_members").select("id", { count: "exact", head: true }).eq("league_id", league.id).eq("is_active", true);
  if (countError) throw countError;
  if ((count || 0) >= Number(league.max_members || 0)) throw new Error("League is full.");
  const aiPersona = AI_PERSONAS.has(String(persona)) ? String(persona) : "BALANCED";
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
      ai_persona: aiPersona,
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
  await assertLeagueSetupEditable(supabase, member.league_id);
  const update: Json = {};
  if (payload.generate_new_name === true) {
    update.team_name = await nextAiTeamName(supabase, member.league_id);
  } else if (payload.team_name) {
    update.team_name = payload.team_name;
  }
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
  await assertLeagueSetupEditable(supabase, member.league_id);
  const { error: standingError } = await supabase.from("standings").delete().eq("league_member_id", member.id);
  if (standingError) throw standingError;
  const { data, error } = await supabase.from("league_members").delete().eq("id", member.id).select("*").single();
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
    player_retention_limit: payload.player_retention_limit ?? null,
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

async function updatePlayoffSettings(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league, isAdmin } = await requireLeagueControl(supabase, user, payload.league_id);
  const { count: activeTeamCount, error: memberError } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (memberError) throw memberError;

  const { data: seasons, error: seasonError } = await supabase
    .from("league_seasons")
    .select("id,current_week,status")
    .eq("league_id", league.id)
    .order("created_date", { ascending: false })
    .limit(1);
  if (seasonError) throw seasonError;
  const activeSeason = seasons?.[0] || null;
  const currentWeek = Number(activeSeason?.current_week || 1);
  const seasonEnded = String(activeSeason?.status || league.league_status || "").toUpperCase() === "COMPLETED";
  if (seasonEnded) throw new Error("Playoff team count is locked after the season ends.");
  if (currentWeek >= 2 && !isAdmin) throw new Error("After Week 2 begins, only a site admin can change playoff team count.");

  const playoffTeamCount = normalizePlayoffTeamCount(payload.playoff_team_count, activeTeamCount || league.max_members);
  const previousPlayoffTeamCount = Number(league.playoff_team_count || recommendedPlayoffTeamCount(activeTeamCount || league.max_members));
  if (playoffTeamCount === previousPlayoffTeamCount) return { league, changed_keys: [] };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("leagues")
    .update({ playoff_team_count: playoffTeamCount, updated_date: now })
    .eq("id", league.id)
    .select("*")
    .single();
  if (error) throw error;

  const allTeamsEligible = Number(activeTeamCount || 0) > 0 && playoffTeamCount >= Number(activeTeamCount || 0);
  const title = allTeamsEligible ? "All teams eligible for playoffs" : "Playoff field updated";
  const body = allTeamsEligible
    ? `The commissioner set the playoff field to ${playoffTeamCount} teams while the league has ${activeTeamCount} active teams. Every team is currently eligible for playoffs.`
    : `The playoff field changed from ${previousPlayoffTeamCount} to ${playoffTeamCount} teams.`;
  const { error: newsError } = await supabase.from("league_news_items").insert({
    league_id: league.id,
    title,
    body,
    news_type: "SYSTEM",
    status: "PUBLISHED",
    published_at: now,
  });
  if (newsError) throw newsError;

  return { league: data, changed_keys: ["playoff_team_count"], news: { title, body } };
}

async function buildPlayerLeaderboard(supabase: ReturnType<typeof createClient>, league: Json) {
  const positions = ["QB", "OFF", "DEF", "K"];
  const emptyLeaders = Object.fromEntries(positions.map((position) => [position, []]));
  const { data: resultRows, error: resultError } = await supabase
    .from("league_week_results")
    .select("league_member_id,scoring_details")
    .eq("league_id", league.id);
  if (resultError) throw resultError;

  const totalsByPlayer = new Map<string, number>();
  const startsByPlayer = new Map<string, number>();
  const gamesPlayedByPlayer = new Map<string, number>();
  const scoringOwnerByPlayer = new Map<string, string>();
  for (const result of resultRows || []) {
    const resultMemberId = String(result.league_member_id || "");
    const details = Array.isArray(result.scoring_details) ? result.scoring_details as Json[] : [];
    for (const slot of details) {
      const playerId = String(slot.player_id || "");
      if (!playerId) continue;
      totalsByPlayer.set(playerId, Number((totalsByPlayer.get(playerId) || 0) + Number(slot.scored_points || 0)));
      gamesPlayedByPlayer.set(playerId, Number(gamesPlayedByPlayer.get(playerId) || 0) + 1);
      if (isStartedLineupSlot(slot)) {
        startsByPlayer.set(playerId, Number(startsByPlayer.get(playerId) || 0) + 1);
      }
      if (resultMemberId) scoringOwnerByPlayer.set(playerId, resultMemberId);
    }
  }

  const playerIds = [...totalsByPlayer.entries()]
    .filter(([, total]) => Number.isFinite(total))
    .map(([playerId]) => playerId);
  if (!playerIds.length) return { league_id: league.id, leaders: emptyLeaders };

  const { data: leagueMembers, error: leagueMemberError } = await supabase
    .from("league_members")
    .select("id,team_name")
    .eq("league_id", league.id)
    .eq("is_active", true);
  if (leagueMemberError) throw leagueMemberError;
  const leagueMemberIds = (leagueMembers || []).map((member: Json) => String(member.id)).filter(Boolean);

  const [
    { data: scoreRows, error: scoreError },
    { data: players, error: playerError },
    { data: durabilityRows, error: durabilityError },
    { data: rosterRows, error: rosterError },
  ] = await Promise.all([
    supabase
      .from("league_player_scores")
      .select("player_id,position,position_rank,tier_value")
      .eq("league_id", league.id)
      .in("player_id", playerIds),
    supabase
      .from("players")
      .select("id,player_display_name,full_name,team,position")
      .in("id", playerIds),
    durabilityEnabled(league)
      ? supabase
        .from("league_player_durability")
        .select("player_id,durability")
        .eq("league_id", league.id)
        .in("player_id", playerIds)
      : Promise.resolve({ data: [], error: null }),
    leagueMemberIds.length
      ? supabase
        .from("roster_slots")
        .select("player_id,league_member_id")
        .in("league_member_id", leagueMemberIds)
        .in("player_id", playerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (scoreError) throw scoreError;
  if (playerError) throw playerError;
  if (durabilityError) throw durabilityError;
  if (rosterError) throw rosterError;

  const currentOwnerIdByPlayer = new Map((rosterRows || []).map((row: Json) => [String(row.player_id), String(row.league_member_id)]));
  const scoreByPlayer = new Map((scoreRows || []).map((row: Json) => [String(row.player_id), row]));
  const playerById = new Map((players || []).map((player: Json) => [String(player.id), player]));
  const durabilityByPlayer = new Map((durabilityRows || []).map((row: Json) => [String(row.player_id), Number(row.durability)]));
  const ownerNameById = new Map((leagueMembers || []).map((row: Json) => [String(row.id), String(row.team_name || "Manager")]));
  const allRows = playerIds
    .map((playerId) => {
      const score = scoreByPlayer.get(playerId);
      if (!score || !positions.includes(String(score.position || "").toUpperCase())) return null;
      const player = playerById.get(playerId) || {};
      const ownerId = currentOwnerIdByPlayer.get(playerId) || scoringOwnerByPlayer.get(playerId);
      return {
        player_id: playerId,
        player_name: player.player_display_name || player.full_name || playerId,
        team: player.team || null,
        fantasy_team_owner: ownerNameById.get(String(ownerId || "")) || "FA",
        position: String(score.position || "").toUpperCase(),
        position_rank: score.position_rank,
        tier_value: score.tier_value,
        durability: durabilityByPlayer.get(playerId) ?? null,
        starts: startsByPlayer.get(playerId) || 0,
        games_played: gamesPlayedByPlayer.get(playerId) || 0,
        total_points: Number((totalsByPlayer.get(playerId) || 0).toFixed(2)),
      };
    })
    .filter(Boolean) as Json[];

  const leaders: Record<string, Json[]> = { ...emptyLeaders };
  for (const position of positions) {
    leaders[position] = allRows
      .filter((row) => row.position === position)
      .sort((a, b) =>
        Number(b.total_points || 0) - Number(a.total_points || 0) ||
        Number(a.position_rank || 9999) - Number(b.position_rank || 9999) ||
        String(a.player_name || "").localeCompare(String(b.player_name || ""))
      )
      .slice(0, 5);
  }

  return { league_id: league.id, leaders };
}

async function refreshPlayerLeaderboardCache(supabase: ReturnType<typeof createClient>, league: Json) {
  const leaderboard = await buildPlayerLeaderboard(supabase, league);
  const { data: latestResultRows, error: latestResultError } = await supabase
    .from("league_week_results")
    .select("week_number")
    .eq("league_id", league.id)
    .order("week_number", { ascending: false })
    .limit(1);
  if (latestResultError) throw latestResultError;
  const generatedThroughWeek = Number(latestResultRows?.[0]?.week_number || 0);
  const { data, error } = await supabase
    .from("league_player_leaderboards")
    .upsert(
      {
        league_id: league.id,
        leaders: leaderboard.leaders || {},
        generated_through_week: generatedThroughWeek,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "league_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getPlayerLeaderboard(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league } = await requireLeagueAccess(supabase, user, payload.league_id);
  const { data: cached, error } = await supabase
    .from("league_player_leaderboards")
    .select("*")
    .eq("league_id", league.id)
    .maybeSingle();
  if (error) throw error;
  return cached || await refreshPlayerLeaderboardCache(supabase, league);
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
  await assertLeagueSetupEditable(supabase, league.id);
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

async function updateLeagueScoring(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league } = await requireLeagueControl(supabase, user, payload.league_id);
  await assertLeagueSetupEditable(supabase, league.id);
  if (league.scoring_rules_locked_at) throw new Error("Scoring rules are locked for this league.");
  if (payload.decline_admin_scoring_change === true) {
    if (league.scoring_overrides_enabled === true) throw new Error("This league is already using league scoring overrides.");
    if (!(await commissionerScoringOverrideEligible(supabase, league))) {
      throw new Error("Declining admin scoring changes requires a paid league or Pro commissioner access.");
    }
    const { data: job, error: jobError } = await supabase
      .from("league_draft_pool_jobs")
      .select("scoring_rules_snapshot,scoring_rules_source_updated_at,updated_date")
      .eq("league_id", league.id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job?.scoring_rules_snapshot) {
      throw new Error("No prepared draft pool scoring snapshot was found for this league. Refresh the draft pool before declining admin scoring changes.");
    }
    const now = new Date().toISOString();
    const sourceUpdatedAt = String(job.scoring_rules_source_updated_at || job.updated_date || now);
    const { data, error } = await supabase
      .from("leagues")
      .update({
        scoring_overrides_enabled: true,
        scoring_rules: mergeScoringRules(job.scoring_rules_snapshot as Json),
        scoring_rules_source_updated_at: sourceUpdatedAt,
        scoring_rules_synced_at: now,
        updated_date: now,
      })
      .eq("id", league.id)
      .select("*")
      .single();
    if (error) throw error;
    return {
      league: data,
      effective_scoring_rules: await effectiveLeagueScoringRules(supabase, data),
      draft_pool_invalidated: false,
      declined_admin_scoring_change: true,
    };
  }
  const overridesEnabled = payload.scoring_overrides_enabled === true;
  if (overridesEnabled && !(await commissionerScoringOverrideEligible(supabase, league))) {
    throw new Error("League scoring overrides require a paid league or Pro commissioner access.");
  }
  const { count: existingPoolCount, error: existingPoolError } = await supabase
    .from("league_player_scores")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);
  if (existingPoolError) throw existingPoolError;
  const now = new Date().toISOString();
  const update = {
    scoring_overrides_enabled: overridesEnabled,
    scoring_rules: overridesEnabled ? mergeScoringRules(payload.scoring_rules as Json | undefined) : {},
    scoring_rules_source_updated_at: overridesEnabled ? now : null,
    scoring_rules_synced_at: null,
    updated_date: now,
  };
  const { data, error } = await supabase
    .from("leagues")
    .update(update)
    .eq("id", league.id)
    .select("*")
    .single();
  if (error) throw error;
  await supabase.from("league_draft_pool_candidates").delete().eq("league_id", league.id);
  await supabase
    .from("league_draft_pool_jobs")
    .update({
      status: "STALE",
      summary: "Scoring changed after this draft pool was prepared.",
      updated_date: now,
    })
    .eq("league_id", league.id);
  return {
    league: data,
    effective_scoring_rules: await effectiveLeagueScoringRules(supabase, data),
    draft_pool_invalidated: Number(existingPoolCount || 0) > 0,
  };
}

async function lockLeagueScoringForCommissioner(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league } = await requireLeagueControl(supabase, user, payload.league_id);
  await assertLeagueSetupEditable(supabase, league.id);
  const lockedLeague = await lockLeagueScoringRules(supabase, league, "commissioner");
  return {
    league: lockedLeague,
    effective_scoring_rules: await effectiveLeagueScoringRules(supabase, lockedLeague),
  };
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
  const { count: matchupCount, error: matchupCountError } = await supabase
    .from("matchups")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);
  if (matchupCountError) throw matchupCountError;
  if (!matchupCount) await generateFullSeasonSchedule(supabase, league, { respectLock: false, replace: true });

  return { season, week };
}

async function updateWeekStatus(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league } = await requireLeagueControl(supabase, user, payload.league_id);
  const weekNumber = Number(payload.week_number || 0);
  const status = String(payload.status || "").toUpperCase();
  const allowedStatuses = new Set(["DRAFT_OPEN", "LINEUPS_OPEN", "LOCKED", "RESOLVED"]);
  if (!weekNumber) throw new Error("Week number is required.");
  if (!allowedStatuses.has(status)) throw new Error("Invalid week status.");

  const { data: existing, error: existingError } = await supabase
    .from("league_weeks")
    .select("*")
    .eq("league_id", league.id)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (existingError) throw existingError;

  const { data: week, error } = await supabase
    .from("league_weeks")
    .upsert(
      {
        league_id: league.id,
        week_number: weekNumber,
        status,
        reveal_state: existing?.reveal_state || "hidden",
      },
      { onConflict: "league_id,week_number" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return { week };
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
  await assertLeagueSetupEditable(supabase, league.id);
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
  const { scoringRules, scoringRulesHash, sourceUpdatedAt } = await scoringRulesHashForLeague(supabase, league);
  const config = await positionConfig(supabase);

  const { data: existing, error: existingError } = await supabase
    .from("league_player_scores")
    .select("id,position,weeks_played,scoring_rules_hash")
    .eq("league_id", leagueId)
    .lte("position_rank", DRAFT_MAX_BUCKET_TARGET);
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
      .sort((a, b) => b.avg - a.avg || b.total - a.total || a.full_name.localeCompare(b.full_name))
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
  if (!league.scoring_rules_locked_at && sourceUpdatedAt) {
    const now = new Date().toISOString();
    await supabase
      .from("leagues")
      .update({
        scoring_rules_source_updated_at: sourceUpdatedAt,
        scoring_rules_synced_at: now,
        updated_date: now,
      })
      .eq("id", league.id)
      .is("scoring_rules_locked_at", null);
  }
}

async function existingLeaguePlayerScoresComplete(supabase: ReturnType<typeof createClient>, league: Json, scoringRulesHash: string) {
  const { data: existing, error } = await supabase
    .from("league_player_scores")
    .select("id,position,weeks_played,scoring_rules_hash")
    .eq("league_id", league.id)
    .lte("position_rank", DRAFT_MAX_BUCKET_TARGET);
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
    .lte("position_rank", DRAFT_MAX_BUCKET_TARGET);
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
      return {
        league_id: league.id,
        player_id: player.player_id,
        durability: 100,
        initial_durability: 100,
        revealed_at: String(league.durability_mode || "") === "revealed_at_draft" ? new Date().toISOString() : null,
      };
    });
  if (rows.length) {
    const { error } = await supabase.from("league_player_durability").insert(rows);
    if (error) throw error;
  }
}

async function resetLeagueDraftPoolJob(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  scoringRulesHash: string,
  scoringRules: Json,
  sourceUpdatedAt: string | null | undefined,
  totalPlayers: number,
  clearExistingScores = false,
) {
  await supabase.from("league_draft_pool_candidates").delete().eq("league_id", league.id);
  if (clearExistingScores) {
    await supabase.from("league_player_scores").delete().eq("league_id", league.id);
    await supabase.from("league_player_durability").delete().eq("league_id", league.id);
  }
  const { data, error } = await supabase
    .from("league_draft_pool_jobs")
    .upsert({
      league_id: league.id,
      status: "RUNNING",
      progress: 1,
      processed_players: 0,
      total_players: totalPlayers,
      scoring_rules_hash: scoringRulesHash,
      scoring_rules_snapshot: scoringRules,
      scoring_rules_source_updated_at: sourceUpdatedAt || null,
      error_details: null,
      summary: "Preparing league draft pool.",
    }, { onConflict: "league_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function loadOrCreateDraftPoolJob(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  scoringRulesHash: string,
  scoringRules: Json,
  sourceUpdatedAt: string | null | undefined,
  forceRebuild = false,
) {
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
    forceRebuild ||
    !job ||
    job.scoring_rules_hash !== scoringRulesHash ||
    !["PENDING", "RUNNING"].includes(String(job.status || "").toUpperCase())
  ) {
    return resetLeagueDraftPoolJob(supabase, league, scoringRulesHash, scoringRules, sourceUpdatedAt, totalPlayers, forceRebuild);
  }
  if (Number(job.total_players || 0) !== totalPlayers) {
    const { data: updatedJob, error: updateError } = await supabase
      .from("league_draft_pool_jobs")
      .update({
        total_players: totalPlayers,
        scoring_rules_snapshot: scoringRules,
        scoring_rules_source_updated_at: sourceUpdatedAt || null,
        updated_date: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return updatedJob;
  }
  return job;
}

async function loadDraftPoolSourceWeeks(supabase: ReturnType<typeof createClient>, sourceSeasonYear: number, playerIds: unknown[]) {
  const rows: Json[] = [];
  if (!playerIds.length) return rows;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("player_week_stats")
      .select("player_id,raw_stats")
      .eq("season_year", sourceSeasonYear)
      .in("player_id", playerIds)
      .order("player_id", { ascending: true })
      .order("week", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
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
    const weeks = await loadDraftPoolSourceWeeks(supabase, sourceSeasonYear, candidatePlayerIds);
    for (const week of weeks) {
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
      .order("position", { ascending: true })
      .order("expected_avg_points", { ascending: false })
      .order("total_points", { ascending: false })
      .order("player_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function finalizeLeagueDraftPoolJob(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  job: Json,
  scoringRulesHash: string,
  scoringRules: Json,
  sourceUpdatedAt: string | null | undefined,
) {
  const candidates = await loadDraftPoolCandidates(supabase, league.id, scoringRulesHash);
  const candidateCounts = draftBucketCounts(candidates);

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
        Number(b.expected_avg_points || 0) - Number(a.expected_avg_points || 0) ||
        Number(b.total_points || 0) - Number(a.total_points || 0)
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

  assertCompleteDraftPool(rows, {
    engine: DRAFT_POOL_ENGINE_VERSION,
    source_season_year: Number(league.source_season_year || new Date().getFullYear() - 1),
    candidate_total: candidates.length,
    candidate_counts: candidateCounts,
    finalist_counts: draftBucketCounts(rows),
    scoring_hash: scoringRulesHash,
  });
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
      scoring_rules_snapshot: scoringRules,
      scoring_rules_source_updated_at: sourceUpdatedAt || null,
      error_details: null,
      updated_date: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return { job: completedJob, buckets: counts, eligible_count: rows.length };
}

async function processLeagueDraftPoolJob(supabase: ReturnType<typeof createClient>, league: Json, forceRebuild = false) {
  const { scoringRules, scoringRulesHash, sourceUpdatedAt } = await scoringRulesHashForLeague(supabase, league);
  const sourceSeasonYear = Number(league.source_season_year || new Date().getFullYear() - 1);
  const { count: sourceWeekCount, error: sourceWeekError } = await supabase
    .from("player_week_stats")
    .select("id", { count: "exact", head: true })
    .eq("season_year", sourceSeasonYear);
  if (sourceWeekError) throw sourceWeekError;
  if (!sourceWeekCount) {
    throw new Error(`No imported player week stats were found for source season ${sourceSeasonYear}. Choose a season with imported data or import that season before preparing the draft pool.`);
  }
  const syncLeagueScoringSource = async () => {
    if (league.scoring_rules_locked_at || !sourceUpdatedAt) return;
    const now = new Date().toISOString();
    const update: Json = {
      scoring_rules_source_updated_at: sourceUpdatedAt,
      scoring_rules_synced_at: now,
      updated_date: now,
    };
    if (league.scoring_overrides_enabled !== true) update.scoring_rules = {};
    await supabase
      .from("leagues")
      .update(update)
      .eq("id", league.id)
      .is("scoring_rules_locked_at", null);
  };

  if (!forceRebuild && await existingLeaguePlayerScoresComplete(supabase, league, scoringRulesHash)) {
    await syncLeagueDurabilityRows(supabase, league);
    await syncLeagueScoringSource();
    await supabase
      .from("league_draft_pool_jobs")
      .update({
        status: "COMPLETED",
        progress: 100,
        scoring_rules_hash: scoringRulesHash,
        scoring_rules_snapshot: scoringRules,
        scoring_rules_source_updated_at: sourceUpdatedAt || null,
        updated_date: new Date().toISOString(),
      })
      .eq("league_id", league.id);
    const { data: rows, count, error } = await supabase
      .from("league_player_scores")
      .select("id,position", { count: "exact" })
      .eq("league_id", league.id)
      .lte("position_rank", DRAFT_MAX_BUCKET_TARGET);
    if (error) throw error;
    return {
      league_id: league.id,
      status: "COMPLETED",
      complete: true,
      progress: 100,
      scoring_rules_hash: scoringRulesHash,
      source_updated_at: sourceUpdatedAt || null,
      effective_scoring_rules: scoringRules,
      eligible_count: count || 0,
      buckets: draftBucketCounts(rows || []),
    };
  }

  const config = await positionConfig(supabase);
  const job = await loadOrCreateDraftPoolJob(supabase, league, scoringRulesHash, scoringRules, sourceUpdatedAt, forceRebuild);
  try {
    const processedJob = await processDraftPoolPlayerChunk(supabase, league, job, scoringRules, scoringRulesHash, config);
    if (Number(processedJob.processed_players || 0) >= Number(processedJob.total_players || 0)) {
      const finalized = await finalizeLeagueDraftPoolJob(supabase, league, processedJob, scoringRulesHash, scoringRules, sourceUpdatedAt);
      await syncLeagueScoringSource();
      return {
        league_id: league.id,
        status: "COMPLETED",
        complete: true,
        progress: 100,
        scoring_rules_hash: scoringRulesHash,
        source_updated_at: sourceUpdatedAt || null,
        effective_scoring_rules: scoringRules,
        ...finalized,
      };
    }
    return {
      league_id: league.id,
      status: "RUNNING",
      complete: false,
      scoring_rules_hash: scoringRulesHash,
      source_updated_at: sourceUpdatedAt || null,
      effective_scoring_rules: scoringRules,
      progress: Number(processedJob.progress || 1),
      processed_players: Number(processedJob.processed_players || 0),
      total_players: Number(processedJob.total_players || 0),
      summary: processedJob.summary || "Preparing league draft pool.",
    };
  } catch (error) {
    const message = errorMessage(error);
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

async function leagueMemberRosterCount(supabase: ReturnType<typeof createClient>, leagueMemberId: string) {
  const { count, error } = await supabase
    .from("roster_slots")
    .select("id", { count: "exact", head: true })
    .eq("league_member_id", leagueMemberId);
  if (error) throw error;
  return Number(count || 0);
}

function maxSafeTierForPick(league: Json, tierTotal: number, rosteredCount: number) {
  const plan = draftRosterPlan(league);
  const cap = Number(league.team_tier_cap || DEFAULT_TEAM_TIER_CAP);
  if (cap <= 0) return 5;
  const remainingPicksIncludingCurrent = Math.max(1, plan.totalSlots - rosteredCount);
  const remainingCap = Math.max(0, cap - tierTotal);
  if (remainingCap <= remainingPicksIncludingCurrent) return 1;
  return Math.max(1, Math.min(5, remainingCap - (remainingPicksIncludingCurrent - 1)));
}

async function enforceTeamTierCap(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string, playerId: string) {
  const cap = Number(league.team_tier_cap || 0);
  if (cap <= 0) return;
  await ensureLeaguePlayerScores(supabase, league);
  const currentTotal = await leagueMemberTierTotal(supabase, league, leagueMemberId);
  const playerTier = await getPlayerTierValue(supabase, league, playerId);
  const rosteredCount = await leagueMemberRosterCount(supabase, leagueMemberId);
  const maxSafeTier = maxSafeTierForPick(league, currentTotal, rosteredCount);
  if (currentTotal + playerTier > cap) {
    throw new Error(`Drafting this player would exceed the team tier cap (${currentTotal + playerTier}/${cap}).`);
  }
  if (playerTier > maxSafeTier) {
    throw new Error(`Drafting this player would leave too little tier cap to complete the roster. Max allowed for this pick is Tier ${maxSafeTier}.`);
  }
}

async function canFitTeamTierCap(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string, playerId: string) {
  const cap = Number(league.team_tier_cap || 0);
  if (cap <= 0) return true;
  const currentTotal = await leagueMemberTierTotal(supabase, league, leagueMemberId);
  const playerTier = await getPlayerTierValue(supabase, league, playerId);
  const rosteredCount = await leagueMemberRosterCount(supabase, leagueMemberId);
  const maxSafeTier = maxSafeTierForPick(league, currentTotal, rosteredCount);
  return currentTotal + playerTier <= cap && playerTier <= maxSafeTier;
}

function randomIntegerInclusive(min: number, max: number) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  return low + (crypto.getRandomValues(new Uint32Array(1))[0] % (high - low + 1));
}

function draftRosterPlan(league: Json) {
  const rosterRules = ((league.roster_rules || {}) as Json);
  const draftGroups = ((rosterRules.draft_groups || DEFAULT_ROSTER_RULES.draft_groups) as Record<string, number>);
  const positionLimits = ((rosterRules.position_limits || DEFAULT_ROSTER_RULES.position_limits) as Record<string, number>);
  const minimums = {
    QB: Number(draftGroups.QB || 0),
    OFF: Number(draftGroups.OFF || 0),
    DEF: Number(draftGroups.DEF || 0),
    K: Number(draftGroups.K || 0),
  };
  const limits = {
    QB: Number(positionLimits.QB || 0),
    OFF: Number(positionLimits.OFF || 0),
    DEF: Number(positionLimits.DEF || 0),
    K: Number(positionLimits.K || 0),
  };
  const totalSlots = Math.max(
    1,
    Number((league.draft_config as Json | undefined)?.rounds || 0),
    Object.values(draftGroups).reduce((sum, value) => sum + Number(value || 0), 0),
  );
  return { minimums, limits, totalSlots };
}

function rosterCountsFromRows(rows: Json[] = []) {
  return rows.reduce((counts: Record<string, number>, row) => {
    const bucket = String(row.bucket || row.position || "").toUpperCase();
    if (["QB", "OFF", "DEF", "K"].includes(bucket)) counts[bucket] = Number(counts[bucket] || 0) + 1;
    return counts;
  }, { QB: 0, OFF: 0, DEF: 0, K: 0 });
}

async function aiRosterContext(supabase: ReturnType<typeof createClient>, league: Json, leagueMemberId: string) {
  const { data: roster, error: rosterError } = await supabase
    .from("roster_slots")
    .select("player_id,players!inner(position)")
    .eq("league_member_id", leagueMemberId);
  if (rosterError) throw rosterError;
  await ensureLeaguePlayerScores(supabase, league);
  const playerIds = [...new Set((roster || []).map((slot: Json) => String(slot.player_id)).filter(Boolean))];
  const { data: tiers, error: tierError } = playerIds.length
    ? await supabase
      .from("league_player_scores")
      .select("player_id,position,tier_value")
      .eq("league_id", league.id)
      .in("player_id", playerIds)
    : { data: [], error: null };
  if (tierError) throw tierError;
  const tiersByPlayer = new Map((tiers || []).map((tier: Json) => [String(tier.player_id), tier]));
  const rows = (roster || []).map((slot: Json) => {
    const tier = tiersByPlayer.get(String(slot.player_id));
    const player = Array.isArray(slot.players) ? slot.players[0] : slot.players;
    return {
      player_id: slot.player_id,
      bucket: String(tier?.position || rosterLimitBucket(String(player?.position || ""), DEFAULT_POSITION_CONFIG)).toUpperCase(),
      tier_value: Number(tier?.tier_value || 1),
    };
  });
  return {
    rows,
    counts: rosterCountsFromRows(rows),
    tierTotal: rows.reduce((sum, row) => sum + Number(row.tier_value || 1), 0),
  };
}

function aiPersonaBucketScore(persona: string, bucket: string) {
  const normalizedPersona = String(persona || "BALANCED").toUpperCase();
  if (normalizedPersona === "OFFENSIVE") {
    if (bucket === "OFF") return 5;
    if (bucket === "QB") return 4;
    if (bucket === "DEF") return 1;
    return 0;
  }
  if (normalizedPersona === "DEFENSIVE") {
    if (bucket === "DEF") return 5;
    if (bucket === "OFF" || bucket === "QB") return 2;
    return 0;
  }
  if (bucket === "K") return 0;
  return 3;
}

function aiCanCompleteRosterAfterPick(league: Json, counts: Record<string, number>, bucket: string, rosteredCount: number) {
  const plan = draftRosterPlan(league);
  const nextCounts = { ...counts, [bucket]: Number(counts[bucket] || 0) + 1 };
  if (Number(nextCounts[bucket] || 0) > Number(plan.limits[bucket as keyof typeof plan.limits] || 0)) return false;
  const remainingSlotsAfterPick = Math.max(0, plan.totalSlots - rosteredCount - 1);
  const missingMinimums = Object.entries(plan.minimums).reduce((sum, [position, minimum]) =>
    sum + Math.max(0, Number(minimum || 0) - Number(nextCounts[position] || 0)), 0);
  return missingMinimums <= remainingSlotsAfterPick;
}

function aiBucketNeedScore(league: Json, counts: Record<string, number>, bucket: string, rosteredCount: number, round: number) {
  const plan = draftRosterPlan(league);
  const current = Number(counts[bucket] || 0);
  const minimum = Number(plan.minimums[bucket as keyof typeof plan.minimums] || 0);
  const missing = Math.max(0, minimum - current);
  const remainingSlotsIncludingCurrent = Math.max(1, plan.totalSlots - rosteredCount);
  const totalMissing = Object.entries(plan.minimums).reduce((sum, [position, value]) =>
    sum + Math.max(0, Number(value || 0) - Number(counts[position] || 0)), 0);
  let score = missing * 10;
  if (missing > 0 && totalMissing >= remainingSlotsIncludingCurrent) score += 100;
  if (bucket === "K") {
    if (current > 0) score -= 100;
    else if (round >= 10) score += 120;
    else if (round >= 8) score += 25;
    else score -= 80;
  }
  return score;
}

function aiKickerAllowed(league: Json, counts: Record<string, number>, rosteredCount: number, round: number, hasNonKickerOptions: boolean) {
  if (round >= 8) return true;
  if (!hasNonKickerOptions) return true;
  const plan = draftRosterPlan(league);
  const remainingSlotsIncludingCurrent = Math.max(1, plan.totalSlots - rosteredCount);
  const missingKickers = Math.max(0, Number(plan.minimums.K || 0) - Number(counts.K || 0));
  return missingKickers >= remainingSlotsIncludingCurrent;
}

async function aiBestAvailablePlayer(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  draftId: string,
  member: Json,
  turn: Json,
) {
  const leagueMemberId = String(member.id || "");
  const persona = String(member.ai_persona || "BALANCED").toUpperCase();
  const { data: picks, error: picksError } = await supabase.from("draft_picks").select("player_id").eq("draft_id", draftId);
  if (picksError) throw picksError;
  const pickedIds = new Set((picks || []).map((pick: Json) => String(pick.player_id)));
  await ensureLeaguePlayerScores(supabase, league);
  const rosterContext = await aiRosterContext(supabase, league, leagueMemberId);
  const rosteredCount = rosterContext.rows.length;
  const maxSafeTier = maxSafeTierForPick(league, rosterContext.tierTotal, rosteredCount);
  const cap = Number(league.team_tier_cap || DEFAULT_TEAM_TIER_CAP);
  const remainingCap = cap > 0 ? Math.max(0, cap - rosterContext.tierTotal) : 99;
  const round = Number(turn.round || rosteredCount + 1);

  const { data: playerRows, error: playersError } = await supabase
    .from("league_player_scores")
    .select("player_id,position,position_rank,tier_value")
    .eq("league_id", league.id)
    .lte("position_rank", DRAFT_MAX_BUCKET_TARGET)
    .order("tier_value", { ascending: false })
    .order("position_rank", { ascending: true })
    .limit(1000);
  if (playersError) throw playersError;

  const legalRows = (playerRows || [])
    .filter((row: Json) => !pickedIds.has(String(row.player_id)))
    .filter((row: Json) => Number(row.tier_value || 1) <= remainingCap)
    .filter((row: Json) => Number(row.tier_value || 1) <= maxSafeTier)
    .filter((row: Json) => aiCanCompleteRosterAfterPick(league, rosterContext.counts, String(row.position || "").toUpperCase(), rosteredCount));

  const hasNonKickerOptions = legalRows.some((row: Json) =>
    String(row.position || "").toUpperCase() !== "K"
  );
  const candidates = legalRows
    .filter((row: Json) => {
      const bucket = String(row.position || "").toUpperCase();
      return bucket !== "K" || aiKickerAllowed(league, rosterContext.counts, rosteredCount, round, hasNonKickerOptions);
    });

  const fallbackCandidates = legalRows.filter((row: Json) => {
    const bucket = String(row.position || "").toUpperCase();
    return bucket !== "K" || aiKickerAllowed(league, rosterContext.counts, rosteredCount, round, legalRows.some((item: Json) => String(item.position || "").toUpperCase() !== "K"));
  });
  const ordered = (candidates.length ? candidates : fallbackCandidates).sort((a: Json, b: Json) => {
    const bucketA = String(a.position || "").toUpperCase();
    const bucketB = String(b.position || "").toUpperCase();
    return Number(b.tier_value || 1) - Number(a.tier_value || 1) ||
      aiBucketNeedScore(league, rosterContext.counts, bucketB, rosteredCount, round) - aiBucketNeedScore(league, rosterContext.counts, bucketA, rosteredCount, round) ||
      aiPersonaBucketScore(persona, bucketB) - aiPersonaBucketScore(persona, bucketA) ||
      Number(a.position_rank || 0) - Number(b.position_rank || 0);
  });

  for (const row of ordered) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("position")
      .eq("id", row.player_id)
      .single();
    if (playerError) throw playerError;
    const { allowed } = await canDraftPositionForMember(supabase, league, leagueMemberId, String(player.position || ""));
    if (!allowed) continue;
    if (!(await canFitTeamTierCap(supabase, league, leagueMemberId, String(row.player_id)))) continue;
    return row.player_id;
  }

  throw new Error("No eligible AI draft players remain");
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

function shuffleRows<T extends { id?: unknown }>(rows: T[]) {
  const shuffled = [...rows];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (
    shuffled.length > 1 &&
    shuffled.every((row, index) => String(row?.id || "") === String(rows[index]?.id || ""))
  ) {
    const offset = 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % (shuffled.length - 1));
    return [...shuffled.slice(offset), ...shuffled.slice(0, offset)];
  }
  return shuffled;
}

function draftCheckInState(room?: Json | null) {
  const state = ((room?.state || {}) as Json);
  const checkIn = ((state.check_in || {}) as Json);
  return {
    active: checkIn.active === true,
    started_at: checkIn.started_at || null,
    ends_at: checkIn.ends_at || null,
    duration_minutes: Number(checkIn.duration_minutes || 0),
    statuses: ((checkIn.statuses || {}) as Json),
  };
}

function draftCheckInStatus(checkIn: Json, memberId: unknown) {
  return String((((checkIn.statuses || {}) as Json)[String(memberId || "")] as Json | undefined)?.status || "").toUpperCase();
}

function draftCheckInComplete(members: Json[] = [], checkIn: Json) {
  if (!members.length) return false;
  return members.every((member) => ["CHECKED_IN", "FORCED"].includes(draftCheckInStatus(checkIn, member.id)));
}

async function upsertDraftRoomState(supabase: ReturnType<typeof createClient>, draft: Json, league: Json, state: Json) {
  const { data: existingRoom, error: existingRoomError } = await supabase
    .from("draft_rooms")
    .select("current_pick,timer_seconds")
    .eq("draft_id", draft.id)
    .maybeSingle();
  if (existingRoomError) throw existingRoomError;
  const { data: room, error } = await supabase
    .from("draft_rooms")
    .upsert(
      {
        draft_id: draft.id,
        current_pick: Number(existingRoom?.current_pick || 1),
        timer_seconds: Number(existingRoom?.timer_seconds || (league.draft_config as Json | undefined)?.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds),
        state,
        updated_date: new Date().toISOString(),
      },
      { onConflict: "draft_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return room;
}

async function draftAndLeagueForCheckIn(supabase: ReturnType<typeof createClient>, payload: Json) {
  if (payload.draft_id) {
    const { data, error } = await supabase
      .from("drafts")
      .select("*, leagues(*)")
      .eq("id", payload.draft_id)
      .maybeSingle();
    if (error) throw error;
    if (data) return { draft: data, league: normalizeLeaguePlaySettings(data.leagues) };
  }

  const leagueId = String(payload.league_id || "");
  if (!leagueId) throw new Error("League is required.");
  const { data: rawLeague, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!rawLeague) throw new Error("League was not found.");
  const league = normalizeLeaguePlaySettings(rawLeague);

  const { data: existingDraft, error: existingError } = await supabase
    .from("drafts")
    .select("*")
    .eq("league_id", league.id)
    .in("status", ["SCHEDULED", "OPEN"])
    .order("created_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingDraft) return { draft: { ...existingDraft, leagues: rawLeague }, league };

  const { data: createdDraft, error: createError } = await supabase
    .from("drafts")
    .insert({
      league_id: league.id,
      week_number: null,
      status: "SCHEDULED",
      type: ((league.draft_config as Json | undefined)?.type) || DEFAULT_DRAFT_CONFIG.type,
      start: null,
      updated_date: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (createError) throw createError;
  return { draft: { ...createdDraft, leagues: rawLeague }, league };
}

async function updateDraftCheckIn(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const action = String(payload.action || "").toLowerCase();
  const { draft, league } = await draftAndLeagueForCheckIn(supabase, payload);
  if (String(draft.status || "").toUpperCase() === "COMPLETED") throw new Error("Draft is already complete.");

  const { data: existingRoom, error: roomError } = await supabase
    .from("draft_rooms")
    .select("*")
    .eq("draft_id", draft.id)
    .maybeSingle();
  if (roomError) throw roomError;
  const roomState = ((existingRoom?.state || {}) as Json);
  const checkIn = draftCheckInState(existingRoom);
  const statuses = { ...((checkIn.statuses || {}) as Json) };

  if (action === "check_in") {
    let member: Json | null = null;
    const { data: profileMember, error: profileMemberError } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", league.id)
      .eq("is_active", true)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (profileMemberError) throw profileMemberError;
    member = profileMember;
    if (!member && user.email) {
      const { data: emailMember, error: emailMemberError } = await supabase
        .from("league_members")
        .select("*")
        .eq("league_id", league.id)
        .eq("is_active", true)
        .eq("user_email", user.email)
        .maybeSingle();
      if (emailMemberError) throw emailMemberError;
      member = emailMember;
    }
    if (!member) throw new Error("Only active league managers can check in.");
    statuses[String(member.id)] = { status: "CHECKED_IN", checked_in_at: new Date().toISOString(), by: user.id };
  } else {
    const { league: controlledLeague } = await requireLeagueControl(supabase, user, league.id);
    const controlled = normalizeLeaguePlaySettings(controlledLeague);
    if (action === "start") {
      const durationMinutes = Math.max(1, Math.min(240, Number(payload.duration_minutes || 15)));
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + durationMinutes * 60000);
      const nextCheckIn = {
        active: true,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_minutes: durationMinutes,
        statuses,
      };
      const nextState = { ...roomState, check_in: nextCheckIn };
      const room = await upsertDraftRoomState(supabase, draft, controlled, nextState);
      return { room, check_in: nextCheckIn };
    }
    if (action === "force") {
      const memberId = String(payload.league_member_id || "");
      if (!memberId) throw new Error("Team is required.");
      const { data: member, error: memberError } = await supabase
        .from("league_members")
        .select("id")
        .eq("league_id", league.id)
        .eq("id", memberId)
        .eq("is_active", true)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!member) throw new Error("Team is not active in this league.");
      statuses[memberId] = { status: "FORCED", forced_at: new Date().toISOString(), by: user.id, auto_draft: true };
    } else if (action === "pause") {
      const { data: currentRoom, error: currentRoomError } = await supabase
        .from("draft_rooms")
        .select("*")
        .eq("draft_id", draft.id)
        .maybeSingle();
      if (currentRoomError) throw currentRoomError;
      if (!currentRoom) throw new Error("Draft room was not found.");
      const currentState = ((currentRoom.state || {}) as Json);
      const timerSeconds = Number(currentRoom.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds);
      const startedAt = new Date(String(currentState.pick_started_at || currentRoom.updated_date || currentRoom.created_date)).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const remainingSeconds = Math.max(0, timerSeconds - elapsedSeconds);
      const aiDueAt = currentState.ai_pick_due_at ? new Date(String(currentState.ai_pick_due_at)).getTime() : 0;
      const nextState = {
        ...currentState,
        draft_paused: true,
        paused_at: new Date().toISOString(),
        paused_remaining_seconds: remainingSeconds,
        paused_ai_remaining_seconds: aiDueAt ? Math.max(0, Math.ceil((aiDueAt - Date.now()) / 1000)) : null,
      };
      const room = await upsertDraftRoomState(supabase, draft, controlled, nextState);
      return { room, paused: true };
    } else if (action === "continue") {
      const { data: currentRoom, error: currentRoomError } = await supabase
        .from("draft_rooms")
        .select("*")
        .eq("draft_id", draft.id)
        .maybeSingle();
      if (currentRoomError) throw currentRoomError;
      if (!currentRoom) throw new Error("Draft room was not found.");
      const currentState = ((currentRoom.state || {}) as Json);
      const timerSeconds = Number(currentRoom.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds);
      const remainingSeconds = Math.max(0, Math.min(timerSeconds, Number(currentState.paused_remaining_seconds || timerSeconds)));
      const pickStartedAt = new Date(Date.now() - Math.max(0, timerSeconds - remainingSeconds) * 1000).toISOString();
      const aiRemainingSeconds = currentState.paused_ai_remaining_seconds === null || currentState.paused_ai_remaining_seconds === undefined
        ? null
        : Math.max(0, Number(currentState.paused_ai_remaining_seconds || 0));
      const nextState = {
        ...currentState,
        draft_paused: false,
        paused_at: null,
        paused_remaining_seconds: null,
        paused_ai_remaining_seconds: null,
        pick_started_at: pickStartedAt,
        ai_pick_due_at: aiRemainingSeconds === null ? currentState.ai_pick_due_at : new Date(Date.now() + aiRemainingSeconds * 1000).toISOString(),
      };
      const room = await upsertDraftRoomState(supabase, draft, controlled, nextState);
      return { room, paused: false };
    } else if (action === "sound") {
      const nextState = { ...roomState, draft_day_sound_version: new Date().toISOString() };
      const room = await upsertDraftRoomState(supabase, draft, controlled, nextState);
      return { room };
    } else {
      throw new Error("Unsupported draft check-in action.");
    }
  }

  const nextCheckIn = {
    ...checkIn,
    active: checkIn.active !== false,
    statuses,
  };
  const nextState = { ...roomState, check_in: nextCheckIn };
  const room = await upsertDraftRoomState(supabase, draft, league, nextState);
  return { room, check_in: nextCheckIn };
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

  const { data: memberRows, error: memberError } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", league.id)
    .eq("is_active", true)
    .order("created_date", { ascending: true });
  if (memberError) throw memberError;
  let members = memberRows || [];
  if (!members?.length) throw new Error("No active teams are in this league");

  const { data: existingRoom, error: existingRoomError } = await supabase
    .from("draft_rooms")
    .select("*")
    .eq("draft_id", draft.id)
    .maybeSingle();
  if (existingRoomError) throw existingRoomError;
  const room = existingRoom || null;
  let checkIn = draftCheckInState(room);
  if (members.length % 2 !== 0) {
    const createdAi = await createAiLeagueMember(supabase, league, "BALANCED");
    members = [...members, createdAi.member];
    const statuses = { ...((checkIn.statuses || {}) as Json) };
    statuses[String(createdAi.member.id)] = { status: "FORCED", forced_at: new Date().toISOString(), by: user.id, auto_draft: true, reason: "odd_team_count" };
    checkIn = { ...checkIn, statuses };
  }
  if (!draftCheckInComplete(members || [], checkIn)) {
    throw new Error("All active managers must check in or be force checked-in before the draft can start.");
  }

  const lockedLeague = await lockLeagueScoringRules(supabase, league, "draft_start");
  const { scoringRulesHash } = await scoringRulesHashForLeague(supabase, lockedLeague);
  if (!(await existingLeaguePlayerScoresComplete(supabase, lockedLeague, scoringRulesHash))) {
    throw new Error("Draft pool is still preparing. Wait for the Eligible Players panel to finish before starting the draft.");
  }
  await syncLeagueDurabilityRows(supabase, lockedLeague);

  const { count: existingPicks, error: pickCountError } = await supabase
    .from("draft_picks")
    .select("id", { count: "exact", head: true })
    .eq("draft_id", draft.id);
  if (pickCountError) throw pickCountError;
  if (Number(existingPicks || 0) > 0) throw new Error("Draft order cannot be randomized after picks have been made.");

  await supabase.from("draft_turns").delete().eq("draft_id", draft.id);
  const order = shuffleRows(members || []);
  const rounds = Math.max(1, Number((lockedLeague.draft_config as Json | undefined)?.rounds || DEFAULT_DRAFT_CONFIG.rounds));
  const isSnake = String(draft.type || (lockedLeague.draft_config as Json | undefined)?.type || "snake") === "snake";
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

  const { error: roomError } = await supabase.from("draft_rooms").upsert(
    {
      draft_id: draft.id,
      current_pick: 1,
      timer_seconds: Number((lockedLeague.draft_config as Json | undefined)?.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds),
      state: {
        ...(((room?.state || {}) as Json)),
        check_in: { ...checkIn, active: false },
        pick_started_at: new Date().toISOString(),
        draft_day_sound_version: new Date().toISOString(),
      },
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
  const { error: leagueStatusError } = await supabase
    .from("leagues")
    .update({ league_status: "DRAFTING", updated_date: new Date().toISOString() })
    .eq("id", league.id);
  if (leagueStatusError) throw leagueStatusError;
  return { draft: updatedDraft };
}

async function resetDraft(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  const { data: draft, error: draftError } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", payload.draft_id)
    .eq("league_id", league.id)
    .single();
  if (draftError) throw draftError;

  const { data: picks, error: picksError } = await supabase
    .from("draft_picks")
    .select("league_member_id,player_id")
    .eq("draft_id", draft.id);
  if (picksError) throw picksError;

  for (const pick of picks || []) {
    const { error: rosterDeleteError } = await supabase
      .from("roster_slots")
      .delete()
      .eq("league_member_id", pick.league_member_id)
      .eq("player_id", pick.player_id);
    if (rosterDeleteError) throw rosterDeleteError;
  }

  const { error: picksDeleteError } = await supabase.from("draft_picks").delete().eq("draft_id", draft.id);
  if (picksDeleteError) throw picksDeleteError;
  const { error: turnsDeleteError } = await supabase.from("draft_turns").delete().eq("draft_id", draft.id);
  if (turnsDeleteError) throw turnsDeleteError;
  const { error: roomsDeleteError } = await supabase.from("draft_rooms").delete().eq("draft_id", draft.id);
  if (roomsDeleteError) throw roomsDeleteError;

  const { data: recapItems, error: recapFetchError } = await supabase
    .from("league_news_items")
    .select("id,storage_bucket,storage_path")
    .eq("source_draft_id", draft.id)
    .eq("news_type", "AI_DRAFT_RECAP");
  if (recapFetchError) throw recapFetchError;
  const recapItemsByBucket = (recapItems || []).reduce((groups: Record<string, string[]>, item: Json) => {
    const bucket = String(item.storage_bucket || "");
    const path = String(item.storage_path || "");
    if (!bucket || !path) return groups;
    groups[bucket] = [...(groups[bucket] || []), path];
    return groups;
  }, {});
  for (const [bucket, paths] of Object.entries(recapItemsByBucket)) {
    const { error: storageRemoveError } = await supabase.storage.from(bucket).remove(paths);
    if (storageRemoveError) throw storageRemoveError;
  }
  if ((recapItems || []).length) {
    const { error: recapDeleteError } = await supabase
      .from("league_news_items")
      .delete()
      .eq("source_draft_id", draft.id)
      .eq("news_type", "AI_DRAFT_RECAP");
    if (recapDeleteError) throw recapDeleteError;
  }

  if (league.scoring_rules_lock_source === "draft_start") {
    const { error: leagueUpdateError } = await supabase
      .from("leagues")
      .update({
        scoring_rules_locked_at: null,
        scoring_rules_lock_source: null,
        updated_date: new Date().toISOString(),
      })
      .eq("id", league.id);
    if (leagueUpdateError) throw leagueUpdateError;
  }

  const { data: updatedDraft, error: updateError } = await supabase
    .from("drafts")
    .update({
      status: "SCHEDULED",
      started_at: null,
      completed_at: null,
      updated_date: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return {
    draft: updatedDraft,
    removed_picks: (picks || []).length,
    removed_recaps: (recapItems || []).length,
    reset: true,
  };
}

async function prepareDraftPool(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  return processLeagueDraftPoolJob(supabase, league, payload.force_rebuild === true);
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
      if (allowed && await canFitTeamTierCap(supabase, league, memberId, String(item.player_id))) return item.player_id;
    }
  }

  const { data: players, error: playersError } = await supabase
    .from("league_player_scores")
    .select("player_id,total_points,position_rank,tier_value,players!inner(position)")
    .eq("league_id", league.id)
    .lte("position_rank", DRAFT_MAX_BUCKET_TARGET)
    .limit(1000);
  if (playersError) throw playersError;

  const tierPriority = new Map([[3, 0], [2, 1], [1, 2], [4, 3], [5, 4]]);
  const orderedPlayers = [...(players || [])].sort((a: Json, b: Json) =>
    Number(tierPriority.get(Number(a.tier_value || 1)) ?? 99) - Number(tierPriority.get(Number(b.tier_value || 1)) ?? 99) ||
    Number(b.total_points || 0) - Number(a.total_points || 0) ||
    Number(a.position_rank || 0) - Number(b.position_rank || 0)
  );

  for (const player of orderedPlayers) {
    if (pickedIds.has(player.player_id)) continue;
    if (memberId) {
      const playerRow = Array.isArray(player.players) ? player.players[0] : player.players;
      const { allowed } = await canDraftPositionForMember(supabase, league, memberId, String(playerRow?.position || ""));
      if (!allowed) continue;
      if (!(await canFitTeamTierCap(supabase, league, memberId, String(player.player_id)))) continue;
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
  if ((room.state as Json | undefined)?.draft_paused === true) throw new Error("Draft is paused.");
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
    const nextState = {
      ...((room.state || {}) as Json),
      pick_started_at: new Date().toISOString(),
      ai_pick_due_at: null,
      ai_pick_due_pick: null,
    };
    await supabase.from("draft_rooms").update({
      current_pick: nextPick,
      state: nextState,
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
  if ((room.state as Json | undefined)?.draft_paused === true) return { processed: false, paused: true };
  const startedAt = new Date(String((room.state as Json | undefined)?.pick_started_at || room.updated_date || room.created_date)).getTime();
  const timerMs = Number(room.timer_seconds || DEFAULT_DRAFT_CONFIG.timer_seconds) * 1000;

  const { data: turn, error: turnError } = await supabase
    .from("draft_turns")
    .select("*")
    .eq("draft_id", draft.id)
    .eq("overall_pick", room.current_pick)
    .single();
  if (turnError) throw turnError;

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .select("*")
    .eq("id", turn.league_member_id)
    .single();
  if (memberError) throw memberError;
  const league = normalizeLeaguePlaySettings(draft.leagues);
  if (member?.is_ai === true) {
    const state = ((room.state || {}) as Json);
    const currentPick = Number(room.current_pick || 1);
    const duePick = Number(state.ai_pick_due_pick || 0);
    const dueAt = state.ai_pick_due_at ? new Date(String(state.ai_pick_due_at)).getTime() : 0;
    if (duePick !== currentPick || !dueAt) {
      const delaySeconds = randomIntegerInclusive(AI_DRAFT_PICK_DELAY_MIN_SECONDS, AI_DRAFT_PICK_DELAY_MAX_SECONDS);
      const nextState = {
        ...state,
        ai_pick_due_pick: currentPick,
        ai_pick_due_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      };
      const { error: updateError } = await supabase
        .from("draft_rooms")
        .update({ state: nextState, updated_date: new Date().toISOString() })
        .eq("draft_id", draft.id);
      if (updateError) throw updateError;
      return { processed: false, ai_pending: true, delay_seconds: delaySeconds };
    }
    if (Date.now() < dueAt) {
      return { processed: false, ai_pending: true, due_at: state.ai_pick_due_at };
    }
    const playerId = await aiBestAvailablePlayer(supabase, league, draft.id, member, turn);
    return submitDraftPick(supabase, user, { draft_id: draft.id, player_id: playerId, auto_pick: true });
  }

  if (Date.now() - startedAt < timerMs) return { processed: false };
  const playerId = await bestAvailablePlayer(supabase, league, draft.id, turn.league_member_id);
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

async function latestSeasonForLeague(supabase: ReturnType<typeof createClient>, leagueId: unknown) {
  const { data, error } = await supabase
    .from("league_seasons")
    .select("*")
    .eq("league_id", leagueId)
    .order("created_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function validateLineupSlots(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  memberId: string,
  weekNumber: number,
  slots: Json[] = [],
) {
  const playerIds = slots.map((slot) => String(slot.player_id || "")).filter(Boolean);
  if (!playerIds.length) throw new Error("Lineup requires roster players.");
  if (new Set(playerIds).size !== playerIds.length) throw new Error("Lineup cannot include duplicate players.");

  const { data: roster, error: rosterError } = await supabase
    .from("roster_slots")
    .select("player_id,slot_type,players(position)")
    .eq("league_member_id", memberId);
  if (rosterError) throw rosterError;
  const rosterByPlayer = new Map((roster || []).map((slot: Json) => [String(slot.player_id), slot]));
  const missing = playerIds.filter((playerId) => !rosterByPlayer.has(playerId));
  if (missing.length) throw new Error("Lineup includes players not on this roster.");

  const counts: Record<string, number> = { QB: 0, OFF: 0, DEF: 0, K: 0 };
  const treatmentSlots = slots.filter(isTreatmentLineupSlot);
  if (treatmentSlots.length > 1) throw new Error("Only one player may be treated per week.");
  if (treatmentSlots.length && !durabilityEnabled(league)) throw new Error("Treatment is only available when durability is enabled.");
  const treatmentPlayerId = treatmentSlots[0]?.player_id ? String(treatmentSlots[0].player_id) : null;
  if (treatmentPlayerId) {
    const { data: durabilityRow, error: durabilityError } = await supabase
      .from("league_player_durability")
      .select("durability,initial_durability")
      .eq("league_id", league.id)
      .eq("player_id", treatmentPlayerId)
      .maybeSingle();
    if (durabilityError) throw durabilityError;
    if (!durabilityRow) throw new Error("Treatment requires a durability record for that player.");
    const currentDurability = Number(durabilityRow.durability ?? 0);
    if (currentDurability >= 100) throw new Error("Players must have durability loss before treatment.");

    const { data: usageRow, error: usageError } = await supabase
      .from("manager_player_usage")
      .select("usage_count,last_used_week")
      .eq("league_id", league.id)
      .eq("league_member_id", memberId)
      .eq("player_id", treatmentPlayerId)
      .maybeSingle();
    if (usageError) throw usageError;
    const lastUsedWeek = Number(usageRow?.last_used_week || 0);
    const hasPriorStart = Number(usageRow?.usage_count || 0) >= 1 && lastUsedWeek > 0 && lastUsedWeek < Number(weekNumber);
    if (!hasPriorStart) throw new Error("Players must have started in a previous week before treatment.");
  }

  for (const slot of slots) {
    if (isTreatmentLineupSlot(slot) && isStartedLineupSlot(slot)) throw new Error("A treated player cannot also be a starter.");
    if (!isStartedLineupSlot(slot)) continue;
    const rosterSlot = rosterByPlayer.get(String(slot.player_id || "")) || {};
    const player = Array.isArray(rosterSlot.players) ? rosterSlot.players[0] : rosterSlot.players;
    const bucket = lineupPositionBucket(slot.slot || rosterSlot.slot_type || player?.position);
    counts[bucket] = Number(counts[bucket] || 0) + 1;
  }

  const offDefTotal = Number(counts.OFF || 0) + Number(counts.DEF || 0);
  const valid = Number(counts.QB || 0) === 1 &&
    Number(counts.K || 0) === 1 &&
    offDefTotal === 3 &&
    Number(counts.OFF || 0) >= 1 &&
    Number(counts.OFF || 0) <= 2 &&
    Number(counts.DEF || 0) >= 1 &&
    Number(counts.DEF || 0) <= 2;
  if (!valid) throw new Error("Lineup must include 1 QB, 1 K, and either 2 OFF/1 DEF or 1 OFF/2 DEF.");
  return { counts, treatmentPlayerId };
}

async function spendTreatmentPointsIfNeeded(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  memberId: string,
  weekNumber: number,
  treatmentPlayerId: string | null,
) {
  if (!treatmentPlayerId || league.manager_points_enabled !== true) return;
  const actions = { ...DEFAULT_MANAGER_POINT_ACTIONS, ...((league.manager_point_actions || {}) as Json) };
  const action = (actions.treat_bench_player || {}) as Json;
  if (action.active !== true) throw new Error("Treat Bench Player is not enabled for Manager Points.");
  const cost = Math.max(0, Number(action.cost || 0));
  if (cost <= 0) return;

  const { data: existingTransactions, error: existingError } = await supabase
    .from("manager_point_transactions")
    .select("*")
    .eq("league_id", league.id)
    .eq("league_member_id", memberId)
    .eq("action_key", "treat_bench_player")
    .contains("metadata", { week_number: weekNumber, purpose: "lineup_treatment" });
  if (existingError) throw existingError;
  const existing = (existingTransactions || [])[0];
  if (existing) {
    if (String(existing.target_player_id || "") !== treatmentPlayerId) {
      throw new Error("A paid treatment has already been used this week and cannot be changed.");
    }
    return;
  }

  const season = await latestSeasonForLeague(supabase, league.id);
  if (!season?.id) throw new Error("Manager Points require an active season.");
  const { data: account, error: accountError } = await supabase
    .from("manager_point_accounts")
    .select("*")
    .eq("league_id", league.id)
    .eq("league_member_id", memberId)
    .eq("season_id", season.id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) throw new Error("Manager Points account was not found.");
  if (Number(account.current_points || 0) < cost) throw new Error("Not enough Manager Points for treatment.");

  const { error: updateError } = await supabase
    .from("manager_point_accounts")
    .update({ current_points: Number(account.current_points || 0) - cost })
    .eq("id", account.id);
  if (updateError) throw updateError;
  const { error: transactionError } = await supabase.from("manager_point_transactions").insert({
    account_id: account.id,
    league_id: league.id,
    league_member_id: memberId,
    points_delta: -cost,
    action_key: "treat_bench_player",
    target_player_id: treatmentPlayerId,
    metadata: { week_number: weekNumber, purpose: "lineup_treatment" },
  });
  if (transactionError) throw transactionError;
}

async function assertAllLineupsReady(
  supabase: ReturnType<typeof createClient>,
  league: Json,
  weekNumber: number,
  activeMembers: Json[],
  lineups: Json[],
) {
  const lineupByMember = new Map((lineups || []).map((lineup: Json) => [String(lineup.league_member_id || ""), lineup]));
  const missing = [];
  for (const member of activeMembers || []) {
    const memberId = String(member.id || "");
    const lineup = lineupByMember.get(memberId);
    if (!lineup?.finalized_at) {
      missing.push(String(member.team_name || memberId));
      continue;
    }
    await validateLineupSlots(supabase, league, memberId, weekNumber, Array.isArray(lineup.slots) ? lineup.slots as Json[] : []);
  }
  if (missing.length) throw new Error(`Lineups must be finalized before resolving: ${missing.join(", ")}.`);
}

function limitedUseThreshold(league: Json) {
  return league.draft_mode === "season_snake" && league.player_retention_mode === "limited_use"
    ? Math.max(1, Number(league.player_retention_limit || 2))
    : 0;
}

function lineupCandidateSortValue(candidate: Json) {
  const tier = Number(candidate.tier_value || 1);
  const adjusted = Number(candidate.adjusted_points || 0);
  const releasePenalty = candidate.would_release ? 0.75 : 0;
  return (tier - releasePenalty) * 1000 + adjusted;
}

function sortLineupCandidates(candidates: Json[]) {
  return [...candidates].sort((a, b) =>
    lineupCandidateSortValue(b) - lineupCandidateSortValue(a) ||
    Number(a.position_rank || 9999) - Number(b.position_rank || 9999) ||
    String(a.name || a.player_id).localeCompare(String(b.name || b.player_id))
  );
}

function chooseLineupCandidates(candidates: Json[], count: number) {
  const sorted = sortLineupCandidates(candidates);
  if (sorted.length <= count) return sorted;
  const healthier = sorted.filter((candidate) => Number(candidate.durability ?? 100) >= 80);
  if (healthier.length >= count) return healthier.slice(0, count);
  const playable = sorted.filter((candidate) => Number(candidate.durability ?? 100) >= 50);
  if (playable.length >= count) return playable.slice(0, count);
  return sorted.slice(0, count);
}

async function managerPointTreatmentAffordable(supabase: ReturnType<typeof createClient>, league: Json, memberId: string) {
  if (league.manager_points_enabled !== true) return true;
  const actions = { ...DEFAULT_MANAGER_POINT_ACTIONS, ...((league.manager_point_actions || {}) as Json) };
  const action = (actions.treat_bench_player || {}) as Json;
  if (action.active !== true) return false;
  const cost = Math.max(0, Number(action.cost || 0));
  if (cost <= 0) return true;
  const season = await latestSeasonForLeague(supabase, league.id);
  if (!season?.id) return false;
  const { data: account, error } = await supabase
    .from("manager_point_accounts")
    .select("current_points")
    .eq("league_id", league.id)
    .eq("league_member_id", memberId)
    .eq("season_id", season.id)
    .maybeSingle();
  if (error) throw error;
  return Number(account?.current_points || 0) >= cost;
}

async function buildAiLineupSlots(supabase: ReturnType<typeof createClient>, league: Json, member: Json, weekNumber: number) {
  await ensureLeaguePlayerScores(supabase, league);
  const memberId = String(member.id || "");
  const { data: roster, error: rosterError } = await supabase
    .from("roster_slots")
    .select("player_id,slot_type,players(id,full_name,player_display_name,position,team)")
    .eq("league_member_id", memberId);
  if (rosterError) throw rosterError;
  const playerIds = [...new Set((roster || []).map((slot: Json) => String(slot.player_id || "")).filter(Boolean))];
  if (!playerIds.length) throw new Error(`${member.team_name || "AI team"} has no roster players.`);

  const [{ data: tiers, error: tierError }, { data: scores, error: scoreError }, { data: durabilityRows, error: durabilityError }, { data: usageRows, error: usageError }] = await Promise.all([
    supabase.from("league_player_draft_tiers").select("player_id,tier_value,position,position_rank").eq("league_id", league.id).in("player_id", playerIds),
    supabase.from("league_player_scores").select("player_id,expected_avg_points,total_points,tier_value,position,position_rank").eq("league_id", league.id).in("player_id", playerIds),
    durabilityEnabled(league)
      ? supabase.from("league_player_durability").select("player_id,durability,initial_durability").eq("league_id", league.id).in("player_id", playerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("manager_player_usage").select("player_id,usage_count,last_used_week,released_at").eq("league_id", league.id).eq("league_member_id", memberId).in("player_id", playerIds),
  ]);
  if (tierError) throw tierError;
  if (scoreError) throw scoreError;
  if (durabilityError) throw durabilityError;
  if (usageError) throw usageError;

  const tierByPlayer = new Map((tiers || []).map((row: Json) => [String(row.player_id), row]));
  const scoreByPlayer = new Map((scores || []).map((row: Json) => [String(row.player_id), row]));
  const durabilityByPlayer = new Map((durabilityRows || []).map((row: Json) => [String(row.player_id), row]));
  const usageByPlayer = new Map((usageRows || []).map((row: Json) => [String(row.player_id), row]));
  const threshold = limitedUseThreshold(league);
  const byBucket: Record<string, Json[]> = { QB: [], OFF: [], DEF: [], K: [] };

  for (const slot of roster || []) {
    const playerId = String(slot.player_id || "");
    const player = Array.isArray(slot.players) ? slot.players[0] : slot.players;
    const tier = tierByPlayer.get(playerId) || {};
    const score = scoreByPlayer.get(playerId) || {};
    const bucket = lineupPositionBucket(tier.position || score.position || player?.position || slot.slot_type);
    const durabilityRow = durabilityByPlayer.get(playerId) || {};
    const durability = durabilityRow.durability === undefined ? 100 : Number(durabilityRow.durability);
    const initialDurability = durabilityRow.initial_durability === undefined ? 100 : Number(durabilityRow.initial_durability);
    const usage = usageByPlayer.get(playerId) || {};
    const usageCount = Number(usage.usage_count || 0);
    const lastUsedWeek = Number(usage.last_used_week || 0);
    const previousStartCount = lastUsedWeek > 0 && lastUsedWeek < Number(weekNumber) ? usageCount : 0;
    const wouldRelease = threshold > 0 && !usage.released_at && usageCount + 1 >= threshold;
    byBucket[bucket].push({
      player_id: playerId,
      slot: tier.position || score.position || player?.position || slot.slot_type || bucket,
      bucket,
      tier_value: Number(tier.tier_value || score.tier_value || 1),
      position_rank: Number(tier.position_rank || score.position_rank || 9999),
      expected_avg_points: Number(score.expected_avg_points || 0),
      adjusted_points: Number(score.expected_avg_points || 0) * durabilityMultiplierFor(durability),
      durability,
      initial_durability: initialDurability,
      usage_count: usageCount,
      previous_start_count: previousStartCount,
      would_release: wouldRelease,
      name: String(player?.player_display_name || player?.full_name || playerId),
    });
  }

  const qb = chooseLineupCandidates(byBucket.QB, 1);
  const kicker = chooseLineupCandidates(byBucket.K, 1);
  const shapeA = [...chooseLineupCandidates(byBucket.OFF, 2), ...chooseLineupCandidates(byBucket.DEF, 1)];
  const shapeB = [...chooseLineupCandidates(byBucket.OFF, 1), ...chooseLineupCandidates(byBucket.DEF, 2)];
  const scoreShape = (items: Json[]) => items.length === 3 ? items.reduce((sum, item) => sum + lineupCandidateSortValue(item), 0) : -1;
  const flex = scoreShape(shapeA) >= scoreShape(shapeB) ? shapeA : shapeB;
  const starters = [...qb, ...kicker, ...flex];
  if (starters.length !== 5 || qb.length !== 1 || kicker.length !== 1 || flex.length !== 3) {
    throw new Error(`${member.team_name || "AI team"} does not have enough roster players for a valid lineup.`);
  }

  const starterIds = new Set(starters.map((candidate) => String(candidate.player_id)));
  let treatmentId: string | null = null;
  const treatmentAffordable = await managerPointTreatmentAffordable(supabase, league, memberId);
  if (treatmentAffordable && durabilityEnabled(league)) {
    const benchCandidates = sortLineupCandidates(Object.values(byBucket).flat())
      .filter((candidate) => !starterIds.has(String(candidate.player_id)))
      .filter((candidate) => Number(candidate.durability ?? 100) < 100)
      .filter((candidate) => Number(candidate.previous_start_count || 0) >= 1)
      .filter((candidate) => league.manager_points_enabled === true
        ? Number(candidate.durability ?? 100) <= 90 && (Number(candidate.tier_value || 1) >= 3 || byBucket[String(candidate.bucket)]?.length <= 1)
        : true);
    treatmentId = benchCandidates[0]?.player_id ? String(benchCandidates[0].player_id) : null;
  }

  return (roster || []).map((slot: Json) => {
    const playerId = String(slot.player_id || "");
    const candidate = Object.values(byBucket).flat().find((item) => String(item.player_id) === playerId);
    return {
      slot: candidate?.slot || slot.slot_type || "FLEX",
      player_id: playerId,
      status: starterIds.has(playerId) ? "active" : treatmentId === playerId ? "treatment" : "bench",
    };
  });
}

async function generateAiLineups(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const { league: rawLeague } = await requireLeagueControl(supabase, user, payload.league_id);
  const league = normalizeLeaguePlaySettings(rawLeague);
  const weekNumber = Number(payload.week_number || 0);
  if (!weekNumber) throw new Error("Week number is required.");
  const { count: resolvedCount, error: resolvedError } = await supabase
    .from("league_week_results")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("week_number", weekNumber);
  if (resolvedError) throw resolvedError;
  if (resolvedCount) throw new Error("AI lineups cannot be regenerated after the week is resolved.");

  const { data: members, error: memberError } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", league.id)
    .eq("is_active", true)
    .eq("is_ai", true);
  if (memberError) throw memberError;
  const aiMemberIds = (members || []).map((member: Json) => member.id).filter(Boolean);
  if (payload.force === true && aiMemberIds.length) {
    const { error: deleteError } = await supabase
      .from("lineups")
      .delete()
      .eq("league_id", league.id)
      .eq("week_number", weekNumber)
      .in("league_member_id", aiMemberIds);
    if (deleteError) throw deleteError;
  }
  const generated = [];
  const skipped = [];
  for (const member of members || []) {
    const { data: existing, error: existingError } = await supabase
      .from("lineups")
      .select("*")
      .eq("league_id", league.id)
      .eq("league_member_id", member.id)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.finalized_at && payload.force !== true) {
      skipped.push(member.id);
      continue;
    }
    const slots = await buildAiLineupSlots(supabase, league, member, weekNumber);
    const result = await finalizeLineup(supabase, { league_id: league.id, league_member_id: member.id, week_number: weekNumber, slots });
    generated.push(result.lineup);
  }
  return { generated_count: generated.length, skipped_count: skipped.length, lineups: generated };
}

async function finalizeLineup(supabase: ReturnType<typeof createClient>, payload: Json) {
  const { data: rawLeague, error: leagueError } = await supabase.from("leagues").select("*").eq("id", payload.league_id).single();
  if (leagueError) throw leagueError;
  const league = normalizeLeaguePlaySettings(rawLeague);
  const slots = Array.isArray(payload.slots) ? payload.slots as Json[] : [];
  const memberId = String(payload.league_member_id || "");
  const weekNumber = Number(payload.week_number || 0);
  const gamePlanType = normalizeGamePlanType(payload.game_plan_type || payload.game_plan?.type);
  const gamePlanDetails = ((payload.game_plan || {}) as Json).details || ((payload.game_plan || {}) as Json).metadata || {};
  const validation = await validateLineupSlots(supabase, league, memberId, weekNumber, slots);
  const { data: lineup, error } = await supabase
    .from("lineups")
    .upsert(
      {
        league_id: payload.league_id,
        league_member_id: payload.league_member_id,
        week_number: payload.week_number,
        slots,
        game_plan_type: gamePlanType,
        game_plan: { type: gamePlanType, details: gamePlanDetails },
        finalized_at: new Date().toISOString(),
      },
      { onConflict: "league_id,league_member_id,week_number" },
    )
    .select("*")
    .single();
  if (error) throw error;
  const { error: gamePlanError } = await supabase
    .from("league_game_plans")
    .upsert(
      {
        league_id: payload.league_id,
        league_member_id: payload.league_member_id,
        lineup_id: lineup.id,
        week_number: payload.week_number,
        game_plan_type: gamePlanType,
        game_plan: { type: gamePlanType, details: gamePlanDetails },
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "league_id,league_member_id,week_number" },
    );
  if (gamePlanError) throw gamePlanError;
  await spendTreatmentPointsIfNeeded(supabase, league, memberId, weekNumber, validation.treatmentPlayerId);
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
  const isPlayoffWeek = weekNumber >= playoffStartWeekForLeague(league);

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
  let resolvedLineups = lineups || [];
  let resolvedActiveMembers = activeMembers || [];
  const { data: weekMatchups, error: weekMatchupError } = await supabase.from("matchups").select("*").eq("league_id", leagueId).eq("week_number", weekNumber);
  if (weekMatchupError) throw weekMatchupError;
  if (isPlayoffWeek) {
    const playoffMemberIds = new Set((weekMatchups || []).flatMap((matchup: Json) => [
      String(matchup.home_member_id || ""),
      String(matchup.away_member_id || ""),
    ]).filter(Boolean));
    resolvedLineups = resolvedLineups.filter((lineup: Json) => playoffMemberIds.has(String(lineup.league_member_id || "")));
    resolvedActiveMembers = resolvedActiveMembers.filter((member: Json) => playoffMemberIds.has(String(member.id || "")));
  }
  await assertAllLineupsReady(supabase, league, weekNumber, resolvedActiveMembers || [], resolvedLineups || []);

  const assignments = { ...((randomization?.assignments || {}) as Record<string, Json>) };
  const sourceSeasonYear = Number(randomization?.source_season_year || league.source_season_year || new Date().getFullYear() - 1);
  const scoringRules = await effectiveLeagueScoringRules(supabase, league);
  const lockSegment = sourceWeekLockSegment(league, weekNumber);
  const lineupEntries = (resolvedLineups || []).flatMap((lineup: Json) =>
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
  const { data: scheduleRows, error: scheduleError } = await supabase
    .from("league_game_schedule")
    .select("durability_loss_percent,game_conditions")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);
  if (scheduleError) throw scheduleError;
  const gameConditionDurabilityLoss = Math.max(0, ...(scheduleRows || []).map((row: Json) => durabilityLossModifierFromSchedule(row)));
  const lineupTotals: Array<{ league_member_id: string; team_name: string | null; total: number; slots: Json[] }> = [];

  for (const lineup of resolvedLineups || []) {
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
      const durabilityBonus = Number((finalPoints - slotPoints).toFixed(2));
      total += finalPoints;
      scoredSlots.push({
        ...slot,
        player_id: playerId,
        source_weeks: sourceWeeks,
        source_week_values: sourceWeekValues,
        average_points: Number(baseAverage.toFixed(4)),
        lineup_multiplier: lineupSlotMultiplier(slot),
        base_points: Number(slotPoints.toFixed(4)),
        durability: durabilityByPlayer.get(playerId),
        durability_bonus: durabilityBonus,
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
  for (const member of resolvedActiveMembers || []) {
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
    const isPlayoff = isPlayoffWeek;
    for (const lineup of lineupTotals) {
      for (const slot of lineup.slots || []) {
        const playerId = String(slot.player_id || "");
        const isStarted = isStartedLineupSlot(slot);
        if (!isStarted) continue;
        const { data: existing, error: existingError } = await supabase
          .from("manager_player_usage")
          .select("*")
          .eq("league_id", leagueId)
          .eq("league_member_id", lineup.league_member_id)
          .eq("player_id", playerId)
          .maybeSingle();
        if (existingError) throw existingError;
        const usageCount = Number(existing?.usage_count || 0) + 1;
        const limitedUseThreshold = league.draft_mode === "season_snake" && league.player_retention_mode === "limited_use"
          ? Math.max(1, Number(league.player_retention_limit || 2))
          : 0;
        const shouldRelease = limitedUseThreshold > 0 && usageCount >= limitedUseThreshold && !existing?.released_at;
        const releasedAt = shouldRelease ? new Date().toISOString() : existing?.released_at || null;
        const usagePayload = {
          league_id: leagueId,
          league_member_id: lineup.league_member_id,
          player_id: playerId,
          used_in_week: existing?.used_in_week || weekNumber,
          usage_count: usageCount,
          first_used_week: existing?.first_used_week || weekNumber,
          last_used_week: weekNumber,
          use_context: isPlayoff ? "playoff" : "regular",
          released_at: releasedAt,
        };
        if (existing) {
          const { error } = await supabase.from("manager_player_usage").update(usagePayload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("manager_player_usage").insert(usagePayload);
          if (error) throw error;
        }
        if (shouldRelease) {
          await supabase
            .from("roster_slots")
            .delete()
            .eq("league_member_id", lineup.league_member_id)
            .eq("player_id", playerId);
          const { data: release, error: releaseError } = await supabase
            .from("player_release_events")
            .insert({
              league_id: leagueId,
              league_member_id: lineup.league_member_id,
              player_id: playerId,
              week_number: weekNumber,
              release_reason: "limited_use_limit",
              available_at: releasedAt,
            })
            .select("*")
            .single();
          if (releaseError) throw releaseError;
          releases.push(release);
        }
      }
    }
    if (releases.length) {
      const releasePlayerIds = [...new Set(releases.map((release) => String(release.player_id || "")).filter(Boolean))];
      const { data: releasedPlayers, error: releasedPlayersError } = releasePlayerIds.length
        ? await supabase
          .from("players")
          .select("id,player_display_name,full_name")
          .in("id", releasePlayerIds)
        : { data: [], error: null };
      if (releasedPlayersError) throw releasedPlayersError;
      const playerById = new Map((releasedPlayers || []).map((player: Json) => [
        String(player.id),
        String(player.player_display_name || player.full_name || player.id),
      ]));
      const releasesByMember = new Map<string, string[]>();
      for (const release of releases) {
        const memberId = String(release.league_member_id || "");
        const names = releasesByMember.get(memberId) || [];
        names.push(playerById.get(String(release.player_id || "")) || String(release.player_id || "Player"));
        releasesByMember.set(memberId, names);
      }
      for (const [memberId, playerNames] of releasesByMember.entries()) {
        const { error: messageError } = await supabase.from("manager_messages").insert({
          league_id: leagueId,
          recipient_member_id: memberId,
          subject: "Players released to free agency",
          body: `${playerNames.join(", ")} ${playerNames.length === 1 ? "has" : "have"} reached the ${Number(league.player_retention_limit || 2)}-start limited-use threshold and returned to the free agent pool after Week ${weekNumber}.`,
        });
        if (messageError) throw messageError;
      }
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

  const matchupOutcomes = new Map<string, "win" | "loss" | "tie">();
  for (const matchup of weekMatchups || []) {
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
  if (!(existingWeekResults || []).length && durabilityEnabled(league)) {
    const durabilityUpdates = new Map<string, number>();
    for (const lineup of lineupTotals) {
      const outcome = matchupOutcomes.get(String(lineup.league_member_id));
      const outcomeAdjustment = outcome === "win"
        ? WIN_DURABILITY_RECOVERY
        : outcome === "loss"
          ? -LOSS_DURABILITY_PENALTY
          : 0;
      for (const slot of lineup.slots || []) {
        const playerId = String(slot.player_id || "");
        const status = lineupSlotStatus(slot);
        if (status === "bench" || status === "benched") continue;
        const currentDurability = durabilityUpdates.has(playerId)
          ? durabilityUpdates.get(playerId)
          : durabilityByPlayer.get(playerId);
        if (currentDurability === undefined) continue;
        const playAdjustment = status === "treating" || status === "treatment" || status === "treated"
          ? 100 - Number(currentDurability)
          : -(randomDurabilityLossPercent() + gameConditionDurabilityLoss);
        const resolvedOutcomeAdjustment = status === "treating" || status === "treatment" || status === "treated" ? 0 : outcomeAdjustment;
        durabilityUpdates.set(playerId, clampDurability(Number(currentDurability) + playAdjustment + resolvedOutcomeAdjustment));
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
  const playerLeaderboard = await refreshPlayerLeaderboardCache(supabase, league);

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
      { durability, label: durabilityLabel(durability), multiplier: durabilityMultiplierFor(durability) },
    ])),
    standings_delta: standingsResult.standings,
    player_leaderboard: playerLeaderboard,
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
  if (nextWeek > playoffStartWeekForLeague(league)) {
    const remaining = await previousPlayoffWinnerRows(supabase, league, nextWeek);
    if (remaining.length <= 1) {
      const now = new Date().toISOString();
      const champion = remaining[0] || null;
      const { data: completedSeason, error: completedSeasonError } = await supabase
        .from("league_seasons")
        .update({ status: "COMPLETED", updated_date: now })
        .eq("id", season.id)
        .select("*")
        .single();
      if (completedSeasonError) throw completedSeasonError;
      await supabase.from("leagues").update({ league_status: "COMPLETED", updated_date: now }).eq("id", league.id);
      return { current_week: Number(season.current_week || 1), season: completedSeason, week: null, champion };
    }
  }
  const { data: updatedSeason, error: updateError } = await supabase
    .from("league_seasons")
    .update({
      current_week: nextWeek,
      status: nextWeek >= playoffStartWeekForLeague(league) ? "PLAYOFFS" : season.status,
    })
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
  const matchups = await generateMatchups(supabase, league, nextWeek);
  if (nextWeek >= playoffStartWeekForLeague(league)) {
    await supabase.from("leagues").update({ league_status: "PLAYOFFS", updated_date: new Date().toISOString() }).eq("id", league.id);
  }
  const playerLeaderboard = await refreshPlayerLeaderboardCache(supabase, league);

  return { current_week: nextWeek, season: updatedSeason, week, matchups, player_leaderboard: playerLeaderboard };
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
  const regularSeasonWeeks = regularSeasonWeeksForLeague(league);
  const regularResults = (results || []).filter((row) => Number(row.week_number || 0) <= regularSeasonWeeks);
  const regularMatchups = (matchups || []).filter((matchup) => Number(matchup.week_number || 0) <= regularSeasonWeeks);
  const resultByMemberWeek = new Map(
    regularResults.map((row) => [`${row.league_member_id}:${row.week_number}`, row]),
  );

  const rows = (members || []).map((member) => {
    const memberResults = regularResults.filter((row) => row.league_member_id === member.id);
    const memberMatchups = regularMatchups.filter((matchup) => matchup.home_member_id === member.id || matchup.away_member_id === member.id);
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let pointsAgainst = 0;
    for (const matchup of memberMatchups) {
      const isHome = matchup.home_member_id === member.id;
      const opponentId = isHome ? matchup.away_member_id : matchup.home_member_id;
      const ownResult = resultByMemberWeek.get(`${member.id}:${matchup.week_number}`);
      const opponentResult = resultByMemberWeek.get(`${opponentId}:${matchup.week_number}`);
      if (!ownResult || !opponentResult) continue;
      const own = Number(ownResult.total_points || 0);
      const opp = Number(opponentResult.total_points || 0);
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
                                    : action === "update_playoff_settings"
                                      ? await updatePlayoffSettings(supabase, user, payload)
                                      : action === "get_player_leaderboard"
                                        ? await getPlayerLeaderboard(supabase, user, payload)
                                      : action === "update_league_scoring"
                                        ? await updateLeagueScoring(supabase, user, payload)
                                      : action === "lock_scoring_rules"
                                        ? await lockLeagueScoringForCommissioner(supabase, user, payload)
                                        : action === "vote_league_audit"
                                          ? await voteLeagueAudit(supabase, user, payload)
                                  : action === "pause_league"
                                    ? await setLeagueStatus(supabase, user, payload, "PAUSED")
                                    : action === "resume_league"
                                      ? await setLeagueStatus(supabase, user, payload, "ACTIVE")
                                      : action === "schedule_draft"
                                        ? await scheduleDraft(supabase, user, payload)
                                        : action === "update_draft_check_in"
                                          ? await updateDraftCheckIn(supabase, user, payload)
                                          : action === "start_draft"
                                            ? await startDraft(supabase, user, payload)
                                            : action === "reset_draft"
                                              ? await resetDraft(supabase, user, payload)
                                              : action === "prepare_draft_pool"
                                                ? await prepareDraftPool(supabase, user, payload)
                                                : action === "submit_draft_pick"
                                                  ? await submitDraftPick(supabase, user, payload)
                                                  : action === "process_draft_timer"
                                                    ? await processDraftTimer(supabase, user, payload)
        : action === "start_season"
          ? await startSeason(supabase, payload)
        : action === "update_week_status"
          ? await updateWeekStatus(supabase, user, payload)
        : action === "generate_schedule"
          ? await generateSchedule(supabase, user, payload)
        : action === "open_week_draft"
          ? await openWeekDraft(supabase, payload)
          : action === "submit_pick"
            ? await submitPick(supabase, payload)
            : action === "generate_ai_lineups"
              ? await generateAiLineups(supabase, user, payload)
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
    return json({ error: errorMessage(error) }, 400);
  }
}
