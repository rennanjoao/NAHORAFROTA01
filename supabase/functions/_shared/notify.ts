import type { Deps, OrderRow } from "./types.ts";
import { SERVER_PLANS } from "./plans.ts";
import { formatCnpj } from "./validation.ts";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export function buildAccessEmail(order: OrderRow, tempPassword: string, env: Deps["env"]) {
  const plan = SERVER_PLANS[order.plan];
  const loginUrl = `${env.SITE_URL.replace(/\/$/, "")}/login`;
  const firstName = order.contact_name.split(" ")[0];
  // Conversão do teste grátis com o mesmo login: sem senha temporária.
  const existing = !!order.existing_user || !tempPassword;
  const conversion = order.kind === "conversion";
  const subject = existing ? `Sua assinatura do Na Hora Frota está ativa · ${plan.name}` : `Seu acesso ao Na Hora Frota está pronto · ${plan.name}`;
  const intro = existing
    ? `Pagamento confirmado. A ${order.company_name} (CNPJ ${formatCnpj(order.cnpj)}) saiu do teste grátis e está ativa no plano ${plan.name}. Entre com o e-mail e a senha que você já usa.`
    : conversion
      ? `Pagamento confirmado. A ${order.company_name} (CNPJ ${formatCnpj(order.cnpj)}) já estava no Na Hora Frota (teste grátis) e agora está ativa no plano ${plan.name}, com você como administrador.`
      : `Pagamento confirmado. A conta da ${order.company_name} (CNPJ ${formatCnpj(order.cnpj)}) está ativa no plano ${plan.name}.`;
  const text = [
    `Olá, ${firstName}.`,
    ``,
    intro,
    ``,
    `Entrar: ${loginUrl}`,
    `Login: ${order.email}`,
    ...(existing ? [`Senha: a mesma que você já usa (esqueceu? use “Esqueci minha senha” na tela de entrada).`] : [`Senha temporária: ${tempPassword}`, ``, `No primeiro acesso você cria a sua senha definitiva.`]),
    ``,
    `Primeiros passos: cadastre motoristas e veículos, importe o XML das notas de hoje e monte o primeiro romaneio.`,
    `O app do motorista instala pelo navegador do celular: ${env.SITE_URL.replace(/\/$/, "")}/install`,
    ``,
    `Dúvidas: ${env.SUPPORT_EMAIL}`,
    `Na Hora Frota · Sempre na hora.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#F2F4F5;font-family:Inter,Segoe UI,Arial,sans-serif;color:#080808">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F4F5;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%">
  <tr><td style="background:#080808;padding:22px 28px;border-radius:4px 4px 0 0">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px">
        <svg width="34" height="20" viewBox="0 0 365 212" aria-hidden="true"><path d="M0,161 L129.22,27.78 A11,11 0 0 1 144.78,27.78 L216.96,99.96 L181.6,135.31 L137,90.71 L70.71,161 Z" fill="#04E8A4"/><path d="M117.64,212 L297.64,32 L203,32 L235,0 L365,0 L365,98 L333,130 L333,67.36 L188.36,212 Z" fill="#04E8A4"/></svg>
      </td>
      <td style="vertical-align:middle;font:700 18px 'Space Grotesk',Arial,sans-serif;color:#fff;letter-spacing:-.01em">Na Hora <span style="color:#04E8A4">Frota</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:32px 28px;border:1px solid #E1E5E8;border-top:0">
    <p style="margin:0;font:600 12px/1 'Space Grotesk',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#0B6B4F">Pagamento confirmado</p>
    <h1 style="margin:12px 0 0;font:700 26px/1.15 'Space Grotesk',Arial,sans-serif;letter-spacing:-.01em">${existing ? `Sua assinatura está ativa, ${esc(firstName)}.` : `Seu acesso está pronto, ${esc(firstName)}.`}</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#3A3F44">${
      existing
        ? `A <strong>${esc(order.company_name)}</strong> (CNPJ ${esc(formatCnpj(order.cnpj))}) saiu do teste grátis e está ativa no plano <strong>${esc(plan.name)}</strong>. Entre com o e-mail e a senha que você já usa.`
        : conversion
          ? `A <strong>${esc(order.company_name)}</strong> (CNPJ ${esc(formatCnpj(order.cnpj))}) já estava no Na Hora Frota (teste grátis) e agora está ativa no plano <strong>${esc(plan.name)}</strong>, com você como administrador. Entre com os dados abaixo e crie a sua senha definitiva no primeiro acesso.`
          : `A conta da <strong>${esc(order.company_name)}</strong> (CNPJ ${esc(formatCnpj(order.cnpj))}) está ativa no plano <strong>${esc(plan.name)}</strong>. Entre com os dados abaixo e crie a sua senha definitiva no primeiro acesso.`
    }</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #E1E5E8;border-radius:4px">
      <tr><td style="padding:14px 16px;${existing ? "" : "border-bottom:1px solid #E1E5E8"}">
        <div style="font:600 11px/1 'Space Grotesk',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6B7177">Login</div>
        <div style="margin-top:6px;font:600 16px 'Space Grotesk',Arial,sans-serif">${esc(order.email)}</div>
      </td></tr>${
        existing
          ? ""
          : `
      <tr><td style="padding:14px 16px">
        <div style="font:600 11px/1 'Space Grotesk',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6B7177">Senha temporária</div>
        <div style="margin-top:6px;font:600 18px 'Space Grotesk',Arial,monospace;letter-spacing:.06em">${esc(tempPassword)}</div>
      </td></tr>`
      }
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#04E8A4;border-radius:4px">
      <a href="${esc(loginUrl)}" style="display:inline-block;padding:14px 22px;font:700 15px 'Space Grotesk',Arial,sans-serif;color:#080808;text-decoration:none">Entrar no painel →</a>
    </td></tr></table>
    <h2 style="margin:30px 0 0;font:700 15px 'Space Grotesk',Arial,sans-serif">Primeiros 10 minutos</h2>
    <ol style="margin:8px 0 0;padding-left:20px;font-size:14px;line-height:1.7;color:#3A3F44">
      <li>${existing ? "Entre com a sua senha de sempre (esqueceu? use “Esqueci minha senha”)." : "Entre e crie a sua senha definitiva."}</li>
      <li>Cadastre motoristas e veículos.</li>
      <li>Importe o XML das notas de hoje e monte o primeiro romaneio.</li>
    </ol>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6B7177">O app do motorista instala pelo navegador do celular: <a href="${esc(env.SITE_URL.replace(/\/$/, ""))}/install" style="color:#0B6B4F">${esc(env.SITE_URL.replace(/\/$/, ""))}/install</a></p>
  </td></tr>
  <tr><td style="padding:18px 28px;font-size:12px;line-height:1.6;color:#6B7177">
    Dúvidas? Responda este e-mail ou escreva para <a href="mailto:${esc(env.SUPPORT_EMAIL)}" style="color:#0B6B4F">${esc(env.SUPPORT_EMAIL)}</a>.<br>
    Na Hora Frota · Sempre na hora.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, text, html, to: order.email };
}

export type EmailResult = { status: "sent" | "failed" | "not_configured"; id?: string; error?: string };

/** Envia o e-mail de acesso pela Resend. Sem chave configurada, não envia (o acesso continua visível na tela de sucesso). */
export async function sendAccessEmail(order: OrderRow, tempPassword: string, deps: Deps): Promise<EmailResult> {
  const { env } = deps;
  const email = buildAccessEmail(order, tempPassword, env);
  let result: EmailResult;
  if (!env.RESEND_API_KEY) {
    result = { status: "not_configured" };
  } else {
    try {
      const res = await deps.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [email.to],
          reply_to: env.SUPPORT_EMAIL,
          subject: email.subject,
          html: email.html,
          text: email.text,
          tags: [{ name: "type", value: order.existing_user ? "subscription_active" : "access" }, { name: "plan", value: order.plan }],
        }),
      });
      const json = await res.json().catch(() => ({}));
      result = res.ok ? { status: "sent", id: json?.id } : { status: "failed", error: json?.message || `Resend respondeu ${res.status}` };
    } catch (e) {
      result = { status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
  await deps.admin
    .from("orders")
    .update({
      access_email_status: result.status,
      access_sent_at: result.status === "sent" ? deps.now().toISOString() : null,
      metadata: { ...(order.metadata || {}), email_id: result.id ?? null, email_error: result.error ?? null },
      updated_at: deps.now().toISOString(),
    })
    .eq("id", order.id);
  deps.log(`e-mail de acesso para ${order.email}: ${result.status}${result.error ? ` (${result.error})` : ""}`);
  return result;
}
