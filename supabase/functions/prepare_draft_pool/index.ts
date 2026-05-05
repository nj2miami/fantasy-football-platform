import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("prepare_draft_pool", request));
