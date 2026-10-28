import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { onlyDigits } from "../_shared/documents.ts";

// Intervalo minimo entre dois envios para o mesmo motorista.
const RESEND_INTERVAL_MS = 10 * 60 * 1000;

/** Senha inicial gerada pelo cadastro: 6 primeiros digitos do CPF + "Na". */
function initialPasswordFromCpf(cpf: string | null): string | null {
  const digits = onlyDigits(cpf || "");
  return digits.length === 11 ? `${digits.slice(0, 6)}Na` : null;
}

// Envia ao motorista recem-cadastrado um e-mail com os dados de acesso ao app.
// O destinatario e sempre o e-mail de contato gravado no cadastro do motorista
// (drivers.contact_email), nunca um endereco vindo da requisicao.
//
// Segredos necessarios (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY     chave da API do Resend (https://resend.com)
//   RESEND_FROM_EMAIL  remetente verificado, ex.: "NaHora Frota <nao-responda@nahorafrota.tech>"
//   APP_URL            opcional, padrao https://nahorafrota.tech

interface SendCredentialsRequest {
  driver_id: string;
  password?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Configuracao do servidor incompleta" }, 500, jsonHeaders);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized - Token ausente" }, 401, jsonHeaders);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized - Sessao invalida" }, 401, jsonHeaders);
    }

    const callerUserId = claimsData.claims.sub;

    const [{ data: isAdmin }, { data: isFleetManager }, { data: callerTenantId }] = await Promise.all([
      userClient.rpc("has_role", { _user_id: callerUserId, _role: "admin" }),
      userClient.rpc("has_role", { _user_id: callerUserId, _role: "fleet_manager" }),
      userClient.rpc("get_user_tenant_id", { p_user_id: callerUserId }),
    ]);

    if (!isAdmin && !isFleetManager) {
      return jsonResponse({ error: "Apenas administradores e gestores de frota podem enviar o acesso" }, 403, jsonHeaders);
    }

    const body: SendCredentialsRequest = await req.json();
    if (!body.driver_id) {
      return jsonResponse({ error: "driver_id obrigatorio" }, 400, jsonHeaders);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: driver, error: driverError } = await adminClient
      .from("drivers")
      .select("id, name, email, contact_email, tenant_id, vehicle_plate, vehicle_type, cpf, user_id, credentials_email_sent_at")
      .eq("id", body.driver_id)
      .maybeSingle();

    if (driverError || !driver) {
      return jsonResponse({ error: "Motorista nao encontrado" }, 404, jsonHeaders);
    }

    if (!driver.tenant_id || driver.tenant_id !== callerTenantId) {
      return jsonResponse({ error: "Motorista nao pertence a sua empresa" }, 403, jsonHeaders);
    }

    const { data: tenantHasAccess } = await adminClient.rpc("tenant_has_access", { p_tenant_id: driver.tenant_id });
    if (tenantHasAccess !== true) {
      return jsonResponse({ error: "Empresa sem acesso ativo ao sistema" }, 403, jsonHeaders);
    }

    const lastSentAt = driver.credentials_email_sent_at ? new Date(driver.credentials_email_sent_at).getTime() : 0;
    if (Date.now() - lastSentAt < RESEND_INTERVAL_MS) {
      return jsonResponse({ sent: false, reason: "rate_limited" }, 200, jsonHeaders);
    }

    const recipient = String(driver.contact_email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return jsonResponse({ sent: false, reason: "no_contact_email" }, 200, jsonHeaders);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!resendApiKey || !fromEmail) {
      console.warn("send-driver-credentials: RESEND_API_KEY/RESEND_FROM_EMAIL nao configurados");
      return jsonResponse({ sent: false, reason: "email_not_configured" }, 200, jsonHeaders);
    }

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("razao_social")
      .eq("id", driver.tenant_id)
      .maybeSingle();

    const appUrl = (Deno.env.get("APP_URL") || "https://nahorafrota.tech").replace(/\/$/, "");
    const companyName = tenant?.razao_social || "sua transportadora";
    const driverName = driver.name || "Motorista";
    // So envia login/senha se o motorista tem acesso ao app, e a senha so vai se
    // for a senha inicial do cadastro (nunca texto livre vindo da requisicao).
    const login = driver.user_id ? driver.email || "" : "";
    const initialPassword = initialPasswordFromCpf(driver.cpf);
    const password = login && initialPassword && body.password === initialPassword ? initialPassword : "";
    const vehicle = [driver.vehicle_type, driver.vehicle_plate].filter(Boolean).join(" • ");

    const rows: Array<[string, string]> = [
      ["Empresa", companyName],
      ...(login ? [["Login (e-mail)", login] as [string, string]] : []),
      ...(password ? [["Senha inicial", password] as [string, string]] : []),
      ...(vehicle ? [["Veículo", vehicle] as [string, string]] : []),
    ];

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 12px">Olá, ${escapeHtml(driverName)}!</h2>
        <p>Seu cadastro como motorista na <strong>${escapeHtml(companyName)}</strong> foi concluído no NaHora Frota.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          ${rows
            .map(
              ([label, value]) =>
                `<tr><td style="padding:8px;border:1px solid #e5e7eb;color:#555">${escapeHtml(label)}</td>` +
                `<td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">${escapeHtml(value)}</td></tr>`,
            )
            .join("")}
        </table>
        <p>${login ? "Para começar, abra o app no celular e faça login:" : "Quando o seu acesso ao app for liberado, use o link abaixo para instalar:"}</p>
        <p><a href="${appUrl}/install" style="display:inline-block;background:#f97316;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Instalar o app do motorista</a></p>
        <p style="color:#555;font-size:13px">Por segurança, não compartilhe sua senha. Em caso de dúvida, fale com o responsável pela frota.</p>
      </div>`;

    const text = [
      `Olá, ${driverName}!`,
      `Seu cadastro como motorista na ${companyName} foi concluído no NaHora Frota.`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      `Instale o app: ${appUrl}/install`,
    ].join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject: `Seu acesso ao app NaHora Frota - ${companyName}`,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, detail);
      return jsonResponse({ sent: false, reason: "provider_error" }, 502, jsonHeaders);
    }

    await adminClient
      .from("drivers")
      .update({ credentials_email_sent_at: new Date().toISOString() })
      .eq("id", driver.id);

    console.log(`Driver credentials sent: driver=${driver.id} tenant=${driver.tenant_id}`);
    return jsonResponse({ sent: true, recipient }, 200, jsonHeaders);
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500, jsonHeaders);
  }
});
