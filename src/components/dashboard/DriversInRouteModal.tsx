/**
 * Motoristas com romaneio em andamento hoje.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, MessageCircle, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState, StatusBadge } from "@/components/patterns";
import { DriversInRouteData } from "@/hooks/useDashboardKPIs";
import { openWhatsApp } from "@/lib/whatsapp";
import { DetailSheet } from "./DetailPanel";
import { DriverAvatar } from "./DriverAvatar";
import { plateLabel, plural } from "./status";

interface DriversInRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DriversInRouteData[];
  /** Quantidade de NFs em transito nesses romaneios. */
  invoicesInTransitCount?: number;
  onShowInvoices?: () => void;
}

export function DriversInRouteModal({ open, onOpenChange, data, invoicesInTransitCount, onShowInvoices }: DriversInRouteModalProps) {
  const description = [
    `${plural(data.length, "motorista", "motoristas")} com romaneio em andamento`,
    typeof invoicesInTransitCount === "number" ? plural(invoicesInTransitCount, "nota em trânsito", "notas em trânsito") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Truck}
      tone="info"
      title="Motoristas em rota"
      description={description}
      bodyLabel="Motoristas em rota"
      summary={
        onShowInvoices && (
          <Button variant="outline" size="sm" className="w-fit" onClick={onShowInvoices}>
            <Package aria-hidden="true" />
            Ver notas em trânsito
          </Button>
        )
      }
    >
      {data.length === 0 ? (
        <EmptyState
          compact
          icon={Truck}
          title="Ninguém em rota agora"
          description="Quando um romaneio sair para entrega, o motorista aparece aqui."
        />
      ) : (
        <ul className="space-y-3">
          {data.map(({ driver, manifest, totalDeliveries, completedDeliveries, inProgress }) => {
            const progressPercent = totalDeliveries > 0 ? Math.round((completedDeliveries / totalDeliveries) * 100) : 0;

            return (
              <li key={manifest.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <DriverAvatar name={driver.name} photo={driver.photo_url || driver.avatar} size="lg" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="min-w-0 break-words text-[0.9375rem] font-semibold text-foreground">{driver.name}</h3>
                      <StatusBadge tone="info" pulse>
                        Em rota
                      </StatusBadge>
                    </div>

                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        {plateLabel(driver.vehicle_plate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Romaneio das {format(new Date(manifest.created_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </p>

                    {totalDeliveries > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {completedDeliveries} de {plural(totalDeliveries, "entrega", "entregas")}
                            {inProgress > 0 && ` · ${inProgress} em andamento`}
                          </span>
                          <span className="font-data font-medium text-foreground">{progressPercent}%</span>
                        </div>
                        <Progress
                          value={progressPercent}
                          className="h-1.5 [&>div]:bg-info"
                          aria-label={`Andamento de ${driver.name}: ${progressPercent}%`}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        GPS ligado, sem romaneio em andamento
                      </p>
                    )}

                    {driver.phone && (
                      <Button
                        size="sm"
                        variant="soft"
                        className="mt-3"
                        onClick={() => openWhatsApp(driver.phone.replace(/\D/g, ""))}
                      >
                        <MessageCircle aria-hidden="true" />
                        Chamar no WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DetailSheet>
  );
}
