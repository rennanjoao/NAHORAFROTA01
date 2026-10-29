import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedLoader } from "@/components/auth/BrandedLoader";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { SubscriptionBlockScreen, type BlockReason } from "@/components/auth/SubscriptionBlockScreen";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "fleet_manager" | "dispatcher" | "viewer";
  allowDrivers?: boolean; // Flag to allow drivers on specific routes (like /tracker)
}

// Routes that drivers should NEVER access (admin/dashboard routes)
const ADMIN_ROUTES = [
  "/dashboard",
  "/drivers",
  "/routes",
  "/vehicles",
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
    return <BrandedLoader label="Abrindo o Na Hora Frota" />;
  }

  // PHASE 2: Redirect to login if not authenticated
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // PHASE 2.5: contas criadas pelo checkout entram com senha temporaria e precisam
  // trocar antes de qualquer tela (a flag some quando a pessoa salva a senha nova).
  if (user?.user_metadata?.must_change_password && location.pathname !== "/primeiro-acesso") {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  // PHASE 3: Wait for roles to load before making access decisions
  if (rolesLoading) {
    return <BrandedLoader label="Conferindo seu acesso" />;
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
    return <Navigate to="/dashboard" replace />;
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
      return <Navigate to="/dashboard" replace />;
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
    return <Navigate to="/dashboard" replace />;
  }

  // PHASE 8: Non-driver emails without operational roles cannot access admin routes
  // If user IS authenticated but has no roles, show a "configuring" state instead of redirect loop
  if (isAdminRoute && !hasOperationalRole) {
    console.log("[SECURITY] User without operational roles attempting admin access:", userEmail);
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
        <div role="status" className="w-full max-w-md animate-fade-in rounded-2xl border bg-card p-6 text-center shadow-lg sm:p-8">
          <span
            aria-hidden="true"
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"
          >
            <UserCog className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-semibold text-foreground">Estamos preparando seu acesso</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            Sua conta ainda não tem uma função liberada. Tente de novo daqui a pouco. Se continuar assim, peça ao
            administrador da sua empresa para liberar o seu acesso.
          </p>
          <Button onClick={() => window.location.reload()} size="lg" className="mt-6 w-full sm:w-auto">
            <RefreshCw aria-hidden="true" />
            Tentar de novo
          </Button>
        </div>
      </main>
    );
  }

  // PHASE 9: Check specific role requirement if specified
  if (requiredRole && !hasRole(requiredRole) && !hasAdminRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // PHASE 10: All security checks passed - render children
  return <>{children}</>;
}
