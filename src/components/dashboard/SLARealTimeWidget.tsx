/**
 * SLA DE HOJE
 * SLA da frota no dia, atualizado a cada baixa, com o ranking dos motoristas.
 */

import { useMemo, useState } from "react";
import { ChevronRight, MessageCircle, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusBadge, toneText } from "@/components/patterns";
import { useSLADB, DriverSLAStats, isSLACritical, isSLAAttention, SLA_THRESHOLDS, getOccurrenceLabel } from "@/hooks/useSLADB";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { rankBySLA } from "@/lib/slaRanking";
import { openWhatsApp } from "@/lib/whatsapp";
import { SLADrilldownModal } from "./SLADrilldownModal";
import { SLABar, SLATrend } from "./SLAParts";
import { plural, slaStatus, pct } from "./status";

/** Quantos aparecem no cartao; o resto fica na janela "Ver todos". */
const RANKING_PREVIEW = 8;

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sem posição</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-xs font-semibold",
        rank <= 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
      title={`${rank}º lugar no SLA de hoje`}
    >
      {rank}º
    </span>
  );
}

function RankingRow({ driver, rank, onClick }: { driver: DriverSLAStats; rank: number | null; onClick: () => void }) {
  const hasActivity = driver.todayTotalInvoices > 0;
  const status = slaStatus(hasActivity ? driver.todaySLA : 100);
  const phone = driver.phone?.replace(/\D/g, "");

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RankBadge rank={rank} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{driver.driver_name}</span>
          {hasActivity ? (
            <span className="block text-xs text-muted-foreground">
              {plural(driver.todayDeliveredCount, "entrega", "entregas")} ·{" "}
              {plural(driver.todayOccurrenceCount, "ocorrência", "ocorrências")}
            </span>
          ) : (
            <span className="block truncate text-xs text-muted-foreground">Em rota, aguardando as primeiras baixas</span>
          )}
          {driver.todayOccurrences.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {driver.todayOccurrences.slice(0, 2).map((occ, idx) => (
                <Badge key={idx} variant="secondary" className="px-2 py-0 text-[0.6875rem]">
                  {getOccurrenceLabel(occ.occurrenceType)}
                </Badge>
              ))}
              {driver.todayOccurrences.length > 2 && (
                <Badge variant="secondary" className="px-2 py-0 text-[0.6875rem]">
                  +{driver.todayOccurrences.length - 2}
                </Badge>
              )}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 sm:w-20">
          <span className={cn("font-data text-sm font-semibold", hasActivity ? toneText[status.tone] : "text-muted-foreground")}>
            {hasActivity ? `${formatSLA(driver.todaySLA)}%` : "—"}
          </span>
          {hasActivity && <SLABar value={driver.todaySLA} tone={status.tone} className="hidden h-1 sm:block" />}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {phone && (
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 text-muted-foreground hover:text-success"
          onClick={() => openWhatsApp(phone)}
          aria-label={`Chamar ${driver.driver_name} no WhatsApp`}
          title={`Chamar ${driver.driver_name} no WhatsApp`}
        >
          <MessageCircle aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

export function SLARealTimeWidget() {
  const { isLoading, fleetSLA, todayProblematicDrivers, activeDriverStats, todayTrend, driverStats } = useSLADB();

  const [showDrilldown, setShowDrilldown] = useState(false);

  const status = slaStatus(fleetSLA.today);
  const criticalCount = todayProblematicDrivers.filter((d) => isSLACritical(d.todaySLA)).length;
  const warningCount = todayProblematicDrivers.filter((d) => isSLAAttention(d.todaySLA)).length;
  const driversWithActivity = activeDriverStats.filter((d) => d.todayTotalInvoices > 0);
  const trendDiff = fleetSLA.today - fleetSLA.yesterday;

  // Ranking de hoje: todos os motoristas com baixa hoje, do melhor para o pior,
  // seguidos dos que estao em rota e ainda nao finalizaram nenhuma entrega.
  const todayRanking = useMemo(
    () =>
      rankBySLA(
        driverStats.filter((d) => d.todayTotalInvoices > 0 || d.status === "in_route"),
        (d) => d.todaySLA,
        (d) => d.todayTotalInvoices,
        (d) => d.driver_name,
      ),
    [driverStats],
  );

  if (isLoading) {
    return (
      <Card className="h-full p-6" aria-busy="true">
        <Skeleton className="h-5 w-32" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
            <CardTitle className="text-base">SLA de hoje</CardTitle>
            <CardDescription>Atualiza a cada entrega baixada pelos motoristas</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setShowDrilldown(true)}>
            Ver todos
            <ChevronRight aria-hidden="true" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-6">
          {/* Visao da frota */}
          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="font-data text-[2.5rem] font-semibold leading-none tracking-tight text-foreground">
                    {formatSLA(fleetSLA.today)}%
                  </p>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <SLATrend trend={todayTrend} diff={trendDiff} compared="yesterday" />
                  <span className="text-sm text-muted-foreground">
                    {plural(driversWithActivity.length, "motorista com baixa", "motoristas com baixa")} hoje
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <SLABar value={fleetSLA.today} tone={status.tone} goal={SLA_THRESHOLDS.EXCELLENT} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Crítico abaixo de {pct(SLA_THRESHOLDS.ATTENTION)}</span>
                  <span>Meta {pct(SLA_THRESHOLDS.EXCELLENT)}</span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <div className={cn("rounded-lg border p-3", criticalCount > 0 ? "border-destructive/30 bg-destructive/5" : "bg-muted/40")}>
                <dt className="text-xs font-medium text-muted-foreground">Críticos</dt>
                <dd
                  className={cn(
                    "mt-1 font-data text-2xl font-semibold leading-none",
                    criticalCount > 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {criticalCount}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">abaixo de {pct(SLA_THRESHOLDS.ATTENTION)}</dd>
              </div>
              <div className={cn("rounded-lg border p-3", warningCount > 0 ? "border-warning/30 bg-warning/5" : "bg-muted/40")}>
                <dt className="text-xs font-medium text-muted-foreground">Atenção</dt>
                <dd
                  className={cn(
                    "mt-1 font-data text-2xl font-semibold leading-none",
                    warningCount > 0 ? "text-warning" : "text-foreground",
                  )}
                >
                  {warningCount}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {pct(SLA_THRESHOLDS.ATTENTION)} a {pct(SLA_THRESHOLDS.GOOD - 0.1)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Ranking de todos os motoristas do dia */}
          <div className="min-w-0 border-t pt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
                Ranking de SLA dos motoristas hoje
              </h4>
              <span className="shrink-0 text-xs text-muted-foreground">{plural(todayRanking.length, "motorista", "motoristas")}</span>
            </div>
            {todayRanking.length > 0 ? (
              <>
                <ul className="-mx-2 space-y-0.5">
                  {todayRanking.slice(0, RANKING_PREVIEW).map(({ item: driver, rank }) => (
                    <RankingRow key={driver.driver_id} driver={driver} rank={rank} onClick={() => setShowDrilldown(true)} />
                  ))}
                </ul>
                {todayRanking.length > RANKING_PREVIEW && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowDrilldown(true)}>
                    Ver os {todayRanking.length} motoristas
                  </Button>
                )}
              </>
            ) : (
              <EmptyState
                compact
                icon={Trophy}
                title="Nenhum motorista em rota hoje"
                description="O ranking aparece assim que as primeiras entregas forem baixadas."
              />
            )}
          </div>
        </CardContent>
      </Card>

      <SLADrilldownModal
        open={showDrilldown}
        onOpenChange={setShowDrilldown}
        title="SLA de hoje"
        subtitle="Desempenho de cada motorista no dia. Toque em um nome para ver as notas."
        drivers={driversWithActivity}
        fleetSLA={fleetSLA.today}
        mode="today"
      />
    </>
  );
}
