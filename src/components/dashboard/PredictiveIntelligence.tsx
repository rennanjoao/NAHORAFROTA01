import { AlertTriangle, Eye, CheckCircle2, Clock, AlertCircle, MessageCircle, History, Truck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect } from "react";
import { HelperTooltip } from "./HelperTooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatSLA } from "@/lib/formatSLA";
import { useSLADB, OCCURRENCE_LABELS, getSLAColorScheme, isSLACritical, SLA_THRESHOLDS } from "@/hooks/useSLADB";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  MIN_INVOICES_FOR_ATTENTION,
  SLA_PERIODS,
  SLA_PERIOD_LABELS,
  rankBySLA,
  type PeriodSLA,
  type SLAPeriodDays,
} from "@/lib/slaRanking";

interface PeriodRank {
  rank: number | null;
  of: number;
}

interface DriverAttention {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  photoUrl: string | null;
  isInRoute: boolean;
  /** SLA do periodo selecionado */
  historicalSLA: number;
  periodStats: Record<SLAPeriodDays, PeriodSLA>;
  ranks: Record<SLAPeriodDays, PeriodRank>;
  todayDeliveries: {
    id: string;
    nfNumber: string;
    recipient: string;
    status: "completed" | "occurrence" | "pending";
    occurrenceType?: string;
    routeSequence: number;
  }[];
  completedCount: number;
  occurrenceCount: number;
  pendingCount: number;
}

function getAttentionLevel(sla: number): "critical" | "warning" | "ok" {
  if (sla < SLA_THRESHOLDS.ATTENTION) return "critical";
  if (sla < SLA_THRESHOLDS.EXCELLENT) return "warning";
  return "ok";
}

function getAttentionColor(level: "critical" | "warning" | "ok") {
  switch (level) {
    case "critical": return "text-destructive";
    case "warning": return "text-warning";
    case "ok": return "text-success";
  }
}

function getProgressColor(level: "critical" | "warning" | "ok") {
  switch (level) {
    case "critical": return "[&>div]:bg-destructive";
    case "warning": return "[&>div]:bg-warning";
    case "ok": return "[&>div]:bg-success";
  }
}

function DeliveryStatusDot({ status }: { status: "completed" | "occurrence" | "pending" }) {
  return (
    <div
      className={cn(
        "h-3 w-3 rounded-full flex-shrink-0",
        status === "completed" && "bg-success",
        status === "occurrence" && "bg-warning",
        status === "pending" && "bg-muted-foreground/40"
      )}
      title={
        status === "completed" ? "Entrega realizada" :
        status === "occurrence" ? "Entrega com ocorrência" :
        "Entrega pendente"
      }
    />
  );
}

function RankLabel({ rank }: { rank: PeriodRank }) {
  if (rank.rank === null) return <span className="text-muted-foreground">sem ranking</span>;
  return (
    <span>
      <span className="font-semibold text-foreground">{rank.rank}º</span> de {rank.of}
    </span>
  );
}

/** Linha compacta com o SLA de cada janela de historico. */
function PeriodHistoryRow({ driver, selected }: { driver: DriverAttention; selected: SLAPeriodDays }) {
  return (
    <div className="grid grid-cols-5 gap-1 text-center">
      {SLA_PERIODS.map((days) => {
        const stats = driver.periodStats[days];
        const hasData = stats.total > 0;
        const scheme = getSLAColorScheme(stats.sla);
        return (
          <div
            key={days}
            className={cn(
              "rounded-md border px-1 py-1",
              days === selected ? "border-primary/50 bg-primary/5" : "border-border"
            )}
            title={hasData ? `${stats.total} NF(s), ${stats.occurrences} ocorrência(s)` : "Sem entregas no período"}
          >
            <p className="text-[10px] text-muted-foreground leading-tight">{days === 180 ? "Geral" : `${days}d`}</p>
            <p className={cn("text-xs font-mono font-semibold", hasData ? scheme.textClass : "text-muted-foreground")}>
              {hasData ? `${formatSLA(stats.sla)}%` : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DriverAttentionCard({ 
  driver, 
  period,
  onClick 
}: { 
  driver: DriverAttention;
  period: SLAPeriodDays;
  onClick: () => void;
}) {
  const attentionLevel = getAttentionLevel(driver.historicalSLA);
  const totalDeliveries = driver.todayDeliveries.length;

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = driver.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${cleanPhone}`, "_blank");
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition-all cursor-pointer",
        attentionLevel === "critical" 
          ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" 
          : attentionLevel === "warning"
          ? "bg-warning/5 border-warning/20 hover:bg-warning/10"
          : "bg-card border-border hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3">
        {driver.photoUrl ? (
          <img 
            src={driver.photoUrl} 
            alt={driver.name} 
            className={cn(
              "h-10 w-10 rounded-full object-cover ring-2",
              attentionLevel === "critical" ? "ring-destructive" :
              attentionLevel === "warning" ? "ring-warning" :
              "ring-success"
            )}
          />
        ) : (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0",
              attentionLevel === "critical"
                ? "bg-destructive text-destructive-foreground"
                : attentionLevel === "warning"
                ? "bg-warning text-warning-foreground"
                : "bg-success text-success-foreground"
            )}
          >
            {driver.avatar}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                {driver.name}
                {driver.isInRoute && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                    <Truck className="h-3 w-3 mr-0.5" /> em rota
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Ranking {SLA_PERIOD_LABELS[period]}: <RankLabel rank={driver.ranks[period]} />
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className={cn("text-lg font-bold font-mono", getAttentionColor(attentionLevel))}>
                {formatSLA(driver.historicalSLA)}%
              </span>
            </div>
          </div>

          <div className="mt-1">
            <Progress
              value={driver.historicalSLA}
              className={cn("h-1.5", getProgressColor(attentionLevel))}
            />
          </div>
        </div>

        <Button 
          size="sm" 
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 text-green-500 hover:text-green-600" 
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>

      <PeriodHistoryRow driver={driver} selected={period} />

      {/* Delivery sequence dots */}
      {driver.todayDeliveries.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {driver.todayDeliveries.slice(0, 15).map((delivery, idx) => (
            <DeliveryStatusDot key={delivery.id || idx} status={delivery.status} />
          ))}
          {driver.todayDeliveries.length > 15 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{driver.todayDeliveries.length - 15}
            </span>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-success" />
          {driver.completedCount}
        </span>
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-warning" />
          {driver.occurrenceCount}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {driver.pendingCount}
        </span>
        {totalDeliveries > 0 && (
          <span className="ml-auto">
            {totalDeliveries} entregas hoje
          </span>
        )}
      </div>
    </div>
  );
}

function DriverDetailSheet({ 
  driver, 
  period,
  open, 
  onOpenChange 
}: { 
  driver: DriverAttention | null;
  period: SLAPeriodDays;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!driver) return null;

  const attentionLevel = getAttentionLevel(driver.historicalSLA);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {driver.photoUrl ? (
              <img 
                src={driver.photoUrl} 
                alt={driver.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold",
                  attentionLevel === "critical"
                    ? "bg-destructive text-destructive-foreground"
                    : attentionLevel === "warning"
                    ? "bg-warning text-warning-foreground"
                    : "bg-success text-success-foreground"
                )}
              >
                {driver.avatar}
              </div>
            )}
            <div>
              <p>{driver.name}</p>
              <p className={cn("text-sm font-normal", getAttentionColor(attentionLevel))}>
                SLA {SLA_PERIOD_LABELS[period]}: {formatSLA(driver.historicalSLA)}%
              </p>
            </div>
          </SheetTitle>
          <SheetDescription>
            Histórico de SLA, posição no ranking e entregas do dia
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* SLA history and ranking per period */}
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Como tem sido o SLA</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-normal">Período</th>
                  <th className="px-3 py-1.5 text-right font-normal">SLA</th>
                  <th className="px-3 py-1.5 text-right font-normal">NFs</th>
                  <th className="px-3 py-1.5 text-right font-normal">Ocorr.</th>
                  <th className="px-3 py-1.5 text-right font-normal">Ranking</th>
                </tr>
              </thead>
              <tbody>
                {SLA_PERIODS.map((days) => {
                  const stats = driver.periodStats[days];
                  const hasData = stats.total > 0;
                  return (
                    <tr key={days} className={cn("border-t", days === period && "bg-primary/5")}>
                      <td className="px-3 py-1.5">{SLA_PERIOD_LABELS[days]}</td>
                      <td className={cn("px-3 py-1.5 text-right font-mono font-semibold", hasData ? getSLAColorScheme(stats.sla).textClass : "text-muted-foreground")}>
                        {hasData ? `${formatSLA(stats.sla)}%` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{stats.total}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{stats.occurrences}</td>
                      <td className="px-3 py-1.5 text-right text-xs"><RankLabel rank={driver.ranks[days]} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-success" />
              Finalizada
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-warning" />
              Ocorrência
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-muted-foreground/40" />
              Pendente
            </span>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
              <p className="text-2xl font-bold text-success">{driver.completedCount}</p>
              <p className="text-xs text-muted-foreground">Finalizadas</p>
            </div>
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-center">
              <p className="text-2xl font-bold text-warning">{driver.occurrenceCount}</p>
              <p className="text-xs text-muted-foreground">Ocorrências</p>
            </div>
            <div className="rounded-lg bg-muted/50 border p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{driver.pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>

          {/* Delivery list - ordered by route sequence */}
          {driver.todayDeliveries.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {driver.todayDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3",
                      delivery.status === "completed" && "bg-success/5 border-success/20",
                      delivery.status === "occurrence" && "bg-warning/5 border-warning/20",
                      delivery.status === "pending" && "bg-muted/30 border-border"
                    )}
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-medium" title="Sequência da roteirização">
                      {delivery.routeSequence}
                    </div>
                    <DeliveryStatusDot status={delivery.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{delivery.nfNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{delivery.recipient}</p>
                    </div>
                    {delivery.status === "completed" && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        OK
                      </Badge>
                    )}
                    {delivery.status === "occurrence" && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {OCCURRENCE_LABELS[delivery.occurrenceType || ""] || delivery.occurrenceType || "Ocorrência"}
                      </Badge>
                    )}
                    {delivery.status === "pending" && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma entrega hoje ainda</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PredictiveIntelligence() {
  const { driverStats, isLoading } = useSLADB();
  const [selectedDriver, setSelectedDriver] = useState<DriverAttention | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [driversInRoute, setDriversInRoute] = useState<string[]>([]);
  const [todayInvoices, setTodayInvoices] = useState<any[]>([]);
  const [period, setPeriod] = useState<SLAPeriodDays>(30);
  const [onlyInRoute, setOnlyInRoute] = useState(false);

  // Fetch drivers currently in route and their today's invoices
  useEffect(() => {
    const fetchData = async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      const [driversResult, invoicesResult] = await Promise.all([
        // Get drivers with status 'in_route'
        supabase
          .from("drivers")
          .select("id")
          .eq("status", "in_route"),
        
        // Get today's invoices with all statuses
        supabase
          .from("invoices")
          .select("id, nfe_number, recipient_name, status, occurrence_type, driver_id, updated_at")
          .gte("updated_at", todayStart.slice(0, 10)),
      ]);

      setDriversInRoute((driversResult.data || []).map(d => d.id));
      setTodayInvoices(invoicesResult.data || []);
    };

    fetchData();

    // Subscribe to driver status changes
    const channel = supabase
      .channel("predictive-drivers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Posicao de cada motorista no ranking de SLA de cada janela (1 = melhor).
  const ranksByDriver = useMemo(() => {
    const result = new Map<string, Record<SLAPeriodDays, PeriodRank>>();
    driverStats.forEach(d => result.set(d.driver_id, {} as Record<SLAPeriodDays, PeriodRank>));
    SLA_PERIODS.forEach(days => {
      const ranked = rankBySLA(
        driverStats,
        d => d.periodStats[days].sla,
        d => d.periodStats[days].total,
        d => d.driver_name
      );
      const of = ranked.filter(r => r.rank !== null).length;
      ranked.forEach(({ item, rank }) => {
        result.get(item.driver_id)![days] = { rank, of };
      });
    });
    return result;
  }, [driverStats]);

  // Motoristas que precisam de atencao no periodo escolhido:
  // SLA abaixo da meta com volume minimo de NFs finalizadas.
  const driversRequiringAttention = useMemo(() => {
    const attentionList: DriverAttention[] = driverStats
      .filter(d => {
        const stats = d.periodStats[period];
        return (
          (!onlyInRoute || driversInRoute.includes(d.driver_id)) &&
          stats.total >= MIN_INVOICES_FOR_ATTENTION[period] &&
          stats.sla < SLA_THRESHOLDS.EXCELLENT
        );
      })
      .map(driver => {
        // Get today's invoices for this driver
        const driverInvoices = todayInvoices
          .filter(inv => inv.driver_id === driver.driver_id)
          .map((inv, index) => ({
            id: inv.id,
            nfNumber: inv.nfe_number || `NF-${inv.id.slice(0, 8)}`,
            recipient: inv.recipient_name || "Cliente",
            status: inv.status === "delivered" 
              ? "completed" as const
              : inv.status === "occurrence" || inv.status === "returned"
                ? "occurrence" as const
                : "pending" as const,
            occurrenceType: inv.occurrence_type,
            routeSequence: index + 1,
          }));

        const completedCount = driverInvoices.filter(d => d.status === "completed").length;
        const occurrenceCount = driverInvoices.filter(d => d.status === "occurrence").length;
        const pendingCount = driverInvoices.filter(d => d.status === "pending").length;

        return {
          id: driver.driver_id,
          name: driver.driver_name,
          avatar: driver.driver_name.split(" ").map(n => n[0]).join("").slice(0, 2),
          phone: driver.phone,
          photoUrl: driver.photo_url,
          isInRoute: driversInRoute.includes(driver.driver_id),
          historicalSLA: driver.periodStats[period].sla,
          periodStats: driver.periodStats,
          ranks: ranksByDriver.get(driver.driver_id)!,
          todayDeliveries: driverInvoices,
          completedCount,
          occurrenceCount,
          pendingCount,
        };
      })
      .sort((a, b) => a.historicalSLA - b.historicalSLA);

    return attentionList;
  }, [driverStats, driversInRoute, todayInvoices, period, onlyInRoute, ranksByDriver]);

  // Split into critical and attention
  const criticalDrivers = driversRequiringAttention.filter(d => isSLACritical(d.historicalSLA));
  const attentionDrivers = driversRequiringAttention.filter(d => !isSLACritical(d.historicalSLA));

  const criticalCount = criticalDrivers.length;
  const warningCount = attentionDrivers.length;

  const handleDriverClick = (driver: DriverAttention) => {
    setSelectedDriver(driver);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-lg bg-warning/10 p-2">
          <Eye className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Motoristas que Precisam de Atenção</h3>
            <HelperTooltip 
              term="Histórico SLA" 
              explanation={`SLA de cada motorista no período escolhido. Entram na lista os motoristas abaixo de ${SLA_THRESHOLDS.EXCELLENT}% com um volume mínimo de NFs finalizadas. O ranking compara todos os motoristas com entregas no período (1º = melhor SLA).`}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Histórico de SLA dos últimos {SLA_PERIOD_LABELS[period].toLowerCase()} e ranking da frota
          </p>
        </div>
      </div>

      {/* Period + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={String(period)}
          onValueChange={(value) => value && setPeriod(Number(value) as SLAPeriodDays)}
        >
          {SLA_PERIODS.map(days => (
            <ToggleGroupItem key={days} value={String(days)} className="h-8 px-2.5 text-xs">
              {days === 180 ? "Geral" : `${days}d`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Switch id="only-in-route" checked={onlyInRoute} onCheckedChange={setOnlyInRoute} />
          <Label htmlFor="only-in-route" className="text-xs text-muted-foreground">Só em rota</Label>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 mb-4">
        {criticalCount > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {criticalCount} críticos (&lt;{SLA_THRESHOLDS.ATTENTION}%)
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            {warningCount} atenção ({SLA_THRESHOLDS.ATTENTION}-{SLA_THRESHOLDS.EXCELLENT - 0.1}%)
          </Badge>
        )}
        {driversRequiringAttention.length === 0 && driverStats.length > 0 && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Todos acima de {SLA_THRESHOLDS.EXCELLENT}%
          </Badge>
        )}
      </div>

      {driversRequiringAttention.length > 0 ? (
        <div className="space-y-4">
          {/* Critical Section */}
          {criticalDrivers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="font-semibold text-destructive text-sm">
                  Estado Crítico (&lt;{SLA_THRESHOLDS.ATTENTION}%) - Acompanhamento Intensivo
                </span>
              </div>
              <div className="space-y-3">
                {criticalDrivers.map((driver) => (
                  <DriverAttentionCard 
                    key={driver.id} 
                    driver={driver} 
                    period={period}
                    onClick={() => handleDriverClick(driver)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Attention Section */}
          {attentionDrivers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="font-semibold text-warning text-sm">
                  Alerta de Risco ({SLA_THRESHOLDS.ATTENTION}-{SLA_THRESHOLDS.EXCELLENT - 0.1}%) - Monitoramento
                </span>
              </div>
              <div className="space-y-3">
                {attentionDrivers.map((driver) => (
                  <DriverAttentionCard 
                    key={driver.id} 
                    driver={driver} 
                    period={period}
                    onClick={() => handleDriverClick(driver)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-success/50" />
          <p className="font-medium text-success">
            {onlyInRoute && driversInRoute.length === 0
              ? "Nenhum motorista em rota no momento"
              : "Nenhum motorista precisa de atenção neste período!"
            }
          </p>
          <p className="text-sm">
            {onlyInRoute && driversInRoute.length === 0
              ? "Aguardando início das rotas do dia."
              : `Ninguém abaixo de ${SLA_THRESHOLDS.EXCELLENT}% nos últimos ${SLA_PERIOD_LABELS[period].toLowerCase()}.`
            }
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Legenda das entregas:</p>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-success" />
            Finalizada
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-warning" />
            Ocorrência
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            Pendente
          </span>
        </div>
      </div>

      {/* Detail Sheet */}
      <DriverDetailSheet
        driver={selectedDriver}
        period={period}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
