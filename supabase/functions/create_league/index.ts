import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("create_league", request));
