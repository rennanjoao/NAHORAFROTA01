import { AlertTriangle, Eye, CheckCircle2, Clock, AlertCircle, MessageCircle, ChevronRight } from "lucide-react";
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
import { useSLADB, getOccurrenceWeight, OCCURRENCE_LABELS, getSLAColorScheme, isSLACritical, isSLAAttention, isSLAGood, SLA_THRESHOLDS } from "@/hooks/useSLADB";

interface DriverAttention {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  photoUrl: string | null;
  historicalSLA: number; // 6-month average
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

function DriverAttentionCard({ 
  driver, 
  onClick 
}: { 
  driver: DriverAttention;
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
            <p className="font-medium text-foreground truncate">{driver.name}</p>
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
  open, 
  onOpenChange 
}: { 
  driver: DriverAttention | null;
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
                SLA Histórico (6 meses): {formatSLA(driver.historicalSLA)}%
              </p>
            </div>
          </SheetTitle>
          <SheetDescription>
            Sequência de entregas do dia
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
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

  // Calculate drivers requiring attention:
  // - Currently in_route today
  // - Historical SLA (6 months) < 97%
  const driversRequiringAttention = useMemo(() => {
    const attentionList: DriverAttention[] = driverStats
      // Filter: in route AND has enough historical data AND below 97%
      .filter(d => 
        driversInRoute.includes(d.driver_id) && 
        d.historicalTotalInvoices >= 10 && 
        d.historicalSLA < SLA_THRESHOLDS.EXCELLENT
      )
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
          historicalSLA: driver.historicalSLA,
          todayDeliveries: driverInvoices,
          completedCount,
          occurrenceCount,
          pendingCount,
        };
      })
      .sort((a, b) => a.historicalSLA - b.historicalSLA);

    return attentionList;
  }, [driverStats, driversInRoute, todayInvoices]);

  // Split into critical (<90%) and attention (90-96.9%)
  const criticalDrivers = driversRequiringAttention.filter(d => isSLACritical(d.historicalSLA));
  const attentionDrivers = driversRequiringAttention.filter(d => isSLAAttention(d.historicalSLA));

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
            <h3 className="font-semibold text-foreground">Motoristas em Rota que Requerem Atenção</h3>
            <HelperTooltip 
              term="Histórico SLA" 
              explanation="Baseado na média do SLA dos últimos 6 meses. Motoristas com SLA abaixo de 97% são listados aqui para acompanhamento." 
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Baseado no histórico de SLA dos últimos 6 meses
          </p>
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
        {driversRequiringAttention.length === 0 && driversInRoute.length > 0 && (
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
            {driversInRoute.length > 0 
              ? "Todos os motoristas em rota estão com bom histórico!"
              : "Nenhum motorista em rota no momento"
            }
          </p>
          <p className="text-sm">
            {driversInRoute.length > 0 
              ? `Nenhum motorista com SLA abaixo de ${SLA_THRESHOLDS.EXCELLENT}% nos últimos 6 meses.`
              : "Aguardando início das rotas do dia."
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
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
