import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LogisticsProvider } from "@/contexts/LogisticsContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlanProtectedRoute } from "@/components/auth/PlanProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Todas as páginas carregam sob demanda: o visitante do site não baixa o painel, e o painel não baixa o site.
const Index = lazy(() => import("./pages/Index"));
const DriversPage = lazy(() => import("./pages/DriversPage"));
const RoutesPage = lazy(() => import("./pages/RoutesPage"));
const VehiclesPage = lazy(() => import("./pages/VehiclesPage"));
const SeguradoresPage = lazy(() => import("./pages/SeguradoresPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const DeliveriesPage = lazy(() => import("./pages/DeliveriesPage"));
const SettlementPage = lazy(() => import("./pages/SettlementPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TrackerPage = lazy(() => import("./pages/TrackerPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const MasterAdminPage = lazy(() => import("./pages/MasterAdminPage"));
const UpgradeRequiredPage = lazy(() => import("./pages/UpgradeRequiredPage"));
const PrimeiroAcessoPage = lazy(() => import("./pages/PrimeiroAcessoPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LandingPage = lazy(() => import("./site/pages/LandingPage"));
const CheckoutPage = lazy(() => import("./site/pages/CheckoutPage"));
const CheckoutSandboxPage = lazy(() => import("./site/pages/CheckoutSandboxPage"));
const CheckoutSuccessPage = lazy(() => import("./site/pages/CheckoutSuccessPage"));
const LegalPage = lazy(() => import("./site/pages/LegalPage"));

const queryClient = new QueryClient();

function SiteFallback() {
  return <div className="min-h-screen bg-background" aria-busy="true" />;
}

/** "/" mostra o site para visitantes e o painel para quem já está logado. */
function HomeGate() {
  const { session, loading } = useAuth();
  if (loading) return <SiteFallback />;
  if (session) {
    return (
      <ProtectedRoute>
        <Index />
      </ProtectedRoute>
    );
  }
  return (
    <Suspense fallback={<SiteFallback />}>
      <LandingPage />
    </Suspense>
  );
}

const Site = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<SiteFallback />}>{children}</Suspense>;

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="nhf-theme" disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LogisticsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary fallbackMessage="Erro ao carregar o sistema">
                <Suspense fallback={<SiteFallback />}>
                <Routes>
                  {/* Site público */}
                  <Route path="/" element={<HomeGate />} />
                  <Route path="/site" element={<Site><LandingPage /></Site>} />
                  <Route path="/comprar/sucesso" element={<Site><CheckoutSuccessPage /></Site>} />
                  <Route path="/comprar/:planId" element={<Site><CheckoutPage /></Site>} />
                  <Route path="/checkout/sandbox/:orderId" element={<Site><CheckoutSandboxPage /></Site>} />
                  <Route path="/termos" element={<Site><LegalPage kind="termos" /></Site>} />
                  <Route path="/privacidade" element={<Site><LegalPage kind="privacidade" /></Site>} />
                  <Route path="/planos" element={<Navigate to="/#planos" replace />} />
                  <Route path="/register" element={<Navigate to="/#planos" replace />} />

                  {/* Autenticação */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                  <Route path="/primeiro-acesso" element={<PrimeiroAcessoPage />} />

                  {/* App (autenticado) */}
                  <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/drivers" element={<ProtectedRoute><DriversPage /></ProtectedRoute>} />
                  <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
                  <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
                  <Route path="/seguradoras" element={<ProtectedRoute><SeguradoresPage /></ProtectedRoute>} />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <PlanProtectedRoute feature="reports">
                          <ReportsPage />
                        </PlanProtectedRoute>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/deliveries" element={<ProtectedRoute><DeliveriesPage /></ProtectedRoute>} />
                  <Route
                    path="/settlement"
                    element={
                      <ProtectedRoute>
                        <PlanProtectedRoute feature="financial_dashboard">
                          <SettlementPage />
                        </PlanProtectedRoute>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="/tracker" element={<ProtectedRoute allowDrivers={true}><TrackerPage /></ProtectedRoute>} />
                  <Route path="/master" element={<ProtectedRoute><MasterAdminPage /></ProtectedRoute>} />
                  <Route path="/install" element={<InstallPage />} />
                  <Route path="/upgrade" element={<ProtectedRoute><UpgradeRequiredPage /></ProtectedRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </LogisticsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
