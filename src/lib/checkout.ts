import type { PlanId } from "@/config/plans";

/**
 * Cliente das funções de checkout (Supabase Edge Functions).
 * Em desenvolvimento, VITE_FUNCTIONS_URL pode apontar para o servidor local (scripts/dev-backend).
 */
const FUNCTIONS_URL: string =
  (import.meta.env.VITE_FUNCTIONS_URL as string | undefined) || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type OrderStatus = "pending" | "paid" | "provisioned" | "failed" | "canceled";
export type AccessEmailStatus = "sent" | "pending" | "failed" | "not_configured";

export interface CheckoutInput {
  plan: PlanId;
  company_name: string;
  cnpj: string;
  contact_name: string;
  email: string;
  whatsapp: string;
}

export interface CheckoutSession {
  order_id: string;
  access_token: string;
  checkout_url: string;
  mode: "stripe" | "sandbox";
}

export interface OrderPublic {
  id: string;
  status: OrderStatus;
  mode: "stripe" | "sandbox";
  plan: PlanId;
  amount_cents: number;
  company_name: string;
  contact_name: string;
  email: string;
  whatsapp: string | null;
  temp_password: string | null;
  login_url: string;
  access_email_status: AccessEmailStatus;
  access_sent_at: string | null;
  error: string | null;
  created_at: string;
}

export class CheckoutError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(name: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CheckoutError("Não conseguimos falar com o servidor. Verifique a conexão e tente de novo.", 0);
  }
  let data: { error?: string; code?: string } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new CheckoutError(data?.error || "Algo deu errado. Tente de novo em instantes.", res.status, data?.code);
  }
  return data as T;
}

export function createCheckout(input: CheckoutInput) {
  return call<CheckoutSession>("create-checkout", input);
}

export function getOrder(order_id: string, access_token: string) {
  return call<OrderPublic>("get-order", { order_id, access_token });
}

export function confirmSandboxPayment(order_id: string, access_token: string, outcome: "approved" | "declined") {
  return call<{ ok: boolean; status: OrderStatus }>("confirm-sandbox-payment", { order_id, access_token, outcome });
}

const KEY = "nhf:checkout:last";

export function rememberOrder(session: { order_id: string; access_token: string }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* sem storage: a URL de sucesso carrega os dados */
  }
}

export function recallOrder(): { order_id: string; access_token: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function buildWhatsAppLink(phoneDigits: string, text: string) {
  const digits = phoneDigits.replace(/\D/g, "");
  const intl = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Pedido como o Painel Master enxerga (RLS: só admin da plataforma). */
export interface OrderAdminRow {
  id: string;
  created_at: string;
  status: OrderStatus;
  mode: "stripe" | "sandbox";
  plan: PlanId;
  amount_cents: number;
  company_name: string;
  cnpj: string;
  contact_name: string;
  email: string;
  whatsapp: string | null;
  access_email_status: AccessEmailStatus;
  access_sent_at: string | null;
  tenant_id: string | null;
  error: string | null;
}

/** Reenvia o acesso (nova senha temporária + e-mail). Exige sessão de admin da plataforma. */
export async function resendAccess(orderId: string, sessionToken: string) {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/resend-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch {
    throw new CheckoutError("Não conseguimos falar com o servidor.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new CheckoutError(data?.error || "Não foi possível reenviar.", res.status);
  return data as { ok: boolean; email_status: AccessEmailStatus; temp_password: string };
}
