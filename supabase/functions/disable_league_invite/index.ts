import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("disable_league_invite", request));
