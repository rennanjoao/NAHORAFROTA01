import type { Tone } from "@/components/patterns";
import type { TenantData } from "@/hooks/usePlatformAdmin";
import { isTrialExpired } from "@/lib/billingStatus";

/** Situacao da empresa na plataforma (texto + cor com significado). */
export const TENANT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Ativa", tone: "success" },
  inactive: { label: "Aguardando liberação", tone: "warning" },
  blocked: { label: "Bloqueada", tone: "danger" },
  trial: { label: "Em teste", tone: "info" },
  trial_expired: { label: "Teste expirado", tone: "warning" },
};

/** Nomes dos planos como o cliente ve (mesmos de usePlanLimits). */
export const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "control", label: "Standard" },
  { value: "total", label: "Premium" },
];

export const planLabel = (plan: string) => PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? plan;

export function tenantStatusKey(tenant: TenantData) {
  return isTrialExpired(tenant) ? "trial_expired" : tenant.status;
}

export function tenantStatus(tenant: TenantData) {
  return TENANT_STATUS[tenantStatusKey(tenant)] || TENANT_STATUS.inactive;
}
