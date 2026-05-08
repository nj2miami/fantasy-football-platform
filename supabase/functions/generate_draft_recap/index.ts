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

function buildPrompt(recapData: Json) {
  return `You are the league newsletter writer for Retro Fantasy Football.

Write a polished post-draft newsletter titled "Draft Recap".

Style:
- Fun, confident, commissioner-style fantasy sports voice.
- Fair but opinionated.
- Grade every team.
- Use expected season numbers only as summarized support, not as a raw stat dump.
- Do not reveal any hidden source weeks or raw player stat lines.
- Target 900 to 1300 words.
- Return markdown only.

Required sections:
1. Opening league-wide recap.
2. Team-by-team draft grades.
3. Best value picks.
4. Riskiest builds.
5. Projected strongest teams by expected numbers.
6. Closing note.

Draft data:
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
  if (!text) throw new Error("Gemini returned an empty Draft Recap.");
  return { text, model, usageMetadata: body?.usageMetadata || null, responseId: body?.responseId || null };
}

async function generateDraftRecap(supabase: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, payload: Json) {
  const leagueId = String(payload.league_id || "");
  const draftId = String(payload.draft_id || "");
  if (!leagueId || !draftId) throw new Error("league_id and draft_id are required");
  const { league } = await requireLeagueControl(supabase, user, leagueId);
  const { data: draft, error: draftError } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .eq("league_id", leagueId)
    .single();
  if (draftError) throw draftError;
  if (String(draft.status || "").toUpperCase() !== "COMPLETED") throw new Error("Draft Recap can only be generated after the draft is completed.");

  const [membersResult, turnsResult, picksResult] = await Promise.all([
    supabase.from("league_members").select("*").eq("league_id", leagueId).eq("is_active", true),
    supabase.from("draft_turns").select("*").eq("draft_id", draftId).order("overall_pick", { ascending: true }),
    supabase.from("draft_picks").select("*").eq("draft_id", draftId).order("overall_pick", { ascending: true }),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (turnsResult.error) throw turnsResult.error;
  if (picksResult.error) throw picksResult.error;

  const members = membersResult.data || [];
  const picks = picksResult.data || [];
  if (!picks.length) throw new Error("Draft has no picks to recap.");

  const playerIds = [...new Set(picks.map((pick: Json) => String(pick.player_id || "")).filter(Boolean))];
  const [playersResult, scoresResult] = await Promise.all([
    supabase.from("players").select("id,full_name,player_display_name,position,team").in("id", playerIds),
    supabase
      .from("league_player_scores")
      .select("player_id,position,position_rank,tier_value,expected_avg_points,total_points,weeks_played")
      .eq("league_id", leagueId)
      .in("player_id", playerIds),
  ]);
  if (playersResult.error) throw playersResult.error;
  if (scoresResult.error) throw scoresResult.error;

  const playersById = new Map((playersResult.data || []).map((player: Json) => [String(player.id), player]));
  const scoresByPlayer = new Map((scoresResult.data || []).map((score: Json) => [String(score.player_id), score]));
  const membersById = new Map(members.map((member: Json) => [String(member.id), member]));
  const teamTierCap = Number(league.team_tier_cap || 25);
  const picksWithContext = picks.map((pick: Json) => {
    const player = playersById.get(String(pick.player_id));
    const score = scoresByPlayer.get(String(pick.player_id));
    const member = membersById.get(String(pick.league_member_id));
    return {
      league_member_id: String(pick.league_member_id || ""),
      overall_pick: Number(pick.overall_pick || 0),
      round: Number(pick.round || 0),
      team: memberName(member),
      player: playerName(player),
      nfl_team: player?.team || null,
      position: score?.position || player?.position || null,
      tier: Number(score?.tier_value || 1),
      position_rank: Number(score?.position_rank || 0),
      expected_avg_points: formatNumber(score?.expected_avg_points, 2),
      expected_total_points: formatNumber(score?.total_points, 2),
      weeks_played: Number(score?.weeks_played || 0),
    };
  });
  const teamSummaries = members.map((member: Json) => {
    const teamPicks = picksWithContext.filter((pick) => pick.league_member_id === String(member.id || ""));
    const tierTotal = teamPicks.reduce((sum, pick) => sum + Number(pick.tier || 1), 0);
    const expectedTotal = teamPicks.reduce((sum, pick) => sum + Number(pick.expected_total_points || 0), 0);
    const expectedAverage = teamPicks.reduce((sum, pick) => sum + Number(pick.expected_avg_points || 0), 0);
    const composition = teamPicks.reduce((counts: Record<string, number>, pick) => {
      const position = String(pick.position || "UNK").toUpperCase();
      counts[position] = (counts[position] || 0) + 1;
      return counts;
    }, {});
    return {
      team: memberName(member),
      ai_persona: member.is_ai ? member.ai_persona || "BALANCED" : null,
      picks: teamPicks,
      tier_spend: tierTotal,
      remaining_tier_cap: teamTierCap - tierTotal,
      expected_total_points: formatNumber(expectedTotal, 2),
      expected_avg_points_sum: formatNumber(expectedAverage, 2),
      roster_composition: composition,
    };
  });

  const recapData = {
    league: {
      name: league.name,
      source_season_year: league.source_season_year,
      team_tier_cap: teamTierCap,
      scoring_rules: league.scoring_rules || {},
      scoring_rules_locked_at: league.scoring_rules_locked_at || null,
      scoring_rules_lock_source: league.scoring_rules_lock_source || null,
      draft_config: league.draft_config || {},
      roster_rules: league.roster_rules || {},
    },
    draft: {
      id: draft.id,
      type: draft.type,
      completed_at: draft.completed_at,
      total_picks: picksWithContext.length,
      order: (turnsResult.data || []).map((turn: Json) => ({
        overall_pick: turn.overall_pick,
        round: turn.round,
        team: memberName(membersById.get(String(turn.league_member_id))),
      })),
      picks: picksWithContext,
    },
    teams: teamSummaries,
  };

  const generated = await callGemini(buildPrompt(recapData));
  const storageBucket = "league-news";
  const storagePath = `draft-recaps/${leagueId}/${draftId}.md`;
  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, new Blob([generated.text], { type: "text/markdown;charset=utf-8" }), {
      contentType: "text/markdown;charset=utf-8",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const generationMetadata = {
    provider: "google_gemini",
    model: generated.model,
    response_id: generated.responseId,
    usage_metadata: generated.usageMetadata,
    generated_at: new Date().toISOString(),
    pick_count: picksWithContext.length,
  };
  const newsPayload = {
    league_id: leagueId,
    title: "Draft Recap",
    body: generated.text,
    news_type: "AI_DRAFT_RECAP",
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
    storage_bucket: storageBucket,
    storage_path: storagePath,
    source_draft_id: draftId,
    generation_metadata: generationMetadata,
    updated_date: new Date().toISOString(),
  };
  const { data: existing, error: existingError } = await supabase
    .from("league_news_items")
    .select("id")
    .eq("league_id", leagueId)
    .eq("source_draft_id", draftId)
    .eq("news_type", "AI_DRAFT_RECAP")
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
    return json(await generateDraftRecap(supabase, user, payload));
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
});
