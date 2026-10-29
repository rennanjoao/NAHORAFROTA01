import type { Deps, OrderRow } from "./types.ts";
import { SERVER_PLANS, isPlanId } from "./plans.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "./cors.ts";
import { cleanText, isValidCnpj, isValidEmail, isValidWhatsApp, normalizeEmail, onlyDigits } from "./validation.ts";
import { sha256Hex } from "./crypto.ts";
import { createStripeCheckoutSession, verifyStripeSignature } from "./stripe.ts";
import { provisionOrder } from "./provision.ts";
import { sendAccessEmail } from "./notify.ts";

type Json = Record<string, unknown>;

function json(body: Json, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function readJson(req: Request): Promise<Json> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Json) : {};
  } catch {
    return {};
  }
}

function siteUrl(env: Deps["env"]): string {
  return env.SITE_URL.replace(/\/$/, "");
}

/** Campos do pedido que o navegador pode ver (com o token certo). */
function toPublic(o: OrderRow, env: Deps["env"], now: Date): Json {
  const expired = o.temp_password_expires_at ? new Date(o.temp_password_expires_at).getTime() < now.getTime() : false;
  return {
    id: o.id,
    status: o.status,
    mode: o.mode,
    plan: o.plan,
    amount_cents: o.amount_cents,
    company_name: o.company_name,
    contact_name: o.contact_name,
    email: o.email,
    whatsapp: o.whatsapp,
    temp_password: o.status === "provisioned" && !expired ? o.temp_password : null,
    login_url: `${siteUrl(env)}/login`,
    access_email_status: o.access_email_status,
    access_sent_at: o.access_sent_at,
    error: o.status === "failed" ? o.error : null,
    created_at: o.created_at,
  };
}

async function loadOrderByToken(deps: Deps, orderId: unknown, token: unknown): Promise<OrderRow | null> {
  const id = String(orderId ?? "");
  const t = String(token ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/i.test(t)) return null;
  const { data } = await deps.admin.from("orders").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const hash = await sha256Hex(t);
  return hash === data.access_token_hash ? (data as OrderRow) : null;
}

/** Paga → provisiona → envia acesso. Usado pelo webhook do Stripe e pelo ambiente de teste. */
async function fulfill(order: OrderRow, deps: Deps): Promise<OrderRow> {
  if (order.status === "provisioned") return order;
  const result = await provisionOrder(order, deps); // lança em falha (pedido já marcado como failed)
  const { data: fresh } = await deps.admin.from("orders").select("*").eq("id", order.id).maybeSingle();
  const updated = (fresh as OrderRow) ?? { ...order, status: "provisioned" as const, temp_password: result.tempPassword };
  if (!result.alreadyProvisioned || updated.access_email_status === "pending") {
    await sendAccessEmail(updated, result.tempPassword, deps);
  }
  const { data: final } = await deps.admin.from("orders").select("*").eq("id", order.id).maybeSingle();
  return (final as OrderRow) ?? updated;
}

/* ------------------------------------------------------------------ */
/* POST /create-checkout                                                */
/* ------------------------------------------------------------------ */
export async function handleCreateCheckout(req: Request, deps: Deps): Promise<Response> {
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  const body = await readJson(req);
  const plan = body.plan;
  const company_name = cleanText(body.company_name, 140);
  const cnpj = onlyDigits(body.cnpj);
  const contact_name = cleanText(body.contact_name, 100);
  const email = normalizeEmail(body.email);
  const whatsapp = onlyDigits(body.whatsapp);

  if (!isPlanId(plan)) return json({ error: "Escolha um plano válido.", code: "invalid_plan" }, 400, cors);
  if (company_name.length < 3) return json({ error: "Informe a razão social.", code: "invalid_company" }, 400, cors);
  if (!isValidCnpj(cnpj)) return json({ error: "CNPJ inválido.", code: "invalid_cnpj" }, 400, cors);
  if (contact_name.length < 2) return json({ error: "Informe o seu nome.", code: "invalid_name" }, 400, cors);
  if (!isValidEmail(email)) return json({ error: "E-mail inválido.", code: "invalid_email" }, 400, cors);
  if (!isValidWhatsApp(whatsapp)) return json({ error: "WhatsApp inválido. Use DDD + número.", code: "invalid_whatsapp" }, 400, cors);

  // Já é cliente? Não deixa criar uma segunda empresa com o mesmo CNPJ nem um segundo login com o mesmo e-mail.
  const { data: tenantDup } = await deps.admin.from("tenants").select("id").eq("cnpj", cnpj).maybeSingle();
  if (tenantDup) return json({ error: "Este CNPJ já tem conta no Na Hora Frota. Entre com o seu login ou fale com o suporte.", code: "cnpj_exists" }, 409, cors);
  const { data: profileDup } = await deps.admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (profileDup) return json({ error: "Este e-mail já tem acesso. Entre com a sua senha ou use “Esqueci minha senha”.", code: "email_exists" }, 409, cors);

  const serverPlan = SERVER_PLANS[plan];
  const token = deps.randomToken();
  const mode = deps.env.STRIPE_SECRET_KEY ? "stripe" : deps.env.CHECKOUT_MODE === "sandbox" ? "sandbox" : null;
  if (!mode) return json({ error: "Pagamento ainda não configurado neste ambiente. Fale com o suporte." }, 503, cors);

  const nowIso = deps.now().toISOString();
  const { data: order, error: insErr } = await deps.admin
    .from("orders")
    .insert({
      status: "pending",
      mode,
      plan,
      amount_cents: serverPlan.amountCents,
      currency: "BRL",
      company_name,
      cnpj,
      contact_name,
      email,
      whatsapp,
      access_token_hash: await sha256Hex(token),
      access_email_status: "pending",
      metadata: { user_agent: req.headers.get("User-Agent") ?? null, origin: req.headers.get("Origin") ?? null },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (insErr || !order) {
    deps.log("falha ao criar pedido", insErr);
    return json({ error: "Não conseguimos registrar o pedido. Tente de novo." }, 500, cors);
  }

  const successUrl = `${siteUrl(deps.env)}/comprar/sucesso?order=${order.id}&t=${token}`;
  const cancelUrl = `${siteUrl(deps.env)}/comprar/${plan}?canceled=1`;

  if (mode === "stripe") {
    try {
      const session = await createStripeCheckoutSession(
        { secretKey: deps.env.STRIPE_SECRET_KEY!, orderId: order.id, planName: serverPlan.name, amountCents: serverPlan.amountCents, email, cnpj, companyName: company_name, successUrl, cancelUrl },
        deps.fetch,
      );
      await deps.admin.from("orders").update({ provider_session_id: session.id, updated_at: deps.now().toISOString() }).eq("id", order.id);
      return json({ order_id: order.id, access_token: token, checkout_url: session.url, mode }, 200, cors);
    } catch (e) {
      deps.log("stripe checkout falhou", e);
      await deps.admin.from("orders").update({ status: "failed", error: `stripe: ${e instanceof Error ? e.message : e}` }).eq("id", order.id);
      return json({ error: "Não conseguimos abrir o pagamento agora. Tente de novo em instantes." }, 502, cors);
    }
  }

  // sandbox: página interna de pagamento simulado
  return json({ order_id: order.id, access_token: token, checkout_url: `/checkout/sandbox/${order.id}?t=${token}`, mode }, 200, cors);
}

/* ------------------------------------------------------------------ */
/* POST /get-order                                                      */
/* ------------------------------------------------------------------ */
export async function handleGetOrder(req: Request, deps: Deps): Promise<Response> {
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);
  const body = await readJson(req);
  const order = await loadOrderByToken(deps, body.order_id, body.access_token);
  if (!order) return json({ error: "Pedido não encontrado." }, 404, cors);
  return json(toPublic(order, deps.env, deps.now()), 200, cors);
}

/* ------------------------------------------------------------------ */
/* POST /confirm-sandbox-payment  (só com CHECKOUT_MODE=sandbox)        */
/* ------------------------------------------------------------------ */
export async function handleConfirmSandboxPayment(req: Request, deps: Deps): Promise<Response> {
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);
  if (deps.env.CHECKOUT_MODE !== "sandbox" || deps.env.STRIPE_SECRET_KEY) {
    return json({ error: "Ambiente de teste desativado." }, 403, cors);
  }
  const body = await readJson(req);
  const order = await loadOrderByToken(deps, body.order_id, body.access_token);
  if (!order) return json({ error: "Pedido não encontrado." }, 404, cors);
  if (order.mode !== "sandbox") return json({ error: "Este pedido não é de teste." }, 400, cors);

  if (body.outcome === "declined") {
    await deps.admin.from("orders").update({ status: "canceled", error: "Pagamento recusado (simulado)", updated_at: deps.now().toISOString() }).eq("id", order.id);
    return json({ ok: true, status: "canceled" }, 200, cors);
  }
  if (order.status === "provisioned") return json({ ok: true, status: "provisioned" }, 200, cors);
  if (order.status === "failed") return json({ ok: false, status: "failed", error: order.error }, 200, cors);

  const paidAt = deps.now().toISOString();
  await deps.admin.from("orders").update({ status: "paid", paid_at: paidAt, provider_session_id: `sandbox_${order.id.slice(0, 8)}`, updated_at: paidAt }).eq("id", order.id);
  const paid = { ...order, status: "paid" as const, paid_at: paidAt };
  try {
    const final = await fulfill(paid, deps);
    return json({ ok: true, status: final.status }, 200, cors);
  } catch (e) {
    return json({ ok: false, status: "failed", error: e instanceof Error ? e.message : String(e) }, 200, cors);
  }
}

/* ------------------------------------------------------------------ */
/* POST /stripe-webhook                                                 */
/* ------------------------------------------------------------------ */
export async function handleStripeWebhook(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  const secret = deps.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook não configurado", { status: 500 });
  const payload = await req.text();
  const ok = await verifyStripeSignature(payload, req.headers.get("Stripe-Signature"), secret, Math.floor(deps.now().getTime() / 1000));
  if (!ok) return new Response("Assinatura inválida", { status: 400 });

  let event: Json;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const type = String(event.type ?? "");
  const obj = ((event.data as Json)?.object ?? {}) as Json;
  const eventId = String(event.id ?? "");
  deps.log(`stripe evento ${type} ${eventId}`);

  const reply = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const orderId = String((obj.metadata as Json)?.order_id ?? obj.client_reference_id ?? "");
    if (!orderId) return reply({ received: true, ignored: "sem order_id" });
    if (obj.payment_status && obj.payment_status !== "paid") return reply({ received: true, ignored: `payment_status=${obj.payment_status}` });

    const { data } = await deps.admin.from("orders").select("*").eq("id", orderId).maybeSingle();
    const order = data as OrderRow | null;
    if (!order) return reply({ received: true, ignored: "pedido não encontrado" });
    if (order.status === "provisioned") return reply({ received: true, already: true });

    const nowIso = deps.now().toISOString();
    const patch = {
      status: "paid",
      paid_at: order.paid_at ?? nowIso,
      provider_session_id: String(obj.id ?? order.provider_session_id ?? ""),
      provider_customer_id: typeof obj.customer === "string" ? obj.customer : order.provider_customer_id,
      provider_subscription_id: typeof obj.subscription === "string" ? obj.subscription : order.provider_subscription_id,
      provider_event_id: eventId,
      updated_at: nowIso,
    };
    await deps.admin.from("orders").update(patch).eq("id", order.id);
    try {
      const final = await fulfill({ ...order, ...patch, status: "paid" } as OrderRow, deps);
      return reply({ received: true, status: final.status });
    } catch (e) {
      // 200 mesmo assim: o pedido ficou "failed" com o motivo e será tratado manualmente; reenviar o evento não resolve.
      return reply({ received: true, status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (type === "invoice.paid" || type === "invoice.payment_succeeded") {
    const subId = typeof obj.subscription === "string" ? obj.subscription : String((obj.parent as Json)?.subscription_details && ((obj.parent as Json).subscription_details as Json).subscription || "");
    if (!subId) return reply({ received: true, ignored: "sem subscription" });
    const { data: tenant } = await deps.admin.from("tenants").select("id, payment_cycle").eq("billing_subscription_id", subId).maybeSingle();
    if (!tenant) return reply({ received: true, ignored: "empresa não encontrada" });
    const lines = ((obj.lines as Json)?.data as Json[]) ?? [];
    const periodEnd = Number((lines[0]?.period as Json)?.end ?? obj.period_end ?? 0);
    const due = periodEnd ? new Date(periodEnd * 1000) : new Date(deps.now().getTime() + 30 * 86400 * 1000);
    const amount = Number(obj.amount_paid ?? 0) / 100;
    const nowIso = deps.now().toISOString();
    await deps.admin.from("tenants").update({ next_due_date: due.toISOString().slice(0, 10), financial_status: "current", status: "active", updated_at: nowIso }).eq("id", tenant.id);
    if (amount > 0 && obj.billing_reason !== "subscription_create") {
      await deps.admin.from("payment_history").insert({ tenant_id: tenant.id, amount, payment_date: nowIso.slice(0, 10), due_date: due.toISOString().slice(0, 10), cycle: "monthly", notes: `Stripe · fatura ${obj.id ?? ""}` });
    }
    return reply({ received: true, status: "renewed" });
  }

  if (type === "invoice.payment_failed") {
    const subId = typeof obj.subscription === "string" ? obj.subscription : "";
    if (subId) await deps.admin.from("tenants").update({ financial_status: "pending", updated_at: deps.now().toISOString() }).eq("billing_subscription_id", subId);
    return reply({ received: true, status: "payment_failed" });
  }

  if (type === "customer.subscription.deleted") {
    const subId = String(obj.id ?? "");
    if (subId) await deps.admin.from("tenants").update({ financial_status: "blocked", status: "blocked", updated_at: deps.now().toISOString() }).eq("billing_subscription_id", subId);
    return reply({ received: true, status: "canceled" });
  }

  return reply({ received: true, ignored: type });
}

/* ------------------------------------------------------------------ */
/* POST /resend-access  (admin da plataforma, com JWT)                  */
/* Gera nova senha temporária e reenvia o e-mail de acesso de um pedido */
/* ------------------------------------------------------------------ */
export async function handleResendAccess(req: Request, deps: Deps): Promise<Response> {
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ error: "Sessão ausente." }, 401, cors);
  const { data: userData, error: userErr } = await deps.admin.auth.getUser(token);
  const callerId = userData?.user?.id as string | undefined;
  if (userErr || !callerId) return json({ error: "Sessão inválida." }, 401, cors);
  const { data: pa } = await deps.admin.from("platform_admins").select("user_id").eq("user_id", callerId).maybeSingle();
  if (!pa) return json({ error: "Só administradores da plataforma podem reenviar acessos." }, 403, cors);

  const body = await readJson(req);
  const orderId = String(body.order_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Pedido inválido." }, 400, cors);
  const { data } = await deps.admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  const order = data as OrderRow | null;
  if (!order) return json({ error: "Pedido não encontrado." }, 404, cors);
  if (order.status !== "provisioned" || !order.user_id) return json({ error: "Este pedido ainda não tem acesso criado." }, 409, cors);

  const tempPassword = deps.randomPassword();
  const { error: updErr } = await deps.admin.auth.admin.updateUserById(order.user_id, { password: tempPassword, user_metadata: { must_change_password: true } });
  if (updErr) return json({ error: `Não foi possível redefinir a senha: ${updErr.message}` }, 500, cors);
  const now = deps.now();
  await deps.admin
    .from("orders")
    .update({ temp_password: tempPassword, temp_password_expires_at: new Date(now.getTime() + 72 * 3600 * 1000).toISOString(), access_email_status: "pending", updated_at: now.toISOString() })
    .eq("id", order.id);
  const result = await sendAccessEmail({ ...order, temp_password: tempPassword }, tempPassword, deps);
  deps.log(`acesso reenviado por ${callerId} para pedido ${order.id}: ${result.status}`);
  return json({ ok: true, email_status: result.status, temp_password: tempPassword }, 200, cors);
}
