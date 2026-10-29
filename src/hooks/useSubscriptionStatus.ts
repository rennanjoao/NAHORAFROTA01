import { useTenantAccess } from "@/hooks/useTenantAccess";
import { getSubscriptionStatus, type SubscriptionStatus } from "@/lib/billingStatus";

export type { SubscriptionStatus };

export function useSubscriptionStatus() {
  const { access, isLoading, error } = useTenantAccess();

  if (isLoading) return { status: "loading" as const, daysRemaining: 0, isLoading: true, access: null };

  // Se a RPC falhar (ex.: migration ainda nao aplicada), nao bloqueia a interface;
  // o banco continua sendo a barreira real de acesso.
  if (error) return { status: "no_date" as const, daysRemaining: 999, isLoading: false, access: null };

  const { status, daysRemaining } = getSubscriptionStatus(access);
  return { status, daysRemaining, isLoading: false, access };
}
