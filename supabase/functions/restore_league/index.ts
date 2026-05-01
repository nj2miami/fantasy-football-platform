import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("restore_league", request));
