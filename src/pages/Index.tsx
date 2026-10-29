import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Package, 
  FileWarning, 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Building2, 
  UserCheck,
  CheckCircle2,
  DollarSign,
  ChevronDown,
  ChevronUp,
  MapPin,
  Loader2
} from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PlanLockOverlay } from "@/components/plan/PlanLockOverlay";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LiveMap } from "@/components/dashboard/LiveMap";
import { PredictiveIntelligence } from "@/components/dashboard/PredictiveIntelligence";
import { DeliveryStatus } from "@/components/dashboard/DeliveryStatus";
import { SLAWeeklyWidget } from "@/components/dashboard/SLAWeeklyWidget";
import { SLARealTimeWidget } from "@/components/dashboard/SLARealTimeWidget";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import { UnroutedSheet } from "@/components/dashboard/UnroutedSheet";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { useTenantData } from "@/hooks/useTenantData";

// New dashboard components
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { DriversInRouteModal } from "@/components/dashboard/DriversInRouteModal";
import { FinishedDriversModal } from "@/components/dashboard/FinishedDriversModal";
import { InvoicesInTransitModal } from "@/components/dashboard/InvoicesInTransitModal";
import { TodayLoadedModal } from "@/components/dashboard/TodayLoadedModal";
import { FreightCostModal } from "@/components/dashboard/FreightCostModal";
import { FleetManifestsModal } from "@/components/dashboard/FleetManifestsModal";
import { DeliveredInvoicesModal } from "@/components/dashboard/DeliveredInvoicesModal";
import { AggregateEfficiencyWidget } from "@/components/dashboard/AggregateEfficiencyWidget";

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkFeatureAccess } = useFeatureAccess();
  const slaAccess = checkFeatureAccess('sla_weekly');
  const realtimeAccess = checkFeatureAccess('realtime_dashboard');
  const financialAccess = checkFeatureAccess('financial_dashboard');

  // Tenant verification - prevent white screen for new users
  const { tenant, isLoading: tenantLoading } = useTenantData();

  const {
    isLoading,
    driversInRoute,
    driversInRouteCount,
    finishedDrivers,
    finishedDriversCount,
    invoicesInTransit,
    invoicesInTransitCount,
    todayLoadedInvoices,
    todayLoadedCount,
    todayDeliveredInvoices,
    todayDeliveredCount,
    todayRevenue,
    todayFreightCost,
    todayManifestsWithFreight,
    ownFleetToday,
    ownFleetCount,
    thirdPartyToday,
    thirdPartyCount,
    unroutedInvoices,
    unroutedCount,
  } = useDashboardKPIs();

  // Modal states
  const [isDriversInRouteOpen, setIsDriversInRouteOpen] = useState(false);
  const [isFinishedDriversOpen, setIsFinishedDriversOpen] = useState(false);
  const [isInTransitOpen, setIsInTransitOpen] = useState(false);
  const [isTodayLoadedOpen, setIsTodayLoadedOpen] = useState(false);
  const [isFreightCostOpen, setIsFreightCostOpen] = useState(false);
  const [isOwnFleetOpen, setIsOwnFleetOpen] = useState(false);
  const [isThirdPartyOpen, setIsThirdPartyOpen] = useState(false);
  const [isUnroutedOpen, setIsUnroutedOpen] = useState(false);
  const [isDeliveredInvoicesOpen, setIsDeliveredInvoicesOpen] = useState(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const focusDriverId = searchParams.get("focusDriver");

  useEffect(() => {
    if (!focusDriverId) return;

    const timer = window.setTimeout(() => {
      document.getElementById("live-map-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [focusDriverId]);

  const handleMapFocusHandled = () => {
    if (!focusDriverId) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("focusDriver");
    setSearchParams(nextParams, { replace: true });
  };

  // Show loading while tenant data is being verified
  if (tenantLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">
              {tenantLoading ? "Preparando seu ambiente..." : "Carregando dados..."}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // If tenant is not found after loading, show onboarding message
  if (!tenant) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center space-y-4 max-w-md">
            <Building2 className="h-16 w-16 text-primary/50 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Preparando seu ambiente...</h2>
            <p className="text-muted-foreground">
              Sua empresa está sendo configurada. Isso pode levar alguns instantes. 
              Se o problema persistir, entre em contato com o suporte.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="text-sm text-primary hover:underline"
            >
              Recarregar página
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* System Notifications Banner */}
        <NotificationBanner />

        {/* Welcome Banner - Beginner Friendly */}
        <WelcomeBanner />

        {/* Live Status Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-lg font-semibold text-foreground">Painel de Operações</h2>
          <div className="flex items-center gap-4">
            {/* Active Drivers Badge */}
            <div className="flex items-center gap-2 rounded-lg bg-info/10 border border-info/20 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
              <span className="text-sm font-medium text-info">
                {driversInRouteCount} em rota
              </span>
            </div>
            {/* Finished Drivers Badge */}
            <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">
                {finishedDriversCount} finalizaram
              </span>
            </div>
          </div>
        </div>

        {/* SLA Widget + KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* SLA Weekly Widget - Prominent */}
          <div className="lg:col-span-2">
            {slaAccess.allowed ? (
              <SLAWeeklyWidget />
            ) : (
              <PlanLockOverlay upgradePlanLabel={slaAccess.upgradePlanLabel}>
                <SLAWeeklyWidget />
              </PlanLockOverlay>
            )}
          </div>

          {/* Motoristas em Rota ("na rua" e "em rota" são o mesmo indicador) */}
          <MetricCard
            title="Motoristas em Rota"
            value={driversInRouteCount}
            subtitle={`${invoicesInTransitCount} NF(s) em trânsito`}
            icon={Truck}
            variant="default"
            clickable
            onClick={() => setIsDriversInRouteOpen(true)}
          />

          {/* Finalizaram Hoje */}
          <MetricCard
            title="Finalizaram Hoje"
            value={finishedDriversCount}
            subtitle="Romaneios concluídos no dia"
            icon={CheckCircle2}
            variant="success"
            clickable
            onClick={() => setIsFinishedDriversOpen(true)}
          />
        </div>

        {/* Notas Carregadas + Entregas Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            title="Notas Carregadas Hoje"
            value={todayLoadedCount}
            subtitle="NFs romaneadas no dia"
            icon={Package}
            variant="success"
            clickable
            onClick={() => setIsTodayLoadedOpen(true)}
          />
          
          <MetricCard
            title="Entregas Realizadas"
            value={todayDeliveredCount}
            subtitle="Baixas de hoje"
            icon={CheckCircle2}
            variant="success"
            clickable
            onClick={() => setIsDeliveredInvoicesOpen(true)}
          />
          
          <MetricCard
            title="Não Roterizadas"
            value={unroutedCount}
            subtitle="Pendentes + Devolvidas sem romaneio"
            icon={FileWarning}
            variant="warning"
            clickable
            onClick={() => setIsUnroutedOpen(true)}
          />
        </div>

        {/* Financial Summary Row - 3 cards */}
        {financialAccess.allowed ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Receita Total */}
          <div 
            className="glass-card rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setIsTodayLoadedOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Total (Carregadas)</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(todayRevenue)}
                </p>
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                <TrendingUp className="h-3 w-3 mr-1" />
                Hoje
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Clique para ver detalhes →
            </p>
          </div>
          
          {/* Custo de Frete do Dia */}
          <div 
            className="glass-card rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setIsFreightCostOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo de Frete do Dia</p>
                <p className="text-2xl font-bold font-mono text-warning">
                  {formatCurrency(todayFreightCost)}
                </p>
              </div>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                <DollarSign className="h-3 w-3 mr-1" />
                Acertos
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Clique para ver detalhes →
            </p>
          </div>

          {/* Eficiência do Custo Frete */}
          <AggregateEfficiencyWidget
            freightValue={todayFreightCost}
            totalSalesValue={todayRevenue}
            allowed
            upgradePlanLabel={financialAccess.upgradePlanLabel}
          />
        </div>
        ) : (
          <PlanLockOverlay upgradePlanLabel={financialAccess.upgradePlanLabel} />
        )}

        {/* Fleet Row - 2 cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Frota Própria Hoje */}
          <div 
            className="glass-card rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setIsOwnFleetOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Frota Própria Hoje
                </p>
                <p className="text-2xl font-bold text-primary">
                  {ownFleetCount}
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                CLT
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Clique para ver detalhes →
            </p>
          </div>
           
          {/* Terceiros Hoje */}
          <div 
            className="glass-card rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setIsThirdPartyOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Terceiros Hoje
                </p>
                <p className="text-2xl font-bold text-warning">
                  {thirdPartyCount}
                </p>
              </div>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                Agregados
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Clique para ver detalhes →
            </p>
          </div>
        </div>

        {/* SLA Real-Time + Predictive Intelligence */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {realtimeAccess.allowed ? (
            <SLARealTimeWidget />
          ) : (
            <PlanLockOverlay upgradePlanLabel={realtimeAccess.upgradePlanLabel}>
              <SLARealTimeWidget />
            </PlanLockOverlay>
          )}
          <PredictiveIntelligence />
        </div>

        {/* Live Map */}
        <div id="live-map-section">
          {realtimeAccess.allowed ? (
            <LiveMap focusDriverId={focusDriverId} onFocusHandled={handleMapFocusHandled} />
          ) : (
            <PlanLockOverlay upgradePlanLabel={realtimeAccess.upgradePlanLabel}>
              <LiveMap focusDriverId={focusDriverId} onFocusHandled={handleMapFocusHandled} />
            </PlanLockOverlay>
          )}
        </div>

        {/* Delivery Status - 4 categories */}
        <DeliveryStatus />

        {/* Motoristas que Finalizaram (replaces RecentDeliveries) */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Motoristas que Finalizaram Hoje
              </h3>
              <p className="text-sm text-muted-foreground">
                {finishedDriversCount} motorista(s) completaram suas rotas
              </p>
            </div>
            <button 
              onClick={() => setIsFinishedDriversOpen(true)}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Ver todos →
            </button>
          </div>

          {finishedDrivers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma rota finalizada hoje ainda
            </div>
          ) : (
            <div className="divide-y divide-border">
              {finishedDrivers.slice(0, 5).map(({ driver, manifest, invoices, finishedAt, totalDeliveries, completedDeliveries, occurrences }) => {
                const isExpanded = expandedDriverId === manifest.id;
                const deliveredInvoices = invoices.filter(inv => inv.status === "delivered");
                const occurrenceInvoices = invoices.filter(inv => inv.status === "occurrence" || inv.status === "returned");

                return (
                  <div key={manifest.id} className="bg-card">
                    {/* Driver Header Row */}
                    <div 
                      className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedDriverId(isExpanded ? null : manifest.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                          {(driver?.photo_url || driver?.avatar) ? (
                            <img 
                              src={driver.photo_url || driver.avatar} 
                              alt={driver?.name || 'Motorista'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">
                              {(driver?.name || 'M').split(" ").map(n => n?.[0] || '').join("").slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {driver.vehicle_plate} • {completedDeliveries}/{totalDeliveries} entregas
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            occurrences > 0
                              ? "bg-warning/10 text-warning border-warning/30"
                              : "bg-success/10 text-success border-success/30"
                          )}
                        >
                          {occurrences > 0 ? `${occurrences} Oc.` : "OK"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(finishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content - NFs */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-muted/30 border-t border-border">
                        {/* Entregas Realizadas */}
                        {deliveredInvoices.length > 0 && (
                          <div className="pt-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              <h4 className="text-sm font-semibold text-foreground">
                                Entregas Realizadas ({deliveredInvoices.length})
                              </h4>
                            </div>
                            <div className="space-y-2">
                              {deliveredInvoices.map((invoice) => (
                                <div
                                  key={invoice.id}
                                  className="p-3 rounded-lg border border-border bg-card text-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-medium">
                                          NF {invoice.nfe_number || invoice.id.slice(0, 8)}
                                        </span>
                                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Entregue
                                        </Badge>
                                      </div>
                                      <p className="text-muted-foreground truncate mt-1">
                                        {invoice.recipient_name}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {invoice.address_full}
                                      </p>
                                    </div>
                                    <span className="font-mono font-medium whitespace-nowrap">
                                      {formatCurrency(invoice.total_value)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ocorrências */}
                        {occurrenceInvoices.length > 0 && (
                          <div className="pt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-warning" />
                              <h4 className="text-sm font-semibold text-foreground">
                                Ocorrências / Devoluções ({occurrenceInvoices.length})
                              </h4>
                            </div>
                            <div className="space-y-2">
                              {occurrenceInvoices.map((invoice) => (
                                <div
                                  key={invoice.id}
                                  className="p-3 rounded-lg border border-border bg-card text-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-medium">
                                          NF {invoice.nfe_number || invoice.id.slice(0, 8)}
                                        </span>
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-xs",
                                            invoice.status === "returned" 
                                              ? "bg-destructive/10 text-destructive border-destructive/30"
                                              : "bg-warning/10 text-warning border-warning/30"
                                          )}
                                        >
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {invoice.status === "returned" ? "Devolvida" : (invoice.occurrence_type || "Ocorrência")}
                                        </Badge>
                                      </div>
                                      <p className="text-muted-foreground truncate mt-1">
                                        {invoice.recipient_name}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {invoice.address_full}
                                      </p>
                                    </div>
                                    <span className="font-mono font-medium whitespace-nowrap">
                                      {formatCurrency(invoice.total_value)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty state */}
                        {deliveredInvoices.length === 0 && occurrenceInvoices.length === 0 && (
                          <div className="py-4 text-center text-muted-foreground text-sm">
                            Nenhuma NF neste romaneio
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <DriversInRouteModal
        open={isDriversInRouteOpen}
        onOpenChange={setIsDriversInRouteOpen}
        data={driversInRoute}
        invoicesInTransitCount={invoicesInTransitCount}
        onShowInvoices={() => {
          setIsDriversInRouteOpen(false);
          setIsInTransitOpen(true);
        }}
      />
      <FinishedDriversModal
        open={isFinishedDriversOpen}
        onOpenChange={setIsFinishedDriversOpen}
        data={finishedDrivers}
      />
      <InvoicesInTransitModal
        open={isInTransitOpen}
        onOpenChange={setIsInTransitOpen}
        data={invoicesInTransit}
      />
      <TodayLoadedModal
        open={isTodayLoadedOpen}
        onOpenChange={setIsTodayLoadedOpen}
        data={todayLoadedInvoices}
      />
      <FreightCostModal
        open={isFreightCostOpen}
        onOpenChange={setIsFreightCostOpen}
        data={todayManifestsWithFreight}
        totalCost={todayFreightCost}
      />
      <FleetManifestsModal
        open={isOwnFleetOpen}
        onOpenChange={setIsOwnFleetOpen}
        data={ownFleetToday}
        type="own"
      />
      <FleetManifestsModal
        open={isThirdPartyOpen}
        onOpenChange={setIsThirdPartyOpen}
        data={thirdPartyToday}
        type="third_party"
      />
      <UnroutedSheet
        open={isUnroutedOpen}
        onOpenChange={setIsUnroutedOpen}
      />
      <DeliveredInvoicesModal
        open={isDeliveredInvoicesOpen}
        onOpenChange={setIsDeliveredInvoicesOpen}
        data={todayDeliveredInvoices}
      />
    </AppLayout>
  );
}
