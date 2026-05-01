import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("reveal_week_results", request));
