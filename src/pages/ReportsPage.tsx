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
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

// Components
import { ReportsFilters, FilterState, defaultFilters } from "@/components/reports/ReportsFilters";
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
  const { invoices, isLoading: invoicesLoading } = useInvoicesDB();
  const { manifests } = useManifestsDB();

  // Filter helper
  const isInDateRange = (date: Date) => {
    if (!filters.dateRange.from || !filters.dateRange.to) return true;
    return isWithinInterval(date, { 
      start: startOfDay(filters.dateRange.from), 
      end: endOfDay(filters.dateRange.to) 
    });
  };

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
  
  // Filter delivery data
  const deliveryData = useMemo(() => {
    // Use real invoice data from database
    const filtered = invoices.filter(inv => {
      const invDate = new Date(inv.imported_at);
      return isInDateRange(invDate);
    });
    
    return {
      entregue: filtered.filter(inv => inv.status === 'entregue' || inv.status === 'delivered').length,
      devolvido: filtered.filter(inv => inv.status === 'devolvido' || inv.status === 'returned').length,
      atrasado: filtered.filter(inv => inv.occurrence_type).length,
    };
  }, [invoices, filters.dateRange]);

  // SLA chart access check
  const slaEvolutionAccess = checkFeatureAccess('sla_evolution');

  // Calculate period SLA as average of individual driver scores
  // Formula: (Sum of each driver's SLA) / (Number of distinct drivers with activity)
  const periodSLA = useMemo(() => {
    const filtered = invoices.filter(inv => {
      const invDate = new Date(inv.imported_at);
      return isInDateRange(invDate);
    });
    
    const finalized = filtered.filter(inv => 
      inv.status === 'entregue' || inv.status === 'delivered' || inv.status === 'occurrence' || inv.status === 'devolvido' || inv.status === 'returned'
    );
    
    if (finalized.length === 0) return 100;
    
    // Group finalized invoices by driver_id
    const driverInvoices = new Map<string, typeof finalized>();
    finalized.forEach(inv => {
      const driverId = inv.driver_id || '__no_driver__';
      if (!driverInvoices.has(driverId)) {
        driverInvoices.set(driverId, []);
      }
      driverInvoices.get(driverId)!.push(inv);
    });
    
    // Calculate individual SLA per driver
    let totalDriverSLA = 0;
    let driverCount = 0;
    
    driverInvoices.forEach((driverInvs) => {
      let driverWeight = 0;
      driverInvs.forEach(inv => {
        const w = getOccurrenceWeight(inv.occurrence_type, (inv.status === 'entregue' || inv.status === 'delivered') ? 'delivered' : 'occurrence');
        if (w >= 0) driverWeight += w;
      });
      const driverSLA = (driverWeight / driverInvs.length) * 100;
      totalDriverSLA += Math.min(100, Math.max(0, driverSLA));
      driverCount++;
    });
    
    if (driverCount === 0) return 100;
    return Math.min(100, Math.max(0, totalDriverSLA / driverCount));
  }, [invoices, filters.dateRange]);

  // Filter and aggregate occurrences
  const occurrencesData = useMemo(() => {
    const filtered = invoices.filter(inv => {
      const invDate = new Date(inv.imported_at);
      return isInDateRange(invDate) && inv.occurrence_type;
    });
    
    const reasonTotals: Record<string, number> = {};
    filtered.forEach(inv => {
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
  }, [invoices, filters.dateRange]);

  // Calculate KPI data using period SLA
  const kpiData = useMemo(() => {
    const total = deliveryData.entregue + deliveryData.devolvido + deliveryData.atrasado;
    
    return {
      sla: periodSLA,
      slaTrend: 0,
      onTime: deliveryData.entregue,
      onTimeTrend: 0,
      delayed: deliveryData.atrasado,
      delayedTrend: 0,
      returns: deliveryData.devolvido,
      returnsTrend: 0,
      avgCost: (() => {
        // Custo médio = soma fretes de agregados (não frota própria) no período / entregas realizadas no período
        const filteredManifests = manifests.filter(m => {
          const mDate = new Date(m.scheduled_date);
          return !m.is_own_fleet && isInDateRange(mDate);
        });
        const totalFreight = filteredManifests.reduce((sum, m) => sum + (m.freight_value || 0), 0);
        const deliveredCount = deliveryData.entregue;
        return deliveredCount > 0 ? totalFreight / deliveredCount : 0;
      })(),
      avgCostTrend: 0,
      totalVolume: total,
      volumeTrend: 0,
    };
  }, [periodSLA, deliveryData, manifests, filters.dateRange]);

  // Financial impact data
  const financialImpactData = useMemo(() => ({
    returnCount: deliveryData.devolvido,
    returnCost: 85, // Cost per return
    delayedCount: deliveryData.atrasado,
    delayPenalty: 45, // Penalty per delay
    reworkPercentage: ((deliveryData.devolvido + deliveryData.atrasado) / 
      (deliveryData.entregue + deliveryData.devolvido + deliveryData.atrasado)) * 100,
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

  // Top offenders data
  const topOffendersData = useMemo(() => ({
    routes: [] as { rank: number; name: string; delays: number; trend: number }[],
    clients: [] as { rank: number; name: string; returns: number; trend: number }[],
    reasons: occurrencesData.map((d, i) => ({
      rank: i + 1,
      reason: d.reason,
      count: d.count,
      percentage: d.percentage,
    })),
  }), [occurrencesData]);

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
              onClick={() => {
                setIsLoading(true);
                setTimeout(() => {
                  setIsLoading(false);
                  toast({ title: "Dados atualizados" });
                }, 800);
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
              invoices={invoices}
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
              onRouteClick={(route) => toast({ title: `Navegando para rota: ${route}` })}
              onClientClick={(client) => toast({ title: `Navegando para cliente: ${client}` })}
            />
          </TabsContent>

          {/* Regional Efficiency Tab */}
          <TabsContent value="regional" className="mt-0">
            <RegionalEfficiencyDashboard 
              invoices={invoices.map(inv => ({
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
