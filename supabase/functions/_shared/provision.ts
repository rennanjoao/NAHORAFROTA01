import type { Deps, OrderRow } from "./types.ts";
import { SERVER_PLANS } from "./plans.ts";

type Row = Record<string, unknown>;

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ProvisionResult {
  tenantId: string;
  userId: string;
  /** Vazia quando o comprador ja tinha login na empresa (conversao do teste gratis). */
  tempPassword: string;
  alreadyProvisioned: boolean;
  existingUser: boolean;
}

function fail(step: string, error: { message?: string } | null | undefined): never {
  throw new Error(`${step}: ${error?.message || "erro desconhecido"}`);
}

/** Campos da empresa que a ativacao altera (guardados para desfazer se algo falhar depois). */
const BILLING_FIELDS = [
  "status", "plan", "plan_started_at", "contract_start_date", "payment_cycle", "next_due_date", "financial_status",
  "auto_block_days", "converted_at", "billing_provider", "billing_customer_id", "billing_subscription_id", "billing_email", "updated_at",
] as const;

/**
 * Entrega o que foi pago. Dois caminhos:
 * - pedido "new": cria empresa ativa + administrador com senha temporaria;
 * - pedido "conversion": a empresa ja existia em teste gratis (register-tenant). Ela vira
 *   assinatura ativa no plano comprado; se o comprador ja era usuario dela, nada muda no
 *   login; se e um e-mail novo, entra como segundo administrador com senha temporaria.
 * Idempotente (pedido ja provisionado nao repete). Em falha, desfaz e marca "failed".
 */
export async function provisionOrder(order: OrderRow, deps: Deps): Promise<ProvisionResult> {
  const { admin, now, log } = deps;
  if (order.tenant_id && order.user_id && order.status === "provisioned") {
    return { tenantId: order.tenant_id, userId: order.user_id, tempPassword: order.temp_password ?? "", alreadyProvisioned: true, existingUser: !!order.existing_user };
  }

  const plan = SERVER_PLANS[order.plan];
  const today = now();
  const isConversion = order.kind === "conversion" && !!order.tenant_id;
  const reuseUser = isConversion && !!order.existing_user && !!order.user_id;
  const tempPassword = reuseUser ? "" : deps.randomPassword();
  const paymentNote = `Pedido ${order.id.slice(0, 8)} · ${plan.name} · ${order.mode === "stripe" ? "Stripe" : "ambiente de teste"}${isConversion ? " · conversão do teste grátis" : ""}`;

  let userId: string | null = reuseUser ? order.user_id : null;
  let createdUserId: string | null = null;
  let tenantId: string | null = isConversion ? order.tenant_id : null;
  let createdTenant = false;
  let previousTenant: Row | null = null;

  const rollback = async () => {
    try {
      if (tenantId) {
        await admin.from("payment_history").delete().eq("tenant_id", tenantId).eq("notes", paymentNote);
        if (createdTenant) {
          await admin.from("tenant_memberships").delete().eq("tenant_id", tenantId);
          await admin.from("user_roles").delete().eq("tenant_id", tenantId);
          await admin.from("tenants").delete().eq("id", tenantId);
        } else if (previousTenant) {
          await admin.from("tenants").update(previousTenant).eq("id", tenantId);
        }
      }
      if (createdUserId) {
        if (tenantId && !createdTenant) {
          await admin.from("tenant_memberships").delete().eq("tenant_id", tenantId).eq("user_id", createdUserId);
          await admin.from("user_roles").delete().eq("user_id", createdUserId);
        }
        await admin.from("profiles").delete().eq("id", createdUserId);
        await admin.auth.admin.deleteUser(createdUserId);
      }
    } catch (e) {
      log("rollback falhou", e);
    }
  };

  try {
    // 1. Usuario administrador (e-mail confirmado, senha temporaria, troca obrigatoria no primeiro login)
    if (!reuseUser) {
      const { data: created, error: userErr } = await admin.auth.admin.createUser({
        email: order.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: order.contact_name, must_change_password: true, origin: "checkout", order_id: order.id },
      });
      if (userErr || !created?.user?.id) {
        const msg = String(userErr?.message || "");
        if (/already|exists|registered/i.test(msg)) throw new Error("E-mail já cadastrado em outra conta. Use outro e-mail ou peça ajuda ao suporte.");
        fail("criar usuário", userErr);
      }
      userId = created.user.id as string;
      createdUserId = userId;
    }

    // 2. Empresa: nova (ativa, plano pago, vencimento em 1 mes) ou a existente ativada
    const billing = {
      status: "active",
      plan: order.plan,
      plan_started_at: today.toISOString(),
      contract_start_date: ymd(today),
      payment_cycle: "monthly",
      next_due_date: ymd(addMonths(today, 1)),
      financial_status: "current",
      auto_block_days: 7,
      billing_provider: order.mode,
      billing_customer_id: order.provider_customer_id,
      billing_subscription_id: order.provider_subscription_id,
      billing_email: order.email,
      updated_at: today.toISOString(),
    };
    if (isConversion) {
      const { data: current, error: curErr } = await admin.from("tenants").select("*").eq("id", tenantId).maybeSingle();
      if (curErr || !current) fail("localizar empresa", curErr);
      previousTenant = Object.fromEntries(BILLING_FIELDS.map((k) => [k, (current as Row)[k] ?? null]));
      const { error: updErr } = await admin.from("tenants").update({ ...billing, converted_at: today.toISOString() }).eq("id", tenantId);
      if (updErr) fail("ativar empresa", updErr);
    } else {
      const { data: tenant, error: tenantErr } = await admin
        .from("tenants")
        .insert({
          name: order.company_name,
          slug: `empresa-${order.cnpj}`,
          document: order.cnpj,
          cnpj: order.cnpj,
          razao_social: order.company_name,
          email: order.email,
          telefone: order.whatsapp,
          ...billing,
        })
        .select("id")
        .single();
      if (tenantErr || !tenant?.id) fail("criar empresa", tenantErr);
      tenantId = tenant.id as string;
      createdTenant = true;
    }

    // 3. Perfil, papel e vinculo do administrador (so quando o login e novo)
    if (!reuseUser && userId && tenantId) {
      const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, email: order.email, name: order.contact_name, tenant_id: tenantId }, { onConflict: "id" });
      if (profileErr) fail("criar perfil", profileErr);

      const { error: roleErr } = await admin.from("user_roles").upsert({ user_id: userId, role: "admin", tenant_id: tenantId }, { onConflict: "user_id,role" });
      if (roleErr) fail("definir permissão", roleErr);
      await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "viewer");

      const { error: memberErr } = await admin.from("tenant_memberships").upsert({ tenant_id: tenantId, user_id: userId, role: "admin" }, { onConflict: "tenant_id,user_id" });
      if (memberErr) fail("vincular administrador", memberErr);
    }

    // 4. Historico financeiro
    const { error: payErr } = await admin.from("payment_history").insert({
      tenant_id: tenantId,
      amount: order.amount_cents / 100,
      payment_date: ymd(today),
      due_date: billing.next_due_date,
      cycle: "monthly",
      notes: paymentNote,
    });
    if (payErr) fail("registrar pagamento", payErr);

    // 5. Pedido
    const expires = new Date(today.getTime() + 72 * 3600 * 1000);
    const { error: orderErr } = await admin
      .from("orders")
      .update({
        status: "provisioned",
        tenant_id: tenantId,
        user_id: userId,
        temp_password: reuseUser ? null : tempPassword,
        temp_password_expires_at: reuseUser ? null : expires.toISOString(),
        provisioned_at: today.toISOString(),
        error: null,
        updated_at: today.toISOString(),
      })
      .eq("id", order.id);
    if (orderErr) fail("atualizar pedido", orderErr);

    log(`${isConversion ? "convertido" : "provisionado"}: ${order.company_name} (${order.cnpj}) plano ${order.plan} tenant ${tenantId}${reuseUser ? " (login existente)" : ""}`);
    return { tenantId: tenantId as string, userId: userId as string, tempPassword, alreadyProvisioned: false, existingUser: reuseUser };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("provision falhou:", message);
    await rollback();
    await admin.from("orders").update({ status: "failed", error: message, updated_at: now().toISOString() }).eq("id", order.id);
    throw e;
  }
}
