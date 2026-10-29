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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const access = checkFeatureAccess(feature);

  if (!access.allowed) {
    return <Navigate to="/upgrade" replace />;
  }

  return <>{children}</>;
}
