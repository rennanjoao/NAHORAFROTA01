import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Deps, Env } from "./types.ts";
import { generateTempPassword, generateToken } from "./crypto.ts";

/** Dependências reais (produção): variáveis de ambiente + cliente service role. */
export function realDeps(): Deps {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  const env: Env = {
    SITE_URL: Deno.env.get("SITE_URL") || "https://nahorafrota.tech",
    CHECKOUT_MODE: (Deno.env.get("CHECKOUT_MODE") as Env["CHECKOUT_MODE"]) || "stripe",
    STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY") || undefined,
    STRIPE_WEBHOOK_SECRET: Deno.env.get("STRIPE_WEBHOOK_SECRET") || undefined,
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") || undefined,
    EMAIL_FROM: Deno.env.get("EMAIL_FROM") || "Na Hora Frota <acesso@nahorafrota.tech>",
    SUPPORT_EMAIL: Deno.env.get("SUPPORT_EMAIL") || "suporte@nahorafrota.com.br",
    ENVIRONMENT: Deno.env.get("ENVIRONMENT") || "production",
  };
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    env,
    admin,
    fetch: globalThis.fetch.bind(globalThis),
    now: () => new Date(),
    randomPassword: generateTempPassword,
    randomToken: generateToken,
    log: (...a) => console.log("[checkout]", ...a),
  };
}
