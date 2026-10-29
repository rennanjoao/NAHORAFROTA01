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
import { AppShell } from "@/components/layout/AppShell";
import { PreferencesProvider } from "@/components/theme/PreferencesProvider";
import Index from "./pages/Index";
import DriversPage from "./pages/DriversPage";
import RoutesPage from "./pages/RoutesPage";
import VehiclesPage from "./pages/VehiclesPage";
import ReportsPage from "./pages/ReportsPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import SettlementPage from "./pages/SettlementPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SettingsPage from "./pages/SettingsPage";
import TrackerPage from "./pages/TrackerPage";
import InstallPage from "./pages/InstallPage";
import MasterAdminPage from "./pages/MasterAdminPage";
import UpgradeRequiredPage from "./pages/UpgradeRequiredPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
                <Routes>
                  {/* Publicas */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/install" element={<InstallPage />} />

                  {/* Painel: estrutura fixa (menu, topo, busca) com as telas dentro.
                      ProtectedRoute cuida de login, papel, motorista e assinatura. */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<Index />} />
                    <Route path="/deliveries" element={<DeliveriesPage />} />
                    <Route path="/routes" element={<RoutesPage />} />
                    <Route path="/drivers" element={<DriversPage />} />
                    <Route path="/vehicles" element={<VehiclesPage />} />
                    <Route
                      path="/settlement"
                      element={
                        <PlanProtectedRoute feature="financial_dashboard">
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
                  <Route path="/seguradoras" element={<Navigate to="/" replace />} />

                  {/* Novas rotas acima do "*". Telas do painel: registre tambem em src/config/navigation.ts. */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </LogisticsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </PreferencesProvider>
);

export default App;
