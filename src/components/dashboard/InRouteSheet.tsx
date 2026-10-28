import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, FileText, User, MapPin } from "lucide-react";
import { useLogistics } from "@/contexts/LogisticsContext";

interface InRouteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InRouteSheet({ open, onOpenChange }: InRouteSheetProps) {
  const { deliveries, drivers } = useLogistics();

  // Get deliveries that are in transit
  const inTransitDeliveries = useMemo(() => {
    return deliveries.filter(d => d.status === "in_transit");
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
            <Truck className="h-5 w-5 text-primary" />
            Em Rota
            <Badge className="ml-2">{inTransitDeliveries.length}</Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-3 pr-4">
            {inTransitDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{delivery.nfNumber}</h4>
                      <Badge variant="outline" className="text-xs">
                        {delivery.weight}kg
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium text-foreground truncate">{delivery.recipient}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{delivery.address}, {delivery.city}/{delivery.state}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 p-2 rounded bg-muted/50">
                      <Truck className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        <span className="text-muted-foreground">Motorista:</span>{" "}
                        <span className="font-medium text-foreground">{getDriverName(delivery.driverId)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {inTransitDeliveries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma nota em rota no momento</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
