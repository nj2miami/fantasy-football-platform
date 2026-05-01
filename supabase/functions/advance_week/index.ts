import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("advance_week", request));
