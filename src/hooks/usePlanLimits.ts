import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PlanLimits {
  max_users: number;
  max_drivers: number;
  max_vehicles: number;
  realtime: boolean;
  batch_import: boolean;
  sla_weekly: boolean;
  sla_drilldown: boolean;
  financial_dashboard: boolean;
}

interface PlanPayload {
  tenantId: string | null;
  /** Plano em vigor (no teste gratis = "total"). */
  plan: string;
  /** Plano gravado na empresa (o que sera cobrado). */
  contractedPlan: string;
  isTrial: boolean;
  limits: PlanLimits;
  systemUsersCount: number;
  driversCount: number;
  vehiclesCount: number;
}

const DEFAULT_LIMITS: PlanLimits = {
  max_users: 1,
  max_drivers: 5,
  max_vehicles: 5,
  realtime: false,
  batch_import: false,
  sla_weekly: false,
  sla_drilldown: false,
  financial_dashboard: false,
};

const planLabels: Record<string, string> = {
  basic: 'Básico',
  control: 'Controle',
  total: 'Controle Total',
};

export const PLAN_STATUS_QUERY_KEY = 'plan-status';

/** Recarrega limites e contagens depois de cadastrar/remover usuario, motorista ou veiculo. */
export function invalidatePlanStatus(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [PLAN_STATUS_QUERY_KEY] });
}

async function fetchPlanStatus(): Promise<PlanPayload> {
  const { data, error } = await (supabase as any).rpc('get_current_plan_status');
  if (error) throw error;

  const payload = typeof data === 'string' ? JSON.parse(data) : data;
  const plan = payload?.plan || 'basic';
  return {
    tenantId: payload?.tenant_id ?? null,
    plan,
    contractedPlan: payload?.contracted_plan || plan,
    isTrial: payload?.is_trial === true,
    limits: { ...DEFAULT_LIMITS, ...(payload?.limits || {}) },
    systemUsersCount: payload?.system_users_count || 0,
    driversCount: payload?.drivers_count || 0,
    vehiclesCount: payload?.vehicles_count || 0,
  };
}

export function usePlanLimits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [PLAN_STATUS_QUERY_KEY, user?.id],
    queryFn: fetchPlanStatus,
    enabled: !!user,
    staleTime: 30 * 1000,
    retry: 1,
  });

  if (query.error) console.error('Error checking plan limits:', query.error);

  const data = query.data;
  const limits = data?.limits ?? DEFAULT_LIMITS;
  const systemUsersCount = data?.systemUsersCount ?? 0;
  const driversCount = data?.driversCount ?? 0;
  const vehiclesCount = data?.vehiclesCount ?? 0;

  return {
    plan: data?.plan ?? 'basic',
    contractedPlan: data?.contractedPlan ?? 'basic',
    isTrial: data?.isTrial ?? false,
    limits,
    systemUsersCount,
    driversCount,
    vehiclesCount,
    // Sem dados ainda: nao bloqueia o botao (o banco valida de novo no cadastro).
    canAddUser: !data || limits.max_users === -1 || systemUsersCount < limits.max_users,
    canAddDriver: !data || limits.max_drivers === -1 || driversCount < limits.max_drivers,
    canAddVehicle: !data || limits.max_vehicles === -1 || vehiclesCount < limits.max_vehicles,
    isLoading: !!user && query.isLoading,
    tenantId: data?.tenantId ?? null,
    refresh: () => invalidatePlanStatus(queryClient),
    planLabels,
  };
}
