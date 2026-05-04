import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

function normalizePlayerPoolSort(sortBy) {
  return ["-avg_points", "avg_points", "-total_points", "total_points", "-high_score", "high_score", "-low_score", "low_score"].includes(sortBy)
    ? sortBy
    : "-avg_points";
}

export const playerPool = {
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
};
