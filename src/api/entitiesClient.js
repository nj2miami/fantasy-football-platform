import { supabase } from "@/lib/supabase";
import { applyPagination, applySort, mapSupabaseError, now } from "@/api/supabaseCore";

export const entityTableMap = {
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
  DraftTurn: "draft_turns",
  DraftPick: "draft_picks",
  DraftBoardItem: "draft_board_items",
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
  PlayerPositionTier: "player_position_tiers",
  LeaguePlayerDurability: "league_player_durability",
  ManagerPointAccount: "manager_point_accounts",
  ManagerPointTransaction: "manager_point_transactions",
};

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
    async filter(filters = {}, ...options) {
      const [firstSort, secondSort, maybeLimit, maybeSkip] = options;
      let limit = maybeLimit;
      let skip = maybeSkip;
      const sortArgs = [firstSort];
      if (typeof secondSort === "string") sortArgs.push(secondSort);
      else if (typeof secondSort === "number") {
        limit = secondSort;
        skip = maybeLimit;
      }

      let query = supabase.from(table).select("*");
      for (const [key, value] of Object.entries(filters || {})) {
        if (Array.isArray(value)) query = query.in(key, value);
        else query = query.eq(key, value);
      }
      for (const sort of sortArgs.filter(Boolean)) query = applySort(query, sort);
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
      if (!items?.length) return [];
      const rows = items.map((item) => ({ ...item, created_date: item.created_date || now() }));
      const { data, error } = await supabase.from(table).insert(rows).select("*");
      if (error) throw mapSupabaseError(error);
      return data || [];
    },
  };
}

export const entities = Object.fromEntries(Object.keys(entityTableMap).map((name) => [name, makeSupabaseEntityApi(name)]));
