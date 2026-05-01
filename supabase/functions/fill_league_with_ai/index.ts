import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("fill_league_with_ai", request));
