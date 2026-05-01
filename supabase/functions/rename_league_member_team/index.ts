import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("rename_league_member_team", request));
