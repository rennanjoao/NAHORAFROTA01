/**
 * Modal showing today's freight costs (manifests)
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Truck, Package, User, Building2, UserCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardManifest, DashboardDriver } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";

interface ManifestWithDriver extends DashboardManifest {
  driver?: DashboardDriver | null;
}

interface FreightCostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ManifestWithDriver[];
  totalCost: number;
}

export function FreightCostModal({ open, onOpenChange, data, totalCost }: FreightCostModalProps) {
  const ownFleetCost = data
    .filter((m) => m.is_own_fleet)
    .reduce((sum, m) => sum + (m.freight_value || 0), 0);

  const thirdPartyCost = data
    .filter((m) => !m.is_own_fleet)
    .reduce((sum, m) => sum + (m.freight_value || 0), 0);

  const getFreightTypeLabel = (type: string) => {
    switch (type) {
      case "fixed":
        return "Fixo";
      case "lumpsum":
        return "Fechada";
      case "per_km":
        return "Por KM";
      default:
        return type;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-warning" />
            Custo de Frete do Dia
          </SheetTitle>
          <SheetDescription>
            {data.length} romaneio(s) • Total: {formatCurrency(totalCost)}
          </SheetDescription>
        </SheetHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-primary mb-1">
              <Building2 className="h-4 w-4" />
              Frota Própria
            </div>
            <span className="font-mono text-lg font-bold text-primary">
              {formatCurrency(ownFleetCost)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 text-sm text-warning mb-1">
              <UserCheck className="h-4 w-4" />
              Terceiros
            </div>
            <span className="font-mono text-lg font-bold text-warning">
              {formatCurrency(thirdPartyCost)}
            </span>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-220px)] mt-4 pr-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum romaneio criado hoje</p>
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
                            manifest.is_own_fleet
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-warning/10 text-warning border-warning/30"
                          )}
                        >
                          {manifest.is_own_fleet ? (
                            <>
                              <Building2 className="h-3 w-3 mr-1" />
                              CLT
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Terceiro
                            </>
                          )}
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
                        <Badge variant="secondary" className="text-xs">
                          {getFreightTypeLabel(manifest.freight_type)}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-base font-bold">
                        {formatCurrency(manifest.freight_value)}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(manifest.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
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
