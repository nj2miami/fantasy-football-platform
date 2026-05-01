import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("remove_league_member", request));
