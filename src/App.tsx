import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PWAUpdatePrompt } from "@/components/layout/PWAUpdatePrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LogisticsProvider } from "@/contexts/LogisticsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlanProtectedRoute } from "@/components/auth/PlanProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import DriversPage from "./pages/DriversPage";
import RoutesPage from "./pages/RoutesPage";
import VehiclesPage from "./pages/VehiclesPage";
import SeguradoresPage from "./pages/SeguradoresPage";
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
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LogisticsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAUpdatePrompt />
          <BrowserRouter>
            <ErrorBoundary fallbackMessage="Erro ao carregar o sistema">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                
                {/* Protected routes - require authentication */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/drivers" element={
                  <ProtectedRoute>
                    <DriversPage />
                  </ProtectedRoute>
                } />
                <Route path="/routes" element={
                  <ProtectedRoute>
                    <RoutesPage />
                  </ProtectedRoute>
                } />
                <Route path="/vehicles" element={
                  <ProtectedRoute>
                    <VehiclesPage />
                  </ProtectedRoute>
                } />
                <Route path="/seguradoras" element={
                  <ProtectedRoute>
                    <SeguradoresPage />
                  </ProtectedRoute>
                } />
                <Route path="/reports" element={
                  <ProtectedRoute>
                    <PlanProtectedRoute feature="reports">
                      <ReportsPage />
                    </PlanProtectedRoute>
                  </ProtectedRoute>
                } />
                <Route path="/deliveries" element={
                  <ProtectedRoute>
                    <DeliveriesPage />
                  </ProtectedRoute>
                } />
                <Route path="/settlement" element={
                  <ProtectedRoute>
                    <PlanProtectedRoute feature="financial_dashboard">
                      <SettlementPage />
                    </PlanProtectedRoute>
                  </ProtectedRoute>
                } />
                
                {/* Admin route - requires admin role */}
                <Route path="/admin" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } />
                
                {/* GPS Tracker for drivers - protected and allows drivers */}
                <Route path="/tracker" element={
                  <ProtectedRoute allowDrivers={true}>
                    <TrackerPage />
                  </ProtectedRoute>
                } />
                
                {/* Master Admin - platform admins only */}
                <Route path="/master" element={
                  <ProtectedRoute>
                    <MasterAdminPage />
                  </ProtectedRoute>
                } />
                
                {/* PWA Install page - public */}
                <Route path="/install" element={<InstallPage />} />
                
                {/* Upgrade Required page */}
                <Route path="/upgrade" element={
                  <ProtectedRoute>
                    <UpgradeRequiredPage />
                  </ProtectedRoute>
                } />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </LogisticsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
