import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("add_ai_team", request));
