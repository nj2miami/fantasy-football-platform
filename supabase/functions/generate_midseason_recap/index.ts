import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, unknown>;

function json(body: unknown, status = 200) {
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
    try {
      const serialized = JSON.stringify(payload);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through.
    }
  }
  return String(error);
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function getUser(request: Request, supabase: ReturnType<typeof createClient>) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing Authorization bearer token");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error(error?.message || "Invalid user token");
  return data.user;
}

async function getProfile(supabase: ReturnType<typeof createClient>, user: { id: string }) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireLeagueControl(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null },
  leagueId: string,
) {
  const { data: league, error: leagueError } = await supabase.from("leagues").select("*").eq("id", leagueId).single();
  if (leagueError) throw leagueError;
  const profile = await getProfile(supabase, user);
  if (String(profile?.role || "").toLowerCase() === "admin") return { league, profile };
  if (league.commissioner_id === user.id || league.commissioner_email === user.email) return { league, profile };
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
  return { league, profile };
}

function memberName(member: Json | undefined) {
  return String(member?.team_name || member?.display_name || (member?.is_ai ? "AI Manager" : "Manager"));
}

function playerName(player: Json | undefined) {
  return String(player?.player_display_name || player?.full_name || player?.name || "Unknown Player");
}

function formatNumber(value: unknown, digits = 1) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : 0;
}

function firstSentence(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.{40,220}?[.!?])(\s|$)/);
  return (match?.[1] || cleaned.slice(0, 180)).trim();
}

function lineupSlotStatus(slot: Json) {
  return String(slot.status || slot.lineup_status || slot.slot_status || slot.role || "active").toLowerCase();
}

function isStartedLineupSlot(slot: Json) {
  const status = lineupSlotStatus(slot);
  return !["bench", "benched", "treating", "treatment", "treated"].includes(status);
}

function buildPrompt(recapData: Json) {
  return `You are Alti Verse, the signature fantasy football analyst for Retro Fantasy Football.

Write a polished midseason league update after Week 4.

Style:
- Sharp, playful, confident, and fair.
- Sound like a fantasy analyst, not a generic system announcement.
- Do not reveal hidden source weeks or raw stat-line internals.
- Explain how players were expected to perform versus how they are performing.
- Call out underperformers and sleepers.
- Include team-level league context.
- Target 800 to 1200 words.
- Return clean newsletter copy with a headline-friendly opening and clear section headings.

Required sections:
1. League state after Week 4.
2. Expected stars versus actual performance.
3. Underperforming players and teams.
4. Sleepers and surprise contributors.
5. Second-half storylines.

Midseason data:
${JSON.stringify(recapData, null, 2)}`;
}

async function callGemini(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY. Set it with: supabase secrets set GEMINI_API_KEY=your_key_here");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 2600,
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(body) || `Gemini request failed with status ${response.status}`);
  const text = body?.candidates?.[0]?.content?.parts?.map((part: Json) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty Midseason Recap.");
  return { text, model, usageMetadata: body?.usageMetadata || null, responseId: body?.responseId || null };
}

async function generateMidseasonRecap(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const leagueId = String(payload.league_id || "");
  const sourceWeekNumber = Number(payload.week_number || 4);
  if (!leagueId) throw new Error("league_id is required");
  const { league } = await requireLeagueControl(supabase, user, leagueId);

  const { count: weekFourResults, error: countError } = await supabase
    .from("league_week_results")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("week_number", sourceWeekNumber);
  if (countError) throw countError;
  if (!weekFourResults) throw new Error("Midseason Recap is available after Week 4 has been resolved.");

  const [
    membersResult,
    standingsResult,
    resultsResult,
    matchupsResult,
    leaderboardResult,
  ] = await Promise.all([
    supabase.from("league_members").select("id,team_name,display_name,is_ai,ai_persona").eq("league_id", leagueId).eq("is_active", true),
    supabase.from("standings").select("*").eq("league_id", leagueId),
    supabase.from("league_week_results").select("league_member_id,week_number,total_points,weekly_rank,league_points,scoring_details").eq("league_id", leagueId).lte("week_number", sourceWeekNumber),
    supabase.from("matchups").select("*").eq("league_id", leagueId).lte("week_number", sourceWeekNumber),
    supabase.from("league_player_leaderboards").select("leaders,generated_through_week").eq("league_id", leagueId).maybeSingle(),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (standingsResult.error) throw standingsResult.error;
  if (resultsResult.error) throw resultsResult.error;
  if (matchupsResult.error) throw matchupsResult.error;
  if (leaderboardResult.error) throw leaderboardResult.error;

  const members = membersResult.data || [];
  const membersById = new Map(members.map((member: Json) => [String(member.id), member]));
  const resultRows = resultsResult.data || [];
  const playerTotals = new Map<string, { points: number; starts: number; games: number; ownerId: string }>();
  for (const result of resultRows) {
    const ownerId = String(result.league_member_id || "");
    const details = Array.isArray(result.scoring_details) ? result.scoring_details as Json[] : [];
    for (const slot of details) {
      const playerId = String(slot.player_id || "");
      if (!playerId) continue;
      const current = playerTotals.get(playerId) || { points: 0, starts: 0, games: 0, ownerId };
      current.points += Number(slot.scored_points || 0);
      current.games += 1;
      if (isStartedLineupSlot(slot)) current.starts += 1;
      current.ownerId = ownerId || current.ownerId;
      playerTotals.set(playerId, current);
    }
  }

  const playerIds = [...playerTotals.keys()];
  const [playersResult, scoresResult] = playerIds.length ? await Promise.all([
    supabase.from("players").select("id,player_display_name,full_name,position,team").in("id", playerIds),
    supabase.from("league_player_scores").select("player_id,position,position_rank,tier_value,expected_avg_points,total_points,weeks_played").eq("league_id", leagueId).in("player_id", playerIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (playersResult.error) throw playersResult.error;
  if (scoresResult.error) throw scoresResult.error;

  const playersById = new Map((playersResult.data || []).map((player: Json) => [String(player.id), player]));
  const scoresByPlayer = new Map((scoresResult.data || []).map((score: Json) => [String(score.player_id), score]));
  const playerComparison = playerIds.map((playerId) => {
    const actual = playerTotals.get(playerId) || { points: 0, starts: 0, games: 0, ownerId: "" };
    const player = playersById.get(playerId);
    const score = scoresByPlayer.get(playerId);
    const expectedThroughGames = Number(score?.expected_avg_points || 0) * Math.max(Number(actual.games || 0), 1);
    const delta = Number(actual.points || 0) - expectedThroughGames;
    return {
      player_id: playerId,
      player: playerName(player),
      owner: memberName(membersById.get(actual.ownerId)),
      position: score?.position || player?.position || null,
      tier: Number(score?.tier_value || 0),
      position_rank: Number(score?.position_rank || 0),
      starts: actual.starts,
      games_played: actual.games,
      expected_points_to_date: formatNumber(expectedThroughGames, 2),
      actual_points_to_date: formatNumber(actual.points, 2),
      points_delta: formatNumber(delta, 2),
    };
  });

  const teamSummaries = members.map((member: Json) => {
    const memberResults = resultRows.filter((row: Json) => row.league_member_id === member.id);
    const standing = (standingsResult.data || []).find((row: Json) => row.league_member_id === member.id) || {};
    return {
      team: memberName(member),
      ai_persona: member.is_ai ? member.ai_persona || "BALANCED" : null,
      wins: Number(standing.wins || 0),
      losses: Number(standing.losses || 0),
      ties: Number(standing.ties || 0),
      points_for: formatNumber(standing.points_for, 2),
      points_against: formatNumber(standing.points_against, 2),
      weekly_scores: memberResults.map((row: Json) => ({
        week: Number(row.week_number || 0),
        points: formatNumber(row.total_points, 2),
        rank: row.weekly_rank || null,
        league_points: formatNumber(row.league_points, 2),
      })),
    };
  });

  const recapData = {
    league: {
      name: league.name,
      source_season_year: league.source_season_year,
      ranking_system: league.ranking_system,
      scoring_rules_locked_at: league.scoring_rules_locked_at || null,
    },
    standings: teamSummaries,
    matchups: (matchupsResult.data || []).map((matchup: Json) => ({
      week: Number(matchup.week_number || 0),
      home: memberName(membersById.get(String(matchup.home_member_id))),
      away: memberName(membersById.get(String(matchup.away_member_id))),
      home_score: formatNumber(matchup.home_score, 2),
      away_score: formatNumber(matchup.away_score, 2),
    })),
    leaderboard: leaderboardResult.data || null,
    expected_vs_actual_players: {
      overperformers: [...playerComparison].sort((a, b) => Number(b.points_delta) - Number(a.points_delta)).slice(0, 12),
      underperformers: [...playerComparison].sort((a, b) => Number(a.points_delta) - Number(b.points_delta)).slice(0, 12),
      sleepers: playerComparison
        .filter((row) => Number(row.tier || 0) <= 2 || Number(row.position_rank || 999) > 20)
        .sort((a, b) => Number(b.points_delta) - Number(a.points_delta))
        .slice(0, 12),
    },
  };

  const generated = await callGemini(buildPrompt(recapData));
  const summary = firstSentence(generated.text);
  const storageBucket = "league-news";
  const storagePath = `midseason-recaps/${leagueId}/week-${sourceWeekNumber}.txt`;
  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, new Blob([generated.text], { type: "text/plain;charset=utf-8" }), {
      contentType: "text/plain;charset=utf-8",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const newsPayload = {
    league_id: leagueId,
    title: `Midseason AI Update: Week ${sourceWeekNumber}`,
    summary,
    body: generated.text,
    news_type: "AI_MIDSEASON_RECAP",
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
    storage_bucket: storageBucket,
    storage_path: storagePath,
    source_week_number: sourceWeekNumber,
    generation_metadata: {
      provider: "google_gemini",
      model: generated.model,
      response_id: generated.responseId,
      usage_metadata: generated.usageMetadata,
      generated_at: new Date().toISOString(),
      result_weeks_included: sourceWeekNumber,
    },
    updated_date: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabase
    .from("league_news_items")
    .select("id")
    .eq("league_id", leagueId)
    .eq("news_type", "AI_MIDSEASON_RECAP")
    .eq("source_week_number", sourceWeekNumber)
    .maybeSingle();
  if (existingError) throw existingError;
  const { data: newsItem, error: newsError } = existing
    ? await supabase.from("league_news_items").update(newsPayload).eq("id", existing.id).select("*").single()
    : await supabase.from("league_news_items").insert({ ...newsPayload, created_date: new Date().toISOString() }).select("*").single();
  if (newsError) throw newsError;

  return { news_item: newsItem, storage_bucket: storageBucket, storage_path: storagePath, regenerated: Boolean(existing) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await request.json().catch(() => ({}));
    const supabase = adminClient();
    const user = await getUser(request, supabase);
    return json(await generateMidseasonRecap(supabase, user, payload));
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
});
