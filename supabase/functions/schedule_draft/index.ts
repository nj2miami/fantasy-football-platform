import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("schedule_draft", request));
