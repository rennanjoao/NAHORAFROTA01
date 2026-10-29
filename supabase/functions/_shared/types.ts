import type { PlanId } from "./plans.ts";

export type OrderStatus = "pending" | "paid" | "provisioned" | "failed" | "canceled";
export type CheckoutMode = "stripe" | "sandbox";
export type AccessEmailStatus = "sent" | "pending" | "failed" | "not_configured";

export interface OrderRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: OrderStatus;
  mode: CheckoutMode;
  plan: PlanId;
  amount_cents: number;
  currency: string;
  company_name: string;
  cnpj: string;
  contact_name: string;
  email: string;
  whatsapp: string | null;
  access_token_hash: string;
  provider_session_id: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_event_id: string | null;
  tenant_id: string | null;
  user_id: string | null;
  temp_password: string | null;
  temp_password_expires_at: string | null;
  access_email_status: AccessEmailStatus;
  access_sent_at: string | null;
  paid_at: string | null;
  provisioned_at: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface Env {
  SITE_URL: string;
  CHECKOUT_MODE: "stripe" | "sandbox";
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
  SUPPORT_EMAIL: string;
  ENVIRONMENT?: string;
}

/** Cliente admin do Supabase (service role). Tipado de forma solta para permitir o fake dos testes. */
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

export interface Deps {
  env: Env;
  admin: AdminClient;
  fetch: typeof fetch;
  now: () => Date;
  randomPassword: () => string;
  randomToken: () => string;
  log: (...args: unknown[]) => void;
}
