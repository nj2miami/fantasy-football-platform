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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const { error } = await supabase.from("import_jobs").update(patch).eq("id", jobId);
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

function calculateFantasyPoints(row: Json) {
  const position = normalizePosition(row);
  const fallback = Number(toNumber(row.fantasy_points_ppr) ?? toNumber(row.fantasy_points) ?? 0);

  if (position === "K") {
    return (
      n(row, "fg_made_0_19") * 3 +
      n(row, "fg_made_20_29") * 3 +
      n(row, "fg_made_30_39") * 3 +
      n(row, "fg_made_40_49") * 4 +
      n(row, "fg_made_50_59") * 5 +
      n(row, "fg_made_60_") * 6 +
      n(row, "gwfg_made") * 3 +
      n(row, "pat_made") -
      n(row, "fg_missed") -
      n(row, "pat_missed")
    );
  }

  if (position === "DEF") {
    return (
      n(row, "def_tackles_solo") * 1 +
      n(row, "def_tackle_assists") * 0.5 +
      n(row, "def_tackles_for_loss") * 1 +
      n(row, "def_sacks") * 4 +
      n(row, "def_qb_hits") * 0.5 +
      n(row, "def_interceptions") * 3 +
      n(row, "def_pass_defended") * 1 +
      n(row, "def_fumbles_forced") * 2 +
      (n(row, "fumble_recovery_own") + n(row, "fumble_recovery_opp")) * 2 +
      n(row, "def_safeties") * 2 +
      (n(row, "def_tds") + n(row, "fumble_recovery_tds") + n(row, "special_teams_tds")) * 6
    );
  }

  return fallback;
}

function buildWeeklyRow(row: Json) {
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
  payload.fantasy_points = calculateFantasyPoints(row);
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

async function importSeason(supabase: Supabase, season: number, sourceUrl: string, downloadHeadshots: boolean) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Could not download ${sourceUrl}: ${response.status}`);

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
    weeklyRows.push(buildWeeklyRow(row));
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
    const points = calculateFantasyPoints(row);
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
        fantasy_points: calculateFantasyPoints(row),
        passing_yards: toNumber(row.passing_yards) ?? 0,
        passing_tds: toNumber(row.passing_tds) ?? 0,
        rushing_yards: toNumber(row.rushing_yards) ?? 0,
        receiving_yards: toNumber(row.receiving_yards) ?? 0,
        touchdowns,
        raw_stats: buildWeeklyRow(row),
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
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  let job: Json | null = null;

  try {
    await requireAdmin(request, supabase);
    const payload = await parseRequest(request);
    job = await findJob(supabase, payload.job_id ? String(payload.job_id) : undefined);
    if (!job) return json({ processed: 0 });

    const parameters = { ...((job.parameters as Json | undefined) || {}), ...payload };
    const startYear = Number(parameters.start_year || parameters.season || parameters.source_season_year || new Date().getFullYear() - 1);
    const endYear = Number(parameters.end_year || startYear);
    const downloadHeadshots = parameters.download_headshots !== false;

    await appendJobLog(supabase, job, `Starting nflverse player import for ${startYear}-${endYear}.`, {
      status: "RUNNING",
      progress: 5,
    });

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
    const message = error instanceof Error ? error.message : String(error);
    if (job?.id) {
      await updateJob(supabase, String(job.id), {
        status: "FAILED",
        error_details: message,
        logs: [...(Array.isArray(job.logs) ? job.logs : []), `Import failed: ${message}`],
      });
    }
    return json({ error: message }, 400);
  }
});
