import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Crown, FileText, LineChart as LineChartIcon, Lock, Minus, Package, Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { CardsSkeleton, EmptyState, StatCard, StatusBadge, type Tone } from "@/components/patterns";
import {
  axisLine,
  axisTick,
  CHART_FONT_SMALL,
  chartScale,
  fmtPercent,
  GOOD,
  gridProps,
  SERIES,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "./chartTheme";
import { ChartFrame, ReportCard } from "./ReportCard";
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { isDayInRange, previousRange } from "@/lib/reportFilters";
import { toDateStringBrazil } from "@/lib/timezone";
import { useEffect } from "react";

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
  /** null: mes sem romaneio (nao e 0%). */
  percentage: number | null;
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
  /** Periodo escolhido no topo da tela (antes esta aba tinha um periodo proprio). */
  dateRange: { from?: Date; to?: Date };
}

const inRange = (createdAt: string, range: { from?: Date; to?: Date }) =>
  isDayInRange(toDateStringBrazil(createdAt), { from: range.from, to: range.to });

/** Frete de agregados, valor das cargas e a relacao entre eles num conjunto de romaneios. */
function summarize(list: ManifestRow[]) {
  const third = list.filter((m) => m.is_own_fleet === false);
  const freight = third.reduce((s, m) => s + (m.freight_value || 0), 0);
  const cargo = list.reduce((s, m) => s + (m.total_value || 0), 0);
  return { third, freight, cargo, percentage: cargo > 0 ? (freight / cargo) * 100 : 0 };
}

export function ProfitabilityReport({ allowed, upgradePlanLabel, dateRange }: ProfitabilityReportProps) {
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

  // Romaneios do periodo (dia do cadastro, em Brasilia) e do periodo anterior de mesmo tamanho
  const filtered = useMemo(() => manifests.filter((m) => inRange(m.created_at, dateRange)), [manifests, dateRange]);
  const current = useMemo(() => summarize(filtered), [filtered]);
  const previous = useMemo(() => {
    const range = previousRange({ from: dateRange.from, to: dateRange.to });
    return range ? summarize(manifests.filter((m) => inRange(m.created_at, range))) : null;
  }, [manifests, dateRange]);

  const thirdPartyManifests = current.third;
  const thirdPartyFreight = current.freight;
  const totalCargo = current.cargo;
  const percentage = current.percentage;
  // Carga so dos romaneios de agregados (o total da tabela soma as linhas que ela mostra).
  const thirdPartyCargo = thirdPartyManifests.reduce((s, m) => s + (m.total_value || 0), 0);
  const thirdPartyShare = thirdPartyCargo > 0 ? (thirdPartyFreight / thirdPartyCargo) * 100 : 0;

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
        percentage: tc > 0 ? (tp / tc) * 100 : null,
      });
    }
    return points;
  }, [manifests]);

  // Variacao contra o periodo anterior (null: sem cargas antes para comparar)
  const trend = previous && previous.cargo > 0 && totalCargo > 0 ? percentage - previous.percentage : null;

  if (!allowed) return <LockedState planLabel={upgradePlanLabel} />;

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="space-y-6">
        <Skeleton className="h-5 w-96 max-w-full" />
        <CardsSkeleton count={3} className="xl:grid-cols-3" />
        <Skeleton className="h-[320px] rounded-lg" />
      </div>
    );
  }

  const trendValue = trend ?? 0;
  const TrendIcon = trendValue > 0.5 ? ArrowUpRight : trendValue < -0.5 ? ArrowDownRight : Minus;
  const trendClass =
    trendValue > 0.5 ? "bg-destructive/10 text-destructive" : trendValue < -0.5 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  const last = evolutionData[evolutionData.length - 1];
  const monthsWithData = evolutionData.filter((p) => p.percentage !== null);
  const evolutionSummary = `Gráfico de linha do custo com agregados sobre o valor das cargas nos últimos 12 meses. ${
    monthsWithData.length
      ? monthsWithData.map((p) => `${p.label}: ${fmtPercent(p.percentage as number)}`).join("; ")
      : "Nenhum mês com romaneio"
  }. Os outros meses não tiveram romaneio. Meta de até 20%.${
    last?.percentage != null ? ` Mês atual: ${fmtPercent(last.percentage)}.` : ""
  }`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Quanto do valor das cargas foi gasto com frete de agregados no período. Quanto menor, melhor. Meta: até 20%.
      </p>

      {/* Indicadores */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex min-h-[8.5rem] flex-col gap-3 p-5 sm:col-span-2 xl:col-span-1">
          <p className="text-sm font-medium text-muted-foreground">Custo do frete sobre a carga</p>
          <div className="flex items-center gap-4">
            <EfficiencyGauge percentage={percentage} />
            <div className="space-y-1.5">
              <p className="font-data text-[2rem] font-semibold leading-none tracking-tight text-foreground">{fmtPercent(percentage)}</p>
              {totalCargo > 0 ? (
                <StatusBadge tone={shareTone(percentage)}>
                  {percentage <= 20 ? "Dentro da meta" : percentage <= 40 ? "Atenção" : "Acima do ideal"}
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Sem cargas no período</StatusBadge>
              )}
              {trend === null ? (
                <p className="text-xs text-muted-foreground">Sem dados do período anterior</p>
              ) : (
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${trendClass}`}>
                    <TrendIcon className="h-3 w-3" aria-hidden="true" />
                    {trend > 0 ? "+" : ""}
                    {trend.toFixed(1).replace(".", ",")} p.p.
                    <span className="sr-only">{trend > 0.5 ? " a mais, pior" : trend < -0.5 ? " a menos, melhor" : " sem variação"}</span>
                  </span>
                  vs. período anterior
                </p>
              )}
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
              {/* Topo de pelo menos 25%: a linha da meta (20%) aparece sempre. */}
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, (dataMax: number) => Math.max(25, Math.ceil(dataMax / 5) * 5)]}
                width={Math.round(48 * chartScale())}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ stroke: "hsl(var(--border))" }}
                formatter={(value: number | null) => [value == null ? "Sem romaneio" : fmtPercent(value), "Agregados / cargas"]}
              />
              <ReferenceLine
                y={20}
                stroke={GOOD}
                strokeDasharray="5 5"
                label={{ value: "Meta 20%", fontSize: CHART_FONT_SMALL, fill: GOOD, position: "insideTopLeft" }}
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
            description="Escolha outro período no topo da tela."
          />
        ) : (
          <>
            {/* Tabela so do computador grande; no tablet as 6 colunas nao cabiam e a ultima sumia. */}
            <div className="-mx-5 hidden max-h-[420px] overflow-auto border-t sm:-mx-6 lg:block">
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
                        <TableCell className="whitespace-nowrap pl-5 font-data text-xs sm:pl-6">{m.manifest_code}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={m.driver_name}>
                          {m.driver_name}
                        </TableCell>
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
                    <TableCell colSpan={3} className="pl-5 font-semibold sm:pl-6">Total dos agregados</TableCell>
                    <TableCell className="text-right font-data font-semibold">{formatCurrency(thirdPartyCargo)}</TableCell>
                    <TableCell className="text-right font-data font-semibold">{formatCurrency(thirdPartyFreight)}</TableCell>
                    <TableCell className="pr-5 text-right sm:pr-6">
                      <StatusBadge tone={shareTone(thirdPartyShare)} className="font-data">
                        {fmtPercent(thirdPartyShare)}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
              {thirdPartyManifests.map((m) => {
                const pct = (m.total_value || 0) > 0 ? ((m.freight_value || 0) / (m.total_value || 1)) * 100 : 0;
                return (
                  <li key={m.id}>
                    <Card className="space-y-3 p-4 shadow-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={m.driver_name}>
                            {m.driver_name}
                          </p>
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
              <li className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm md:col-span-2">
                <span className="font-semibold">Total dos agregados</span>
                <span className="font-data font-semibold">
                  {formatCurrency(thirdPartyFreight)} de {formatCurrency(thirdPartyCargo)}
                </span>
              </li>
            </ul>
          </>
        )}
      </ReportCard>
    </div>
  );
}
