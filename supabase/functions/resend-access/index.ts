import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { realDeps } from "../_shared/deps.ts";
import { handleResendAccess } from "../_shared/handlers.ts";

const deps = realDeps();
serve((req) => handleResendAccess(req, deps));
