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
  const profile = Array.isArray(member?.profiles) ? member?.profiles[0] : member?.profiles;
  return String(member?.team_name || profile?.display_name || profile?.profile_name || (member?.is_ai ? "AI Manager" : "Manager"));
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

function trimWords(text: string, limit: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= limit ? text.trim() : `${words.slice(0, limit).join(" ")}...`;
}

function lineupSlotStatus(slot: Json) {
  return String(slot.status || slot.lineup_status || slot.slot_status || slot.role || "active").toLowerCase();
}

function isStartedLineupSlot(slot: Json) {
  const status = lineupSlotStatus(slot);
  return !["bench", "benched", "treating", "treatment", "treated"].includes(status);
}

function positionGroup(position: unknown) {
  const value = String(position || "").toUpperCase();
  if (value === "QB" || value === "K") return value;
  if (value === "DEF" || value === "DST" || value === "D/ST") return "DEF";
  return "OFF";
}

function buildPrompt(recapData: Json) {
  return `You are Alti Verse, the signature fantasy football analyst for Retro Fantasy Football.

Write the final end-of-season league recap.

Style:
- Sharp, playful, confident, and fair.
- Celebrate the champion and the top award winners.
- Mention the championship game and the biggest season storylines.
- Keep it under 500 words.
- Return clean newsletter copy with a strong headline and short paragraphs.

End of season data:
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
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 1400,
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(body) || `Gemini request failed with status ${response.status}`);
  const text = body?.candidates?.[0]?.content?.parts?.map((part: Json) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty End Season Recap.");
  return { text: trimWords(text, 500), model, usageMetadata: body?.usageMetadata || null, responseId: body?.responseId || null };
}

async function endSeason(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const leagueId = String(payload.league_id || "");
  if (!leagueId) throw new Error("league_id is required");
  const { league } = await requireLeagueControl(supabase, user, leagueId);

  const { data: season, error: seasonError } = await supabase
    .from("league_seasons")
    .select("*")
    .eq("league_id", leagueId)
    .order("created_date", { ascending: false })
    .limit(1)
    .single();
  if (seasonError) throw seasonError;

  const championshipWeek = Number(season.current_week || 1);
  const [matchupsResult, resultsResult, scheduleResult] = await Promise.all([
    supabase.from("matchups").select("*").eq("league_id", leagueId).eq("week_number", championshipWeek),
    supabase.from("league_week_results").select("*").eq("league_id", leagueId).eq("week_number", championshipWeek),
    supabase.from("league_game_schedule").select("*").eq("league_id", leagueId).eq("week_number", championshipWeek),
  ]);
  if (matchupsResult.error) throw matchupsResult.error;
  if (resultsResult.error) throw resultsResult.error;
  if (scheduleResult.error) throw scheduleResult.error;

  const championshipMatchups = (matchupsResult.data || []).filter((matchup: Json) => {
    const schedule = (scheduleResult.data || []).find((row: Json) => Number(row.game_number || 1) === Number(matchup.game_number || 1));
    return String(schedule?.phase || "").toLowerCase() === "playoff" || String(league.league_status || season.status || "").toUpperCase() === "PLAYOFFS";
  });
  if (championshipMatchups.length !== 1) throw new Error("End Season is only available after the championship game is the only remaining playoff matchup.");
  if (!resultsResult.data?.length) throw new Error("Resolve the championship game before ending the season.");

  const matchup = championshipMatchups[0] as Json;
  const homeResult = (resultsResult.data || []).find((row: Json) => row.league_member_id === matchup.home_member_id);
  const awayResult = (resultsResult.data || []).find((row: Json) => row.league_member_id === matchup.away_member_id);
  if (!homeResult || !awayResult) throw new Error("Both championship teams need resolved results before ending the season.");
  const championMemberId = Number(homeResult.total_points || 0) >= Number(awayResult.total_points || 0)
    ? String(matchup.home_member_id)
    : String(matchup.away_member_id);

  const [membersResult, standingsResult, allResultsResult, leaderboardResult] = await Promise.all([
    supabase.from("league_members").select("id,profile_id,team_name,is_ai,profiles(display_name,profile_name)").eq("league_id", leagueId),
    supabase.from("standings").select("*").eq("league_id", leagueId),
    supabase.from("league_week_results").select("*").eq("league_id", leagueId),
    supabase.from("league_player_leaderboards").select("*").eq("league_id", leagueId).maybeSingle(),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (standingsResult.error) throw standingsResult.error;
  if (allResultsResult.error) throw allResultsResult.error;
  if (leaderboardResult.error) throw leaderboardResult.error;

  const members = membersResult.data || [];
  const membersById = new Map(members.map((member: Json) => [String(member.id), member]));
  const champion = membersById.get(championMemberId);
  const playerTotals = new Map<string, { points: number; starts: number; games: number; ownerId: string }>();
  for (const result of allResultsResult.data || []) {
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
    supabase.from("league_player_scores").select("player_id,position,position_rank,tier_value").eq("league_id", leagueId).in("player_id", playerIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (playersResult.error) throw playersResult.error;
  if (scoresResult.error) throw scoresResult.error;

  const playersById = new Map((playersResult.data || []).map((player: Json) => [String(player.id), player]));
  const scoresByPlayer = new Map((scoresResult.data || []).map((score: Json) => [String(score.player_id), score]));
  const allPlayerRows = playerIds.map((playerId) => {
    const actual = playerTotals.get(playerId) || { points: 0, starts: 0, games: 0, ownerId: "" };
    const player = playersById.get(playerId);
    const score = scoresByPlayer.get(playerId);
    const group = positionGroup(score?.position || player?.position);
    return {
      player_id: playerId,
      player: playerName(player),
      team: player?.team || null,
      position_group: group,
      league_member_id: actual.ownerId,
      manager: memberName(membersById.get(actual.ownerId)),
      total_points: formatNumber(actual.points, 2),
      starts: actual.starts,
      games_played: actual.games,
      position_rank: Number(score?.position_rank || 0),
      tier: Number(score?.tier_value || 0),
    };
  });

  const awardDefinitions = [
    { group: "QB", key: "TOP_QB", name: "Top QB" },
    { group: "OFF", key: "TOP_OFFENSIVE_PLAYER", name: "Top Offensive Player" },
    { group: "DEF", key: "TOP_DEFENSIVE_PLAYER", name: "Top Defensive Player" },
    { group: "K", key: "TOP_KICKER", name: "Top Kicker" },
  ];
  const awards = awardDefinitions.map((definition) => {
    const winner = allPlayerRows
      .filter((row) => row.position_group === definition.group)
      .sort((a, b) => Number(b.total_points || 0) - Number(a.total_points || 0))[0];
    return winner ? { ...definition, ...winner } : null;
  }).filter(Boolean) as Json[];

  const now = new Date().toISOString();
  if (champion?.profile_id) {
    const { error: badgeError } = await supabase.from("manager_profile_badges").upsert({
      profile_id: champion.profile_id,
      league_id: leagueId,
      league_member_id: championMemberId,
      badge_key: "LEAGUE_CHAMPION",
      badge_name: "Champion",
      description: `Won ${league.name}.`,
      awarded_at: now,
      metadata: { season_id: season.id, championship_week: championshipWeek },
    }, { onConflict: "profile_id,league_id,badge_key" });
    if (badgeError) throw badgeError;
  }

  if (awards.length) {
    const awardRows = awards.map((award) => ({
      league_id: leagueId,
      league_member_id: award.league_member_id,
      player_id: award.player_id,
      award_key: award.key,
      award_name: award.name,
      position_group: award.group,
      total_points: award.total_points,
      awarded_at: now,
      metadata: {
        player_name: award.player,
        manager_name: award.manager,
        starts: award.starts,
        games_played: award.games_played,
      },
    }));
    const { error: awardError } = await supabase.from("league_player_awards").upsert(awardRows, { onConflict: "league_id,award_key" });
    if (awardError) throw awardError;

    const managerBadgeRows = awards
      .map((award) => {
        const owner = membersById.get(String(award.league_member_id || ""));
        if (!owner?.profile_id) return null;
        return {
          profile_id: owner.profile_id,
          league_id: leagueId,
          league_member_id: owner.id,
          badge_key: `DRAFTED_${award.key}`,
          badge_name: `Drafted ${award.name}`,
          description: `Drafted ${award.player}, ${league.name}'s ${award.name}.`,
          awarded_at: now,
          metadata: { player_id: award.player_id, player_name: award.player, total_points: award.total_points },
        };
      })
      .filter(Boolean);
    if (managerBadgeRows.length) {
      const { error: managerBadgeError } = await supabase.from("manager_profile_badges").upsert(managerBadgeRows, { onConflict: "profile_id,league_id,badge_key" });
      if (managerBadgeError) throw managerBadgeError;
    }
  }

  const recapData = {
    league: {
      name: league.name,
      source_season_year: league.source_season_year,
      ranking_system: league.ranking_system,
    },
    champion: {
      team: memberName(champion),
      score: championMemberId === String(matchup.home_member_id) ? formatNumber(homeResult.total_points, 2) : formatNumber(awayResult.total_points, 2),
      opponent: championMemberId === String(matchup.home_member_id) ? memberName(membersById.get(String(matchup.away_member_id))) : memberName(membersById.get(String(matchup.home_member_id))),
      opponent_score: championMemberId === String(matchup.home_member_id) ? formatNumber(awayResult.total_points, 2) : formatNumber(homeResult.total_points, 2),
    },
    final_standings: (standingsResult.data || []).map((standing: Json) => ({
      team: memberName(membersById.get(String(standing.league_member_id))),
      wins: Number(standing.wins || 0),
      losses: Number(standing.losses || 0),
      ties: Number(standing.ties || 0),
      points_for: formatNumber(standing.points_for, 2),
      league_points: formatNumber(standing.league_points, 2),
    })),
    awards,
    player_leaderboard: leaderboardResult.data || null,
  };

  const generated = await callGemini(buildPrompt(recapData));
  const summary = firstSentence(generated.text);
  const newsPayload = {
    league_id: leagueId,
    title: `End Season Recap: ${league.name}`,
    summary,
    body: generated.text,
    news_type: "AI_END_SEASON_RECAP",
    status: "PUBLISHED",
    published_at: now,
    generation_metadata: {
      provider: "google_gemini",
      model: generated.model,
      response_id: generated.responseId,
      usage_metadata: generated.usageMetadata,
      generated_at: now,
      word_limit: 500,
    },
    updated_date: now,
  };
  const { data: existing, error: existingError } = await supabase
    .from("league_news_items")
    .select("id")
    .eq("league_id", leagueId)
    .eq("news_type", "AI_END_SEASON_RECAP")
    .maybeSingle();
  if (existingError) throw existingError;
  const { data: newsItem, error: newsError } = existing
    ? await supabase.from("league_news_items").update(newsPayload).eq("id", existing.id).select("*").single()
    : await supabase.from("league_news_items").insert({ ...newsPayload, created_date: now }).select("*").single();
  if (newsError) throw newsError;

  const [{ data: completedSeason, error: completedSeasonError }, { data: completedLeague, error: completedLeagueError }] = await Promise.all([
    supabase.from("league_seasons").update({ status: "COMPLETED", updated_date: now }).eq("id", season.id).select("*").single(),
    supabase.from("leagues").update({ league_status: "COMPLETED", updated_date: now }).eq("id", leagueId).select("*").single(),
  ]);
  if (completedSeasonError) throw completedSeasonError;
  if (completedLeagueError) throw completedLeagueError;

  return {
    league: completedLeague,
    season: completedSeason,
    champion: { league_member_id: championMemberId, team_name: memberName(champion) },
    awards,
    news_item: newsItem,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await request.json().catch(() => ({}));
    const supabase = adminClient();
    const user = await getUser(request, supabase);
    return json(await endSeason(supabase, user, payload));
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
});
