import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("lock_scoring_rules", request));
