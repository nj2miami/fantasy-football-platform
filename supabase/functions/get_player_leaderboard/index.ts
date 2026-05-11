import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("get_player_leaderboard", request));
