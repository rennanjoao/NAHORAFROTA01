import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, CheckCircle2, FileUp, FileWarning, Flag, MapPinned, Package, RefreshCw, Truck, UserCheck, Wallet, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageLoading, Section, StatCard } from "@/components/patterns";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PlanLockOverlay } from "@/components/plan/PlanLockOverlay";
import { useTenantData } from "@/hooks/useTenantData";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { prefersReducedMotion, readPreferences } from "@/lib/preferences";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import { LiveMap } from "@/components/dashboard/LiveMap";
import { DeliveryStatus } from "@/components/dashboard/DeliveryStatus";
import { SLAWeeklyWidget } from "@/components/dashboard/SLAWeeklyWidget";
import { SLARealTimeWidget } from "@/components/dashboard/SLARealTimeWidget";
import { PredictiveIntelligence } from "@/components/dashboard/PredictiveIntelligence";
import { AggregateEfficiencyWidget } from "@/components/dashboard/AggregateEfficiencyWidget";
import { FinishedRoutesList } from "@/components/dashboard/FinishedRoutes";
import { DriversInRouteModal } from "@/components/dashboard/DriversInRouteModal";
import { FinishedDriversModal } from "@/components/dashboard/FinishedDriversModal";
import { InvoicesInTransitModal } from "@/components/dashboard/InvoicesInTransitModal";
import { TodayLoadedModal } from "@/components/dashboard/TodayLoadedModal";
import { FreightCostModal } from "@/components/dashboard/FreightCostModal";
import { FleetManifestsModal } from "@/components/dashboard/FleetManifestsModal";
import { DeliveredInvoicesModal } from "@/components/dashboard/DeliveredInvoicesModal";
import { UnroutedSheet } from "@/components/dashboard/UnroutedSheet";
import { plural } from "@/components/dashboard/status";

const MAP_SECTION_ID = "live-map-section";
// Celular: os quatro numeros do dia em 2 x 2, com respiro menor.
const KPI_COMPACT = "max-sm:gap-2 max-sm:p-4";

function scrollToMap() {
  document.getElementById(MAP_SECTION_ID)?.scrollIntoView({
    behavior: prefersReducedMotion(readPreferences()) ? "auto" : "smooth",
    block: "start",
  });
}

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkFeatureAccess } = useFeatureAccess();
  const slaAccess = checkFeatureAccess("sla_weekly");
  const realtimeAccess = checkFeatureAccess("realtime_dashboard");
  const financialAccess = checkFeatureAccess("financial_dashboard");

  // Empresa ainda sendo criada: evita tela vazia para usuario novo
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
    unroutedCount,
  } = useDashboardKPIs();

  // Janelas de detalhe
  const [isDriversInRouteOpen, setIsDriversInRouteOpen] = useState(false);
  const [isFinishedDriversOpen, setIsFinishedDriversOpen] = useState(false);
  const [isInTransitOpen, setIsInTransitOpen] = useState(false);
  const [isTodayLoadedOpen, setIsTodayLoadedOpen] = useState(false);
  const [isFreightCostOpen, setIsFreightCostOpen] = useState(false);
  const [isOwnFleetOpen, setIsOwnFleetOpen] = useState(false);
  const [isThirdPartyOpen, setIsThirdPartyOpen] = useState(false);
  const [isUnroutedOpen, setIsUnroutedOpen] = useState(false);
  const [isDeliveredInvoicesOpen, setIsDeliveredInvoicesOpen] = useState(false);
  const focusDriverId = searchParams.get("focusDriver");

  useEffect(() => {
    if (!focusDriverId) return;
    const timer = window.setTimeout(scrollToMap, 150);
    return () => window.clearTimeout(timer);
  }, [focusDriverId]);

  const handleMapFocusHandled = () => {
    if (!focusDriverId) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("focusDriver");
    setSearchParams(nextParams, { replace: true });
  };

  if (tenantLoading || isLoading) {
    return <PageLoading stats={4} rows={4} />;
  }

  if (!tenant) {
    return (
      <EmptyState
        icon={Building2}
        title="Preparando o ambiente da sua empresa"
        description="Isso leva alguns instantes. Se demorar mais que alguns minutos, recarregue a página ou fale com o suporte."
        action={
          <Button onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            Recarregar página
          </Button>
        }
        className="mt-10"
      />
    );
  }

  const liveMap = <LiveMap focusDriverId={focusDriverId} onFocusHandled={handleMapFocusHandled} />;

  return (
    <>
      <NotificationBanner />

      <DashboardHeader
        actions={
          <>
            <Button variant="outline" onClick={scrollToMap}>
              <MapPinned aria-hidden="true" />
              Ver mapa ao vivo
            </Button>
            <Button asChild>
              <Link to="/deliveries?action=import">
                <FileUp aria-hidden="true" />
                Importar notas
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-8 md:space-y-10">
        {/* O que importa agora: os quatro numeros do dia */}
        <section aria-label="Resumo de hoje" className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            className={KPI_COMPACT}
            label="Motoristas em rota"
            value={driversInRouteCount}
            icon={Truck}
            tone="info"
            hint={plural(invoicesInTransitCount, "nota em trânsito", "notas em trânsito")}
            onClick={() => setIsDriversInRouteOpen(true)}
          />
          <StatCard
            className={KPI_COMPACT}
            label="Rotas finalizadas"
            value={finishedDriversCount}
            icon={Flag}
            tone="success"
            hint="Romaneios concluídos hoje"
            onClick={() => setIsFinishedDriversOpen(true)}
          />
          <StatCard
            className={KPI_COMPACT}
            label="Entregas feitas"
            value={todayDeliveredCount}
            icon={CheckCircle2}
            tone="success"
            hint="Baixas de hoje"
            onClick={() => setIsDeliveredInvoicesOpen(true)}
          />
          <StatCard
            className={KPI_COMPACT}
            label="Notas sem romaneio"
            value={unroutedCount}
            icon={FileWarning}
            tone={unroutedCount > 0 ? "warning" : "neutral"}
            hint={unroutedCount > 0 ? "Pendentes e devolvidas" : "Tudo em romaneio"}
            onClick={() => setIsUnroutedOpen(true)}
          />
        </section>

        <Section
          id={MAP_SECTION_ID}
          title="Agora na rua"
          description="Onde cada motorista está e em que pé estão as notas de hoje."
          className="scroll-mt-24"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              {realtimeAccess.allowed ? liveMap : <PlanLockOverlay upgradePlanLabel={realtimeAccess.upgradePlanLabel}>{liveMap}</PlanLockOverlay>}
            </div>
            <DeliveryStatus />
          </div>
        </Section>

        <Section
          id="sla"
          title="Entregas no prazo (SLA)"
          description="Quanto das entregas chegou no prazo combinado com o cliente. A meta é 97%."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0">
              {slaAccess.allowed ? (
                <SLAWeeklyWidget />
              ) : (
                <PlanLockOverlay upgradePlanLabel={slaAccess.upgradePlanLabel}>
                  <SLAWeeklyWidget />
                </PlanLockOverlay>
              )}
            </div>
            <div className="min-w-0 lg:col-span-2">
              {realtimeAccess.allowed ? (
                <SLARealTimeWidget />
              ) : (
                <PlanLockOverlay upgradePlanLabel={realtimeAccess.upgradePlanLabel}>
                  <SLARealTimeWidget />
                </PlanLockOverlay>
              )}
            </div>
          </div>
        </Section>

        <Section id="atencao" title="Atenção" description="Motoristas abaixo da meta no período escolhido. Toque em um para ver o histórico.">
          <PredictiveIntelligence />
        </Section>

        <Section id="carga" title="Carga, frota e custos de hoje" description="O que saiu hoje, com quem e quanto custou o frete.">
          <div className="stagger grid grid-flow-dense grid-cols-2 gap-3 sm:grid-flow-row sm:gap-4 xl:grid-cols-3">
            <StatCard
              className={KPI_COMPACT}
              label="Notas carregadas"
              value={todayLoadedCount}
              icon={Package}
              tone="brand"
              hint="Entraram em romaneio hoje"
              onClick={() => setIsTodayLoadedOpen(true)}
            />
            {financialAccess.allowed && (
              <>
                <StatCard
                  className="col-span-2 sm:col-span-1"
                  label="Valor carregado"
                  value={todayRevenue}
                  format={formatCurrency}
                  icon={Banknote}
                  tone="brand"
                  hint="Soma das notas carregadas"
                  onClick={() => setIsTodayLoadedOpen(true)}
                />
                <StatCard
                  className="col-span-2 sm:col-span-1"
                  label="Custo de frete"
                  value={todayFreightCost}
                  format={formatCurrency}
                  icon={Wallet}
                  tone="neutral"
                  hint="Romaneios criados hoje"
                  onClick={() => setIsFreightCostOpen(true)}
                />
                <AggregateEfficiencyWidget
                  freightValue={todayFreightCost}
                  totalSalesValue={todayRevenue}
                  allowed
                  upgradePlanLabel={financialAccess.upgradePlanLabel}
                />
              </>
            )}
            <StatCard
              className={KPI_COMPACT}
              label="Frota própria"
              value={ownFleetCount}
              icon={Building2}
              tone="neutral"
              hint="Romaneios com motorista CLT"
              onClick={() => setIsOwnFleetOpen(true)}
            />
            <StatCard
              className={KPI_COMPACT}
              label="Terceiros e agregados"
              value={thirdPartyCount}
              icon={UserCheck}
              tone="neutral"
              hint="Romaneios com motorista terceiro"
              onClick={() => setIsThirdPartyOpen(true)}
            />
          </div>
          {!financialAccess.allowed && <PlanLockOverlay upgradePlanLabel={financialAccess.upgradePlanLabel} className="min-h-[10rem]" />}
        </Section>

        <Section
          id="finalizadas"
          title="Rotas finalizadas hoje"
          description="Quem já concluiu o romaneio e como foram as entregas. Toque em um motorista para ver as notas."
          actions={
            finishedDriversCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIsFinishedDriversOpen(true)}>
                Ver todas
              </Button>
            )
          }
        >
          <FinishedRoutesList data={finishedDrivers} onShowAll={() => setIsFinishedDriversOpen(true)} />
        </Section>
      </div>

      {/* Janelas de detalhe */}
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
      <FinishedDriversModal open={isFinishedDriversOpen} onOpenChange={setIsFinishedDriversOpen} data={finishedDrivers} />
      <InvoicesInTransitModal open={isInTransitOpen} onOpenChange={setIsInTransitOpen} data={invoicesInTransit} />
      <TodayLoadedModal open={isTodayLoadedOpen} onOpenChange={setIsTodayLoadedOpen} data={todayLoadedInvoices} />
      <FreightCostModal
        open={isFreightCostOpen}
        onOpenChange={setIsFreightCostOpen}
        data={todayManifestsWithFreight}
        totalCost={todayFreightCost}
      />
      <FleetManifestsModal open={isOwnFleetOpen} onOpenChange={setIsOwnFleetOpen} data={ownFleetToday} type="own" />
      <FleetManifestsModal open={isThirdPartyOpen} onOpenChange={setIsThirdPartyOpen} data={thirdPartyToday} type="third_party" />
      <UnroutedSheet open={isUnroutedOpen} onOpenChange={setIsUnroutedOpen} />
      <DeliveredInvoicesModal open={isDeliveredInvoicesOpen} onOpenChange={setIsDeliveredInvoicesOpen} data={todayDeliveredInvoices} />
    </>
  );
}
