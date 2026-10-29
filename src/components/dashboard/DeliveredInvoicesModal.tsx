import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, MapPin, Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { DashboardInvoice } from "@/hooks/useDashboardKPIs";

interface DeliveredInvoicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardInvoice[];
}

export function DeliveredInvoicesModal({ open, onOpenChange, data }: DeliveredInvoicesModalProps) {
  const totalValue = data.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Entregas Realizadas Hoje
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {data.length} NFs entregues
            </span>
            <span className="font-mono font-medium text-foreground">
              Total: {formatCurrency(totalValue)}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {data.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhuma entrega realizada hoje
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {data.map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-foreground">
                          NF {invoice.nfe_number || invoice.id.slice(0, 8)}
                        </span>
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Entregue
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground font-medium">
                        {invoice.recipient_name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{invoice.address_full}</span>
                      </p>
                      {invoice.delivered_at && (
                        <p className="text-xs text-muted-foreground">
                          Entregue às {new Date(invoice.delivered_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-foreground whitespace-nowrap self-start sm:self-auto">
                      {formatCurrency(invoice.total_value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
