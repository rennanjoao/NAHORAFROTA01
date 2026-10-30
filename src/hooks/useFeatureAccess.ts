import { usePlanLimits } from './usePlanLimits';
import { useIsPlatformAdmin } from './usePlatformAdmin';
import { evaluateFeatureAccess, type Feature } from '@/lib/planAccess';

export type { Feature } from '@/lib/planAccess';

export function useFeatureAccess() {
  const planStatus = usePlanLimits();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const { plan, limits, isLoading } = planStatus;

  function checkFeatureAccess(feature: Feature): { allowed: boolean; upgradePlanLabel: string } {
    if (isLoading) return { allowed: true, upgradePlanLabel: '' };
    // Platform admins always have full access
    if (isPlatformAdmin) return { allowed: true, upgradePlanLabel: '' };
    return evaluateFeatureAccess(feature, plan, limits);
  }

  return { checkFeatureAccess, plan, isLoading, ...planStatus };
}
