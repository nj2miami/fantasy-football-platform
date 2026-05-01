import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("join_league_by_invite", request));
