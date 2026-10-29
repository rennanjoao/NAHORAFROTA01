import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Crown, FileText, LineChart as LineChartIcon, Lock, Minus, Package, Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { CardsSkeleton, EmptyState, StatCard, StatusBadge, type Tone } from "@/components/patterns";
import {
  axisLine,
  axisTick,
  fmtPercent,
  GOOD,
  gridProps,
  SERIES,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "./chartTheme";
import { ChartFrame, ReportCard } from "./ReportCard";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, isWithinInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { useEffect } from "react";

type PeriodType = "day" | "month" | "year";

interface ManifestRow {
  id: string;
  driver_name: string;
  manifest_code: string;
  freight_value: number;
  is_own_fleet: boolean | null;
  total_value: number | null;
  created_at: string;
}

interface MonthlyPoint {
  label: string;
  date: Date;
  thirdPartyFreight: number;
  totalCargo: number;
  percentage: number;
}

// ========== LOCKED STATE ==========
function LockedState({ planLabel }: { planLabel: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Relatório de rentabilidade"
      description="Acompanhe quanto do valor das cargas vai para o frete de agregados, mês a mês, e veja onde dá para economizar."
      action={
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          <Crown className="h-4 w-4" aria-hidden="true" />
          Disponível no plano {planLabel || "Controle Total"}
        </span>
      }
    />
  );
}

// Faixas do custo de frete sobre a carga: ate 20% bom, ate 40% atencao, acima ruim.
const shareTone = (pct: number): Tone => (pct <= 20 ? "success" : pct <= 40 ? "warning" : "danger");

// ========== MINI GAUGE (reused from dashboard) ==========
function EfficiencyGauge({ percentage }: { percentage: number }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const radius = 50;
  const strokeWidth = 10;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped <= 20 ? "hsl(var(--success))" : clamped <= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

  return (
    <svg width="120" height="72" viewBox="0 0 120 72" className="shrink-0" aria-hidden="true">
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-slow ease-out"
      />
    </svg>
  );
}

// ========== MAIN COMPONENT ==========

interface ProfitabilityReportProps {
  allowed: boolean;
  upgradePlanLabel: string;
}

export function ProfitabilityReport({ allowed, upgradePlanLabel }: ProfitabilityReportProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(() => format(new Date(), "yyyy"));
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch manifests (RLS ensures tenant isolation)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("manifests")
        .select("id, driver_name, manifest_code, freight_value, is_own_fleet, total_value, created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      setManifests((data as ManifestRow[]) ?? []);
    } catch (err) {
      console.error("Error fetching profitability data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) fetchData();
  }, [allowed, fetchData]);

  // Date range based on period type
  const dateRange = useMemo(() => {
    if (periodType === "day") {
      return { from: startOfDay(selectedDate), to: endOfDay(selectedDate) };
    }
    if (periodType === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    const d = new Date(Number(selectedYear), 0, 1);
    return { from: startOfYear(d), to: endOfYear(d) };
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

  // Filtered manifests for current period
  const filtered = useMemo(() => {
    return manifests.filter((m) => {
      const d = new Date(m.created_at);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    });
  }, [manifests, dateRange]);

  // Calculations
  const thirdPartyManifests = useMemo(() => filtered.filter((m) => m.is_own_fleet === false), [filtered]);
  const thirdPartyFreight = useMemo(() => thirdPartyManifests.reduce((s, m) => s + (m.freight_value || 0), 0), [thirdPartyManifests]);
  const totalCargo = useMemo(() => filtered.reduce((s, m) => s + (m.total_value || 0), 0), [filtered]);
  const percentage = totalCargo > 0 ? (thirdPartyFreight / totalCargo) * 100 : 0;

  // Monthly evolution data (last 12 months)
  const evolutionData = useMemo((): MonthlyPoint[] => {
    const points: MonthlyPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const mStart = startOfMonth(d);
      const mEnd = endOfMonth(d);
      const monthManifests = manifests.filter((m) => {
        const md = new Date(m.created_at);
        return isWithinInterval(md, { start: mStart, end: mEnd });
      });
      const tp = monthManifests.filter((m) => m.is_own_fleet === false).reduce((s, m) => s + (m.freight_value || 0), 0);
      const tc = monthManifests.reduce((s, m) => s + (m.total_value || 0), 0);
      points.push({
        label: format(d, "MMM/yy", { locale: ptBR }),
        date: mStart,
        thirdPartyFreight: tp,
        totalCargo: tc,
        percentage: tc > 0 ? (tp / tc) * 100 : 0,
      });
    }
    return points;
  }, [manifests]);

  // Trend
  const lastTwo = evolutionData.slice(-2);
  const trend = lastTwo.length === 2 ? lastTwo[1].percentage - lastTwo[0].percentage : 0;

  if (!allowed) return <LockedState planLabel={upgradePlanLabel} />;

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <CardsSkeleton count={3} className="xl:grid-cols-3" />
        <Skeleton className="h-[320px] rounded-lg" />
      </div>
    );
  }

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  const yearOptions = Array.from({ length: 3 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { value: String(y), label: String(y) };
  });

  const TrendIcon = trend > 0.5 ? ArrowUpRight : trend < -0.5 ? ArrowDownRight : Minus;
  const trendClass = trend > 0.5 ? "bg-destructive/10 text-destructive" : trend < -0.5 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  const last = evolutionData[evolutionData.length - 1];
  const evolutionSummary = `Gráfico de linha do custo com agregados sobre o valor das cargas nos últimos 12 meses. ${evolutionData
    .map((p) => `${p.label}: ${fmtPercent(p.percentage)}`)
    .join("; ")}. Meta de até 20%.${last ? ` Mês atual: ${fmtPercent(last.percentage)}.` : ""}`;

  return (
    <div className="space-y-6">
      {/* Periodo desta aba */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Quanto do valor das cargas foi gasto com frete de agregados. Quanto menor, melhor. Meta: até 20%.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-full sm:w-[10rem]" aria-label="Tipo de período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="day">Um dia</SelectItem>
              <SelectItem value="month">Um mês</SelectItem>
              <SelectItem value="year">Um ano</SelectItem>
            </SelectContent>
          </Select>

          {periodType === "day" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start font-normal" aria-label={`Dia: ${format(selectedDate, "dd/MM/yyyy")}. Alterar`}>
                  <CalendarDays className="text-muted-foreground" aria-hidden="true" />
                  <span className="font-data">{format(selectedDate, "dd/MM/yyyy")}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={ptBR} />
              </PopoverContent>
            </Popover>
          )}

          {periodType === "month" && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full capitalize sm:w-[12rem]" aria-label="Mês">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {monthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="capitalize">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {periodType === "year" && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[8rem]" aria-label="Ano">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {yearOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex min-h-[8.5rem] flex-col gap-3 p-5 sm:col-span-2 xl:col-span-1">
          <p className="text-sm font-medium text-muted-foreground">Custo do frete sobre a carga</p>
          <div className="flex items-center gap-4">
            <EfficiencyGauge percentage={percentage} />
            <div className="space-y-1.5">
              <p className="font-data text-[2rem] font-semibold leading-none tracking-tight text-foreground">{fmtPercent(percentage)}</p>
              <StatusBadge tone={shareTone(percentage)}>
                {percentage <= 20 ? "Dentro da meta" : percentage <= 40 ? "Atenção" : "Acima do ideal"}
              </StatusBadge>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${trendClass}`}>
                  <TrendIcon className="h-3 w-3" aria-hidden="true" />
                  {trend > 0 ? "+" : ""}
                  {trend.toFixed(1).replace(".", ",")} p.p.
                </span>
                vs. mês anterior
              </p>
            </div>
          </div>
        </Card>
        <StatCard
          label="Valor das cargas"
          value={totalCargo}
          format={formatCurrency}
          icon={Package}
          tone="info"
          hint={`${filtered.length} romaneio${filtered.length === 1 ? "" : "s"} no período`}
        />
        <StatCard
          label="Custo com agregados"
          value={thirdPartyFreight}
          format={formatCurrency}
          icon={Wallet}
          tone="warning"
          hint={`${thirdPartyManifests.length} romaneio${thirdPartyManifests.length === 1 ? "" : "s"} de terceiros`}
        />
      </div>

      {/* Evolucao */}
      <ReportCard
        icon={LineChartIcon}
        title="Evolução nos últimos 12 meses"
        description="Custo com agregados dividido pelo valor das cargas, mês a mês. A linha verde é a meta."
      >
        <ChartFrame height={280} summary={evolutionSummary}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionData} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ stroke: "hsl(var(--border))" }}
                formatter={(value: number) => [fmtPercent(value), "Agregados / cargas"]}
              />
              <ReferenceLine
                y={20}
                stroke={GOOD}
                strokeDasharray="5 5"
                label={{ value: "Meta 20%", fontSize: 11, fill: GOOD, position: "insideTopLeft" }}
              />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke={SERIES[0]}
                strokeWidth={2.5}
                dot={{ fill: SERIES[0], r: 3, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </ReportCard>

      {/* Detalhe */}
      <ReportCard
        icon={FileText}
        title="Romaneios de agregados"
        description="Valor da carga, frete pago e quanto o frete representa em cada romaneio."
      >
        {thirdPartyManifests.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            title="Nenhum romaneio de agregado no período"
            description="Escolha outro dia, mês ou ano acima."
          />
        ) : (
          <>
            <div className="-mx-5 hidden max-h-[420px] overflow-auto border-t md:block sm:-mx-6">
              <Table>
                <TableHeader className="sticky top-0 z-[1] bg-muted">
                  <TableRow>
                    <TableHead className="pl-5 sm:pl-6">Romaneio</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor da carga</TableHead>
                    <TableHead className="text-right">Frete pago</TableHead>
                    <TableHead className="pr-5 text-right sm:pr-6">Frete / carga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thirdPartyManifests.map((m) => {
                    const pct = (m.total_value || 0) > 0 ? ((m.freight_value || 0) / (m.total_value || 1)) * 100 : 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="pl-5 font-data text-xs sm:pl-6">{m.manifest_code}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{m.driver_name}</TableCell>
                        <TableCell className="font-data text-xs text-muted-foreground">{format(new Date(m.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-right font-data">{formatCurrency(m.total_value || 0)}</TableCell>
                        <TableCell className="text-right font-data">{formatCurrency(m.freight_value || 0)}</TableCell>
                        <TableCell className="pr-5 text-right sm:pr-6">
                          <StatusBadge tone={shareTone(pct)} className="font-data">
                            {fmtPercent(pct)}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="pl-5 font-semibold sm:pl-6">Total</TableCell>
                    <TableCell className="text-right font-data font-semibold">{formatCurrency(totalCargo)}</TableCell>
                    <TableCell className="text-right font-data font-semibold">{formatCurrency(thirdPartyFreight)}</TableCell>
                    <TableCell className="pr-5 text-right sm:pr-6">
                      <StatusBadge tone={shareTone(percentage)} className="font-data">
                        {fmtPercent(percentage)}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {thirdPartyManifests.map((m) => {
                const pct = (m.total_value || 0) > 0 ? ((m.freight_value || 0) / (m.total_value || 1)) * 100 : 0;
                return (
                  <li key={m.id}>
                    <Card className="space-y-3 p-4 shadow-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.driver_name}</p>
                          <p className="font-data text-xs text-muted-foreground">
                            {m.manifest_code} · {format(new Date(m.created_at), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <StatusBadge tone={shareTone(pct)} className="font-data">
                          {fmtPercent(pct)}
                        </StatusBadge>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Valor da carga</dt>
                          <dd className="font-data font-semibold">{formatCurrency(m.total_value || 0)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Frete pago</dt>
                          <dd className="font-data font-semibold">{formatCurrency(m.freight_value || 0)}</dd>
                        </div>
                      </dl>
                    </Card>
                  </li>
                );
              })}
              <li className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-semibold">Total</span>
                <span className="font-data font-semibold">
                  {formatCurrency(thirdPartyFreight)} de {formatCurrency(totalCargo)}
                </span>
              </li>
            </ul>
          </>
        )}
      </ReportCard>
    </div>
  );
}
