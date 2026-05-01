import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("resolve_week", request));
