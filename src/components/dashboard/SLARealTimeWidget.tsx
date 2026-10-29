/**
 * SLA REAL-TIME WIDGET
 * Shows today's fleet SLA with real-time updates and drill-down to drivers/invoices
 */

import { useMemo, useState } from "react";
import { 
  Activity, 
  AlertTriangle, 
  ChevronRight, 
  Users,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  MessageCircle,
  Clock,
  Trophy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSLADB, DriverSLAStats, getSLAColorScheme, isSLACritical, isSLAAttention, SLA_THRESHOLDS, getOccurrenceLabel } from "@/hooks/useSLADB";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SLADrilldownModal } from "./SLADrilldownModal";
import { rankBySLA } from "@/lib/slaRanking";
import { openWhatsApp } from "@/lib/whatsapp";

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        rank === 1 && "bg-warning text-warning-foreground",
        rank === 2 && "bg-idle text-foreground",
        rank === 3 && "bg-warning/30 text-warning",
        rank > 3 && "bg-muted text-foreground"
      )}
      title={`${rank}º lugar no SLA de hoje`}
    >
      {rank}º
    </span>
  );
}

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

function DriverOccurrenceCard({ 
  driver, 
  rank,
  onClick 
}: { 
  driver: DriverSLAStats;
  rank: number | null;
  onClick: () => void;
}) {
  const hasActivity = driver.todayTotalInvoices > 0;
  const colorScheme = getSLAColorScheme(hasActivity ? driver.todaySLA : 100);

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = driver.phone.replace(/\D/g, "");
    openWhatsApp(cleanPhone);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 group",
        hasActivity ? colorScheme.borderClass : "border-border",
        hasActivity ? colorScheme.bgClass : "bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />
        {driver.photo_url ? (
          <img 
            src={driver.photo_url} 
            alt={driver.driver_name} 
            className="h-10 w-10 rounded-full object-cover border-2 border-muted" 
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
            {driver.driver_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{driver.driver_name}</p>
          <p className="text-xs text-muted-foreground">
            {hasActivity
              ? `${driver.todayDeliveredCount} entregas • ${driver.todayOccurrenceCount} ocorrências`
              : "Em rota, aguardando as primeiras baixas"}
          </p>
        </div>

        <div className="text-right">
          <span className={cn("text-lg font-bold font-mono", hasActivity ? colorScheme.textClass : "text-muted-foreground")}>
            {hasActivity ? `${formatSLA(driver.todaySLA)}%` : "—"}
          </span>
        </div>

        <Button 
          size="sm" 
          variant="ghost"
          className="md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-success hover:text-success hover:bg-success/10" 
          onClick={handleWhatsApp}
          aria-label={`Chamar ${driver.driver_name} no WhatsApp`}
          title={`Chamar ${driver.driver_name} no WhatsApp`}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>

        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Occurrence preview */}
      {driver.todayOccurrences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {driver.todayOccurrences.slice(0, 3).map((occ, idx) => (
            <Badge 
              key={idx} 
              variant="outline" 
              className="text-xs bg-background"
            >
              {getOccurrenceLabel(occ.occurrenceType)}
            </Badge>
          ))}
          {driver.todayOccurrences.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{driver.todayOccurrences.length - 3}
            </Badge>
          )}
        </div>
      )}

      {hasActivity && (
        <Progress 
          value={driver.todaySLA} 
          className={cn("h-1 mt-2", colorScheme.progressClass)} 
        />
      )}
    </div>
  );
}

export function SLARealTimeWidget() {
  const { 
    isLoading,
    fleetSLA, 
    todayProblematicDrivers,
    activeDriverStats,
    todayTrend,
    driverStats,
  } = useSLADB();

  const [showDrilldown, setShowDrilldown] = useState(false);
  const [selectedDriverForDrilldown, setSelectedDriverForDrilldown] = useState<DriverSLAStats | null>(null);
  
  const fleetColorScheme = getSLAColorScheme(fleetSLA.today);
  const criticalCount = todayProblematicDrivers.filter(d => isSLACritical(d.todaySLA)).length;
  const warningCount = todayProblematicDrivers.filter(d => isSLAAttention(d.todaySLA)).length;
  const driversWithActivity = activeDriverStats.filter(d => d.todayTotalInvoices > 0);
  const trendDiff = fleetSLA.today - fleetSLA.yesterday;

  // Ranking de hoje: todos os motoristas com baixa hoje, do melhor para o pior,
  // seguidos dos que estao em rota e ainda nao finalizaram nenhuma entrega.
  const todayRanking = useMemo(
    () =>
      rankBySLA(
        driverStats.filter(d => d.todayTotalInvoices > 0 || d.status === "in_route"),
        d => d.todaySLA,
        d => d.todayTotalInvoices,
        d => d.driver_name
      ),
    [driverStats]
  );

  const handleDriverClick = (driver: DriverSLAStats) => {
    setSelectedDriverForDrilldown(driver);
    setShowDrilldown(true);
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              SLA em Tempo Real
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8"
              onClick={() => setShowDrilldown(true)}
            >
              Ver todos
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Fleet SLA Overview - Clickable */}
          <div 
            onClick={() => setShowDrilldown(true)}
            className={cn(
              "p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
              fleetColorScheme.borderClass,
              fleetColorScheme.bgClass
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">SLA de Hoje</span>
              <div className="flex items-center gap-2">
                <Badge className={cn(
                  "font-bold",
                  fleetColorScheme.badgeBgClass
                )}>
                  {fleetColorScheme.labelPt}
                </Badge>
                <TrendIndicator trend={todayTrend} diff={trendDiff} />
              </div>
            </div>
            
            <div className="flex items-end gap-3 mb-3">
              <span className={cn("text-4xl font-bold font-data", fleetColorScheme.textClass)}>
                {formatSLA(fleetSLA.today)}%
              </span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                {driversWithActivity.length} motoristas
              </div>
            </div>
            
            <Progress value={fleetSLA.today} className={cn("h-3", fleetColorScheme.progressClass)} />
            
            {/* Threshold markers */}
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>0</span>
              <span className="text-destructive">{SLA_THRESHOLDS.ATTENTION}</span>
              <span className="text-info">{SLA_THRESHOLDS.GOOD}</span>
              <span className="text-success">{SLA_THRESHOLDS.EXCELLENT}</span>
              <span className="text-success">100</span>
            </div>
          </div>

          {/* Alert Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(
              "p-3 rounded-lg border text-left",
              criticalCount > 0 
                ? "border-destructive bg-destructive/10" 
                : "border-border bg-muted/30"
            )}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn("h-4 w-4", criticalCount > 0 ? "text-destructive" : "text-muted-foreground")} />
                <span className="text-sm font-medium">Críticos</span>
              </div>
              <div className={cn("text-2xl font-bold font-data", criticalCount > 0 ? "text-destructive" : "text-muted-foreground")}>
                {criticalCount}
              </div>
              <div className="text-xs text-muted-foreground">SLA &lt; {SLA_THRESHOLDS.ATTENTION}%</div>
            </div>
            
            <div className={cn(
              "p-3 rounded-lg border text-left",
              warningCount > 0 
                ? "border-warning bg-warning/10" 
                : "border-border bg-muted/30"
            )}>
              <div className="flex items-center gap-2">
                <TrendingDown className={cn("h-4 w-4", warningCount > 0 ? "text-warning" : "text-muted-foreground")} />
                <span className="text-sm font-medium">Atenção</span>
              </div>
              <div className={cn("text-2xl font-bold font-data", warningCount > 0 ? "text-warning" : "text-muted-foreground")}>
                {warningCount}
              </div>
              <div className="text-xs text-muted-foreground">SLA {SLA_THRESHOLDS.ATTENTION}-{SLA_THRESHOLDS.EXCELLENT - 0.1}%</div>
            </div>
          </div>

          {/* Ranking of all drivers today */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                Ranking de SLA dos motoristas hoje
              </h4>
              <span className="text-xs text-muted-foreground">{todayRanking.length} motorista(s)</span>
            </div>
            <ScrollArea className="h-[320px]">
              <div className="space-y-2">
                {todayRanking.length > 0 ? (
                  todayRanking.map(({ item: driver, rank }) => (
                    <DriverOccurrenceCard 
                      key={driver.driver_id}
                      driver={driver}
                      rank={rank}
                      onClick={() => handleDriverClick(driver)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-success/50" />
                    <p className="font-medium">Nenhum motorista em rota hoje</p>
                    <p className="text-sm">O ranking aparece assim que as primeiras entregas forem baixadas</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* SLA Drill-down Modal */}
      <SLADrilldownModal
        open={showDrilldown}
        onOpenChange={setShowDrilldown}
        title="Análise de SLA - Hoje"
        subtitle="Desempenho detalhado de todos os motoristas"
        drivers={driversWithActivity}
        fleetSLA={fleetSLA.today}
        mode="today"
      />
    </>
  );
}
