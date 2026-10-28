import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { SubscriptionBlockScreen, type BlockReason } from "@/components/auth/SubscriptionBlockScreen";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "fleet_manager" | "dispatcher" | "viewer";
  allowDrivers?: boolean; // Flag to allow drivers on specific routes (like /tracker)
}

// Routes that drivers should NEVER access (admin/dashboard routes)
const ADMIN_ROUTES = [
  "/",
  "/drivers",
  "/routes",
  "/vehicles",
  "/seguradoras",
  "/reports",
  "/deliveries",
  "/settlement",
  "/admin",
  "/settings",
  "/master",
];

const DRIVER_EMAIL_DOMAIN = "@driver.nahorafrota.app";

// Situacoes em que a empresa perde o acesso ao sistema.
const BLOCKING_STATUSES: readonly string[] = ["expired", "trial_expired", "blocked", "pending"];
// No app do motorista so bloqueia o que o banco tambem bloqueia: fatura vencida
// (bloqueio apenas de tela no painel) nao tira o motorista da rota.
const DRIVER_BLOCKING_STATUSES: readonly string[] = ["trial_expired", "blocked", "pending"];

// Helper function to check if email follows the driver pattern
const isDriverEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(DRIVER_EMAIL_DOMAIN);
};

export function ProtectedRoute({ children, requiredRole, allowDrivers = false }: ProtectedRouteProps) {
  const { session, user, loading, rolesLoading, roles, hasRole, isAdmin } = useAuth();
  const location = useLocation();
  const { status: subscriptionStatus, isLoading: subLoading, access } = useSubscriptionStatus();
  const isBlockedBySubscription =
    !subLoading && !access?.is_platform_admin && BLOCKING_STATUSES.includes(subscriptionStatus);
  const isDriverBlockedBySubscription =
    !subLoading && !access?.is_platform_admin && DRIVER_BLOCKING_STATUSES.includes(subscriptionStatus);

  // Get email from authenticated user
  const userEmail = user?.email;
  const hasDriverEmail = isDriverEmail(userEmail);

  // CRITICAL: Check if current path is an admin route
  const isAdminRoute = ADMIN_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(route + "/")
  );

  // Check if current path is the tracker route
  const isTrackerRoute = location.pathname === "/tracker" || location.pathname.startsWith("/tracker/");

  // PHASE 1: Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // PHASE 2: Redirect to login if not authenticated
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // PHASE 3: Wait for roles to load before making access decisions
  if (rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <ShieldAlert className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // PHASE 4: CRITICAL - Check driver email FIRST before any role checks
  // Driver emails should ONLY access /tracker regardless of any roles they have
  if (hasDriverEmail) {
    if (isAdminRoute) {
      console.log("[SECURITY] Driver email detected, blocking admin route access:", userEmail);
      return <Navigate to="/tracker" replace />;
    }
    // Driver accessing tracker - allowed while the company has access
    if (isTrackerRoute) {
      if (isDriverBlockedBySubscription) {
        return <SubscriptionBlockScreen reason={subscriptionStatus as BlockReason} forDriver />;
      }
      return <>{children}</>;
    }
    // Driver accessing unknown route - redirect to tracker
    console.log("[SECURITY] Driver email on unknown route, redirecting to tracker:", userEmail);
    return <Navigate to="/tracker" replace />;
  }

  if (isTrackerRoute) {
    console.log("[SECURITY] Non-driver email blocked from tracker:", userEmail);
    return <Navigate to="/" replace />;
  }

  // PHASE 5: Check user roles - admin/fleet_manager/dispatcher/viewer have full access
  const hasAdminRole = roles.includes("admin");
  const hasOperationalRole = roles.some(r => 
    r === "admin" || r === "fleet_manager" || r === "dispatcher" || r === "viewer"
  );

  // PHASE 6: If user has operational roles, they can access admin routes
  if (hasOperationalRole && isAdminRoute) {
    // Check specific role requirement if specified
    if (requiredRole && !hasRole(requiredRole) && !hasAdminRole) {
      return <Navigate to="/" replace />;
    }
    
    // SUBSCRIPTION CHECK: block when the trial ended, the subscription expired or the
    // company was blocked (skip for /master route and platform admins)
    if (location.pathname !== "/master" && isBlockedBySubscription) {
      return <SubscriptionBlockScreen reason={subscriptionStatus as BlockReason} />;
    }
    
    // User has proper roles, allow access
    return <>{children}</>;
  }

  // PHASE 7: If user has operational roles but is on tracker route
  if (hasOperationalRole && isTrackerRoute && !allowDrivers) {
    console.log("[SECURITY] Operational user attempting tracker access, redirecting to home");
    return <Navigate to="/" replace />;
  }

  // PHASE 8: Non-driver emails without operational roles cannot access admin routes
  // If user IS authenticated but has no roles, show a "configuring" state instead of redirect loop
  if (isAdminRoute && !hasOperationalRole) {
    console.log("[SECURITY] User without operational roles attempting admin access:", userEmail);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Configurando seu acesso...</h2>
          <p className="text-muted-foreground">
            Sua conta está sendo preparada. Se o problema persistir, entre em contato com o administrador.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-sm text-primary hover:underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // PHASE 9: Check specific role requirement if specified
  if (requiredRole && !hasRole(requiredRole) && !hasAdminRole) {
    return <Navigate to="/" replace />;
  }

  // PHASE 10: All security checks passed - render children
  return <>{children}</>;
}
