import { auth } from "@/api/authClient";
import { draftDay } from "@/api/draftDayClient";
import { entities } from "@/api/entitiesClient";
import { functions } from "@/api/functionsClient";
import { playerPool } from "@/api/playerPoolClient";
import { playerStats } from "@/api/playerStatsClient";
import { integrations } from "@/api/storageClient";

export {
  DEFAULT_DRAFT_CONFIG,
  DEFAULT_LEAGUE_PLAY_SETTINGS,
  DEFAULT_MANAGER_POINTS_STARTING,
  DEFAULT_ROSTER_RULES,
  DEFAULT_SCORING_RULES,
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_TEAM_TIER_CAP,
  DURABILITY_LABELS,
  DURABILITY_MULTIPLIERS,
} from "@/api/defaults";

export const appClient = {
  entities,
  auth,
  functions,
  playerPool,
  playerStats,
  draftDay,
  integrations,
};
