import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("update_draft_check_in", request));
