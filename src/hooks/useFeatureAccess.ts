import { usePlanLimits } from './usePlanLimits';
import { usePlatformAdmin } from './usePlatformAdmin';

export type Feature =
  | 'sla_weekly'
  | 'sla_drilldown'
  | 'sla_evolution'
  | 'realtime_dashboard'
  | 'batch_import'
  | 'financial_dashboard'
  | 'financial_reports'
  | 'reports';

interface FeatureRule {
  /** Which plan limit boolean gates this feature */
  limitKey?: keyof Pick<ReturnType<typeof usePlanLimits>['limits'],
    'realtime' | 'batch_import' | 'sla_weekly' | 'sla_drilldown' | 'financial_dashboard'>;
  /** Minimum plan that unlocks this feature */
  minPlan: 'basic' | 'control' | 'total';
  /** Human-readable label for the plan that unlocks it */
  upgradePlanLabel: string;
}

const FEATURE_RULES: Record<Feature, FeatureRule> = {
  sla_weekly: { limitKey: 'sla_weekly', minPlan: 'control', upgradePlanLabel: 'Controle' },
  sla_drilldown: { limitKey: 'sla_drilldown', minPlan: 'total', upgradePlanLabel: 'Controle Total' },
  sla_evolution: { minPlan: 'control', upgradePlanLabel: 'Controle' },
  realtime_dashboard: { limitKey: 'realtime', minPlan: 'control', upgradePlanLabel: 'Controle' },
  batch_import: { limitKey: 'batch_import', minPlan: 'control', upgradePlanLabel: 'Controle' },
  financial_dashboard: { limitKey: 'financial_dashboard', minPlan: 'total', upgradePlanLabel: 'Controle Total' },
  financial_reports: { limitKey: 'financial_dashboard', minPlan: 'total', upgradePlanLabel: 'Controle Total' },
  reports: { minPlan: 'control', upgradePlanLabel: 'Controle' },
};

const PLAN_HIERARCHY: Record<string, number> = { basic: 0, control: 1, total: 2 };

export function useFeatureAccess() {
  const planStatus = usePlanLimits();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { plan, limits, isLoading } = planStatus;

  function checkFeatureAccess(feature: Feature): { allowed: boolean; upgradePlanLabel: string } {
    if (isLoading) return { allowed: true, upgradePlanLabel: '' };
    
    // Platform admins always have full access
    if (isPlatformAdmin) return { allowed: true, upgradePlanLabel: '' };

    const rule = FEATURE_RULES[feature];
    if (!rule) return { allowed: true, upgradePlanLabel: '' };

    // Check by limit key if available
    if (rule.limitKey && limits[rule.limitKey] === false) {
      return { allowed: false, upgradePlanLabel: rule.upgradePlanLabel };
    }

    // Check by plan hierarchy
    const userLevel = PLAN_HIERARCHY[plan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[rule.minPlan] ?? 0;
    if (userLevel < requiredLevel) {
      return { allowed: false, upgradePlanLabel: rule.upgradePlanLabel };
    }

    return { allowed: true, upgradePlanLabel: '' };
  }

  return { checkFeatureAccess, plan, isLoading, ...planStatus };
}
