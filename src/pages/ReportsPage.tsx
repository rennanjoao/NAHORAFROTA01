import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  FileDown,
  RefreshCw,
   MapPin,
   Truck,
   DollarSign
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Components
import { ReportsFilters, FilterState, defaultFilters, ReportFilterOptions } from "@/components/reports/ReportsFilters";
import { InteractiveKPIs } from "@/components/reports/InteractiveKPIs";
import { KPIDrilldownSheet, DrilldownType } from "@/components/reports/KPIDrilldownSheet";
import { FinancialImpact } from "@/components/reports/FinancialImpact";
import { AIInsights } from "@/components/reports/AIInsights";
import { TopOffenders } from "@/components/reports/TopOffenders";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { SLAEvolutionChart } from "@/components/reports/SLAEvolutionChart";
import { ExportReportDialog, ExportOptions } from "@/components/reports/ExportReportDialog";
import { RegionalEfficiencyDashboard } from "@/components/reports/RegionalEfficiencyDashboard";
import { FleetUsageReport } from "@/components/reports/FleetUsageReport";
import { ProfitabilityReport } from "@/components/reports/ProfitabilityReport";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { useManifestsDB } from "@/hooks/useManifestsDB";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PlanLockOverlay } from "@/components/plan/PlanLockOverlay";
import { getOccurrenceWeight } from "@/hooks/useSLADB";
import {
  buildManifestIndex,
  filterInvoicesByEntity,
  filterInvoicesForReport,
  filterManifestsForReport,
  isDeliveredStatus,
  isInvoiceLate,
  isReturnedStatus,
  previousRange,
  rankRegionsByDelay,
  resolveInvoiceRegion,
} from "@/lib/reportFilters";

const MAX_CLIENT_OPTIONS = 200;

function percentChange(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

/** SLA do periodo: media do SLA individual de cada motorista com NFs finalizadas. */
function calculatePeriodSLA(list: { status: string; occurrence_type: string | null; driver_id: string | null }[]): number {
  const finalized = list.filter(inv =>
    isDeliveredStatus(inv.status) || inv.status === 'occurrence' || isReturnedStatus(inv.status)
  );
  if (finalized.length === 0) return 100;

  const byDriver = new Map<string, typeof finalized>();
  finalized.forEach(inv => {
    const key = inv.driver_id || '__no_driver__';
    byDriver.set(key, [...(byDriver.get(key) || []), inv]);
  });

  let total = 0;
  byDriver.forEach(driverInvs => {
    const weight = driverInvs.reduce((sum, inv) => {
      const w = getOccurrenceWeight(inv.occurrence_type, isDeliveredStatus(inv.status) ? 'delivered' : 'occurrence');
      return sum + (w >= 0 ? w : 0);
    }, 0);
    total += Math.min(100, Math.max(0, (weight / driverInvs.length) * 100));
  });
  return Math.min(100, Math.max(0, total / byDriver.size));
}

// ========== MAIN COMPONENT ==========

export default function ReportsPage() {
  const { checkFeatureAccess } = useFeatureAccess();
  const financialAccess = checkFeatureAccess('financial_reports');
  const slaAccess = checkFeatureAccess('sla_drilldown');

  // Filter state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  
  // Drill-down sheet state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<DrilldownType | null>(null);
  
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Active tab state
   const [activeTab, setActiveTab] = useState<"desempenho" | "regional" | "frota" | "rentabilidade">("desempenho");
  const rentabilidadeAccess = checkFeatureAccess('financial_reports');

  // Fetch real invoices and manifests for reports
  const { invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useInvoicesDB();
  const { manifests, fetchManifests } = useManifestsDB();

  // Handle filter changes with simulated loading
  const handleFiltersChange = (newFilters: FilterState) => {
    setIsLoading(true);
    setFilters(newFilters);
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleClearFilters = () => {
    setIsLoading(true);
    setFilters(defaultFilters);
    setTimeout(() => setIsLoading(false), 500);
  };

  // ========== FILTERED DATA ==========

  const manifestsById = useMemo(() => buildManifestIndex(manifests), [manifests]);

  // Opcoes reais dos filtros (antes eram listas ficticias que nunca filtravam nada)
  const filterOptions = useMemo((): ReportFilterOptions => {
    const clientCounts = new Map<string, number>();
    const regions = new Set<string>();
    const drivers = new Map<string, string>();

    invoices.forEach(inv => {
      if (inv.recipient_name) clientCounts.set(inv.recipient_name, (clientCounts.get(inv.recipient_name) || 0) + 1);
      regions.add(resolveInvoiceRegion(inv));
      if (inv.driver_id && inv.driver_name) drivers.set(inv.driver_id, inv.driver_name);
    });
    manifests.forEach(m => {
      if (m.driver_id && m.driver_name && !drivers.has(m.driver_id)) drivers.set(m.driver_id, m.driver_name);
    });

    return {
      clients: Array.from(clientCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
        .slice(0, MAX_CLIENT_OPTIONS)
        .map(([name]) => ({ id: name, name })),
      routes: Array.from(regions).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(name => ({ id: name, name })),
      drivers: Array.from(drivers.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
        .map(([id, name]) => ({ id, name })),
    };
  }, [invoices, manifests]);

  // Cliente/rota/motorista/operacao aplicados; periodo pela data da entrega/ocorrencia
  const entityFilteredInvoices = useMemo(
    () => filterInvoicesByEntity(invoices, manifestsById, filters),
    [invoices, manifestsById, filters]
  );
  const filteredInvoices = useMemo(
    () => filterInvoicesForReport(invoices, manifestsById, filters),
    [invoices, manifestsById, filters]
  );
  const previousInvoices = useMemo(
    () => filterInvoicesForReport(invoices, manifestsById, { ...filters, dateRange: previousRange(filters.dateRange) }),
    [invoices, manifestsById, filters]
  );
  const filteredManifests = useMemo(() => filterManifestsForReport(manifests, filters), [manifests, filters]);
  const previousManifests = useMemo(
    () => filterManifestsForReport(manifests, { ...filters, dateRange: previousRange(filters.dateRange) }),
    [manifests, filters]
  );

  const summarize = (list: typeof filteredInvoices) => ({
    entregue: list.filter(inv => isDeliveredStatus(inv.status)).length,
    devolvido: list.filter(inv => isReturnedStatus(inv.status)).length,
    atrasado: list.filter(inv => isInvoiceLate(inv, manifestsById)).length,
    total: list.length,
  });

  const deliveryData = useMemo(() => summarize(filteredInvoices), [filteredInvoices, manifestsById]);
  const previousDeliveryData = useMemo(() => summarize(previousInvoices), [previousInvoices, manifestsById]);

  // SLA chart access check
  const slaEvolutionAccess = checkFeatureAccess('sla_evolution');

  // Calculate period SLA as average of individual driver scores
  // Formula: (Sum of each driver's SLA) / (Number of distinct drivers with activity)
  const periodSLA = useMemo(() => calculatePeriodSLA(filteredInvoices), [filteredInvoices]);
  const previousPeriodSLA = useMemo(() => calculatePeriodSLA(previousInvoices), [previousInvoices]);

  // Filter and aggregate occurrences
  const occurrencesData = useMemo(() => {
    const reasonTotals: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      if (inv.occurrence_type) {
        reasonTotals[inv.occurrence_type] = (reasonTotals[inv.occurrence_type] || 0) + 1;
      }
    });
    
    const total = Object.values(reasonTotals).reduce((a, b) => a + b, 0);
    
    return Object.entries(reasonTotals)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredInvoices]);

  // Custo medio = fretes de agregados (nao frota propria) no periodo / entregas realizadas no periodo
  const avgCostOf = (list: typeof filteredManifests, delivered: number) => {
    const totalFreight = list.filter(m => !m.is_own_fleet).reduce((sum, m) => sum + (m.freight_value || 0), 0);
    return delivered > 0 ? totalFreight / delivered : 0;
  };

  // Calculate KPI data using period SLA
  const kpiData = useMemo(() => {
    const avgCost = avgCostOf(filteredManifests, deliveryData.entregue);
    const previousAvgCost = avgCostOf(previousManifests, previousDeliveryData.entregue);
    
    return {
      sla: periodSLA,
      slaTrend: previousDeliveryData.total > 0 ? periodSLA - previousPeriodSLA : 0,
      onTime: deliveryData.entregue,
      onTimeTrend: percentChange(deliveryData.entregue, previousDeliveryData.entregue),
      delayed: deliveryData.atrasado,
      delayedTrend: percentChange(deliveryData.atrasado, previousDeliveryData.atrasado),
      returns: deliveryData.devolvido,
      returnsTrend: percentChange(deliveryData.devolvido, previousDeliveryData.devolvido),
      avgCost,
      avgCostTrend: percentChange(avgCost, previousAvgCost),
      totalVolume: deliveryData.total,
      volumeTrend: percentChange(deliveryData.total, previousDeliveryData.total),
    };
  }, [periodSLA, previousPeriodSLA, deliveryData, previousDeliveryData, filteredManifests, previousManifests]);

  // Financial impact data
  const financialImpactData = useMemo(() => ({
    returnCount: deliveryData.devolvido,
    returnCost: 85, // Cost per return
    delayedCount: deliveryData.atrasado,
    delayPenalty: 45, // Penalty per delay
    reworkPercentage: deliveryData.total > 0
      ? ((deliveryData.devolvido + deliveryData.atrasado) / deliveryData.total) * 100
      : 0,
    reworkCost: deliveryData.devolvido * 35 + deliveryData.atrasado * 25,
  }), [deliveryData]);

  // AI Insights data
  const insightsData = useMemo(() => ({
    topDelayRoute: { name: invoices.length > 0 ? "Sem dados suficientes" : "-", percentage: 0 },
    topReturnClient: { name: invoices.length > 0 ? "Sem dados suficientes" : "-", percentage: 0 },
    belowAverageDriver: { name: invoices.length > 0 ? "Sem dados suficientes" : "-", difference: 0 },
    peakDelayTime: { time: invoices.length > 0 ? "Sem dados suficientes" : "-", percentage: 0 },
    improvementOpportunity: { area: invoices.length > 0 ? "Sem dados suficientes" : "-", potential: "R$ 0" },
  }), [invoices.length]);

  // Top offenders data: regioes da roteirizacao com mais atrasos/ocorrencias e
  // clientes com mais devolucoes, ambos com tendencia vs periodo anterior
  const topOffendersData = useMemo(() => {
    const countReturns = (list: typeof filteredInvoices) => {
      const counts = new Map<string, number>();
      list.forEach(inv => {
        if (isReturnedStatus(inv.status) || inv.status === 'occurrence') {
          counts.set(inv.recipient_name, (counts.get(inv.recipient_name) || 0) + 1);
        }
      });
      return counts;
    };
    const currentReturns = countReturns(filteredInvoices);
    const previousReturns = countReturns(previousInvoices);

    return {
      routes: rankRegionsByDelay(filteredInvoices, previousInvoices, manifestsById).map(r => ({
        rank: r.rank,
        name: r.region,
        delays: r.delays,
        occurrences: r.occurrences,
        trend: r.trend,
      })),
      clients: Array.from(currentReturns.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
        .slice(0, 5)
        .map(([name, returns], i) => ({
          rank: i + 1,
          name,
          returns,
          trend: Math.round(percentChange(returns, previousReturns.get(name) || 0)),
        })),
      reasons: occurrencesData.map((d, i) => ({
        rank: i + 1,
        reason: d.reason,
        count: d.count,
        percentage: d.percentage,
      })),
    };
  }, [filteredInvoices, previousInvoices, manifestsById, occurrencesData]);

  // Charts data (only issues now, SLA has its own component)
  const chartsIssuesData = useMemo(() => occurrencesData, [occurrencesData]);

  // Handle KPI click for drill-down
  const handleKPIClick = (type: DrilldownType) => {
    setDrilldownType(type);
    setDrilldownOpen(true);
  };

  // Handle export
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true);
    
    // Simulate export
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "✅ Relatório Exportado",
      description: "O arquivo PDF foi gerado com sucesso.",
    });
    
    setIsExporting(false);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Relatórios
            </h1>
            <p className="text-muted-foreground">
              Centro de análise e inteligência operacional
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                setIsLoading(true);
                await Promise.all([refetchInvoices(), fetchManifests()]);
                setIsLoading(false);
                toast({ title: "Dados atualizados" });
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="default" 
              size="sm"
              className="gap-2"
              onClick={() => setShowExportDialog(true)}
            >
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Sticky Filters */}
        <ReportsFilters
          filters={filters}
          options={filterOptions}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        {/* View Mode Indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs">
            📊 Visão Operacional
          </Badge>
          <span className="text-sm text-muted-foreground">
            Foco em volumes e contagens
          </span>
        </div>

        {/* Tabs for different report views */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="desempenho" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Desempenho
            </TabsTrigger>
            <TabsTrigger value="regional" className="gap-2">
              <MapPin className="h-4 w-4" />
              Eficiência Regional
            </TabsTrigger>
             <TabsTrigger value="frota" className="gap-2">
               <Truck className="h-4 w-4" />
               Uso de Frota
             </TabsTrigger>
             <TabsTrigger value="rentabilidade" className="gap-2">
               <DollarSign className="h-4 w-4" />
               Rentabilidade
             </TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="desempenho" className="space-y-6 mt-0">
            {/* Interactive KPIs with Drill-Down */}
            <InteractiveKPIs
              data={kpiData}
              viewMode={filters.viewMode}
              onKPIClick={handleKPIClick}
            />


            {/* SLA Evolution Chart */}
            <SLAEvolutionChart
              invoices={entityFilteredInvoices}
              dateRange={filters.dateRange}
              isLoading={isLoading}
              detailedAllowed={slaAccess.allowed}
            />

            {/* Pareto Chart */}
            <ReportsCharts
              slaData={[]}
              issuesData={chartsIssuesData}
              isLoading={isLoading}
            />


            {/* Top Offenders */}
            <TopOffenders 
              data={topOffendersData}
              onRouteClick={(route) => handleFiltersChange({ ...filters, route })}
              onClientClick={(client) => handleFiltersChange({ ...filters, client })}
            />
          </TabsContent>

          {/* Regional Efficiency Tab */}
          <TabsContent value="regional" className="mt-0">
            <RegionalEfficiencyDashboard 
              invoices={filteredInvoices.map(inv => ({
                id: inv.id,
                status: inv.status,
                regiao_logistica: inv.regiao_logistica,
                address_zip: inv.address_zip,
                total_value: inv.total_value,
                occurrence_type: inv.occurrence_type,
              }))}
              isLoading={invoicesLoading}
            />
          </TabsContent>
           {/* Fleet Usage Tab */}
           <TabsContent value="frota" className="mt-0">
             <FleetUsageReport />
           </TabsContent>
           {/* Rentabilidade e Agregados Tab */}
           <TabsContent value="rentabilidade" className="mt-0">
             <ProfitabilityReport
               allowed={rentabilidadeAccess.allowed}
               upgradePlanLabel={rentabilidadeAccess.upgradePlanLabel}
             />
           </TabsContent>
        </Tabs>

        {/* Drill-Down Sheet */}
        <KPIDrilldownSheet
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          kpiType={drilldownType}
          invoices={filteredInvoices}
        />

        {/* Export Dialog */}
        <ExportReportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          currentTab="desempenho"
          onExport={handleExport}
          isExporting={isExporting}
          dateRange={filters.dateRange}
        />
      </div>
    </AppLayout>
  );
}
