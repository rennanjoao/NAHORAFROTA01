import { useState, useEffect, useCallback } from 'react';
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

interface PlanStatus {
  plan: string;
  limits: PlanLimits;
  systemUsersCount: number;
  driversCount: number;
  vehiclesCount: number;
  canAddUser: boolean;
  canAddDriver: boolean;
  canAddVehicle: boolean;
  isLoading: boolean;
  tenantId: string | null;
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

export function usePlanLimits() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PlanStatus>({
    plan: 'basic',
    limits: DEFAULT_LIMITS,
    systemUsersCount: 0,
    driversCount: 0,
    vehiclesCount: 0,
    canAddUser: true,
    canAddDriver: true,
    canAddVehicle: true,
    isLoading: true,
    tenantId: null,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isLoading: true }));

      const { data, error: statusError } = await (supabase as any).rpc('get_current_plan_status');

      if (statusError) {
        throw statusError;
      }

      const payload = typeof data === 'string' ? JSON.parse(data) : data;
      const tenantId = payload?.tenant_id ?? null;
      const plan = payload?.plan || 'basic';
      const limits: PlanLimits = payload?.limits || DEFAULT_LIMITS;
      const systemUsersCount = payload?.system_users_count || 0;
      const driversCount = payload?.drivers_count || 0;
      const vehiclesCount = payload?.vehicles_count || 0;

      const canAddUser = limits.max_users === -1 || systemUsersCount < limits.max_users;
      const canAddDriver = limits.max_drivers === -1 || driversCount < limits.max_drivers;
      const canAddVehicle = limits.max_vehicles === -1 || vehiclesCount < limits.max_vehicles;

      setStatus({
        plan,
        limits,
        systemUsersCount,
        driversCount,
        vehiclesCount,
        canAddUser,
        canAddDriver,
        canAddVehicle,
        isLoading: false,
        tenantId,
      });
    } catch (err) {
      console.error('Error checking plan limits:', err);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, refresh, planLabels };
}
