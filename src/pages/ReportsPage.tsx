import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PlanLockOverlay } from "@/components/plan/PlanLockOverlay";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileDown, Lock, MapPin, RefreshCw, Truck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";

// Components
import { ReportsFilters } from "@/components/reports/ReportsFilters";
import { defaultFilters, type FilterState, type ReportFilterOptions } from "@/components/reports/reportFilterState";
import { InteractiveKPIs } from "@/components/reports/InteractiveKPIs";
import { KPIDrilldownSheet, DrilldownType } from "@/components/reports/KPIDrilldownSheet";
import { TopOffenders, type OffenderTrend } from "@/components/reports/TopOffenders";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { SLAEvolutionChart } from "@/components/reports/SLAEvolutionChart";
import { ExportReportDialog, ExportOptions } from "@/components/reports/ExportReportDialog";
import { RegionalEfficiencyDashboard } from "@/components/reports/RegionalEfficiencyDashboard";
import { FleetUsageReport } from "@/components/reports/FleetUsageReport";
import { ProfitabilityReport } from "@/components/reports/ProfitabilityReport";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { formatManifestNumber, useManifestsDB } from "@/hooks/useManifestsDB";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { getOccurrenceLabel, getOccurrenceWeight } from "@/hooks/useSLADB";
import { downloadReportPdf, pdfCurrency, pdfPercent, type ReportPdfSection } from "@/lib/reportPdf";
import { useTenantData } from "@/hooks/useTenantData";
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

/** Tendencia de um ranking: % contra o periodo anterior, "new" se antes era zero, null sem como comparar. */
function offenderTrend(current: number, previous: number, hasPrevious: boolean): OffenderTrend {
  if (!hasPrevious) return null;
  if (!previous) return current > 0 ? "new" : null;
  return Math.round(percentChange(current, previous));
}

const trendText = (trend: OffenderTrend) =>
  trend === null ? "—" : trend === "new" ? "Novo" : `${trend > 0 ? "+" : ""}${trend}%`;

const isFinalized = (status: string) => isDeliveredStatus(status) || status === "occurrence" || isReturnedStatus(status);

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
  // Planilha de planos: uso da frota em todos; desempenho e eficiencia no Standard; exportar no Premium.
  const performanceAccess = checkFeatureAccess('reports_performance');
  const exportAccess = checkFeatureAccess('reports_export');

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

  // Sem desempenho no plano: abre direto em "Uso da frota" (quando o plano termina de carregar).
  const performanceAllowed = performanceAccess.allowed;
  useEffect(() => {
    if (!performanceAllowed) setActiveTab((tab) => (tab === "desempenho" || tab === "regional" ? "frota" : tab));
  }, [performanceAllowed]);

  // Fetch real invoices and manifests for reports
  const { invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useInvoicesDB();
  const { manifests, fetchManifests } = useManifestsDB();
  const { tenant } = useTenantData();

  // Os filtros sao aplicados na hora (sobre os dados ja carregados); antes havia
  // um "carregando" artificial de meio segundo a cada mudanca.
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Limpa cliente, regiao, motorista e operacao; o periodo escolhido continua.
  const handleClearFilters = () => {
    setFilters((current) => ({ ...defaultFilters, dateRange: current.dateRange }));
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
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
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
  const previousDateRange = useMemo(() => previousRange(filters.dateRange), [filters.dateRange]);
  const previousInvoices = useMemo(
    () => previousDateRange
      ? filterInvoicesForReport(invoices, manifestsById, { ...filters, dateRange: previousDateRange })
      : [],
    [invoices, manifestsById, filters, previousDateRange]
  );
  const filteredManifests = useMemo(() => filterManifestsForReport(manifests, filters), [manifests, filters]);
  const previousManifests = useMemo(
    () => previousDateRange ? filterManifestsForReport(manifests, { ...filters, dateRange: previousDateRange }) : [],
    [manifests, filters, previousDateRange]
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

  // Com filtro de cliente ou regiao, cada romaneio entra so com a parte do frete das notas
  // filtradas (antes o frete de todos os romaneios era dividido so pelas entregas do cliente).
  const entityScoped = filters.client !== 'all' || filters.route !== 'all';
  const invoicesPerManifest = useMemo(() => {
    const counts = new Map<string, number>();
    invoices.forEach(inv => { if (inv.manifest_id) counts.set(inv.manifest_id, (counts.get(inv.manifest_id) || 0) + 1); });
    return counts;
  }, [invoices]);
  /** Frete de agregados de cada romaneio que conta para as notas da lista. */
  const freightShares = useCallback((list: typeof filteredManifests, scopedInvoices: typeof filteredInvoices) => {
    const inView = new Map<string, number>();
    scopedInvoices.forEach(inv => { if (inv.manifest_id) inView.set(inv.manifest_id, (inView.get(inv.manifest_id) || 0) + 1); });
    return list
      .filter(m => !m.is_own_fleet && m.status !== 'cancelled')
      .map(m => ({
        manifest: m,
        freight: entityScoped
          ? (m.freight_value || 0) * ((inView.get(m.id) || 0) / (invoicesPerManifest.get(m.id) || 1))
          : m.freight_value || 0,
      }))
      .filter(share => !entityScoped || share.freight > 0);
  }, [entityScoped, invoicesPerManifest]);

  // Custo medio = fretes de agregados (nao frota propria) no periodo / entregas realizadas no periodo
  const avgCostOf = (list: typeof filteredManifests, scopedInvoices: typeof filteredInvoices, delivered: number) => {
    const totalFreight = freightShares(list, scopedInvoices).reduce((sum, share) => sum + share.freight, 0);
    return delivered > 0 ? totalFreight / delivered : 0;
  };

  // Calculate KPI data using period SLA
  // Sem dados no periodo anterior a tendencia fica null ("Sem dados do periodo anterior"),
  // em vez de "Igual ao periodo anterior".
  const kpiData = useMemo(() => {
    const avgCost = avgCostOf(filteredManifests, filteredInvoices, deliveryData.entregue);
    const previousAvgCost = avgCostOf(previousManifests, previousInvoices, previousDeliveryData.entregue);
    const hasPrevious = previousDeliveryData.total > 0;
    const relative = (current: number, previous: number) => (previous > 0 ? percentChange(current, previous) : null);

    // Sem entrega finalizada nao ha SLA (antes mostrava 100%); sem entrega, nao ha custo medio.
    const hasFinalized = filteredInvoices.some((inv) => isFinalized(inv.status));
    return {
      sla: hasFinalized ? periodSLA : null,
      slaTrend: hasFinalized && previousInvoices.some((inv) => isFinalized(inv.status)) ? periodSLA - previousPeriodSLA : null,
      onTime: deliveryData.entregue,
      onTimeTrend: relative(deliveryData.entregue, previousDeliveryData.entregue),
      delayed: deliveryData.atrasado,
      delayedTrend: relative(deliveryData.atrasado, previousDeliveryData.atrasado),
      returns: deliveryData.devolvido,
      returnsTrend: relative(deliveryData.devolvido, previousDeliveryData.devolvido),
      avgCost: deliveryData.entregue > 0 ? avgCost : null,
      avgCostTrend: deliveryData.entregue > 0 ? relative(avgCost, previousAvgCost) : null,
      totalVolume: deliveryData.total,
      volumeTrend: hasPrevious ? percentChange(deliveryData.total, previousDeliveryData.total) : null,
    };
  }, [periodSLA, previousPeriodSLA, filteredInvoices, previousInvoices, deliveryData, previousDeliveryData, filteredManifests, previousManifests]);

  // Impacto financeiro e insights: calculados, ainda nao exibidos (valores de exemplo).
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
    const hasPrevious = previousInvoices.length > 0;
    // Atrasos de cada regiao no periodo anterior (para saber o que e novo).
    const previousDelays = new Map(
      rankRegionsByDelay(previousInvoices, [], manifestsById, Number.MAX_SAFE_INTEGER).map((r) => [r.region, r.delays]),
    );

    return {
      routes: rankRegionsByDelay(filteredInvoices, previousInvoices, manifestsById).map(r => ({
        rank: r.rank,
        name: r.region,
        delays: r.delays,
        occurrences: r.occurrences,
        trend: offenderTrend(r.delays, previousDelays.get(r.region) || 0, hasPrevious),
      })),
      clients: Array.from(currentReturns.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
        .slice(0, 5)
        .map(([name, returns], i) => ({
          rank: i + 1,
          name,
          returns,
          trend: offenderTrend(returns, previousReturns.get(name) || 0, hasPrevious),
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

  // Custo medio por entrega: a conta e os romaneios de agregados que entram nela
  const costBreakdown = useMemo(() => {
    const shares = freightShares(filteredManifests, filteredInvoices);
    return {
      manifests: shares
        .map(({ manifest: m, freight }) => ({
          id: m.id,
          code: formatManifestNumber(m),
          driver: m.driver_name,
          date: m.scheduled_date,
          freight,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      totalFreight: shares.reduce((sum, share) => sum + share.freight, 0),
      delivered: deliveryData.entregue,
      avgCost: kpiData.avgCost ?? 0,
      scoped: entityScoped,
    };
  }, [filteredManifests, filteredInvoices, deliveryData.entregue, kpiData.avgCost, entityScoped, freightShares]);

  // Filtros da tela em texto (PDF e janela de exportar)
  const filtersLabel = useMemo(() => {
    const driverName = filterOptions.drivers.find(d => d.id === filters.driver)?.name;
    return [
      filters.client !== 'all' ? `Cliente: ${filters.client}` : null,
      filters.route !== 'all' ? `Região: ${filters.route}` : null,
      filters.driver !== 'all' ? `Motorista: ${driverName || filters.driver}` : null,
      filters.operationType !== 'all' ? `Operação: ${filters.operationType === 'own_fleet' ? 'Frota própria' : 'Agregados'}` : null,
    ].filter(Boolean).join(' • ');
  }, [filters, filterOptions.drivers]);

  // Clique numa regiao/cliente do ranking filtra a tela; o aviso confirma o que mudou.
  const applyRankingFilter = (key: "route" | "client", value: string) => {
    handleFiltersChange({ ...filters, [key]: value });
    toast({
      title: key === "route" ? `Mostrando só a região ${value}` : `Mostrando só o cliente ${value}`,
      description: "Para ver tudo de novo, use Limpar filtros no topo da tela.",
    });
  };

  // Handle KPI click for drill-down
  const handleKPIClick = (type: DrilldownType) => {
    setDrilldownType(type);
    setDrilldownOpen(true);
  };

  // Exporta em PDF o que esta filtrado na tela (antes so simulava e avisava sucesso).
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true);
    try {
      const fmtDate = (d?: Date) => (d ? d.toLocaleDateString('pt-BR') : '...');
      const periodLabel = filters.dateRange.from || filters.dateRange.to
        ? `${fmtDate(filters.dateRange.from)} a ${fmtDate(filters.dateRange.to)}`
        : 'Todo o histórico';

      const sections: ReportPdfSection[] = [];
      const activeManifests = filteredManifests.filter(m => m.status !== 'cancelled');
      const thirdParty = activeManifests.filter(m => !m.is_own_fleet);
      const totalFreight = freightShares(filteredManifests, filteredInvoices).reduce((sum, share) => sum + share.freight, 0);
      const totalCargo = filteredInvoices.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

      if (options.tabs.desempenho) {
        sections.push({
          title: 'Desempenho',
          summary: [
            ['SLA do período', kpiData.sla === null ? 'Sem entregas finalizadas' : pdfPercent(kpiData.sla)],
            ['Notas no período', String(deliveryData.total)],
            ['Entregues', String(deliveryData.entregue)],
            ['Atrasadas', String(deliveryData.atrasado)],
            ['Devolvidas', String(deliveryData.devolvido)],
            ['Custo médio por entrega', (kpiData.avgCost === null ? 'Sem entregas' : pdfCurrency(kpiData.avgCost))],
          ],
        });
      }
      if (options.tabs.operacional) {
        sections.push({
          title: 'Regiões com mais atrasos e ocorrências',
          table: {
            headers: ['#', 'Região', 'Atrasos', 'Ocorrências', 'Tendência'],
            widths: [10, 82, 30, 32, 28],
            rows: topOffendersData.routes.map(r => [
              String(r.rank), r.name, String(r.delays), String(r.occurrences), trendText(r.trend),
            ]),
          },
          emptyText: 'Nenhum atraso ou ocorrência no período.',
        });
        sections.push({
          title: 'Motivos de ocorrência',
          table: {
            headers: ['#', 'Motivo', 'Quantidade', '% das ocorrências'],
            widths: [10, 102, 32, 38],
            rows: topOffendersData.reasons.map(r => [String(r.rank), getOccurrenceLabel(r.reason), String(r.count), pdfPercent(r.percentage)]),
          },
          emptyText: 'Nenhuma ocorrência no período.',
        });
      }
      if (options.tabs.financeiro) {
        sections.push({
          title: 'Financeiro',
          summary: [
            ['Romaneios no período', String(activeManifests.length)],
            ['Romaneios de agregados', String(thirdParty.length)],
            ['Frete de agregados', pdfCurrency(totalFreight)],
            ['Valor das mercadorias', pdfCurrency(totalCargo)],
            ['Frete / valor das mercadorias', pdfPercent(totalCargo > 0 ? (totalFreight / totalCargo) * 100 : 0)],
            ['Custo médio por entrega', (kpiData.avgCost === null ? 'Sem entregas' : pdfCurrency(kpiData.avgCost))],
          ],
        });
      }
      if (options.tabs.clientes) {
        const byClient = new Map<string, { count: number; value: number }>();
        filteredInvoices.forEach(inv => {
          const entry = byClient.get(inv.recipient_name) || { count: 0, value: 0 };
          entry.count += 1;
          entry.value += inv.total_value || 0;
          byClient.set(inv.recipient_name, entry);
        });
        sections.push({
          title: 'Principais clientes (por valor)',
          table: {
            headers: ['Cliente', 'Notas', 'Valor'],
            widths: [122, 25, 35],
            rows: Array.from(byClient.entries())
              .sort((a, b) => b[1].value - a[1].value)
              .slice(0, 15)
              .map(([name, d]) => [name, String(d.count), pdfCurrency(d.value)]),
          },
        });
        sections.push({
          title: 'Clientes com mais devoluções/ocorrências',
          table: {
            headers: ['#', 'Cliente', 'Devoluções', 'Tendência'],
            widths: [10, 112, 30, 30],
            rows: topOffendersData.clients.map(c => [String(c.rank), c.name, String(c.returns), trendText(c.trend)]),
          },
          emptyText: 'Nenhuma devolução no período.',
        });
      }

      if (sections.length === 0) {
        toast({ title: 'Nada para exportar', description: 'Selecione ao menos uma seção.', variant: 'destructive' });
        return;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = downloadReportPdf(
        { companyName: tenant?.razao_social || 'Na Hora Frota', periodLabel, filtersLabel: filtersLabel || 'Nenhum', sections },
        `relatorio-${stamp}.pdf`,
      );
      toast({
        title: "Relatório exportado",
        description: `${fileName} foi baixado.`,
      });
    } catch (err) {
      console.error('Report export error:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // aria-disabled no botao: o foco fica nele enquanto atualiza.
  const handleRefresh = async () => {
    if (isLoading) return;
    // Sem internet a busca falha e esvaziava os graficos; os numeros atuais ficam.
    if (!navigator.onLine) {
      toast({
        title: "Sem conexão com a internet",
        description: "Os números continuam os da última atualização. Tente de novo quando a internet voltar.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    await Promise.all([refetchInvoices(), fetchManifests()]);
    setIsLoading(false);
    toast({ title: "Dados atualizados" });
  };

  // Carregando pela primeira vez: esqueleto, e nao "nenhuma ocorrencia" por um instante.
  const firstLoad = isLoading || (invoicesLoading && invoices.length === 0);
  // Uso da frota e Rentabilidade so usam o periodo.
  const periodOnlyTab = activeTab === "frota" || activeTab === "rentabilidade";

  const tabs = [
    { value: "desempenho", label: "Desempenho", icon: BarChart3 },
    { value: "regional", label: "Eficiência regional", icon: MapPin },
    { value: "frota", label: "Uso da frota", icon: Truck },
    { value: "rentabilidade", label: "Rentabilidade", icon: Wallet },
  ] as const;

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Relatórios"
        description="SLA, custos, eficiência e ocorrências do período. Escolha o período e todos os gráficos acompanham."
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh} aria-disabled={isLoading || undefined} className="aria-disabled:pointer-events-none aria-disabled:opacity-60">
              <RefreshCw className={isLoading ? "animate-spin" : undefined} aria-hidden="true" />
              {isLoading ? "Atualizando" : "Atualizar"}
            </Button>
            {exportAccess.allowed ? (
              <Button variant="outline" onClick={() => setShowExportDialog(true)}>
                <FileDown aria-hidden="true" />
                Exportar PDF
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to={`/upgrade?feature=reports_export&plano=${encodeURIComponent(exportAccess.upgradePlanLabel)}`} title={`Exportar relatórios faz parte do plano ${exportAccess.upgradePlanLabel}`}>
                  <Lock aria-hidden="true" />
                  Exportar PDF
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {/* Periodo e filtros (fixos no topo no computador) */}
        <ReportsFilters
          filters={filters}
          options={filterOptions}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          showEntityFilters={!periodOnlyTab}
        />

        {/* Abas: cada uma e uma visao do mesmo periodo */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList
            aria-label="Tipo de relatório"
            className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                // No celular (2 colunas) o nome quebra em vez de vazar.
                <TabsTrigger key={tab.value} value={tab.value} className="min-h-[2.5rem] whitespace-normal px-2 text-center leading-tight sm:min-h-0 sm:whitespace-nowrap sm:px-3">
                  <Icon aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Desempenho */}
          <TabsContent value="desempenho" className="mt-6 space-y-6 md:space-y-8">
            {!performanceAccess.allowed ? (
              <PlanLockOverlay upgradePlanLabel={performanceAccess.upgradePlanLabel} className="min-h-[18rem]" />
            ) : (
            <>
            {/* Indicadores com detalhe ao clicar */}
            <InteractiveKPIs
              data={kpiData}
              viewMode={filters.viewMode}
              onKPIClick={handleKPIClick}
              loading={firstLoad}
            />

            <SLAEvolutionChart
              invoices={entityFilteredInvoices}
              dateRange={filters.dateRange}
              isLoading={firstLoad}
              detailedAllowed={slaAccess.allowed}
            />

            {/* Pareto de ocorrencias */}
            <ReportsCharts
              slaData={[]}
              issuesData={chartsIssuesData}
              isLoading={firstLoad}
            />

            <TopOffenders
              data={topOffendersData}
              loading={firstLoad}
              onRouteClick={(route) => applyRankingFilter("route", route)}
              onClientClick={(client) => applyRankingFilter("client", client)}
            />
            </>
            )}
          </TabsContent>

          {/* Eficiencia regional */}
          <TabsContent value="regional" className="mt-6">
            {!performanceAccess.allowed ? (
              <PlanLockOverlay upgradePlanLabel={performanceAccess.upgradePlanLabel} className="min-h-[18rem]" />
            ) : (
            <RegionalEfficiencyDashboard
              invoices={filteredInvoices.map(inv => ({
                id: inv.id,
                status: inv.status,
                regiao_logistica: inv.regiao_logistica,
                address_zip: inv.address_zip,
                total_value: inv.total_value,
                occurrence_type: inv.occurrence_type,
              }))}
              isLoading={firstLoad}
            />
            )}
          </TabsContent>

          {/* Uso de frota */}
          <TabsContent value="frota" className="mt-6">
            <FleetUsageReport dateRange={filters.dateRange} />
          </TabsContent>

          {/* Rentabilidade e agregados */}
          <TabsContent value="rentabilidade" className="mt-6">
            <ProfitabilityReport
              allowed={rentabilidadeAccess.allowed}
              upgradePlanLabel={rentabilidadeAccess.upgradePlanLabel}
              dateRange={filters.dateRange}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Detalhe do indicador */}
      <KPIDrilldownSheet
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        kpiType={drilldownType}
        invoices={filteredInvoices}
        cost={costBreakdown}
      />

      <ExportReportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExport={handleExport}
        isExporting={isExporting}
        dateRange={filters.dateRange}
        filtersLabel={filtersLabel}
      />
    </>
  );
}
