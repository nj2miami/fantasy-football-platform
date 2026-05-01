import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("archive_league", request));
