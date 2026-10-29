import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Package, Target, TrendingUp, Lock } from "lucide-react";
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
} from "recharts";
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm mb-1">Dia {label}</p>
      {payload.map((entry: any, index: number) => {
        if (entry.value == null) return null;
        const scheme = getSLAColorScheme(entry.value);
        return (
          <p key={index} className="text-xs flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}: {formatSLA(entry.value)}%{" "}
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
  const defaultMonth = useMemo(
    () => format(dateRange.from || new Date(), "yyyy-MM"),
    [dateRange.from]
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
      <SelectTrigger className="h-9 w-full sm:w-[180px]">
        <SelectValue placeholder="Mes" />
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

  // For basic plan: show only yesterday's consolidated
  if (!detailedAllowed) {
    return (
      <Card className="p-6 relative">
        <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Evolução do SLA</h3>
              <p className="text-sm text-muted-foreground">
                Consolidado do dia anterior
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {monthSelect}
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" />
              Plano Controle
            </Badge>
          </div>
        </div>

        {currentSLA != null && currentScheme ? (
          <div className="flex items-center gap-4 py-8 justify-center">
            <div className="text-center">
              <p className={cn("text-5xl font-bold", currentScheme.textClass)}>
                {formatSLA(currentSLA)}%
              </p>
              <Badge className={cn("mt-2", currentScheme.badgeBgClass)}>
                {currentScheme.labelPt}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-sm font-medium">Sem dados para este período</p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground mt-2">
          Faça upgrade para o Plano Controle para ver a evolução diária acumulada
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Carregando evolução do SLA...
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold">Evolução do SLA — Acumulado Diário</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {hasPreviousData ? `${currentMonthLabel} vs ${prevMonthLabel}` : currentMonthLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {monthSelect}
        {currentSLA != null && currentScheme && (
          <Badge className={cn(currentScheme.badgeBgClass)}>
            {formatSLA(currentSLA)}% — {currentScheme.labelPt}
          </Badge>
        )}
        </div>
      </div>

      {currentDataRows.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                SLA do mes
              </div>
              <p className={cn("mt-2 text-2xl font-bold", currentScheme?.textClass)}>
                {currentSLA != null ? `${formatSLA(currentSLA)}%` : "-"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Dias com dados
              </div>
              <p className="mt-2 text-2xl font-bold">
                {monthStats.dataDays}
                <span className="text-sm font-normal text-muted-foreground"> dias</span>
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                Entregas finalizadas
              </div>
              <p className="mt-2 text-2xl font-bold">
                {monthStats.finalizedCount}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}de {monthStats.totalInvoices}
                </span>
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Vs mes anterior
              </div>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold",
                  monthStats.delta == null
                    ? "text-muted-foreground"
                    : monthStats.delta >= 0
                      ? "text-success"
                      : "text-destructive"
                )}
              >
                {monthStats.delta == null
                  ? "-"
                  : `${monthStats.delta >= 0 ? "+" : ""}${formatSLA(monthStats.delta)} pp`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-3">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="4 4" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="day"
                interval="preserveStartEnd"
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                label={{
                  value: "Dia do mês",
                  position: "insideBottomRight",
                  offset: -5,
                  style: {
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  },
                }}
              />
              <YAxis
                domain={[0, 100]}
                width={44}
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              {hasPreviousData && (
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              )}

              {/* Reference lines for thresholds */}
              <ReferenceLine
                y={97}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: "Meta 97%", position: "insideTopLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <ReferenceLine
                y={75}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: "Critico 75%", position: "insideLeft", fill: "hsl(var(--destructive))", fontSize: 11 }}
              />

              {/* Previous month line - only if data exists */}
              {hasPreviousData && (
                <Line
                  type="monotone"
                  dataKey="previous"
                  name={`Mês Anterior`}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2, fill: "hsl(var(--muted-foreground))" }}
                  connectNulls
                />
              )}

              {/* Current month line */}
              <Line
                type="monotone"
                dataKey="current"
                name={`Mês Atual`}
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
          </div>

          {/* Daily SLA table */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Detalhamento Diário</h4>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Dia</th>
                    <th className="text-right p-2 font-medium">
                      SLA Acumulado
                    </th>
                    <th className="text-right p-2 font-medium">Status</th>
                    {hasPreviousData && (
                      <th className="text-right p-2 font-medium">
                        Mês Anterior
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {currentDataRows.map((row) => {
                    const scheme =
                      row.current != null
                        ? getSLAColorScheme(row.current)
                        : null;
                    return (
                      <tr
                        key={row.day}
                        className="border-t border-border hover:bg-muted/30"
                      >
                        <td className="p-2">{row.day}</td>
                        <td
                          className={cn(
                            "p-2 text-right font-medium",
                            scheme?.textClass
                          )}
                        >
                          {row.current != null
                            ? `${formatSLA(row.current)}%`
                            : "—"}
                        </td>
                        <td className="p-2 text-right">
                          {scheme ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                scheme.textClass,
                                scheme.borderClass
                              )}
                            >
                              {scheme.labelPt}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        {hasPreviousData && (
                          <td className="p-2 text-right text-muted-foreground">
                            {row.previous != null
                              ? `${formatSLA(row.previous)}%`
                              : "—"}
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
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-sm font-medium">
            Nenhum dado encontrado para este período
          </p>
          <p className="text-xs mt-1">Tente ajustar os filtros selecionados</p>
        </div>
      )}
    </Card>
  );
}
