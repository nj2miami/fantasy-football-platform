import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("finalize_lineup", request));
