/**
 * Modal showing invoices currently in transit (accumulated from all days)
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, Package, MapPin, Clock } from "lucide-react";
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

interface InvoicesInTransitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardInvoice[];
}

export function InvoicesInTransitModal({ open, onOpenChange, data }: InvoicesInTransitModalProps) {
  const totalValue = data.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            Em Rota
          </SheetTitle>
          <SheetDescription>
            {data.length} NF(s) em trânsito • Total: {formatCurrency(totalValue)}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma NF em trânsito</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pr-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          NF {invoice.nfe_number || invoice.id.slice(0, 8)}
                        </span>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                          <Truck className="h-3 w-3 mr-1" />
                          Em Rota
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1 truncate">
                        {invoice.recipient_name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {invoice.address_full}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        Importada em {format(new Date(invoice.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="min-w-[92px] text-right">
                      <span className="block whitespace-nowrap font-mono text-sm font-semibold">
                        {formatCurrency(invoice.total_value)}
                      </span>
                      {invoice.total_weight && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {invoice.total_weight.toFixed(2)} kg
                        </p>
                      )}
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
