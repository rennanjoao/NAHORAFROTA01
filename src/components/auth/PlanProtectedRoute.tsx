import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Feature, useFeatureAccess } from "@/hooks/useFeatureAccess";

interface PlanProtectedRouteProps {
  feature: Feature;
  children: React.ReactNode;
}

export function PlanProtectedRoute({ feature, children }: PlanProtectedRouteProps) {
  const { checkFeatureAccess, isLoading } = useFeatureAccess();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  const access = checkFeatureAccess(feature);

  if (!access.allowed) {
    return <Navigate to="/upgrade" replace />;
  }

  return <>{children}</>;
}
