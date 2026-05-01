import { handleAction } from "../_shared/engine.ts";

Deno.serve((request) => handleAction("transfer_commissioner", request));
