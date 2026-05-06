import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("update_league_settings", request));
