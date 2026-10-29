import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, Building2, FileText, Truck, UserCheck, Users } from "lucide-react";
import { format } from "date-fns";
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

interface FleetUsageReportProps {
  /** Periodo escolhido no topo da tela (o mesmo das outras abas). Ponta vazia = sem limite. */
  dateRange: { from?: Date; to?: Date };
}

export function FleetUsageReport({ dateRange }: FleetUsageReportProps) {
  const { getFleetUsageReport, isLoading } = useManifestsDB();

  // Antes esta aba tinha um periodo proprio, diferente do escolhido no topo.
  const reportData = useMemo(() => {
    const startDate = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "0000-01-01";
    const endDate = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "9999-12-31";
    return getFleetUsageReport(startDate, endDate);
  }, [dateRange.from, dateRange.to, getFleetUsageReport]);

  // Comparativo: categorias no eixo, uma serie por tipo de frota
  const comparisonData = [
    { name: "Motoristas", own: reportData.ownFleet.driversCount, third: reportData.thirdParty.driversCount },
    { name: "Romaneios", own: reportData.ownFleet.manifestsCount, third: reportData.thirdParty.manifestsCount },
    { name: "Entregas", own: reportData.ownFleet.totalDeliveries, third: reportData.thirdParty.totalDeliveries },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="space-y-6">
        <Skeleton className="h-5 w-96 max-w-full" />
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

  const comparisonSummary = `Gráfico de barras comparando frota própria e agregados: ${comparisonData
    .map((d) => `${d.name.toLowerCase()} ${d.own} da frota própria e ${d.third} de agregados`)
    .join("; ")}.`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Quantos motoristas da casa e agregados trabalharam e quanto foi de frete para terceiros, pela data dos romaneios.
      </p>

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
          description="Escolha outro período no topo da tela para comparar frota própria e agregados."
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
