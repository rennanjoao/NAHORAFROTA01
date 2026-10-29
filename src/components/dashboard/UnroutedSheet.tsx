import { useMemo, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileWarning, FileText, MapPin, Clock, Package, RotateCcw, AlertCircle } from "lucide-react";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface UnroutedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnroutedSheet({ open, onOpenChange }: UnroutedSheetProps) {
  const { invoices, isLoading, refetch } = useInvoicesDB();
  const navigate = useNavigate();

  // Refetch when sheet opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  // Get invoices that are pending or returned, and NOT in a manifest
  const unroutedInvoices = useMemo(() => {
    return invoices.filter(inv => 
      (inv.status === 'pending' || inv.status === 'returned') && 
      inv.manifest_id === null
    );
  }, [invoices]);

  const pendingCount = unroutedInvoices.filter(inv => inv.status === 'pending').length;
  const returnedCount = unroutedInvoices.filter(inv => inv.status === 'returned').length;

  const handleNavigateToDeliveries = () => {
    onOpenChange(false);
    navigate('/deliveries?filter=unrouted');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-warning" />
            Entregas Não Roterizadas
            <Badge variant="outline" className="ml-2 bg-warning/10 text-warning border-warning/30">
              {unroutedInvoices.length}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-sm text-warning font-medium">
            Notas pendentes de roteiro ({pendingCount} novas + {returnedCount} devoluções)
          </p>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 mb-4">
          <Badge variant="outline" className="bg-muted">
            <Package className="h-3 w-3 mr-1" />
            {pendingCount} Pendentes
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <RotateCcw className="h-3 w-3 mr-1" />
            {returnedCount} Devolvidas
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3 pr-4">
            {unroutedInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className={`p-4 rounded-lg border transition-colors ${
                  invoice.status === 'returned' 
                    ? 'border-destructive/20 bg-destructive/5 hover:bg-destructive/10' 
                    : 'border-warning/20 bg-warning/5 hover:bg-warning/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${
                    invoice.status === 'returned' 
                      ? 'bg-destructive/10' 
                      : 'bg-warning/10'
                  }`}>
                    {invoice.status === 'returned' ? (
                      <RotateCcw className="h-5 w-5 text-destructive" />
                    ) : (
                      <FileText className="h-5 w-5 text-warning" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{invoice.nfe_number || 'S/N'}</h4>
                      {invoice.total_weight && (
                        <Badge variant="outline" className="text-xs">
                          {invoice.total_weight}kg
                        </Badge>
                      )}
                      {invoice.status === 'returned' && (
                        <Badge variant="destructive" className="text-xs">
                          Devolução
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-foreground truncate">{invoice.recipient_name}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {invoice.address_city}/{invoice.address_state}
                        {invoice.regiao_logistica && ` - ${invoice.regiao_logistica}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>
                        {invoice.status === 'returned' ? 'Devolvido em' : 'Importado em'}{' '}
                        {new Date(invoice.updated_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {invoice.occurrence_type && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span>Ocorrência: {invoice.occurrence_type}</span>
                      </div>
                    )}

                    <div className="mt-2 text-sm font-medium text-foreground">
                      Valor: {formatCurrency(invoice.total_value)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {unroutedInvoices.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileWarning className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Todas as notas estão roterizadas!</p>
              </div>
            )}
          </div>
        </ScrollArea>
        )}

        {unroutedInvoices.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button className="w-full" variant="default" onClick={handleNavigateToDeliveries}>
              Ir para Entregas
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
