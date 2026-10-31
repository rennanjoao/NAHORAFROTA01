import { lazy, Suspense, type ReactNode } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PWAUpdatePrompt } from "@/components/layout/PWAUpdatePrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LogisticsProvider } from "@/contexts/LogisticsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlanProtectedRoute } from "@/components/auth/PlanProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PreferencesProvider } from "@/components/theme/PreferencesProvider";
import { BrandedLoader } from "@/components/auth/BrandedLoader";

// Tudo carrega sob demanda: o visitante do site nao baixa o painel, e o painel
// nao baixa o site (a cena 3D da capa e um pacote separado).
const AppShell = lazy(() => import("@/components/layout/AppShell").then((m) => ({ default: m.AppShell })));
const Index = lazy(() => import("./pages/Index"));
const DriversPage = lazy(() => import("./pages/DriversPage"));
const RoutesPage = lazy(() => import("./pages/RoutesPage"));
const VehiclesPage = lazy(() => import("./pages/VehiclesPage"));
const CarriersPage = lazy(() => import("./pages/CarriersPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const DeliveriesPage = lazy(() => import("./pages/DeliveriesPage"));
const SettlementPage = lazy(() => import("./pages/SettlementPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PrimeiroAcessoPage = lazy(() => import("./pages/PrimeiroAcessoPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TrackerPage = lazy(() => import("./pages/TrackerPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const MasterAdminPage = lazy(() => import("./pages/MasterAdminPage"));
const UpgradeRequiredPage = lazy(() => import("./pages/UpgradeRequiredPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Site publico (landing, checkout, termos)
const LandingPage = lazy(() => import("./site/pages/LandingPage"));
const CheckoutPage = lazy(() => import("./site/pages/CheckoutPage"));
const CheckoutSandboxPage = lazy(() => import("./site/pages/CheckoutSandboxPage"));
const CheckoutSuccessPage = lazy(() => import("./site/pages/CheckoutSuccessPage"));
const LegalPage = lazy(() => import("./site/pages/LegalPage"));

// Dados guardados entre telas (voltar a uma tela mostra na hora e atualiza por tras).
// O tempo real ja avisa das mudancas, entao nao precisa recarregar ao voltar para a aba.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 } },
});

/** Fundo neutro enquanto o site carrega (sem logo piscando na capa). */
function SiteFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

const Site = ({ children }: { children: ReactNode }) => <Suspense fallback={<SiteFallback />}>{children}</Suspense>;

/**
 * Estrutura do painel (/dashboard e as demais telas). ProtectedRoute cuida de
 * login, papel, motorista e assinatura antes de abrir o AppShell (menu, topo, busca).
 */
function Panel() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  );
}

const App = () => (
  <PreferencesProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LogisticsProvider>
          <TooltipProvider delayDuration={300}>
            <Sonner />
            <PWAUpdatePrompt />
            <BrowserRouter>
              <ErrorBoundary fallbackMessage="Erro ao carregar o sistema">
                <Suspense fallback={<BrandedLoader label="Abrindo o Na Hora Frota" />}>
                  <Routes>
                    {/* Site publico: a raiz e sempre o site (quem esta logado ve "Abrir painel" no topo). */}
                    <Route path="/" element={<Site><LandingPage /></Site>} />
                    <Route path="/site" element={<Navigate to="/" replace />} />
                    <Route path="/comprar/sucesso" element={<Site><CheckoutSuccessPage /></Site>} />
                    <Route path="/comprar/:planId" element={<Site><CheckoutPage /></Site>} />
                    <Route path="/checkout/sandbox/:orderId" element={<Site><CheckoutSandboxPage /></Site>} />
                    <Route path="/termos" element={<Site><LegalPage kind="termos" /></Site>} />
                    <Route path="/privacidade" element={<Site><LegalPage kind="privacidade" /></Site>} />
                    <Route path="/planos" element={<Navigate to="/#planos" replace />} />

                    {/* Publicas do app */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/redefinir-senha" element={<Navigate to="/reset-password" replace />} />
                    <Route path="/primeiro-acesso" element={<PrimeiroAcessoPage />} />
                    <Route path="/install" element={<InstallPage />} />

                    {/* Painel: estrutura fixa (menu, topo, busca) com as telas dentro. */}
                    <Route element={<Panel />}>
                      <Route path="/dashboard" element={<Index />} />
                      <Route path="/deliveries" element={<DeliveriesPage />} />
                      <Route path="/routes" element={<RoutesPage />} />
                      <Route path="/drivers" element={<DriversPage />} />
                      <Route path="/vehicles" element={<VehiclesPage />} />
                      <Route path="/carriers" element={<CarriersPage />} />
                      <Route
                        path="/settlement"
                        element={
                          <PlanProtectedRoute feature="settlement">
                            <SettlementPage />
                          </PlanProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <PlanProtectedRoute feature="reports">
                            <ReportsPage />
                          </PlanProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <AdminPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/master" element={<MasterAdminPage />} />
                      <Route path="/upgrade" element={<UpgradeRequiredPage />} />
                    </Route>

                    {/* App do motorista (celular), fora do painel. */}
                    <Route
                      path="/tracker"
                      element={
                        <ProtectedRoute allowDrivers={true}>
                          <TrackerPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Seguradoras era uma tela so com dados de exemplo; links antigos vao para o inicio. */}
                    <Route path="/seguradoras" element={<Navigate to="/dashboard" replace />} />

                    {/* Novas rotas acima do "*". Telas do painel: registre tambem em src/config/navigation.ts. */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </LogisticsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </PreferencesProvider>
);

export default App;
