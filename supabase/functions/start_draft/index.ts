import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("start_draft", request));
