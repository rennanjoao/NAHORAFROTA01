/**
 * Modal showing drivers who finished their routes today
 * Replaces the old RecentDeliveries component
 */

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Package, 
  ChevronRight, 
  Phone,
  Truck,
  ArrowLeft
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { FinishedDriverData, DashboardInvoice } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";

interface FinishedDriversModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinishedDriverData[];
}

export function FinishedDriversModal({ open, onOpenChange, data }: FinishedDriversModalProps) {
  const [selectedDriver, setSelectedDriver] = useState<FinishedDriverData | null>(null);

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${cleanPhone}`, "_blank");
  };

  const handleClose = () => {
    setSelectedDriver(null);
    onOpenChange(false);
  };

  const getStatusConfig = (invoice: DashboardInvoice) => {
    switch (invoice.status) {
      case "delivered":
        return { 
          label: "Entregue", 
          icon: CheckCircle2, 
          className: "bg-green-500/10 text-green-600 border-green-500/30" 
        };
      case "occurrence":
        return { 
          label: invoice.occurrence_type || "Ocorrência", 
          icon: AlertCircle, 
          className: "bg-orange-500/10 text-orange-600 border-orange-500/30" 
        };
      case "returned":
        return { 
          label: "Devolvida", 
          icon: AlertCircle, 
          className: "bg-red-500/10 text-red-600 border-red-500/30" 
        };
      default:
        return { 
          label: invoice.status, 
          icon: Package, 
          className: "bg-muted text-muted-foreground" 
        };
    }
  };

  // Detail View - Show invoices for selected driver
  if (selectedDriver) {
    const { driver, manifest, invoices, finishedAt, totalDeliveries, completedDeliveries, occurrences } = selectedDriver;

    // Separate invoices by status
    const deliveredInvoices = invoices.filter((inv) => inv.status === "delivered");
    const occurrenceInvoices = invoices.filter((inv) => inv.status === "occurrence" || inv.status === "returned");

    const renderInvoiceCard = (invoice: DashboardInvoice) => {
      const statusConfig = getStatusConfig(invoice);
      const StatusIcon = statusConfig.icon;

      return (
        <div
          key={invoice.id}
          className="p-3 rounded-lg border border-border bg-card"
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
              <p className="text-sm text-muted-foreground truncate mt-1">
                {invoice.recipient_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {invoice.address_full}
              </p>
            </div>
            <span className="font-mono text-sm font-medium whitespace-nowrap">
              {formatCurrency(invoice.total_value)}
            </span>
          </div>
        </div>
      );
    };

    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 mb-2"
              onClick={() => setSelectedDriver(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <SheetTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={driver.photo_url || driver.avatar} />
                <AvatarFallback>
                  {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="block">{driver.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {manifest.manifest_code}
                </span>
              </div>
            </SheetTitle>
            <SheetDescription>
              {completedDeliveries} de {totalDeliveries} entregues • 
              {occurrences > 0 ? ` ${occurrences} ocorrência(s)` : " Sem ocorrências"}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
            <div className="space-y-4">
              {/* Delivered Section */}
              {deliveredInvoices.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Entregas Realizadas ({deliveredInvoices.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {deliveredInvoices.map(renderInvoiceCard)}
                  </div>
                </div>
              )}

              {/* Occurrences Section */}
              {occurrenceInvoices.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Ocorrências / Devoluções ({occurrenceInvoices.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {occurrenceInvoices.map(renderInvoiceCard)}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {deliveredInvoices.length === 0 && occurrenceInvoices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma NF neste romaneio</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  // List View - Show all finished drivers
  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Motoristas que Finalizaram
          </SheetTitle>
          <SheetDescription>
            {data.length} motorista(s) finalizaram suas rotas hoje
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma rota finalizada hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((item) => {
                const { driver, manifest, finishedAt, totalDeliveries, completedDeliveries, occurrences } = item;
                const hasOccurrences = occurrences > 0;

                return (
                  <div
                    key={manifest.id}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedDriver(item)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={driver.photo_url || driver.avatar} />
                        <AvatarFallback>
                          {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground truncate">
                            {driver.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              hasOccurrences
                                ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                                : "bg-green-500/10 text-green-600 border-green-500/30"
                            )}
                          >
                            {hasOccurrences ? (
                              <>
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {occurrences} Oc.
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {completedDeliveries}/{totalDeliveries}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(finishedAt), "HH:mm", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {driver.vehicle_plate}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
