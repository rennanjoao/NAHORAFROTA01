import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { NAV_GROUPS, NAV_ITEMS, findNavItem, type NavItem } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useIsPlatformAdmin } from "@/hooks/usePlatformAdmin";

// Ultimas telas do plano liberadas neste aparelho: enquanto o plano carrega, o menu
// mostra o mesmo de antes (o grupo Financeiro nao "pula" para dentro depois).
const PLAN_CACHE_KEY = "nhf-nav-plan-paths";

const readPlanCache = (): string[] | null => {
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};

/** Telas que o usuario pode abrir (papel + plano), ja agrupadas para o menu. */
export function useNavigation() {
  const { isAdmin } = useAuth();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const { checkFeatureAccess, isLoading: planLoading } = useFeatureAccess();
  const location = useLocation();
  const admin = isAdmin();

  const items = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.adminOnly && !admin) return false;
        if (item.platformAdminOnly && !isPlatformAdmin) return false;
        if (item.feature) {
          if (planLoading) return readPlanCache()?.includes(item.path) ?? false;
          return checkFeatureAccess(item.feature).allowed;
        }
        return true;
      }),
    [admin, isPlatformAdmin, planLoading, checkFeatureAccess],
  );

  useEffect(() => {
    if (planLoading) return;
    try {
      localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(items.filter((item) => item.feature).map((item) => item.path)));
    } catch {
      // sem armazenamento: so perde o atalho visual
    }
  }, [items, planLoading]);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.group === group.id) })).filter(
        (group) => group.items.length > 0,
      ),
    [items],
  );

  const current: NavItem | undefined = findNavItem(location.pathname);
  const currentGroup = current ? NAV_GROUPS.find((group) => group.id === current.group) : undefined;

  const isActive = (item: NavItem) => current?.path === item.path;

  return { items, groups, current, currentGroup, isActive };
}
