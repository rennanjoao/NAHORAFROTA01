/**
 * Modal showing drivers currently on route (today's active manifests)
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, Package, MapPin, Phone, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DriversInRouteData } from "@/hooks/useDashboardKPIs";
import { cn } from "@/lib/utils";
import { openWhatsApp } from "@/lib/whatsapp";

interface DriversInRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DriversInRouteData[];
  /** Quantidade de NFs em transito nesses romaneios. */
  invoicesInTransitCount?: number;
  onShowInvoices?: () => void;
}

export function DriversInRouteModal({ open, onOpenChange, data, invoicesInTransitCount, onShowInvoices }: DriversInRouteModalProps) {
  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    openWhatsApp(cleanPhone);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Motoristas em Rota
          </SheetTitle>
          <SheetDescription>
            {data.length} motorista(s) com romaneio em andamento
            {typeof invoicesInTransitCount === "number" ? ` • ${invoicesInTransitCount} NF(s) em trânsito` : ""}
          </SheetDescription>
          {onShowInvoices && (
            <Button variant="outline" size="sm" className="w-fit gap-2" onClick={onShowInvoices}>
              <Package className="h-4 w-4" />
              Ver NFs em trânsito
            </Button>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum motorista em rota no momento</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.map(({ driver, manifest, totalDeliveries, completedDeliveries, inProgress }) => {
                const progressPercent = totalDeliveries > 0 
                  ? Math.round((completedDeliveries / totalDeliveries) * 100) 
                  : 0;

                return (
                  <div
                    key={manifest.id}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={driver.photo_url || driver.avatar} />
                        <AvatarFallback>
                          {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-foreground truncate">
                            {driver.name}
                          </h4>
                          <Badge variant="outline" className="bg-info/10 text-info border-info/30">
                            Em Rota
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {driver.vehicle_plate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(manifest.created_at), "HH:mm", { locale: ptBR })}
                          </span>
                        </div>

                        {totalDeliveries > 0 ? (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{completedDeliveries} de {totalDeliveries} entregas</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            GPS ativo, sem romaneio em andamento
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3">
                          {totalDeliveries > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {inProgress} em andamento
                            </Badge>
                          )}
                          {driver.phone && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 bg-success/10 text-success hover:bg-success/20"
                              onClick={() => handleWhatsApp(driver.phone)}
                            >
                              <Phone className="h-3 w-3 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                        </div>
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
