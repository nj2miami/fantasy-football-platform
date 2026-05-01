import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("pause_league", request));
