import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NFLVERSE_RELEASE_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player";
const BATCH_SIZE = 500;

const numberFields = [
  "completions",
  "attempts",
  "passing_yards",
  "passing_tds",
  "passing_interceptions",
  "sacks_suffered",
  "sack_yards_lost",
  "sack_fumbles",
  "sack_fumbles_lost",
  "passing_air_yards",
  "passing_yards_after_catch",
  "passing_first_downs",
  "passing_epa",
  "passing_cpoe",
  "passing_2pt_conversions",
  "pacr",
  "carries",
  "rushing_yards",
  "rushing_tds",
  "rushing_fumbles",
  "rushing_fumbles_lost",
  "rushing_first_downs",
  "rushing_epa",
  "rushing_2pt_conversions",
  "receptions",
  "targets",
  "receiving_yards",
  "receiving_tds",
  "receiving_fumbles",
  "receiving_fumbles_lost",
  "receiving_air_yards",
  "receiving_yards_after_catch",
  "receiving_first_downs",
  "receiving_epa",
  "receiving_2pt_conversions",
  "racr",
  "target_share",
  "air_yards_share",
  "wopr",
  "special_teams_tds",
  "def_tackles_solo",
  "def_tackles_with_assist",
  "def_tackle_assists",
  "def_tackles_for_loss",
  "def_tackles_for_loss_yards",
  "def_fumbles_forced",
  "def_sacks",
  "def_sack_yards",
  "def_qb_hits",
  "def_interceptions",
  "def_interception_yards",
  "def_pass_defended",
  "def_tds",
  "def_fumbles",
  "def_safeties",
  "misc_yards",
  "fumble_recovery_own",
  "fumble_recovery_yards_own",
  "fumble_recovery_opp",
  "fumble_recovery_yards_opp",
  "fumble_recovery_tds",
  "penalties",
  "penalty_yards",
  "punt_returns",
  "punt_return_yards",
  "kickoff_returns",
  "kickoff_return_yards",
  "fg_made",
  "fg_att",
  "fg_missed",
  "fg_blocked",
  "fg_long",
  "fg_pct",
  "fg_made_0_19",
  "fg_made_20_29",
  "fg_made_30_39",
  "fg_made_40_49",
  "fg_made_50_59",
  "fg_made_60_",
  "fg_missed_0_19",
  "fg_missed_20_29",
  "fg_missed_30_39",
  "fg_missed_40_49",
  "fg_missed_50_59",
  "fg_missed_60_",
  "pat_made",
  "pat_att",
  "pat_missed",
  "pat_blocked",
  "pat_pct",
  "gwfg_made",
  "gwfg_att",
  "gwfg_missed",
  "gwfg_blocked",
  "fantasy_points",
  "fantasy_points_ppr",
];

const textStatFields = [
  "fg_made_list",
  "fg_missed_list",
  "fg_blocked_list",
  "fg_made_distance",
  "fg_missed_distance",
  "fg_blocked_distance",
  "gwfg_distance",
];

type Json = Record<string, unknown>;
type Supabase = ReturnType<typeof createClient>;
const STALLED_JOB_MINUTES = 30;

const DEFAULT_SCORING_RULES: Json = {
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }

  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    const details = {
      message: source.message,
      code: source.code,
      details: source.details,
      hint: source.hint,
      name: source.name,
    };
    const visible = Object.fromEntries(
      Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );
    return Object.keys(visible).length ? visible : source;
  }

  return { message: String(error) };
}

function errorMessage(error: unknown) {
  const details = errorDetails(error);
  if (typeof details.message === "string" && details.message) {
    const extras = ["code", "details", "hint"]
      .map((key) => details[key] ? `${key}: ${details[key]}` : "")
      .filter(Boolean)
      .join(" | ");
    return extras ? `${details.message} (${extras})` : details.message;
  }
  return JSON.stringify(details);
}

async function parseRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireAdmin(request: Request, supabase: Supabase) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing Authorization bearer token");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error(error?.message || "Invalid user token");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (String(profile?.role || "").toLowerCase() !== "admin") throw new Error("Only admins can run imports");
}

async function updateJob(supabase: Supabase, jobId: string | null, patch: Json) {
  if (!jobId) return;
  const { error } = await supabase
    .from("import_jobs")
    .update({ ...patch, updated_date: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

async function appendJobLog(supabase: Supabase, job: Json | null, line: string, patch: Json = {}) {
  if (!job?.id) return;
  const logs = Array.isArray(job.logs) ? job.logs : [];
  job.logs = [...logs, line];
  await updateJob(supabase, String(job.id), { ...patch, logs: job.logs });
}

async function findJob(supabase: Supabase, requestedJobId?: string) {
  if (requestedJobId) {
    const { data, error } = await supabase.from("import_jobs").select("*").eq("id", requestedJobId).single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .in("status", ["PENDING", "RUNNING"])
    .order("created_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function clearStalledJobs(supabase: Supabase, preserveJobId?: string) {
  const cutoff = new Date(Date.now() - STALLED_JOB_MINUTES * 60 * 1000).toISOString();
  let query = supabase
    .from("import_jobs")
    .select("*")
    .in("status", ["PENDING", "RUNNING"])
    .or(`updated_date.lt.${cutoff},and(updated_date.is.null,created_date.lt.${cutoff})`);

  if (preserveJobId) query = query.neq("id", preserveJobId);

  const { data: stalledJobs, error } = await query;
  if (error) throw error;

  for (const stalledJob of stalledJobs || []) {
    const logs = Array.isArray(stalledJob.logs) ? stalledJob.logs : [];
    await updateJob(supabase, String(stalledJob.id), {
      status: "FAILED",
      progress: Number(stalledJob.progress || 0),
      summary: "Stale job cleared before starting new work.",
      error_details: `Job was still ${stalledJob.status} after ${STALLED_JOB_MINUTES} minutes and was marked failed on worker startup.`,
      logs: [
        ...logs,
        `Stale job cleared: still ${stalledJob.status} after ${STALLED_JOB_MINUTES} minutes.`,
      ],
    });
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [header = [], ...body] = rows;
  return body.filter((items) => items.some(Boolean)).map((items) =>
    Object.fromEntries(header.map((name, index) => [name, items[index] ?? ""]))
  );
}

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePosition(row: Json) {
  const position = String(row.position || "").toUpperCase();
  const group = String(row.position_group || "").toUpperCase();
  if (position === "QB" || group === "QB") return "QB";
  if (position === "K" || group === "SPEC") return "K";
  if (["DEF", "DST"].includes(position) || ["DL", "LB", "DB", "DEF"].includes(group)) return "DEF";
  return "OFF";
}

function n(row: Json, field: string) {
  return Number(toNumber(row[field]) || 0);
}

function rule(rules: Json, category: string, key: string, fallback: number) {
  const categoryRules = rules?.[category] as Json | undefined;
  const parsed = Number(categoryRules?.[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateFantasyPoints(row: Json, rules: Json = DEFAULT_SCORING_RULES) {
  const position = normalizePosition(row);

  if (position === "K") {
    return (
      (n(row, "fg_made_0_19") + n(row, "fg_made_20_29") + n(row, "fg_made_30_39")) * rule(rules, "KICKER", "fg_0_39", 3) +
      n(row, "fg_made_40_49") * rule(rules, "KICKER", "fg_40_49", 4) +
      (n(row, "fg_made_50_59") + n(row, "fg_made_60_")) * rule(rules, "KICKER", "fg_50_plus", 5) +
      n(row, "pat_made") * rule(rules, "KICKER", "xp_made", 1) +
      n(row, "fg_missed") * rule(rules, "KICKER", "fg_miss", -1) +
      n(row, "pat_missed") * rule(rules, "KICKER", "xp_miss", -1)
    );
  }

  if (position === "DEF") {
    return (
      n(row, "def_tackles_solo") * rule(rules, "DEFENSE", "solo_tackle", 1.5) +
      n(row, "def_tackle_assists") * rule(rules, "DEFENSE", "assist_tackle", 0.75) +
      n(row, "def_tackles_for_loss") * rule(rules, "DEFENSE", "tackle_for_loss", 1) +
      n(row, "def_sacks") * rule(rules, "DEFENSE", "sack", 3) +
      n(row, "def_qb_hits") * rule(rules, "DEFENSE", "qb_hit", 0.5) +
      n(row, "def_interceptions") * rule(rules, "DEFENSE", "interception", 4) +
      n(row, "def_pass_defended") * rule(rules, "DEFENSE", "pass_defended", 1) +
      n(row, "def_fumbles_forced") * rule(rules, "DEFENSE", "fumble_forced", 2) +
      (n(row, "fumble_recovery_own") + n(row, "fumble_recovery_opp")) * rule(rules, "DEFENSE", "fumble_recovered", 2) +
      n(row, "def_safeties") * rule(rules, "DEFENSE", "safety", 2) +
      (n(row, "def_tds") + n(row, "fumble_recovery_tds") + n(row, "special_teams_tds")) * rule(rules, "DEFENSE", "touchdown", 6)
    );
  }

  const offensivePoints =
    n(row, "completions") * rule(rules, "OFFENSE", "completion", 0.2) +
    Math.max(n(row, "attempts") - n(row, "completions"), 0) * rule(rules, "OFFENSE", "incompletion", -0.3) +
    n(row, "passing_yards") * rule(rules, "OFFENSE", "passing_yard", 0.04) +
    n(row, "passing_tds") * rule(rules, "OFFENSE", "passing_td", 4) +
    n(row, "passing_interceptions") * rule(rules, "OFFENSE", "passing_int", -2) +
    n(row, "passing_first_downs") * rule(rules, "OFFENSE", "passing_first_down", 0.5) +
    n(row, "rushing_yards") * rule(rules, "OFFENSE", "rushing_yard", 0.1) +
    n(row, "rushing_tds") * rule(rules, "OFFENSE", "rushing_td", 6) +
    n(row, "rushing_first_downs") * rule(rules, "OFFENSE", "rushing_first_down", 0.5) +
    n(row, "receptions") * rule(rules, "OFFENSE", "reception", 1) +
    n(row, "receiving_yards") * rule(rules, "OFFENSE", "receiving_yard", 0.1) +
    n(row, "receiving_tds") * rule(rules, "OFFENSE", "receiving_td", 6) +
    n(row, "receiving_first_downs") * rule(rules, "OFFENSE", "receiving_first_down", 0.5) +
    (n(row, "rushing_fumbles") + n(row, "receiving_fumbles")) * rule(rules, "OFFENSE", "fumble", -1) +
    (n(row, "rushing_fumbles_lost") + n(row, "receiving_fumbles_lost")) * rule(rules, "OFFENSE", "fumble_lost", -2) +
    n(row, "fumble_recovery_tds") * rule(rules, "OFFENSE", "rushing_td", 6) +
    (n(row, "passing_2pt_conversions") + n(row, "rushing_2pt_conversions") + n(row, "receiving_2pt_conversions")) * rule(rules, "OFFENSE", "two_pt_conversion", 2) +
    (n(row, "rushing_yards") + n(row, "receiving_yards") >= 100 ? rule(rules, "OFFENSE", "bonus_100_rush_rec_yards", 3) : 0) +
    (n(row, "passing_yards") >= 300 ? rule(rules, "OFFENSE", "bonus_300_pass_yards", 3) : 0);

  return offensivePoints;
}

function buildWeeklyRow(row: Json, rules: Json = DEFAULT_SCORING_RULES) {
  const payload: Json = {
    player_id: row.player_id,
    season: toNumber(row.season),
    week: toNumber(row.week),
    season_type: row.season_type || "REG",
    position_group: row.position_group || null,
    team: row.team || null,
    game_id: row.game_id,
  };

  for (const field of numberFields) payload[field] = toNumber(row[field]);
  for (const field of textStatFields) payload[field] = row[field] ? String(row[field]) : null;
  payload.fantasy_points = calculateFantasyPoints(row, rules);
  return payload;
}

async function upsertBatches(supabase: Supabase, table: string, rows: Json[], onConflict: string) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw error;
  }
}

function contentExtension(contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

async function saveHeadshot(supabase: Supabase, playerId: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Headshot download failed for ${playerId}: ${response.status}`);

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const extension = contentExtension(contentType);
  const path = `players/${playerId}.${extension}`;
  const bytes = await response.arrayBuffer();
  const { error } = await supabase.storage.from("headshots").upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("headshots").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function defaultScoringRules(supabase: Supabase) {
  const { data, error } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "SCORING_RULES")
    .maybeSingle();
  if (error) throw error;
  return (data?.value as Json | undefined) || DEFAULT_SCORING_RULES;
}

async function ensureSeasonScoringRules(supabase: Supabase, season: number) {
  const { data: existing, error: existingError } = await supabase
    .from("season_scoring_rules")
    .select("rules")
    .eq("season_year", season)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.rules) return existing.rules as Json;

  const rules = await defaultScoringRules(supabase);
  const { data: created, error: createError } = await supabase
    .from("season_scoring_rules")
    .insert({ season_year: season, rules })
    .select("rules")
    .single();
  if (createError) throw createError;
  return (created?.rules as Json | undefined) || rules;
}

async function importSeason(supabase: Supabase, season: number, sourceUrl: string, downloadHeadshots: boolean) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Could not download ${sourceUrl}: ${response.status}`);

  const scoringRules = await ensureSeasonScoringRules(supabase, season);
  const csv = await response.text();
  const parsedRows = parseCsv(csv).filter((row) => String(row.season_type || "").toUpperCase() === "REG");
  const playerMap = new Map<string, Json>();
  const weeklyRows: Json[] = [];

  for (const row of parsedRows) {
    if (!row.player_id || !row.game_id) continue;
    const existing = playerMap.get(String(row.player_id));
    playerMap.set(String(row.player_id), {
      player_id: row.player_id,
      player_display_name: row.player_display_name || row.player_name || row.player_id,
      headshot_url: row.headshot_url || existing?.headshot_url || null,
      headshot_storage_path: existing?.headshot_storage_path || null,
      headshot_public_url: existing?.headshot_public_url || null,
    });
    weeklyRows.push(buildWeeklyRow(row, scoringRules));
  }

  const players = [...playerMap.values()];
  if (downloadHeadshots) {
    for (const player of players) {
      if (!player.headshot_url) continue;
      try {
        const saved = await saveHeadshot(supabase, String(player.player_id), String(player.headshot_url));
        player.headshot_storage_path = saved.path;
        player.headshot_public_url = saved.publicUrl;
      } catch (error) {
        console.warn(error);
      }
    }
  }

  await upsertBatches(supabase, "player_master", players, "player_id");
  await upsertBatches(supabase, "weekly_player_stats", weeklyRows, "player_id,season,week,season_type,game_id");

  const aggregateMap = new Map<string, { total: number; high: number; low: number | null; count: number }>();
  for (const row of parsedRows) {
    const points = calculateFantasyPoints(row, scoringRules);
    const current = aggregateMap.get(String(row.player_id)) || { total: 0, high: 0, low: null, count: 0 };
    current.total += points;
    current.high = Math.max(current.high, points);
    current.low = current.low === null ? points : Math.min(current.low, points);
    current.count += 1;
    aggregateMap.set(String(row.player_id), current);
  }

  const legacyPlayers = players.map((player) => {
    const sample = parsedRows.find((row) => row.player_id === player.player_id) || {};
    const aggregates = aggregateMap.get(String(player.player_id));
    return {
      player_key: player.player_id,
      full_name: player.player_display_name,
      player_display_name: player.player_display_name,
      team: sample.team || null,
      position: normalizePosition(sample),
      active_years: [season],
      source_season_year: season,
      avg_points: aggregates?.count ? aggregates.total / aggregates.count : 0,
      high_score: aggregates?.high || 0,
      low_score: aggregates?.low ?? 0,
      total_points: aggregates?.total || 0,
    };
  });
  await upsertBatches(supabase, "players", legacyPlayers, "player_key");

  const { data: storedPlayers, error: storedPlayerError } = await supabase
    .from("players")
    .select("id, player_key")
    .in("player_key", players.map((player) => player.player_id));
  if (storedPlayerError) throw storedPlayerError;

  const legacyIds = new Map((storedPlayers || []).map((player) => [player.player_key, player.id]));
  const legacyWeeks = parsedRows
    .map((row) => {
      const playerId = legacyIds.get(row.player_id);
      if (!playerId) return null;
      const touchdowns =
        Number(toNumber(row.passing_tds) || 0) +
        Number(toNumber(row.rushing_tds) || 0) +
        Number(toNumber(row.receiving_tds) || 0) +
        Number(toNumber(row.special_teams_tds) || 0) +
        Number(toNumber(row.def_tds) || 0) +
        Number(toNumber(row.fumble_recovery_tds) || 0);

      return {
        player_id: playerId,
        season_year: toNumber(row.season),
        week: toNumber(row.week),
        team: row.team || null,
        fantasy_points: calculateFantasyPoints(row, scoringRules),
        passing_yards: toNumber(row.passing_yards) ?? 0,
        passing_tds: toNumber(row.passing_tds) ?? 0,
        rushing_yards: toNumber(row.rushing_yards) ?? 0,
        receiving_yards: toNumber(row.receiving_yards) ?? 0,
        touchdowns,
        raw_stats: buildWeeklyRow(row, scoringRules),
      };
    })
    .filter(Boolean) as Json[];
  await upsertBatches(supabase, "player_week_stats", legacyWeeks, "player_id,season_year,week");

  return { season, players: players.length, weeks: weeklyRows.length };
}

async function refreshGlobalCounts(supabase: Supabase) {
  const { data: players, error } = await supabase.from("players").select("position, source_season_year");
  if (error) throw error;

  const counts = (players || []).reduce<Record<string, number>>((acc, player) => {
    const position = String(player.position || "OFF").toUpperCase();
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {});
  const latestSeason = Math.max(...(players || []).map((player) => Number(player.source_season_year || 0)), 0);

  await upsertBatches(
    supabase,
    "global_settings",
    [
      { key: "COUNT_PLAYERS_QB", value_number: counts.QB || 0 },
      { key: "COUNT_PLAYERS_K", value_number: counts.K || 0 },
      { key: "COUNT_PLAYERS_OFF", value_number: counts.OFF || 0 },
      { key: "COUNT_PLAYERS_DEF", value_number: counts.DEF || 0 },
      { key: "SOURCE_SEASON_YEAR", value_number: latestSeason || null },
    ],
    "key",
  );

  const { error: countRefreshError } = await supabase.rpc("refresh_player_position_year_counts");
  if (countRefreshError) throw countRefreshError;
}

async function refreshPlayerAggregates(supabase: Supabase) {
  const { error } = await supabase.rpc("refresh_player_aggregates");
  if (!error) {
    await refreshGlobalCounts(supabase);
    return;
  }

  const { data: weeks, error: weekError } = await supabase
    .from("player_week_stats")
    .select("player_id,season_year,fantasy_points");
  if (weekError) throw weekError;

  const grouped = new Map<string, { years: Set<number>; total: number; high: number; low: number | null; count: number }>();
  for (const week of weeks || []) {
    const playerId = String(week.player_id);
    const points = Number(week.fantasy_points || 0);
    const current = grouped.get(playerId) || { years: new Set<number>(), total: 0, high: 0, low: null, count: 0 };
    current.years.add(Number(week.season_year));
    current.total += points;
    current.high = Math.max(current.high, points);
    current.low = current.low === null ? points : Math.min(current.low, points);
    current.count += 1;
    grouped.set(playerId, current);
  }

  for (const [playerId, aggregate] of grouped.entries()) {
    const { error: updateError } = await supabase
      .from("players")
      .update({
        active_years: [...aggregate.years].filter(Boolean).sort((a, b) => a - b),
        source_season_year: Math.max(...[...aggregate.years].filter(Boolean)),
        avg_points: aggregate.count ? aggregate.total / aggregate.count : 0,
        high_score: aggregate.high || 0,
        low_score: aggregate.low ?? 0,
        total_points: aggregate.total || 0,
      })
      .eq("id", playerId);
    if (updateError) throw updateError;
  }

  await refreshGlobalCounts(supabase);
}

async function refreshComputedFantasyPoints(supabase: Supabase, seasonYear?: number | null) {
  const { error: updateError } = await supabase.rpc("recompute_player_week_fantasy_points", {
    p_season_year: seasonYear || null,
  });
  if (updateError) throw updateError;
}

async function completeJob(supabase: Supabase, job: Json, summary: string) {
  await appendJobLog(supabase, job, summary, {
    status: "COMPLETED",
    progress: 100,
    summary,
    error_details: null,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  let job: Json | null = null;

  try {
    await requireAdmin(request, supabase);
    const payload = await parseRequest(request);
    await clearStalledJobs(supabase, payload.job_id ? String(payload.job_id) : undefined);
    job = await findJob(supabase, payload.job_id ? String(payload.job_id) : undefined);
    if (!job) return json({ processed: 0 });

    const parameters = { ...((job.parameters as Json | undefined) || {}), ...payload };
    const startYear = Number(parameters.start_year || parameters.season || parameters.source_season_year || new Date().getFullYear() - 1);
    const endYear = Number(parameters.end_year || startYear);
    const downloadHeadshots = parameters.download_headshots !== false;
    const requestedJobType = payload.job_id && payload.job_type ? payload.job_type : null;
    const jobType = String(requestedJobType || job.job_type || parameters.job_type || "HISTORICAL_STATS").toUpperCase();

    await appendJobLog(supabase, job, jobType === "HISTORICAL_STATS"
      ? `Starting nflverse player import for ${startYear}-${endYear}.`
      : `Starting ${jobType}.`, {
      status: "RUNNING",
      progress: 5,
    });

    if (jobType === "RECOUNT_PLAYERS") {
      await refreshGlobalCounts(supabase);
      await completeJob(supabase, job, "Recounted player totals and refreshed player pool count summaries.");
      return json({ processed: 1, job_type: jobType });
    }

    if (jobType === "PLAYER_STAT_AGGREGATION") {
      await refreshPlayerAggregates(supabase);
      await completeJob(supabase, job, "Updated player aggregates and refreshed player pool count summaries.");
      return json({ processed: 1, job_type: jobType });
    }

    if (jobType === "SCORING_UPDATE") {
      const seasonYear = parameters.season_year ? Number(parameters.season_year) : null;
      await appendJobLog(supabase, job, seasonYear
        ? `Recalculating fantasy points for ${seasonYear}.`
        : "Recalculating fantasy points for every stored season.");
      await refreshComputedFantasyPoints(supabase, seasonYear);
      await completeJob(supabase, job, seasonYear
        ? `Updated computed fantasy points and player aggregates for ${seasonYear}.`
        : "Updated computed fantasy points and player aggregates for every stored season.");
      return json({ processed: 1, job_type: jobType, season_year: seasonYear });
    }

    if (parameters.fresh_start) {
      await supabase.from("weekly_player_stats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("player_master").delete().neq("player_id", "");
      await appendJobLog(supabase, job, "Fresh start cleared player_master and weekly_player_stats.");
    }

    const results = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const sourceUrl = parameters.file_url && startYear === endYear
        ? String(parameters.file_url)
        : `${NFLVERSE_RELEASE_URL}/stats_player_week_${year}.csv`;
      await appendJobLog(supabase, job, `Downloading ${sourceUrl}.`, {
        progress: Math.max(10, Math.round(((year - startYear) / Math.max(1, endYear - startYear + 1)) * 80)),
      });
      results.push(await importSeason(supabase, year, sourceUrl, downloadHeadshots));
    }

    await refreshGlobalCounts(supabase);

    const importedPlayers = results.reduce((sum, result) => sum + result.players, 0);
    const importedWeeks = results.reduce((sum, result) => sum + result.weeks, 0);
    await appendJobLog(supabase, job, `Imported ${importedPlayers} player rows and ${importedWeeks} weekly stat rows.`, {
      status: "COMPLETED",
      progress: 100,
      summary: `Imported nflverse player weekly stats for ${startYear}-${endYear}.`,
      error_details: null,
    });

    return json({ processed: 1, results });
  } catch (error) {
    const message = errorMessage(error);
    const details = errorDetails(error);
    if (job?.id) {
      await updateJob(supabase, String(job.id), {
        status: "FAILED",
        error_details: message,
        logs: [...(Array.isArray(job.logs) ? job.logs : []), `Job failed: ${message}`],
      });
    }
    return json({ error: message, details, job_id: job?.id || null }, 400);
  }
});
