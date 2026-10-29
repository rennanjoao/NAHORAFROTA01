/**
 * Testes das funções de checkout (rodam sem rede):
 *   deno test --allow-env supabase/functions/_shared/handlers.test.ts
 */
import { assert, assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleCreateCheckout, handleGetOrder, handleConfirmSandboxPayment, handleStripeWebhook, handleResendAccess } from "./handlers.ts";
import { signStripePayload, verifyStripeSignature } from "./stripe.ts";
import { generateTempPassword, generateToken, sha256Hex } from "./crypto.ts";
import type { Deps } from "./types.ts";
import { FakeDb } from "../../../scripts/dev-backend/fake-supabase.ts";
import { SERVER_PLANS } from "./plans.ts";

const VALID_CNPJ = "11222333000181";
const ORIGIN = "http://localhost:8080";

function makeDeps(opts: { mode?: "stripe" | "sandbox"; stripeKey?: string; resend?: boolean; webhookSecret?: string } = {}) {
  const db = new FakeDb();
  const emails: Record<string, unknown>[] = [];
  const stripeCalls: { url: string; body: string }[] = [];
  let clock = new Date("2026-10-29T12:00:00Z").getTime();
  const deps: Deps = {
    env: {
      SITE_URL: "https://nahorafrota.tech",
      CHECKOUT_MODE: opts.mode ?? "sandbox",
      STRIPE_SECRET_KEY: opts.stripeKey,
      STRIPE_WEBHOOK_SECRET: opts.webhookSecret,
      RESEND_API_KEY: opts.resend === false ? undefined : "re_test",
      EMAIL_FROM: "Na Hora Frota <acesso@nahorafrota.tech>",
      SUPPORT_EMAIL: "suporte@nahorafrota.com.br",
      ENVIRONMENT: "development",
    },
    admin: db.client(),
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.resend.com")) {
        emails.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
      }
      if (url.includes("api.stripe.com/v1/checkout/sessions")) {
        stripeCalls.push({ url, body: String(init?.body) });
        return new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }), { status: 200 });
      }
      throw new Error(`fetch inesperado: ${url}`);
    }) as typeof fetch,
    now: () => new Date(clock),
    randomPassword: generateTempPassword,
    randomToken: generateToken,
    log: () => {},
  };
  return { deps, db, emails, stripeCalls, tick: (ms: number) => (clock += ms) };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://x.supabase.co/functions/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const GOOD = { plan: "control", company_name: "Transportes Exemplo LTDA", cnpj: "11.222.333/0001-81", contact_name: "Ana Souza", email: "Ana@Exemplo.com.br", whatsapp: "(11) 99999-8888" };

Deno.test("create-checkout: valida campos e preços vêm do servidor", async () => {
  const { deps, db } = makeDeps();
  for (const [field, value, code] of [["plan", "gold", "invalid_plan"], ["cnpj", "12345678000100", "invalid_cnpj"], ["email", "ana@", "invalid_email"], ["whatsapp", "119", "invalid_whatsapp"], ["company_name", "AB", "invalid_company"]] as const) {
    const res = await handleCreateCheckout(post("create-checkout", { ...GOOD, [field]: value, amount_cents: 1 }), deps);
    assertEquals(res.status, 400, field);
    assertEquals((await res.json()).code, code);
  }
  const res = await handleCreateCheckout(post("create-checkout", { ...GOOD, amount_cents: 1 }), deps);
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.mode, "sandbox");
  assertMatch(j.checkout_url, /^\/checkout\/sandbox\//);
  assertEquals(db.tables.orders[0].amount_cents, SERVER_PLANS.control.amountCents);
  assertEquals(db.tables.orders[0].email, "ana@exemplo.com.br");
  assertEquals(db.tables.orders[0].cnpj, VALID_CNPJ);
  assertEquals(db.tables.orders[0].access_token_hash, await sha256Hex(j.access_token));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

Deno.test("create-checkout: recusa CNPJ já assinante e e-mail de outra empresa", async () => {
  const { deps, db } = makeDeps();
  // empresa ativa (ja paga) nao compra de novo
  db.tables.tenants.push({ id: "t1", cnpj: VALID_CNPJ, status: "active" });
  let res = await handleCreateCheckout(post("create-checkout", GOOD), deps);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).code, "cnpj_exists");
  // bloqueada depois de ter pago (converted_at) tambem nao
  db.tables.tenants = [{ id: "t1", cnpj: VALID_CNPJ, status: "blocked", converted_at: "2026-01-01T00:00:00Z", trial_started_at: "2025-12-01T00:00:00Z" }];
  res = await handleCreateCheckout(post("create-checkout", GOOD), deps);
  assertEquals(res.status, 409);
  // e-mail que ja e usuario de outra empresa
  db.tables.tenants = [];
  db.tables.profiles.push({ id: "u1", email: "ana@exemplo.com.br", tenant_id: "t-outra" });
  res = await handleCreateCheckout(post("create-checkout", GOOD), deps);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).code, "email_exists");
});

/** Empresa em teste gratis como register-tenant cria, com um administrador. */
async function seedTrial(deps: Deps, db: FakeDb, adminEmail: string) {
  const { data: u } = await deps.admin.auth.admin.createUser({ email: adminEmail, password: "Teste123!", user_metadata: { name: "Bia" } });
  db.tables.tenants.push({
    id: "t-trial", cnpj: VALID_CNPJ, razao_social: "Transportes Exemplo LTDA", name: "Transportes Exemplo LTDA", status: "trial", plan: "basic",
    trial_started_at: "2026-10-20T00:00:00Z", trial_ends_at: "2026-10-27T00:00:00Z", next_due_date: null, financial_status: null,
  });
  db.tables.profiles.push({ id: u.user.id, email: adminEmail, tenant_id: "t-trial" });
  db.tables.user_roles.push({ user_id: u.user.id, role: "admin", tenant_id: "t-trial" });
  db.tables.tenant_memberships.push({ tenant_id: "t-trial", user_id: u.user.id, role: "admin" });
  return u.user.id as string;
}

Deno.test("conversão: empresa em teste grátis + mesmo administrador → assinatura ativa sem senha nova", async () => {
  const { deps, db, emails } = makeDeps();
  const adminId = await seedTrial(deps, db, "ana@exemplo.com.br");

  const res = await handleCreateCheckout(post("create-checkout", GOOD), deps);
  assertEquals(res.status, 200);
  const created = await res.json();
  assertEquals(created.kind, "conversion");
  assertEquals(db.tables.orders[0].tenant_id, "t-trial");
  assertEquals(db.tables.orders[0].user_id, adminId);
  assertEquals(db.tables.orders[0].existing_user, true);

  const conf = await (await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps)).json();
  assertEquals(conf, { ok: true, status: "provisioned" });

  // mesma empresa, agora ativa no plano comprado; nenhum usuario novo, senha intacta
  assertEquals(db.tables.tenants.length, 1);
  const tenant = db.tables.tenants[0];
  assertEquals(tenant.status, "active");
  assertEquals(tenant.plan, "control");
  assertEquals(tenant.financial_status, "current");
  assertEquals(tenant.next_due_date, "2026-11-29");
  assert(tenant.converted_at, "converted_at marcado");
  assertEquals(db.users.length, 1);
  assertEquals(db.users[0].password, "Teste123!");
  assertEquals(db.users[0].user_metadata.must_change_password, undefined);
  assertEquals(db.tables.tenant_memberships.length, 1);
  assertEquals(db.tables.payment_history.length, 1);
  assertEquals(db.tables.payment_history[0].amount, 370);

  // consulta publica: sem senha temporaria; e-mail de "assinatura ativa"
  const pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(pub.status, "provisioned");
  assertEquals(pub.kind, "conversion");
  assertEquals(pub.existing_user, true);
  assertEquals(pub.temp_password, null);
  assertEquals(emails.length, 1);
  assertMatch(String(emails[0].subject), /assinatura/i);
  assert(!String(emails[0].html).includes("Senha temporária"), "e-mail nao traz senha temporaria");
  assert(String(emails[0].text).includes("a mesma que você já usa"));
});

Deno.test("conversão: empresa em teste grátis + e-mail novo → segundo administrador com senha temporária", async () => {
  const { deps, db, emails } = makeDeps();
  await seedTrial(deps, db, "dona@exemplo.com.br");

  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();
  assertEquals(created.kind, "conversion");
  assertEquals(db.tables.orders[0].existing_user, false);
  await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps);

  assertEquals(db.tables.tenants.length, 1);
  assertEquals(db.tables.tenants[0].status, "active");
  assertEquals(db.tables.tenants[0].plan, "control");
  assertEquals(db.users.length, 2);
  const novo = db.users.find((u) => u.email === "ana@exemplo.com.br")!;
  assertEquals(novo.user_metadata.must_change_password, true);
  assert(db.tables.user_roles.some((r) => r.user_id === novo.id && r.role === "admin" && r.tenant_id === "t-trial"));
  assert(db.tables.tenant_memberships.some((m) => m.user_id === novo.id && m.tenant_id === "t-trial"));
  assertEquals(db.tables.profiles.find((p) => p.id === novo.id)?.tenant_id, "t-trial");

  const pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(pub.existing_user, false);
  assertEquals(pub.temp_password, novo.password);
  assertEquals(emails.length, 1);
  assert(String(emails[0].html).includes(novo.password));
  assert(String(emails[0].html).includes("já estava no Na Hora Frota"));
});

Deno.test("fluxo completo (sandbox): pagar → provisionar → enviar acesso → consultar", async () => {
  const { deps, db, emails } = makeDeps();
  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();

  // antes de pagar: sem senha
  let pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(pub.status, "pending");
  assertEquals(pub.temp_password, null);

  // token errado → 404
  const bad = await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: "f".repeat(64) }), deps);
  assertEquals(bad.status, 404);

  const conf = await (await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps)).json();
  assertEquals(conf, { ok: true, status: "provisioned" });

  // empresa + admin criados com o plano certo, ativos, vencimento em 1 mês
  const tenant = db.tables.tenants[0];
  assertEquals(tenant.plan, "control");
  assertEquals(tenant.status, "active");
  assertEquals(tenant.financial_status, "current");
  assertEquals(tenant.next_due_date, "2026-11-29");
  assertEquals(tenant.converted_at, undefined);
  const user = db.users[0];
  assertEquals(user.email, "ana@exemplo.com.br");
  assertEquals(user.user_metadata.must_change_password, true);
  assertEquals(db.tables.user_roles[0], { ...db.tables.user_roles[0], user_id: user.id, role: "admin", tenant_id: tenant.id });
  assertEquals(db.tables.tenant_memberships[0].role, "admin");
  assertEquals(db.tables.profiles[0].tenant_id, tenant.id);
  assertEquals(db.tables.payment_history.length, 1);
  assertEquals(db.tables.payment_history[0].amount, 370);

  // e-mail de acesso com login e senha temporária
  assertEquals(emails.length, 1);
  assertEquals(emails[0].to, ["ana@exemplo.com.br"]);
  assertMatch(String(emails[0].subject), /acesso/i);
  assert(String(emails[0].html).includes(user.password), "html traz a senha temporária");
  assert(String(emails[0].text).includes("https://nahorafrota.tech/login"));

  // consulta pública mostra a senha e o status do e-mail
  pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(pub.status, "provisioned");
  assertEquals(pub.temp_password, user.password);
  assertEquals(pub.access_email_status, "sent");
  assertEquals(pub.login_url, "https://nahorafrota.tech/login");

  // confirmar de novo é idempotente (não cria segunda empresa nem segundo e-mail)
  const again = await (await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps)).json();
  assertEquals(again.status, "provisioned");
  assertEquals(db.tables.tenants.length, 1);
  assertEquals(emails.length, 1);
});

Deno.test("senha temporária some da consulta depois de expirar", async () => {
  const { deps, tick } = makeDeps();
  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();
  await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps);
  tick(73 * 3600 * 1000);
  const pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(pub.status, "provisioned");
  assertEquals(pub.temp_password, null);
});

Deno.test("sem Resend configurada: acesso continua na tela, status not_configured", async () => {
  const { deps, emails } = makeDeps({ resend: false });
  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();
  await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps);
  const pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(emails.length, 0);
  assertEquals(pub.access_email_status, "not_configured");
  assert(pub.temp_password);
});

Deno.test("falha no provisionamento desfaz tudo e marca o pedido como failed", async () => {
  const { deps, db } = makeDeps();
  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();
  // simula e-mail que apareceu no auth entre o checkout e o pagamento
  await deps.admin.auth.admin.createUser({ email: "ana@exemplo.com.br", password: "x", user_metadata: {} });
  const conf = await (await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps)).json();
  assertEquals(conf.ok, false);
  assertEquals(db.tables.orders[0].status, "failed");
  assertMatch(String(db.tables.orders[0].error), /já cadastrado/);
  assertEquals(db.tables.tenants.length, 0);
  assertEquals(db.users.length, 1, "o usuário pré-existente fica; nada novo sobra");
  const pub = await (await handleGetOrder(post("get-order", { order_id: created.order_id, access_token: created.access_token }), deps)).json();
  assertEquals(pub.status, "failed");
  assertMatch(String(pub.error), /já cadastrado/);
});

Deno.test("sandbox desligado em produção", async () => {
  const { deps } = makeDeps({ mode: "stripe", stripeKey: "sk_test_x" });
  const res = await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: "x", access_token: "y" }), deps);
  assertEquals(res.status, 403);
});

Deno.test("modo Stripe: cria a sessão com o preço do servidor e redireciona", async () => {
  const { deps, db, stripeCalls } = makeDeps({ mode: "stripe", stripeKey: "sk_test_x" });
  const res = await handleCreateCheckout(post("create-checkout", { ...GOOD, plan: "total" }), deps);
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.mode, "stripe");
  assertEquals(j.checkout_url, "https://checkout.stripe.com/c/pay/cs_test_123");
  assertEquals(stripeCalls.length, 1);
  const form = new URLSearchParams(stripeCalls[0].body);
  assertEquals(form.get("mode"), "subscription");
  assertEquals(form.get("line_items[0][price_data][unit_amount]"), "55000");
  assertEquals(form.get("line_items[0][price_data][currency]"), "brl");
  assertEquals(form.get("client_reference_id"), j.order_id);
  assert(form.get("success_url")!.includes(`order=${j.order_id}&t=${j.access_token}`));
  assertEquals(db.tables.orders[0].provider_session_id, "cs_test_123");
});

Deno.test("webhook Stripe: assinatura válida provisiona; inválida é rejeitada; repetição é idempotente", async () => {
  const secret = "whsec_test";
  const { deps, db, emails } = makeDeps({ mode: "stripe", stripeKey: "sk_test_x", webhookSecret: secret });
  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();
  const event = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_123", payment_status: "paid", client_reference_id: created.order_id, metadata: { order_id: created.order_id }, customer: "cus_1", subscription: "sub_1" } },
  });
  const t = Math.floor(deps.now().getTime() / 1000);

  const badSig = await handleStripeWebhook(post("stripe-webhook", event, { "Stripe-Signature": `t=${t},v1=deadbeef` }), deps);
  assertEquals(badSig.status, 400);
  assertEquals(db.tables.tenants.length, 0);

  const sig = await signStripePayload(event, secret, t);
  assert(await verifyStripeSignature(event, sig, secret, t));
  assert(!(await verifyStripeSignature(event, sig, secret, t + 600)), "fora da tolerância");

  const ok = await handleStripeWebhook(post("stripe-webhook", event, { "Stripe-Signature": sig }), deps);
  assertEquals(ok.status, 200);
  assertEquals((await ok.json()).status, "provisioned");
  assertEquals(db.tables.tenants.length, 1);
  assertEquals(db.tables.tenants[0].billing_subscription_id, "sub_1");
  assertEquals(db.tables.tenants[0].billing_customer_id, "cus_1");
  assertEquals(emails.length, 1);

  const again = await handleStripeWebhook(post("stripe-webhook", event, { "Stripe-Signature": sig }), deps);
  assertEquals((await again.json()).already, true);
  assertEquals(db.tables.tenants.length, 1);
  assertEquals(emails.length, 1);

  // renovação mensal
  const periodEnd = Math.floor(new Date("2026-12-29T12:00:00Z").getTime() / 1000);
  const inv = JSON.stringify({ id: "evt_2", type: "invoice.paid", data: { object: { id: "in_2", subscription: "sub_1", amount_paid: 37000, billing_reason: "subscription_cycle", lines: { data: [{ period: { end: periodEnd } }] } } } });
  const r = await handleStripeWebhook(post("stripe-webhook", inv, { "Stripe-Signature": await signStripePayload(inv, secret, t) }), deps);
  assertEquals((await r.json()).status, "renewed");
  assertEquals(db.tables.tenants[0].next_due_date, "2026-12-29");
  assertEquals(db.tables.payment_history.length, 2);

  // cancelamento
  const del = JSON.stringify({ id: "evt_3", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } });
  await handleStripeWebhook(post("stripe-webhook", del, { "Stripe-Signature": await signStripePayload(del, secret, t) }), deps);
  assertEquals(db.tables.tenants[0].status, "blocked");
});

Deno.test("resend-access: só admin da plataforma; gera nova senha e reenvia o e-mail", async () => {
  const { deps, db, emails } = makeDeps();
  const created = await (await handleCreateCheckout(post("create-checkout", GOOD), deps)).json();
  await handleConfirmSandboxPayment(post("confirm-sandbox-payment", { order_id: created.order_id, access_token: created.access_token, outcome: "approved" }), deps);
  const oldPassword = db.users[0].password;

  // sem sessão
  assertEquals((await handleResendAccess(post("resend-access", { order_id: created.order_id }), deps)).status, 401);
  // usuário comum
  const { data: common } = await deps.admin.auth.admin.createUser({ email: "x@y.com", password: "p", user_metadata: {} });
  assertEquals((await handleResendAccess(post("resend-access", { order_id: created.order_id }, { Authorization: `Bearer token:${common.user.id}` }), deps)).status, 403);
  // admin da plataforma
  const { data: adminUser } = await deps.admin.auth.admin.createUser({ email: "admin@nahorafrota.tech", password: "p", user_metadata: {} });
  db.tables.platform_admins.push({ user_id: adminUser.user.id });
  const res = await handleResendAccess(post("resend-access", { order_id: created.order_id }, { Authorization: `Bearer token:${adminUser.user.id}` }), deps);
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.email_status, "sent");
  assert(j.temp_password && j.temp_password !== oldPassword);
  assertEquals(db.users[0].password, j.temp_password);
  assertEquals(db.users[0].user_metadata.must_change_password, true);
  assertEquals(emails.length, 2);
  assert(String(emails[1].html).includes(j.temp_password));
});
