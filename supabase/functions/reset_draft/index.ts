import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("reset_draft", request));
