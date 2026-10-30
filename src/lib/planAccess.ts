/**
 * Regras de acesso por plano (puras, sem React), usadas por useFeatureAccess e testadas
 * em planAccess.test.ts contra a planilha de planos.
 */
export interface PlanFlags {
  realtime: boolean;
  batch_import: boolean;
  sla_weekly: boolean;
  sla_drilldown: boolean;
  financial_dashboard: boolean;
}

export type Feature =
  | 'sla_weekly'
  | 'sla_drilldown'
  | 'sla_evolution'
  | 'realtime_dashboard'
  | 'batch_import'
  | 'financial_dashboard'
  | 'financial_reports'
  | 'settlement'
  | 'reports'
  | 'reports_performance'
  | 'reports_export';

interface FeatureRule {
  /** Which plan limit boolean gates this feature */
  limitKey?: keyof PlanFlags;
  /** Minimum plan that unlocks this feature */
  minPlan: 'basic' | 'control' | 'total';
  /** Human-readable label for the plan that unlocks it */
  upgradePlanLabel: string;
}

/*
 * Planilha de planos (29/10/2026). Ids internos: basic = Basic, control = Standard,
 * total = Premium.
 *  - Todos: painel do dia, XML, acerto em lote, relatorio de uso da frota.
 *  - Standard: SLA em tempo real, receita/custo/eficiencia do frete, mapa, desempenho.
 *  - Premium: SLA por motorista, rentabilidade, exportar relatorios.
 */
export const FEATURE_RULES: Record<Feature, FeatureRule> = {
  sla_weekly: { limitKey: 'sla_weekly', minPlan: 'control', upgradePlanLabel: 'Standard' },
  sla_drilldown: { limitKey: 'sla_drilldown', minPlan: 'total', upgradePlanLabel: 'Premium' },
  sla_evolution: { minPlan: 'control', upgradePlanLabel: 'Standard' },
  realtime_dashboard: { limitKey: 'realtime', minPlan: 'control', upgradePlanLabel: 'Standard' },
  batch_import: { minPlan: 'basic', upgradePlanLabel: 'Basic' },
  // Receita, custo do frete de terceiros e eficiencia no painel.
  financial_dashboard: { limitKey: 'financial_dashboard', minPlan: 'control', upgradePlanLabel: 'Standard' },
  // Rentabilidade (relatorio financeiro).
  financial_reports: { minPlan: 'total', upgradePlanLabel: 'Premium' },
  // Acerto financeiro em lote: todos os planos.
  settlement: { minPlan: 'basic', upgradePlanLabel: 'Basic' },
  // Relatorios: uso da frota em todos; desempenho/eficiencia no Standard; exportar no Premium.
  reports: { minPlan: 'basic', upgradePlanLabel: 'Basic' },
  reports_performance: { minPlan: 'control', upgradePlanLabel: 'Standard' },
  reports_export: { minPlan: 'total', upgradePlanLabel: 'Premium' },
};

export const PLAN_HIERARCHY: Record<string, number> = { basic: 0, control: 1, total: 2 };

export function evaluateFeatureAccess(feature: Feature, plan: string, limits: Partial<PlanFlags>): { allowed: boolean; upgradePlanLabel: string } {
  const rule = FEATURE_RULES[feature];
  if (!rule) return { allowed: true, upgradePlanLabel: '' };
  // Interruptor do plano vindo do banco (get_plan_limits)
  if (rule.limitKey && limits[rule.limitKey] === false) {
    return { allowed: false, upgradePlanLabel: rule.upgradePlanLabel };
  }
  // Plano minimo
  const userLevel = PLAN_HIERARCHY[plan] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[rule.minPlan] ?? 0;
  if (userLevel < requiredLevel) {
    return { allowed: false, upgradePlanLabel: rule.upgradePlanLabel };
  }
  return { allowed: true, upgradePlanLabel: '' };
}
