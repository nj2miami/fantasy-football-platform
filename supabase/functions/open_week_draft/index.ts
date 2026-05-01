import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("open_week_draft", request));
