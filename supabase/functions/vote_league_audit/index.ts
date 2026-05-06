import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("vote_league_audit", request));
