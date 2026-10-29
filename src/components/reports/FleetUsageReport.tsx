import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, Building2, CalendarDays, FileText, Truck, UserCheck, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardsSkeleton, EmptyState, StatCard } from "@/components/patterns";
import { useManifestsDB } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  axisLine,
  axisTick,
  fmtNumber,
  fmtPercent,
  gridProps,
  SERIES,
  tooltipCursor,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "./chartTheme";
import { ChartFrame, ReportCard } from "./ReportCard";

// Cor segue o tipo de frota em todos os graficos desta aba.
const COLORS = {
  ownFleet: SERIES[0],
  thirdParty: SERIES[1],
};

type QuickPeriod = "this-month" | "last-month" | "custom";

export function FleetUsageReport() {
  const { getFleetUsageReport, isLoading } = useManifestsDB();

  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Get report data
  const reportData = useMemo(() => {
    const startDate = format(dateRange.from, "yyyy-MM-dd");
    const endDate = format(dateRange.to, "yyyy-MM-dd");
    return getFleetUsageReport(startDate, endDate);
  }, [dateRange, getFleetUsageReport]);

  // Comparativo: categorias no eixo, uma serie por tipo de frota
  const comparisonData = [
    { name: "Motoristas", own: reportData.ownFleet.driversCount, third: reportData.thirdParty.driversCount },
    { name: "Romaneios", own: reportData.ownFleet.manifestsCount, third: reportData.thirdParty.manifestsCount },
    { name: "Entregas", own: reportData.ownFleet.totalDeliveries, third: reportData.thirdParty.totalDeliveries },
  ];

  // Quick period selectors
  const setPeriod = (months: number) => {
    const now = new Date();
    if (months === 0) {
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    } else {
      const start = startOfMonth(subMonths(now, months));
      setDateRange({ from: start, to: months === 1 ? endOfMonth(subMonths(now, 1)) : now });
    }
  };

  const now = new Date();
  const quickPeriod: QuickPeriod =
    isSameDay(dateRange.from, startOfMonth(now)) && isSameDay(dateRange.to, endOfMonth(now))
      ? "this-month"
      : isSameDay(dateRange.from, startOfMonth(subMonths(now, 1))) && isSameDay(dateRange.to, endOfMonth(subMonths(now, 1)))
        ? "last-month"
        : "custom";

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <CardsSkeleton count={4} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[320px] rounded-lg" />
          <Skeleton className="h-[320px] rounded-lg" />
        </div>
      </div>
    );
  }

  const totalDrivers = reportData.ownFleet.driversCount + reportData.thirdParty.driversCount;
  const ownShare = totalDrivers > 0 ? (reportData.ownFleet.driversCount / totalDrivers) * 100 : 0;
  const thirdShare = totalDrivers > 0 ? (reportData.thirdParty.driversCount / totalDrivers) * 100 : 0;
  const totalManifests = reportData.ownFleet.manifestsCount + reportData.thirdParty.manifestsCount;
  const rangeLabel = `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} a ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`;

  const comparisonSummary = `Gráfico de barras comparando frota própria e agregados: ${comparisonData
    .map((d) => `${d.name.toLowerCase()} ${d.own} da frota própria e ${d.third} de agregados`)
    .join("; ")}.`;

  return (
    <div className="space-y-6">
      {/* Periodo desta aba */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Quantos motoristas da casa e agregados trabalharam e quanto foi de frete para terceiros.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={quickPeriod}
            onValueChange={(v) => {
              if (v === "this-month") setPeriod(0);
              else if (v === "last-month") setPeriod(1);
              else setCalendarOpen(true);
            }}
          >
            <SelectTrigger className="w-full sm:w-[11rem]" aria-label="Período da frota">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="this-month">Este mês</SelectItem>
              <SelectItem value="last-month">Mês anterior</SelectItem>
              <SelectItem value="custom">Escolher datas</SelectItem>
            </SelectContent>
          </Select>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal" aria-label={`Datas: ${rangeLabel}. Alterar`}>
                <CalendarDays className="text-muted-foreground" aria-hidden="true" />
                <span className="font-data">{rangeLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Indicadores */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Frota própria"
          value={reportData.ownFleet.driversCount}
          icon={Building2}
          tone="brand"
          hint={`motoristas · ${fmtPercent(ownShare)} do total`}
        />
        <StatCard
          label="Agregados"
          value={reportData.thirdParty.driversCount}
          icon={UserCheck}
          tone="info"
          hint={`motoristas · ${fmtPercent(thirdShare)} do total`}
        />
        <StatCard label="Romaneios" value={totalManifests} icon={Truck} tone="neutral" hint="No período" />
        <StatCard
          label="Frete de agregados"
          value={reportData.thirdParty.totalFreight}
          format={formatCurrency}
          icon={FileText}
          tone="warning"
          hint="A pagar no período"
        />
      </div>

      {totalManifests === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum romaneio neste período"
          description="Escolha outro mês para comparar frota própria e agregados."
          action={
            quickPeriod !== "last-month" ? (
              <Button variant="outline" onClick={() => setPeriod(1)}>
                Ver mês anterior
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ReportCard
            icon={BarChart3}
            title="Frota própria e agregados"
            description="Motoristas, romaneios e entregas de cada tipo de frota."
          >
            <ChartFrame height={260} summary={comparisonSummary}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
                  <CartesianGrid {...gridProps} vertical={false} />
                  <XAxis dataKey="name" tick={axisTick} axisLine={axisLine} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={tooltipCursor} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="own" name="Frota própria" fill={COLORS.ownFleet} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="third" name="Agregados" fill={COLORS.thirdParty} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </ReportCard>

          <ReportCard icon={Users} title="Divisão dos motoristas" description="Quem trabalhou no período, por tipo de frota.">
            <div className="space-y-6">
              <div
                role="img"
                aria-label={`Frota própria ${fmtPercent(ownShare)} e agregados ${fmtPercent(thirdShare)} dos ${totalDrivers} motoristas.`}
                className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
              >
                {ownShare > 0 && (
                  <span className="h-full rounded-full transition-[width] duration-slow ease-out" style={{ width: `${ownShare}%`, background: COLORS.ownFleet }} />
                )}
                {thirdShare > 0 && (
                  <span className="h-full rounded-full transition-[width] duration-slow ease-out" style={{ width: `${thirdShare}%`, background: COLORS.thirdParty }} />
                )}
              </div>
              <dl className="grid grid-cols-2 gap-4">
                {[
                  { label: "Frota própria", value: reportData.ownFleet.driversCount, share: ownShare, color: COLORS.ownFleet },
                  { label: "Agregados", value: reportData.thirdParty.driversCount, share: thirdShare, color: COLORS.thirdParty },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-muted/40 p-4">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </dt>
                    <dd className="mt-1.5 font-data text-2xl font-semibold tracking-tight text-foreground">
                      {fmtPercent(item.share)}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {fmtNumber(item.value)} motorista{item.value === 1 ? "" : "s"}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">Conta só motoristas com romaneio no período.</p>
            </div>
          </ReportCard>
        </div>
      )}
    </div>
  );
}
