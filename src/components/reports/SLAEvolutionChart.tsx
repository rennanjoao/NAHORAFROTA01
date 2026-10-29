import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, LineChart as LineChartIcon } from "lucide-react";
import { EmptyState, StatusBadge, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { formatSLA } from "@/lib/formatSLA";
import { getSLAColorScheme } from "@/lib/slaThresholds";
import { getOccurrenceWeight } from "@/hooks/useSLADB";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  type TooltipProps,
} from "recharts";
import { axisLine, axisTick, gridProps, MUTED, SERIES, BAD, tooltipStyle } from "./chartTheme";
import { ChartFrame, ReportCard } from "./ReportCard";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  subMonths,
  format,
  isAfter,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DBInvoice } from "@/hooks/useInvoicesDB";
import { getInvoiceEventDate, isDeliveredStatus, isReturnedStatus } from "@/lib/reportFilters";

interface SLAEvolutionChartProps {
  invoices: DBInvoice[];
  dateRange: { from?: Date; to?: Date };
  isLoading?: boolean;
  /** Whether the detailed cumulative view is allowed (plan-gated) */
  detailedAllowed: boolean;
}

/** Calculate SLA for a set of invoices using driver-average method */
function calculateDriverAverageSLA(invoices: DBInvoice[]): number {
  // Inclui os status reais do banco ("delivered"/"returned"); antes so os
  // legados em portugues eram considerados e as entregas ficavam de fora.
  const finalized = invoices.filter(
    (inv) => isDeliveredStatus(inv.status) || inv.status === "occurrence" || isReturnedStatus(inv.status)
  );
  if (finalized.length === 0) return -1; // no data

  const driverMap = new Map<string, DBInvoice[]>();
  finalized.forEach((inv) => {
    const driverId = inv.driver_id || "__no_driver__";
    if (!driverMap.has(driverId)) driverMap.set(driverId, []);
    driverMap.get(driverId)!.push(inv);
  });

  let totalDriverSLA = 0;
  let driverCount = 0;

  driverMap.forEach((driverInvs) => {
    let w = 0;
    driverInvs.forEach((inv) => {
      const weight = getOccurrenceWeight(
        inv.occurrence_type,
        isDeliveredStatus(inv.status) ? "delivered" : "occurrence"
      );
      if (weight >= 0) w += weight;
    });
    const sla = (w / driverInvs.length) * 100;
    totalDriverSLA += Math.min(100, Math.max(0, sla));
    driverCount++;
  });

  if (driverCount === 0) return -1;
  return Math.min(100, Math.max(0, totalDriverSLA / driverCount));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const levelTone: Record<string, Tone> = { excellent: "success", good: "warning", attention: "warning", critical: "danger" };

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={tooltipStyle} className="space-y-1 px-3 py-2">
      <p className="font-semibold">Dia {label}</p>
      {payload.map((entry) => {
        if (entry.value == null) return null;
        const scheme = getSLAColorScheme(entry.value);
        return (
          <p key={String(entry.dataKey)} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}: <span className="font-data font-semibold">{formatSLA(entry.value)}%</span>
            <span className="text-muted-foreground">({scheme.labelPt})</span>
          </p>
        );
      })}
    </div>
  );
}

export function SLAEvolutionChart({
  invoices,
  dateRange,
  isLoading,
  detailedAllowed,
}: SLAEvolutionChartProps) {
  // Abre no mes mais recente do periodo escolhido (antes abria no primeiro, quase sempre vazio).
  const defaultMonth = useMemo(
    () => format(dateRange.to || dateRange.from || new Date(), "yyyy-MM"),
    [dateRange.from, dateRange.to]
  );
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  useEffect(() => {
    setSelectedMonth(defaultMonth);
  }, [defaultMonth]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>([defaultMonth, format(new Date(), "yyyy-MM")]);
    invoices.forEach((invoice) => {
      const eventDate = getInvoiceEventDate(invoice);
      if (eventDate) {
        months.add(format(new Date(eventDate), "yyyy-MM"));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [defaultMonth, invoices]);

  const selectedRefDate = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [selectedMonth]);

  const chartData = useMemo(() => {
    const refDate = selectedRefDate;
    const currentMonthStart = startOfMonth(refDate);
    const currentMonthEnd = endOfMonth(refDate);
    const today = new Date();

    // Limit to today if current month
    const effectiveEnd = isAfter(currentMonthEnd, today) ? today : currentMonthEnd;

    const days = eachDayOfInterval({
      start: currentMonthStart,
      end: effectiveEnd,
    });

    // Previous month
    const prevMonthStart = startOfMonth(subMonths(refDate, 1));
    const prevMonthEnd = endOfMonth(subMonths(refDate, 1));
    const prevDays = eachDayOfInterval({
      start: prevMonthStart,
      end: prevMonthEnd,
    });

    // Helper: get invoices for a specific day
    const getInvoicesForDay = (day: Date) =>
      invoices.filter((inv) => {
        // Dia da entrega/ocorrencia, nao o da importacao da NF
        const invDate = new Date(getInvoiceEventDate(inv));
        return isSameDay(invDate, day);
      });

    // Current month: cumulative average
    const dailySLAs: number[] = [];
    days.forEach((day) => {
      const dayInvs = getInvoicesForDay(day);
      const daySLA = calculateDriverAverageSLA(dayInvs);
      if (daySLA >= 0) {
        dailySLAs.push(daySLA);
      }
    });

    // Previous month: cumulative average
    const prevDailySLAs: number[] = [];
    prevDays.forEach((day) => {
      const dayInvs = getInvoicesForDay(day);
      const daySLA = calculateDriverAverageSLA(dayInvs);
      if (daySLA >= 0) {
        prevDailySLAs.push(daySLA);
      }
    });

    // Build chart data with cumulative averages
    const maxDays = Math.max(days.length, prevDays.length, 31);
    const result: {
      day: number;
      current?: number;
      previous?: number;
    }[] = [];

    let cumSumCurrent = 0;
    let cumCountCurrent = 0;
    let cumSumPrev = 0;
    let cumCountPrev = 0;

    // Re-calculate with day-by-day cumulative
    const currentDayMap = new Map<number, number>();
    days.forEach((day) => {
      const dayNum = day.getDate();
      const dayInvs = getInvoicesForDay(day);
      const daySLA = calculateDriverAverageSLA(dayInvs);
      if (daySLA >= 0) currentDayMap.set(dayNum, daySLA);
    });

    const prevDayMap = new Map<number, number>();
    prevDays.forEach((day) => {
      const dayNum = day.getDate();
      const dayInvs = getInvoicesForDay(day);
      const daySLA = calculateDriverAverageSLA(dayInvs);
      if (daySLA >= 0) prevDayMap.set(dayNum, daySLA);
    });

    for (let d = 1; d <= maxDays; d++) {
      const point: { day: number; current?: number; previous?: number } = {
        day: d,
      };

      if (currentDayMap.has(d)) {
        cumSumCurrent += currentDayMap.get(d)!;
        cumCountCurrent++;
      }
      if (cumCountCurrent > 0 && d <= days.length) {
        point.current = cumSumCurrent / cumCountCurrent;
      }

      if (prevDayMap.has(d)) {
        cumSumPrev += prevDayMap.get(d)!;
        cumCountPrev++;
      }
      if (cumCountPrev > 0 && d <= prevDays.length) {
        point.previous = cumSumPrev / cumCountPrev;
      }

      result.push(point);
    }

    return result;
  }, [invoices, selectedRefDate]);

  // Get current cumulative SLA (last data point)
  const currentSLA = useMemo(() => {
    const lastPoint = [...chartData].reverse().find((p) => p.current != null);
    return lastPoint?.current ?? null;
  }, [chartData]);

  const currentScheme = currentSLA != null ? getSLAColorScheme(currentSLA) : null;

  const hasPreviousData = useMemo(() => chartData.some(p => p.previous != null), [chartData]);
  const currentDataRows = useMemo(
    () => chartData.filter((p) => p.current != null || p.previous != null),
    [chartData]
  );

  // Eixo comeca perto dos dados (antes ia de 0 a 100 e a linha ficava espremida no topo).
  const yAxis = useMemo(() => {
    const values = chartData.flatMap((p) => [p.current, p.previous]).filter((v): v is number => v != null);
    const min = values.length ? Math.min(...values) : 100;
    const lower = Math.max(0, Math.min(70, Math.floor((min - 5) / 10) * 10));
    const step = lower <= 40 ? 20 : 10;
    const ticks: number[] = [];
    for (let v = lower; v <= 100; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== 100) ticks.push(100);
    return { domain: [lower, 100] as [number, number], ticks };
  }, [chartData]);

  const refDate = selectedRefDate;
  const currentMonthLabel = format(refDate, "MMMM yyyy", { locale: ptBR });
  const prevMonthLabel = format(subMonths(refDate, 1), "MMMM yyyy", {
    locale: ptBR,
  });

  const monthStats = useMemo(() => {
    const finalizedStatuses = new Set(["entregue", "delivered", "occurrence", "devolvido", "returned"]);
    const monthInvoices = invoices.filter((invoice) => {
      const invoiceDate = new Date(getInvoiceEventDate(invoice));
      return (
        invoiceDate.getMonth() === refDate.getMonth() &&
        invoiceDate.getFullYear() === refDate.getFullYear()
      );
    });
    const finalizedCount = monthInvoices.filter((invoice) => finalizedStatuses.has(invoice.status)).length;
    const dataDays = chartData.filter((point) => point.current != null).length;
    const previousSLA = [...chartData].reverse().find((point) => point.previous != null)?.previous ?? null;
    const delta = currentSLA != null && previousSLA != null ? currentSLA - previousSLA : null;

    return {
      dataDays,
      finalizedCount,
      totalInvoices: monthInvoices.length,
      previousSLA,
      delta,
    };
  }, [chartData, currentSLA, invoices, refDate]);

  const monthSelect = (
    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
      <SelectTrigger className="w-full capitalize sm:w-[11.5rem]" aria-label="Mês do gráfico">
        <SelectValue placeholder="Mês" />
      </SelectTrigger>
      <SelectContent>
        {monthOptions.map((month) => {
          const [year, monthNumber] = month.split("-").map(Number);
          const label = format(new Date(year, monthNumber - 1, 1), "MMMM yyyy", {
            locale: ptBR,
          });
          return (
            <SelectItem key={month} value={month} className="capitalize">
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  const statusBadge =
    currentSLA != null && currentScheme ? (
      <StatusBadge tone={levelTone[currentScheme.level] ?? "neutral"} className="text-sm">
        {formatSLA(currentSLA)}% · {currentScheme.labelPt}
      </StatusBadge>
    ) : null;

  const emptyState = (
    <EmptyState
      compact
      icon={LineChartIcon}
      title={`Sem entregas finalizadas em ${currentMonthLabel}`}
      description="Escolha outro mês ao lado ou mude o período no topo da tela."
    />
  );

  // Plano basico: so o consolidado do mes, sem a evolucao diaria
  if (!detailedAllowed) {
    return (
      <ReportCard
        icon={LineChartIcon}
        tone="success"
        title="Evolução do SLA"
        description="Consolidado do mês escolhido. A evolução dia a dia faz parte do plano Controle."
        actions={
          <>
            {monthSelect}
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Crown aria-hidden="true" />
              Plano Controle
            </Badge>
          </>
        }
      >
        {currentSLA != null && currentScheme ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className={cn("font-data text-5xl font-semibold tracking-tight", currentScheme.textClass)}>
              {formatSLA(currentSLA)}%
            </p>
            <StatusBadge tone={levelTone[currentScheme.level] ?? "neutral"}>{currentScheme.labelPt}</StatusBadge>
          </div>
        ) : (
          emptyState
        )}
      </ReportCard>
    );
  }

  if (isLoading) {
    return (
      <ReportCard icon={LineChartIcon} tone="success" title="Evolução do SLA" description="Carregando os dados do mês.">
        <div role="status" aria-label="Carregando" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      </ReportCard>
    );
  }

  const tiles = [
    {
      label: "SLA do mês",
      value: currentSLA != null ? `${formatSLA(currentSLA)}%` : "—",
      className: currentScheme?.textClass,
    },
    { label: "Dias com dados", value: `${monthStats.dataDays}`, suffix: monthStats.dataDays === 1 ? "dia" : "dias" },
    { label: "Entregas finalizadas", value: `${monthStats.finalizedCount}`, suffix: `de ${monthStats.totalInvoices}` },
    {
      label: "Vs. mês anterior",
      value: monthStats.delta == null ? "—" : `${monthStats.delta >= 0 ? "+" : ""}${formatSLA(monthStats.delta)} p.p.`,
      className:
        monthStats.delta == null ? "text-muted-foreground" : monthStats.delta >= 0 ? "text-success" : "text-destructive",
    },
  ];

  const summary =
    currentSLA != null
      ? `Gráfico de linha do SLA acumulado em ${currentMonthLabel}: termina em ${formatSLA(currentSLA)}% (${currentScheme?.labelPt}).${
          monthStats.previousSLA != null ? ` No mês anterior terminou em ${formatSLA(monthStats.previousSLA)}%.` : ""
        } Meta de 97%. Os valores de cada dia estão na tabela abaixo.`
      : `Gráfico do SLA de ${currentMonthLabel} sem dados.`;

  return (
    <ReportCard
      icon={LineChartIcon}
      tone="success"
      title="Evolução do SLA"
      description={
        <>
          Média acumulada dia a dia, para ver se o mês vai fechar na meta de 97%.
          {hasPreviousData && ` ${capitalize(currentMonthLabel)} contra ${prevMonthLabel}.`}
        </>
      }
      actions={
        <>
          {monthSelect}
          {statusBadge}
        </>
      }
    >
      {currentDataRows.length > 0 ? (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-lg border bg-muted/40 p-4">
                <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{tile.label}</dt>
                <dd className={cn("mt-1.5 font-data text-xl font-semibold tracking-tight sm:text-2xl", tile.className)}>
                  {tile.value}
                  {tile.suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{tile.suffix}</span>}
                </dd>
              </div>
            ))}
          </dl>

          <ChartFrame summary={summary} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 16, left: -8, bottom: 4 }}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="day" interval="preserveStartEnd" tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis
                  domain={yAxis.domain}
                  ticks={yAxis.ticks}
                  allowDataOverflow
                  width={48}
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
                {hasPreviousData && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}

                {/* Linhas de referencia: meta e critico */}
                <ReferenceLine
                  y={97}
                  stroke={MUTED}
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{ value: "Meta 97%", position: "insideTopLeft", fill: MUTED, fontSize: 11 }}
                />
                <ReferenceLine
                  y={75}
                  stroke={BAD}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: "Crítico 75%", position: "insideBottomLeft", fill: BAD, fontSize: 11 }}
                />

                {hasPreviousData && (
                  <Line
                    type="monotone"
                    dataKey="previous"
                    name={capitalize(prevMonthLabel)}
                    stroke={SERIES[1]}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="current"
                  name={capitalize(currentMonthLabel)}
                  stroke={SERIES[0]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: SERIES[0], stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>

          {/* Tabela dia a dia (tambem e o texto alternativo do grafico) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Dia a dia</h3>
            <div className="max-h-[240px] overflow-y-auto rounded-lg border" tabIndex={0} aria-label="Tabela do SLA dia a dia">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-xs text-muted-foreground">
                    <th scope="col" className="p-2.5 text-left font-semibold">Dia</th>
                    <th scope="col" className="p-2.5 text-right font-semibold">SLA acumulado</th>
                    <th scope="col" className="p-2.5 text-right font-semibold">Situação</th>
                    {hasPreviousData && <th scope="col" className="p-2.5 text-right font-semibold">Mês anterior</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentDataRows.map((row) => {
                    const scheme = row.current != null ? getSLAColorScheme(row.current) : null;
                    return (
                      <tr key={row.day} className="border-t transition-colors duration-fast hover:bg-muted/50">
                        <td className="p-2.5 font-data">{row.day}</td>
                        <td className="p-2.5 text-right font-data font-medium">
                          {row.current != null ? `${formatSLA(row.current)}%` : "—"}
                        </td>
                        <td className="p-2.5 text-right">
                          {scheme ? <StatusBadge tone={levelTone[scheme.level] ?? "neutral"}>{scheme.labelPt}</StatusBadge> : "—"}
                        </td>
                        {hasPreviousData && (
                          <td className="p-2.5 text-right font-data text-muted-foreground">
                            {row.previous != null ? `${formatSLA(row.previous)}%` : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        emptyState
      )}
    </ReportCard>
  );
}
