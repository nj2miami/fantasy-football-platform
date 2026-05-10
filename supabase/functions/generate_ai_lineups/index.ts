import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("generate_ai_lineups", request));
