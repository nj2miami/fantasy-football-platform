import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("force_delete_league", request));
