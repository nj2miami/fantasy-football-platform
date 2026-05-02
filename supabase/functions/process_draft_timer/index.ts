import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("process_draft_timer", request));
