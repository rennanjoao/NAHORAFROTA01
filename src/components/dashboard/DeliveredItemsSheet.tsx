import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, FileText, User, Clock, Truck } from "lucide-react";
import { useLogistics } from "@/contexts/LogisticsContext";

interface DeliveredItemsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveredItemsSheet({ open, onOpenChange }: DeliveredItemsSheetProps) {
  const { deliveries, drivers } = useLogistics();

  // Get deliveries that were delivered
  const deliveredItems = useMemo(() => {
    return deliveries.filter(d => d.status === "delivered");
  }, [deliveries]);

  // Get driver name by ID
  const getDriverName = (driverId?: number) => {
    if (!driverId) return "Não atribuído";
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || "Motorista não encontrado";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Entregas Realizadas
            <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/30">
              {deliveredItems.length}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-3 pr-4">
            {deliveredItems.map((delivery) => (
              <div
                key={delivery.id}
                className="p-4 rounded-lg border border-success/20 bg-success/5 hover:bg-success/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-success/10 p-2">
                    <FileText className="h-5 w-5 text-success" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* NF Number */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{delivery.nfNumber}</h4>
                      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                        Entregue
                      </Badge>
                    </div>
                    
                    {/* Destinatário */}
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Para:</span>
                      <span className="font-medium text-foreground truncate">{delivery.recipient}</span>
                    </div>

                    {/* Motorista */}
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Motorista:</span>
                      <span className="font-medium text-foreground">{getDriverName(delivery.driverId)}</span>
                    </div>

                    {/* Horário */}
                    {delivery.deliveredAt && (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">Horário:</span>
                        <span className="font-medium text-success">
                          {delivery.deliveredAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {deliveredItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma entrega realizada ainda</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
