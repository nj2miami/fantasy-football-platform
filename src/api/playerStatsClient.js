import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

function normalizePlayerWeekSummary(week) {
  return {
    id: week.id,
    player_id: week.player_id,
    season_year: Number(week.season_year || 0),
    season: Number(week.season_year || 0),
    week: Number(week.week || 0),
    team: week.team || null,
    opponent_team: week.opponent_team || week.raw_stats?.opponent_team || null,
    fantasy_points: Number(week.fantasy_points || 0),
  };
}

export async function countPlayerWeeks(playerId, seasonYear) {
  if (!playerId) return 0;
  const { count, error } = await supabase
    .from("player_week_stats")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("season_year", Number(seasonYear));
  if (error) throw mapSupabaseError(error);
  return count || 0;
}

export const playerStats = {
  async latestSourceSeasonYear() {
    const { data, error } = await supabase
      .from("player_week_stats")
      .select("season_year")
      .order("season_year", { ascending: false })
      .limit(1);
    if (error) throw mapSupabaseError(error);
    return Number(data?.[0]?.season_year || new Date().getFullYear() - 1);
  },
  async getAggregate({ playerId, seasonYear = null } = {}) {
    if (!playerId) return null;
    if (seasonYear) {
      const { data, error } = await supabase
        .from("player_week_stats")
        .select("fantasy_points")
        .eq("player_id", playerId)
        .eq("season_year", Number(seasonYear));
      if (error) throw mapSupabaseError(error);
      const points = (data || []).map((week) => Number(week.fantasy_points || 0));
      const total = points.reduce((sum, point) => sum + point, 0);
      return {
        player_id: playerId,
        season_year: Number(seasonYear),
        total_points: total,
        avg_points: points.length ? total / points.length : 0,
        high_score: points.length ? Math.max(...points) : 0,
        low_score: points.length ? Math.min(...points) : 0,
        weeks_played: points.length,
      };
    }

    const { data, error } = await supabase
      .from("players")
      .select("id,total_points,avg_points,high_score,low_score")
      .eq("id", playerId)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (!data) return null;
    return {
      player_id: data.id,
      season_year: null,
      total_points: data.total_points || 0,
      avg_points: data.avg_points || 0,
      high_score: data.high_score || 0,
      low_score: data.low_score || 0,
      weeks_played: null,
    };
  },
  async listWeeklySummaries({ playerId } = {}) {
    if (!playerId) return [];
    const { data, error } = await supabase
      .from("player_week_stats")
      .select("id,player_id,season_year,week,team,opponent_team,fantasy_points,raw_stats")
      .eq("player_id", playerId)
      .order("season_year", { ascending: true })
      .order("week", { ascending: true });
    if (error) throw mapSupabaseError(error);
    return (data || []).map(normalizePlayerWeekSummary);
  },
  async listWeeklyActuals({ playerId } = {}) {
    if (!playerId) return [];
    const { data, error } = await supabase
      .from("player_week_stats")
      .select("id,player_id,season_year,week,team,opponent_team,raw_stats")
      .eq("player_id", playerId)
      .order("season_year", { ascending: true })
      .order("week", { ascending: true });
    if (error) throw mapSupabaseError(error);
    return data || [];
  },
  async getWeekDetail({ playerWeekId, playerId, seasonYear, week } = {}) {
    let query = supabase.from("player_week_stats").select("*");
    if (playerWeekId) query = query.eq("id", playerWeekId);
    else {
      query = query
        .eq("player_id", playerId)
        .eq("season_year", Number(seasonYear))
        .eq("week", Number(week));
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? { ...(data.raw_stats || {}), ...data, season: data.season_year } : null;
  },
};
