/**
 * SLA DRIVER DETAIL SHEET
 * Shows detailed view of a driver's deliveries and SLA-impacting occurrences
 */

import { Package, AlertTriangle, CheckCircle, Clock, TrendingDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useLogistics } from "@/contexts/LogisticsContext";
import { DriverSLAData } from "@/hooks/useSLA";
import { getSLAColorScheme, formatSLAScore, OCCURRENCE_RULES } from "@/lib/slaCalculations";

interface SLADriverDetailSheetProps {
  driver: DriverSLAData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map context occurrence types to SLA labels
const occurrenceLabels: Record<string, string> = {
  delay: "Local Fechado",
  damage: "Mercadoria Avariada",
  wrong_address: "Entrega Recusada",
  absent_recipient: "Cliente Ausente",
  refusal: "Entrega Recusada",
  theft: "Mercadoria Não Localizada",
  other: "Entrega Parcial",
};

const occurrenceSeverity: Record<string, { label: string; color: string }> = {
  delay: { label: "Leve", color: "text-warning" },
  damage: { label: "Muito Grave", color: "text-destructive" },
  wrong_address: { label: "Leve", color: "text-warning" },
  absent_recipient: { label: "Leve", color: "text-warning" },
  refusal: { label: "Leve", color: "text-warning" },
  theft: { label: "Muito Grave", color: "text-destructive" },
  other: { label: "Grave", color: "text-orange-500" },
};

export function SLADriverDetailSheet({ driver, open, onOpenChange }: SLADriverDetailSheetProps) {
  const { deliveries } = useLogistics();

  if (!driver) return null;

  const colorScheme = getSLAColorScheme(driver.currentDailySLA);

  // Get today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Get driver's deliveries for today
  const driverDeliveries = deliveries.filter(
    (d) =>
      d.driverId === driver.driverId &&
      d.scheduledDate >= todayStart &&
      d.scheduledDate <= todayEnd
  );

  // Separate deliveries with and without occurrences
  const deliveriesWithOccurrences = driverDeliveries.filter(
    (d) => d.occurrences.length > 0
  );
  const deliveriesWithoutOccurrences = driverDeliveries.filter(
    (d) => d.occurrences.length === 0
  );

  // Calculate point value
  const totalDeliveries = driverDeliveries.length || 1;
  const pointValue = 100 / totalDeliveries;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:max-w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${colorScheme.progressClass}`} />
            {driver.driverName}
          </SheetTitle>
          <SheetDescription>
            Detalhes do SLA e entregas do dia
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* SLA Summary */}
          <div className={`p-4 rounded-xl border-2 ${colorScheme.borderClass} ${colorScheme.bgClass}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">SLA Atual</span>
              <Badge className={`${colorScheme.textClass} bg-transparent border ${colorScheme.borderClass}`}>
                {colorScheme.labelPt}
              </Badge>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-3xl font-bold font-data ${colorScheme.textClass}`}>
                {formatSLAScore(driver.currentDailySLA)}%
              </span>
              <span className="text-sm text-muted-foreground mb-1">
                de 100 pontos
              </span>
            </div>
            <Progress value={driver.currentDailySLA} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <Package className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold font-data">{driverDeliveries.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="p-3 rounded-lg border bg-success/10 border-success/30 text-center">
              <CheckCircle className="h-4 w-4 mx-auto mb-1 text-success" />
              <div className="text-lg font-bold font-data text-success">
                {deliveriesWithoutOccurrences.length}
              </div>
              <div className="text-xs text-muted-foreground">OK</div>
            </div>
            <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-destructive" />
              <div className="text-lg font-bold font-data text-destructive">
                {deliveriesWithOccurrences.length}
              </div>
              <div className="text-xs text-muted-foreground">Ocorrências</div>
            </div>
          </div>

          <Separator />

          {/* Occurrences that impacted SLA */}
          {deliveriesWithOccurrences.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Ocorrências que Impactaram o SLA
              </h4>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {deliveriesWithOccurrences.map((delivery) =>
                    delivery.occurrences.map((occ, idx) => {
                      const severity = occurrenceSeverity[occ.type] || {
                        label: "Grave",
                        color: "text-orange-500",
                      };
                      const multiplier =
                        severity.label === "Muito Grave"
                          ? 2
                          : severity.label === "Grave"
                          ? 1
                          : 0.5;
                      const pointsLost = pointValue * multiplier;

                      return (
                        <div
                          key={`${delivery.id}-${idx}`}
                          className="p-3 rounded-lg border bg-destructive/5 border-destructive/20"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {delivery.nfNumber}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${severity.color}`}
                                >
                                  {severity.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {occurrenceLabels[occ.type] || occ.type}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {delivery.recipient}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-destructive font-bold font-data">
                                -{pointsLost.toFixed(1)}
                              </span>
                              <p className="text-xs text-muted-foreground">pontos</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* All deliveries */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Todas as Entregas do Dia
            </h4>
            <ScrollArea className="h-[180px]">
              <div className="space-y-2">
                {driverDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={`p-3 rounded-lg border ${
                      delivery.occurrences.length > 0
                        ? "bg-destructive/5 border-destructive/20"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">
                          {delivery.nfNumber}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {delivery.recipient}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {delivery.occurrences.length > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {delivery.occurrences.length} ocorrência
                            {delivery.occurrences.length > 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-success border-success"
                          >
                            OK
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {driverDeliveries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma entrega hoje</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
