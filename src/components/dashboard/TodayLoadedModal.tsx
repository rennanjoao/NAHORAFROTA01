/**
 * Modal showing all invoices loaded today (assigned to manifests)
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, MapPin, Clock, CheckCircle2, Truck, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardInvoice } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";

interface TodayLoadedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardInvoice[];
}

export function TodayLoadedModal({ open, onOpenChange, data }: TodayLoadedModalProps) {
  const totalValue = data.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "in_transit":
        return { label: "Em Rota", icon: Truck, className: "bg-info/10 text-info border-info/30" };
      case "delivered":
        return { label: "Entregue", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" };
      case "occurrence":
        return { label: "Ocorrência", icon: AlertCircle, className: "bg-warning/10 text-warning border-warning/30" };
      case "returned":
        return { label: "Devolvida", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/30" };
      default:
        return { label: status, icon: Package, className: "bg-muted text-muted-foreground" };
    }
  };

  // Group by status for summary
  const statusCounts = data.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Notas Carregadas Hoje
          </SheetTitle>
          <SheetDescription>
            {data.length} NF(s) romaneadas hoje • Total: {formatCurrency(totalValue)}
          </SheetDescription>
        </SheetHeader>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config = getStatusConfig(status);
            const Icon = config.icon;
            return (
              <Badge key={status} variant="outline" className={cn("text-xs", config.className)}>
                <Icon className="h-3 w-3 mr-1" />
                {count} {config.label}
              </Badge>
            );
          })}
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma NF carregada hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((invoice) => {
                const statusConfig = getStatusConfig(invoice.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={invoice.id}
                    className="p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            NF {invoice.nfe_number || invoice.id.slice(0, 8)}
                          </span>
                          <Badge variant="outline" className={cn("text-xs", statusConfig.className)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground mt-1 truncate">
                          {invoice.recipient_name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {invoice.address_full}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-semibold">
                          {formatCurrency(invoice.total_value)}
                        </span>
                        {invoice.total_weight && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {invoice.total_weight.toFixed(2).replace(".", ",")} kg
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
