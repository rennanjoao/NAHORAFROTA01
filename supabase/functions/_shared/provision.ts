import type { Deps, OrderRow } from "./types.ts";
import { SERVER_PLANS } from "./plans.ts";

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
  tempPassword: string;
  alreadyProvisioned: boolean;
}

function fail(step: string, error: { message?: string } | null | undefined): never {
  throw new Error(`${step}: ${error?.message || "erro desconhecido"}`);
}

/**
 * Cria empresa + administrador para um pedido pago. Idempotente: se o pedido já tem tenant, não repete.
 * Em qualquer falha, desfaz o que criou e marca o pedido como "failed" com o motivo.
 */
export async function provisionOrder(order: OrderRow, deps: Deps): Promise<ProvisionResult> {
  const { admin, now, log } = deps;
  if (order.tenant_id && order.user_id && order.status === "provisioned") {
    return { tenantId: order.tenant_id, userId: order.user_id, tempPassword: order.temp_password ?? "", alreadyProvisioned: true };
  }

  const plan = SERVER_PLANS[order.plan];
  const tempPassword = deps.randomPassword();
  const today = now();
  let userId: string | null = null;
  let tenantId: string | null = null;

  const rollback = async () => {
    try {
      if (tenantId) {
        await admin.from("tenant_memberships").delete().eq("tenant_id", tenantId);
        await admin.from("user_roles").delete().eq("tenant_id", tenantId);
        await admin.from("payment_history").delete().eq("tenant_id", tenantId);
        await admin.from("tenants").delete().eq("id", tenantId);
      }
      if (userId) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    } catch (e) {
      log("rollback falhou", e);
    }
  };

  try {
    // 1. Usuário administrador (e-mail confirmado, senha temporária, troca obrigatória no primeiro login)
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

    // 2. Empresa (ativa, plano pago, vencimento em 1 mês)
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
        status: "active",
        plan: order.plan,
        plan_started_at: today.toISOString(),
        contract_start_date: ymd(today),
        payment_cycle: "monthly",
        next_due_date: ymd(addMonths(today, 1)),
        financial_status: "current",
        auto_block_days: 7,
        max_users: plan.limits.users,
        max_drivers: plan.limits.drivers,
        max_vehicles: plan.limits.vehicles,
        billing_provider: order.mode,
        billing_customer_id: order.provider_customer_id,
        billing_subscription_id: order.provider_subscription_id,
        billing_email: order.email,
      })
      .select("id")
      .single();
    if (tenantErr || !tenant?.id) fail("criar empresa", tenantErr);
    tenantId = tenant.id as string;

    // 3. Perfil, papel e vínculo
    const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, email: order.email, name: order.contact_name, tenant_id: tenantId }, { onConflict: "id" });
    if (profileErr) fail("criar perfil", profileErr);

    const { error: roleErr } = await admin.from("user_roles").upsert({ user_id: userId, role: "admin", tenant_id: tenantId }, { onConflict: "user_id,role" });
    if (roleErr) fail("definir permissão", roleErr);
    await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "viewer");

    const { error: memberErr } = await admin.from("tenant_memberships").upsert({ tenant_id: tenantId, user_id: userId, role: "admin" }, { onConflict: "tenant_id,user_id" });
    if (memberErr) fail("vincular administrador", memberErr);

    // 4. Histórico financeiro
    await admin.from("payment_history").insert({
      tenant_id: tenantId,
      amount: order.amount_cents / 100,
      payment_date: ymd(today),
      due_date: ymd(addMonths(today, 1)),
      cycle: "monthly",
      notes: `Pedido ${order.id.slice(0, 8)} · ${plan.name} · ${order.mode === "stripe" ? "Stripe" : "ambiente de teste"}`,
    });

    // 5. Pedido
    const expires = new Date(today.getTime() + 72 * 3600 * 1000);
    const { error: orderErr } = await admin
      .from("orders")
      .update({
        status: "provisioned",
        tenant_id: tenantId,
        user_id: userId,
        temp_password: tempPassword,
        temp_password_expires_at: expires.toISOString(),
        provisioned_at: today.toISOString(),
        error: null,
        updated_at: today.toISOString(),
      })
      .eq("id", order.id);
    if (orderErr) fail("atualizar pedido", orderErr);

    log(`provisionado: ${order.company_name} (${order.cnpj}) plano ${order.plan} tenant ${tenantId}`);
    return { tenantId, userId, tempPassword, alreadyProvisioned: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("provision falhou:", message);
    await rollback();
    await admin.from("orders").update({ status: "failed", error: message, updated_at: now().toISOString() }).eq("id", order.id);
    throw e;
  }
}
