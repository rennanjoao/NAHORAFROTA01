/**
 * SLA WEEKLY WIDGET
 * Shows last 7 days fleet SLA with drill-down to drivers and invoices
 */

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, AlertCircle, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { HelperTooltip, helperTexts } from "./HelperTooltip";
import { formatSLA } from "@/lib/formatSLA";
import { useSLADB, getSLAColorScheme, SLA_THRESHOLDS } from "@/hooks/useSLADB";
import { Skeleton } from "@/components/ui/skeleton";
import { SLADrilldownModal } from "./SLADrilldownModal";

function TrendIndicator({ trend, diff }: { trend: "up" | "down" | "stable"; diff: number }) {
  if (trend === "stable") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        Estável
      </span>
    );
  }
  
  if (trend === "up") {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <TrendingUp className="h-3 w-3" />
        +{Math.abs(diff).toFixed(1)}%
      </span>
    );
  }
  
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <TrendingDown className="h-3 w-3" />
      -{Math.abs(diff).toFixed(1)}%
    </span>
  );
}

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

  const slaStatus = getSLAColorScheme(fleetSLA.weekly);
  const detractorCount = worstWeeklyDrivers.length + orphanInvoices.length;
  const criticalCount = criticalWeeklyDrivers.length;
  const attentionCount = attentionWeeklyDrivers.length;
  const orphanCount = orphanInvoices.length;
  const trendDiff = fleetSLA.weekly - fleetSLA.previousWeekly;

  // Check if truly healthy (no detractors AND no orphans)
  const isTrulyHealthy = isOperationHealthy && orphanInvoices.length === 0;

  // Get drivers with activity for the drill-down
  const driversWithWeeklyActivity = driverStats.filter(d => d.weeklyTotalInvoices > 0);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <>
      {/* Main Widget */}
      <div 
        onClick={() => setIsModalOpen(true)} 
        className={cn(
          "glass-card rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]",
          "border-2",
          slaStatus.borderClass
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", slaStatus.bgClass)}>
              <TrendingUp className={cn("h-5 w-5", slaStatus.textClass)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">SLA Semanal</h3>
                <HelperTooltip term={helperTexts.sla.term} explanation={helperTexts.sla.explanation} />
              </div>
              <p className="text-sm text-muted-foreground">Clique para ver detratores</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className={cn("font-bold", slaStatus.badgeBgClass)}>
              {slaStatus.labelPt}
            </Badge>
            <div className="mt-1">
              <TrendIndicator trend={weeklyTrend} diff={trendDiff} />
            </div>
          </div>
        </div>

        {/* Progress Ring Simulation */}
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background Circle */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
              {/* Progress Circle */}
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="12" 
                strokeLinecap="round" 
                strokeDasharray={`${fleetSLA.weekly * 2.51327} 251.327`} 
                className={slaStatus.textClass} 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("font-bold text-2xl", slaStatus.textClass)}>
                {formatSLA(fleetSLA.weekly)}%
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meta:</span>
              <span className="font-medium text-foreground">{SLA_THRESHOLDS.EXCELLENT}.0%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Atual:</span>
              <span className={cn("font-bold", slaStatus.textClass)}>{formatSLA(fleetSLA.weekly)}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Detratores:</span>
              <span className={cn("font-medium", detractorCount > 0 ? "text-destructive" : "text-success")}>
                {detractorCount} motoristas
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Alert */}
        {(!isTrulyHealthy) && (
          <div className="mt-4 space-y-2">
            {criticalCount > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {criticalCount} motorista(s) em estado crítico (&lt;{SLA_THRESHOLDS.ATTENTION}%)
                </p>
              </div>
            )}
            {attentionCount > 0 && (
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
                <p className="text-sm text-warning font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {attentionCount} motorista(s) requerem atenção ({SLA_THRESHOLDS.ATTENTION}-{SLA_THRESHOLDS.EXCELLENT - 0.1}%)
                </p>
              </div>
            )}
            {orphanCount > 0 && (
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
                <p className="text-sm text-warning font-medium flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  {orphanCount} NF(s) com ocorrência sem motorista associado
                </p>
              </div>
            )}
          </div>
        )}

        {isTrulyHealthy && (
          <div className="mt-4 rounded-lg bg-success/10 border border-success/20 p-3">
            <p className="text-sm text-success font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Operação Saudável: Todos os motoristas acima da meta de {SLA_THRESHOLDS.EXCELLENT}%
            </p>
          </div>
        )}
      </div>

      {/* SLA Drill-down Modal */}
      <SLADrilldownModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Detratores de SLA - Últimos 7 Dias"
        subtitle={`Motoristas e NFs com SLA abaixo de ${SLA_THRESHOLDS.EXCELLENT}%`}
        drivers={driversWithWeeklyActivity}
        orphanInvoices={orphanInvoices}
        fleetSLA={fleetSLA.weekly}
        mode="weekly"
      />
    </>
  );
}
