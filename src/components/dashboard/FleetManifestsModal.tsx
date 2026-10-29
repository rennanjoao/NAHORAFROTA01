/**
 * Modal showing fleet manifests (own fleet or third-party)
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, UserCheck, Truck, Package, User, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardManifest } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";

interface FleetManifestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardManifest[];
  type: "own" | "third_party";
}

export function FleetManifestsModal({ open, onOpenChange, data, type }: FleetManifestsModalProps) {
  const isOwnFleet = type === "own";
  const totalFreight = data.reduce((sum, m) => sum + (m.freight_value || 0), 0);
  const totalDeliveries = data.reduce((sum, m) => sum + (m.deliveries_count || 0), 0);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em Andamento";
      case "completed":
        return "Concluído";
      case "paid":
        return "Pago";
      default:
        return status;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isOwnFleet ? (
              <>
                <Building2 className="h-5 w-5 text-primary" />
                Frota Própria Hoje
              </>
            ) : (
              <>
                <UserCheck className="h-5 w-5 text-warning" />
                Terceiros/Agregados Hoje
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {data.length} romaneio(s) • {totalDeliveries} NF(s) 
            {!isOwnFleet && ` • Frete: ${formatCurrency(totalFreight)}`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {isOwnFleet ? (
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              ) : (
                <UserCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              )}
              <p className="text-muted-foreground">
                Nenhum romaneio de {isOwnFleet ? "frota própria" : "terceiros"} hoje
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((manifest) => (
                <div
                  key={manifest.id}
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {manifest.manifest_code}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            manifest.status === "completed" || manifest.status === "paid"
                              ? "bg-green-500/10 text-green-600 border-green-500/30"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                          )}
                        >
                          {getStatusLabel(manifest.status)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 mt-2 text-sm text-foreground">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {manifest.driver_name}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {manifest.vehicle_plate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {manifest.deliveries_count} NF(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(manifest.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    {!isOwnFleet && (
                      <div className="text-right">
                        <span className="font-mono text-base font-bold text-warning">
                          {formatCurrency(manifest.freight_value)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
