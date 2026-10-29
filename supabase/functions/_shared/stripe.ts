import { hmacSha256Hex, timingSafeEqual } from "./crypto.ts";

const STRIPE_API = "https://api.stripe.com/v1";

function encodeForm(obj: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export interface StripeCheckoutInput {
  secretKey: string;
  orderId: string;
  planName: string;
  amountCents: number;
  email: string;
  cnpj: string;
  companyName: string;
  successUrl: string;
  cancelUrl: string;
}

/** Cria uma Checkout Session de assinatura mensal. Usa a API REST direto (sem SDK). */
export async function createStripeCheckoutSession(input: StripeCheckoutInput, fetchFn: typeof fetch): Promise<{ id: string; url: string }> {
  const body = encodeForm({
    mode: "subscription",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": input.amountCents,
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `Na Hora Frota · Plano ${input.planName}`,
    "line_items[0][price_data][product_data][description]": `Assinatura mensal · ${input.companyName}`,
    customer_email: input.email,
    client_reference_id: input.orderId,
    "metadata[order_id]": input.orderId,
    "metadata[cnpj]": input.cnpj,
    "subscription_data[metadata][order_id]": input.orderId,
    "subscription_data[metadata][cnpj]": input.cnpj,
    "subscription_data[description]": `Na Hora Frota · ${input.planName} · ${input.companyName}`,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    locale: "pt-BR",
    billing_address_collection: "auto",
    allow_promotion_codes: true,
  });
  const res = await fetchFn(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout-${input.orderId}`,
    },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json?.url) {
    throw new Error(json?.error?.message || `Stripe respondeu ${res.status}`);
  }
  return { id: json.id, url: json.url };
}

/**
 * Verifica a assinatura do webhook (cabeçalho Stripe-Signature: t=...,v1=...).
 * Mesmo esquema do SDK oficial: HMAC-SHA256 de "t.payload" com o segredo do endpoint.
 */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec: number, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  const signatures = header
    .split(",")
    .map((kv) => kv.trim())
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  if (!t || signatures.length === 0) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  return signatures.some((s) => timingSafeEqual(s, expected));
}

/** Monta um cabeçalho Stripe-Signature válido (usado nos testes). */
export async function signStripePayload(payload: string, secret: string, tSec: number): Promise<string> {
  const v1 = await hmacSha256Hex(secret, `${tSec}.${payload}`);
  return `t=${tSec},v1=${v1}`;
}

export async function stripeGet(path: string, secretKey: string, fetchFn: typeof fetch): Promise<Record<string, unknown>> {
  const res = await fetchFn(`${STRIPE_API}${path}`, { headers: { Authorization: `Bearer ${secretKey}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Stripe respondeu ${res.status}`);
  return json;
}
