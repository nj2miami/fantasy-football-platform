import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("submit_draft_pick", request));
