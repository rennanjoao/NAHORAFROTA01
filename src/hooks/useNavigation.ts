import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { NAV_GROUPS, NAV_ITEMS, findNavItem, type NavItem } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useIsPlatformAdmin } from "@/hooks/usePlatformAdmin";

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
          if (planLoading) return false;
          return checkFeatureAccess(item.feature).allowed;
        }
        return true;
      }),
    [admin, isPlatformAdmin, planLoading, checkFeatureAccess],
  );

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
