/**
 * SLA DA SEMANA
 * SLA da frota nos ultimos 7 dias, com acesso aos motoristas e notas abaixo da meta.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/patterns";
import { formatSLA } from "@/lib/formatSLA";
import { useSLADB, SLA_THRESHOLDS } from "@/hooks/useSLADB";
import { HelperTooltip, helperTexts } from "./HelperTooltip";
import { SLADrilldownModal } from "./SLADrilldownModal";
import { SLANote, SLARing, SLATrend } from "./SLAParts";
import { plural, slaStatus, pct } from "./status";

export function SLAWeeklyWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    isLoading,
    fleetSLA,
    driverStats,
    worstWeeklyDrivers,
    criticalWeeklyDrivers,
    attentionWeeklyDrivers,
    orphanInvoices,
    isOperationHealthy,
    weeklyTrend,
  } = useSLADB();

  const status = slaStatus(fleetSLA.weekly);
  const criticalCount = criticalWeeklyDrivers.length;
  const attentionCount = attentionWeeklyDrivers.length;
  const nearGoalCount = worstWeeklyDrivers.length - criticalCount - attentionCount;
  const orphanCount = orphanInvoices.length;
  const trendDiff = fleetSLA.weekly - fleetSLA.previousWeekly;

  // Saudavel de verdade: frota na meta e nenhuma nota com ocorrencia sem motorista
  const isTrulyHealthy = isOperationHealthy && orphanCount === 0;

  // Motoristas com atividade na semana, para o detalhe
  const driversWithWeeklyActivity = driverStats.filter((d) => d.weeklyTotalInvoices > 0);

  if (isLoading) {
    return (
      <Card className="h-full p-6" aria-busy="true">
        <Skeleton className="h-5 w-32" />
        <div className="mt-6 flex items-center gap-5">
          <Skeleton className="h-28 w-28 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader className="flex-row items-start justify-between gap-3 pb-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">SLA da semana</CardTitle>
              <HelperTooltip term={helperTexts.sla.term} explanation={helperTexts.sla.explanation} />
            </div>
            <CardDescription>Entregas no prazo nos últimos 7 dias</CardDescription>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-5">
            <SLARing value={fleetSLA.weekly} tone={status.tone} label={`SLA da semana: ${formatSLA(fleetSLA.weekly)}%`} size={104} />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm text-muted-foreground">
                Meta de <span className="font-data font-semibold text-foreground">{pct(SLA_THRESHOLDS.EXCELLENT)}</span>
              </p>
              <SLATrend trend={weeklyTrend} diff={trendDiff} compared="lastWeek" />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Semana anterior</dt>
              <dd className="mt-1 font-data text-lg font-semibold leading-none text-foreground">{formatSLA(fleetSLA.previousWeekly)}%</dd>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Abaixo da meta</dt>
              <dd className="mt-1 font-data text-lg font-semibold leading-none text-foreground">
                {worstWeeklyDrivers.length}{" "}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  {worstWeeklyDrivers.length === 1 ? "motorista" : "motoristas"}
                </span>
              </dd>
            </div>
          </dl>

          <ul className="space-y-2 border-t pt-4" aria-label="Resumo da semana">
            {isTrulyHealthy ? (
              <SLANote tone="success">Operação saudável: todos acima da meta de {pct(SLA_THRESHOLDS.EXCELLENT)}.</SLANote>
            ) : (
              <>
                {criticalCount > 0 && (
                  <SLANote tone="danger">
                    {plural(criticalCount, "motorista", "motoristas")} em estado crítico (abaixo de {pct(SLA_THRESHOLDS.ATTENTION)})
                  </SLANote>
                )}
                {attentionCount > 0 && (
                  <SLANote tone="warning">
                    {plural(attentionCount, "motorista pede", "motoristas pedem")} atenção ({pct(SLA_THRESHOLDS.ATTENTION)} a{" "}
                    {pct(SLA_THRESHOLDS.GOOD - 0.1)})
                  </SLANote>
                )}
                {nearGoalCount > 0 && (
                  <SLANote tone="warning">
                    {plural(nearGoalCount, "motorista", "motoristas")} perto da meta ({pct(SLA_THRESHOLDS.GOOD)} a{" "}
                    {pct(SLA_THRESHOLDS.EXCELLENT - 0.1)})
                  </SLANote>
                )}
                {orphanCount > 0 && (
                  <SLANote tone="warning">
                    {plural(orphanCount, "nota com ocorrência", "notas com ocorrência")} sem motorista ligado
                  </SLANote>
                )}
                {criticalCount + attentionCount + nearGoalCount + orphanCount === 0 && (
                  <SLANote tone="warning">A frota está abaixo da meta de {pct(SLA_THRESHOLDS.EXCELLENT)}.</SLANote>
                )}
              </>
            )}
          </ul>

          <Button variant="outline" className="mt-auto w-full" onClick={() => setIsModalOpen(true)}>
            Ver motoristas e notas
            <ChevronRight aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <SLADrilldownModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="SLA dos últimos 7 dias"
        subtitle={`Motoristas e notas abaixo da meta de ${pct(SLA_THRESHOLDS.EXCELLENT)} aparecem primeiro.`}
        drivers={driversWithWeeklyActivity}
        orphanInvoices={orphanInvoices}
        fleetSLA={fleetSLA.weekly}
        mode="weekly"
      />
    </>
  );
}
