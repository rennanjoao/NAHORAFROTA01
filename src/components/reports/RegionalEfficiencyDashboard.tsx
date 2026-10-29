import { useMemo } from "react";
import { AlertTriangle, BarChart3, MapPin, Package, Percent, PieChart as PieIcon, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardsSkeleton, EmptyState, StatCard, StatusBadge, type Tone } from "@/components/patterns";
import { calculateRegiaoLogistica } from "@/lib/cepRegionMapping";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  axisLine,
  axisTick,
  chartScale,
  legendStyle,
  BAD,
  fmtNumber,
  fmtPercent,
  GOOD,
  gridProps,
  MUTED,
  SERIES,
  tooltipCursor,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "./chartTheme";
import { ChartFrame, ReportCard, WrappedTick } from "./ReportCard";

interface Invoice {
  id: string;
  status: string;
  regiao_logistica: string | null;
  address_zip?: string | null;
  total_value: number;
  occurrence_type: string | null;
}

interface RegionalEfficiencyDashboardProps {
  invoices: Invoice[];
  isLoading?: boolean;
}

interface RegionStats {
  region: string;
  total: number;
  delivered: number;
  occurrences: number;
  pending: number;
  inTransit: number;
  totalValue: number;
  deliveredValue: number;
  successRate: number;
}

// Cor fixa por area (a cor segue a area, nao a posicao na lista).
const AREA_COLORS: Record<string, string> = {
  "Capital SP": SERIES[0],
  "Grande SP": SERIES[1],
  Interior: SERIES[2],
  Litoral: SERIES[3],
  Outras: MUTED,
};

/** Area da regiao (a mesma do grafico de rosca). */
function areaOf(region: string): string {
  if (region.startsWith("SP -")) return "Capital SP";
  if (region.startsWith("GSP")) return "Grande SP";
  if (region.startsWith("Interior")) return "Interior";
  if (region.startsWith("Litoral")) return "Litoral";
  return "Outras";
}

/** Ponto com a cor da area (antes usava verde/amarelo de status, que confundia com a taxa). */
function AreaDot({ region }: { region: string }) {
  const area = areaOf(region);
  return (
    <span
      aria-hidden="true"
      title={area}
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: AREA_COLORS[area] ?? MUTED }}
    />
  );
}

const rateTone = (rate: number): Tone => (rate >= 90 ? "success" : rate >= 70 ? "warning" : "danger");

/** Taxa de sucesso; sem nota finalizada ainda nao ha taxa (nao e 0%). */
function SuccessRate({ stat }: { stat: RegionStats }) {
  if (stat.delivered + stat.occurrences === 0) return <StatusBadge tone="neutral">Sem finalizadas</StatusBadge>;
  return (
    <StatusBadge tone={rateTone(stat.successRate)} className="font-data">
      {fmtPercent(stat.successRate)}
    </StatusBadge>
  );
}

function resolveInvoiceRegion(invoice: Invoice): string {
  const storedRegion = invoice.regiao_logistica?.trim();
  if (storedRegion && storedRegion !== 'Sem Região' && storedRegion !== 'Sem RegiÃ£o') {
    return storedRegion;
  }

  return calculateRegiaoLogistica(invoice.address_zip);
}

export function RegionalEfficiencyDashboard({ invoices, isLoading }: RegionalEfficiencyDashboardProps) {
  // Calcula estatísticas por região
  const regionStats = useMemo(() => {
    const stats: Record<string, RegionStats> = {};
    
    invoices.forEach(inv => {
      const region = resolveInvoiceRegion(inv);
      
      if (!stats[region]) {
        stats[region] = {
          region,
          total: 0,
          delivered: 0,
          occurrences: 0,
          pending: 0,
          inTransit: 0,
          totalValue: 0,
          deliveredValue: 0,
          successRate: 0,
        };
      }
      
      stats[region].total++;
      stats[region].totalValue += inv.total_value || 0;
      
      if (inv.status === 'delivered') {
        stats[region].delivered++;
        stats[region].deliveredValue += inv.total_value || 0;
      } else if (inv.status === 'occurrence' || inv.occurrence_type) {
        stats[region].occurrences++;
      } else if (inv.status === 'pending') {
        stats[region].pending++;
      } else if (inv.status === 'in_transit' || inv.status === 'in_route') {
        stats[region].inTransit++;
      }
    });
    
    // Calcula taxa de sucesso
    Object.values(stats).forEach(s => {
      const completed = s.delivered + s.occurrences;
      s.successRate = completed > 0 ? (s.delivered / completed) * 100 : 0;
    });
    
    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [invoices]);

  // Dados para gráfico de barras (Top 10 regiões por volume)
  const barChartData = useMemo(() => {
    return regionStats.slice(0, 10).map(s => ({
      name: s.region.replace('Interior - ', '').replace('GSP - ', '').replace('SP - ', ''),
      fullName: s.region,
      entregues: s.delivered,
      ocorrencias: s.occurrences,
    }));
  }, [regionStats]);

  // Dados para gráfico de pizza (Distribuição por categoria)
  const pieChartData = useMemo(() => {
    const categories: Record<string, number> = {
      'Capital SP': 0,
      'Grande SP': 0,
      'Interior': 0,
      'Litoral': 0,
      'Outras': 0,
    };
    
    regionStats.forEach(s => {
      categories[areaOf(s.region)] += s.total;
    });
    
    return Object.entries(categories)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [regionStats]);

  // KPIs gerais
  const totalDelivered = regionStats.reduce((acc, s) => acc + s.delivered, 0);
  const totalOccurrences = regionStats.reduce((acc, s) => acc + s.occurrences, 0);
  const totalValue = regionStats.reduce((acc, s) => acc + s.totalValue, 0);
  const overallSuccessRate = (totalDelivered + totalOccurrences) > 0 
    ? (totalDelivered / (totalDelivered + totalOccurrences)) * 100 
    : 0;

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="space-y-6">
        <CardsSkeleton count={4} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[360px] rounded-lg" />
          <Skeleton className="h-[360px] rounded-lg" />
        </div>
      </div>
    );
  }

  const pieTotal = pieChartData.reduce((acc, d) => acc + d.value, 0);
  const barSummary =
    barChartData.length > 0
      ? `Gráfico de barras de entregas e ocorrências por região. ${barChartData
          .map((d) => `${d.fullName}: ${d.entregues} entregues e ${d.ocorrencias} ocorrências`)
          .join("; ")}.`
      : "";
  const pieSummary =
    pieTotal > 0
      ? `Gráfico de rosca com as notas por área: ${pieChartData
          .map((d) => `${d.name} ${fmtPercent((d.value / pieTotal) * 100, 0)}`)
          .join("; ")}.`
      : "";

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Regiões com entregas" value={regionStats.length} icon={MapPin} tone="brand" hint="No período" />
        <StatCard label="Notas entregues" value={totalDelivered} icon={Package} tone="success" hint="Com sucesso" />
        <StatCard label="Ocorrências" value={totalOccurrences} icon={AlertTriangle} tone="danger" hint="Entregas com problema" />
        <StatCard
          label="Taxa de sucesso"
          value={overallSuccessRate}
          format={(v) => fmtPercent(v)}
          icon={Percent}
          tone={(totalDelivered + totalOccurrences) > 0 ? rateTone(overallSuccessRate) : "neutral"}
          hint="Entregues entre as finalizadas"
        />
      </div>

      {regionStats.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nenhuma nota no período"
          description="Mude o período ou os filtros no topo para ver como cada região está indo."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ReportCard
              icon={BarChart3}
              title="Entregas e ocorrências por região"
              description="As 10 regiões com mais notas. Verde é entregue, vermelho é ocorrência."
            >
              <ChartFrame height={Math.max(200, barChartData.length * 56 + 56)} summary={barSummary}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid {...gridProps} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={Math.round(112 * chartScale())} tick={<WrappedTick maxChars={15} />} interval={0} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={tooltipCursor}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
                    />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="entregues" name="Entregues" fill={GOOD} radius={[0, 4, 4, 0]} maxBarSize={14} />
                    <Bar dataKey="ocorrencias" name="Ocorrências" fill={BAD} radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </ReportCard>

            <ReportCard icon={PieIcon} title="Notas por área" description="Quanto do volume foi para capital, Grande SP, interior e litoral.">
              {pieChartData.length > 0 ? (
                <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <ChartFrame height={220} summary={pieSummary}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="62%"
                          outerRadius="92%"
                          paddingAngle={pieChartData.length > 1 ? 2 : 0}
                          dataKey="value"
                          rootTabIndex={-1}
                          stroke="hsl(var(--card))"
                          // Com uma area so, a borda abria um corte no anel.
                          strokeWidth={pieChartData.length > 1 ? 2 : 0}
                        >
                          {pieChartData.map((entry) => (
                            <Cell key={entry.name} fill={AREA_COLORS[entry.name] ?? MUTED} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                          formatter={(value: number, name: string) => [`${fmtNumber(value)} notas`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                  <ul className="space-y-2.5" aria-label="Legenda">
                    {pieChartData.map((entry) => (
                      <li key={entry.name} className="flex items-center gap-2.5 text-sm">
                        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: AREA_COLORS[entry.name] ?? MUTED }} />
                        <span className="flex-1 text-foreground">{entry.name}</span>
                        <span className="font-data text-muted-foreground">{fmtNumber(entry.value)}</span>
                        <span className="w-12 text-right font-data font-semibold text-foreground">
                          {fmtPercent((entry.value / pieTotal) * 100, 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState compact icon={PieIcon} title="Sem dados por área" description="Nenhuma nota no período." />
              )}
            </ReportCard>
          </div>

          {/* Ranking */}
          <ReportCard
            icon={Trophy}
            title="Ranking por região"
            description="As 15 regiões com mais notas, com a taxa de sucesso de cada uma."
          >
            <div className="-mx-5 hidden border-t md:block sm:-mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5 sm:pl-6">Região</TableHead>
                    <TableHead className="text-right">Notas</TableHead>
                    <TableHead className="text-right">Entregues</TableHead>
                    <TableHead className="text-right">Ocorrências</TableHead>
                    <TableHead className="text-right">Taxa de sucesso</TableHead>
                    <TableHead className="pr-5 text-right sm:pr-6">Valor total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionStats.slice(0, 15).map((stat) => (
                    <TableRow key={stat.region}>
                      <TableCell className="pl-5 sm:pl-6">
                        <span className="flex items-center gap-2">
                          <AreaDot region={stat.region} />
                          <span className="font-medium">{stat.region}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-data">{stat.total}</TableCell>
                      <TableCell className="text-right font-data">{stat.delivered}</TableCell>
                      <TableCell className="text-right font-data">{stat.occurrences}</TableCell>
                      <TableCell className="text-right">
                        <SuccessRate stat={stat} />
                      </TableCell>
                      <TableCell className="pr-5 text-right font-data sm:pr-6">{formatCurrency(stat.totalValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {regionStats.slice(0, 15).map((stat) => (
                <li key={stat.region}>
                  <Card className="space-y-3 p-4 shadow-none">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <AreaDot region={stat.region} />
                        <span className="truncate font-medium" title={stat.region}>{stat.region}</span>
                      </span>
                      <SuccessRate stat={stat} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Notas</dt>
                        <dd className="font-data font-semibold">{stat.total}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Entregues</dt>
                        <dd className="font-data font-semibold">{stat.delivered}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Ocorrências</dt>
                        <dd className="font-data font-semibold">{stat.occurrences}</dd>
                      </div>
                    </dl>
                    <p className="flex items-center justify-between border-t pt-2 text-sm">
                      <span className="text-muted-foreground">Valor total</span>
                      <span className="font-data font-semibold">{formatCurrency(stat.totalValue)}</span>
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </ReportCard>
        </>
      )}
    </div>
  );
}
