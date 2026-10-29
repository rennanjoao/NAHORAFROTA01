/**
 * Servidor local das funções de checkout, sem Supabase e sem Stripe:
 *   deno run --allow-net --allow-env scripts/dev-backend/server.ts
 *
 * - Roda os MESMOS handlers de supabase/functions/_shared/handlers.ts sobre um banco em memória.
 * - CHECKOUT_MODE=sandbox: a página /checkout/sandbox simula o pagamento.
 * - E-mails "enviados" pela Resend ficam em http://localhost:54321/dev/outbox (HTML real do e-mail).
 * - Estado do banco em http://localhost:54321/dev/state
 * No frontend, aponte VITE_FUNCTIONS_URL=http://localhost:54321/functions/v1 (arquivo .env.local).
 */
import { handleCreateCheckout, handleGetOrder, handleConfirmSandboxPayment, handleStripeWebhook, handleResendAccess } from "../../supabase/functions/_shared/handlers.ts";
import { generateTempPassword, generateToken } from "../../supabase/functions/_shared/crypto.ts";
import type { Deps } from "../../supabase/functions/_shared/types.ts";
import { FakeDb } from "./fake-supabase.ts";

Deno.env.set("ENVIRONMENT", "development");
const PORT = Number(Deno.env.get("DEV_BACKEND_PORT") || 54321);
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:8080";

const db = new FakeDb();
const outbox: { to: string; subject: string; html: string; text: string; at: string }[] = [];

const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://api.resend.com/emails")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    outbox.unshift({ to: body.to?.[0], subject: body.subject, html: body.html, text: body.text, at: new Date().toISOString() });
    return new Response(JSON.stringify({ id: `dev_${outbox.length}` }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ error: { message: `fetch bloqueado no dev: ${url}` } }), { status: 500 });
};

const deps: Deps = {
  env: {
    SITE_URL,
    CHECKOUT_MODE: "sandbox",
    RESEND_API_KEY: Deno.env.get("DEV_SIMULATE_EMAIL") === "0" ? undefined : "re_dev_fake",
    EMAIL_FROM: "Na Hora Frota <acesso@nahorafrota.tech>",
    SUPPORT_EMAIL: "suporte@nahorafrota.com.br",
    ENVIRONMENT: "development",
  },
  admin: db.client(),
  fetch: fakeFetch,
  now: () => new Date(),
  randomPassword: generateTempPassword,
  randomToken: generateToken,
  log: (...a) => console.log("[dev-backend]", ...a),
};

const ROUTES: Record<string, (req: Request, d: Deps) => Promise<Response>> = {
  "create-checkout": handleCreateCheckout,
  "get-order": handleGetOrder,
  "confirm-sandbox-payment": handleConfirmSandboxPayment,
  "stripe-webhook": handleStripeWebhook,
  "resend-access": handleResendAccess,
};

function page(title: string, body: string): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:Inter,system-ui;margin:24px;background:#F2F4F5">${body}</body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve({ port: PORT, onListen: ({ port }) => console.log(`[dev-backend] http://localhost:${port}  (functions em /functions/v1/*, e-mails em /dev/outbox)`) }, async (req) => {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/functions\/v1\/([a-z-]+)\/?$/);
  if (m && ROUTES[m[1]]) {
    const res = await ROUTES[m[1]](req, deps);
    console.log(`[dev-backend] ${req.method} ${m[1]} → ${res.status}`);
    return res;
  }
  if (url.pathname === "/dev/outbox") {
    const idx = url.searchParams.get("i");
    if (idx !== null) {
      const e = outbox[Number(idx)];
      return e ? new Response(e.html, { headers: { "Content-Type": "text/html; charset=utf-8" } }) : new Response("não encontrado", { status: 404 });
    }
    const items = outbox.map((e, i) => `<li><a href="/dev/outbox?i=${i}">${e.subject}</a> → ${e.to} <small>${e.at}</small></li>`).join("") || "<li>vazio</li>";
    return page("Caixa de saída (dev)", `<h1>Caixa de saída</h1><ul>${items}</ul>`);
  }
  if (url.pathname === "/dev/outbox.json") return Response.json(outbox);
  if (url.pathname === "/dev/state") return Response.json({ users: db.users.map((u) => ({ id: u.id, email: u.email, user_metadata: u.user_metadata })), ...db.tables });
  if (url.pathname === "/dev/reset" && req.method === "POST") {
    db.tables = { orders: [], tenants: [], profiles: [], user_roles: [], tenant_memberships: [], payment_history: [], platform_admins: [] };
    db.users = [];
    outbox.length = 0;
    return Response.json({ ok: true });
  }
  return page("dev-backend", `<h1>dev-backend</h1><p>Funções: ${Object.keys(ROUTES).map((r) => `<code>/functions/v1/${r}</code>`).join(", ")}</p><p><a href="/dev/outbox">Caixa de saída</a> · <a href="/dev/state">Estado</a></p>`);
});
