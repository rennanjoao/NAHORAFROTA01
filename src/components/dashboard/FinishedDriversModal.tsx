/**
 * Motoristas que finalizaram a rota hoje. Toque em um para ver as notas.
 */

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/patterns";
import { FinishedDriverData } from "@/hooks/useDashboardKPIs";
import { DetailSheet } from "./DetailPanel";
import { DriverAvatar } from "./DriverAvatar";
import { FinishedRouteInvoices, RouteResultBadge } from "./FinishedRoutes";
import { plateLabel, plural } from "./status";

interface FinishedDriversModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinishedDriverData[];
}

export function FinishedDriversModal({ open, onOpenChange, data }: FinishedDriversModalProps) {
  const [selectedDriver, setSelectedDriver] = useState<FinishedDriverData | null>(null);
  // Foco: entra no "Voltar" ao abrir um motorista e volta para a linha dele ao voltar
  // (antes caia no corpo da janela).
  const backRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastId.current = null;
      return;
    }
    if (selectedDriver) backRef.current?.focus();
    else if (lastId.current) listRef.current?.querySelector<HTMLElement>(`[data-row="${lastId.current}"]`)?.focus();
  }, [open, selectedDriver]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedDriver(null);
    onOpenChange(next);
  };

  // Detalhe: notas do motorista escolhido
  if (selectedDriver) {
    const { driver, manifest, totalDeliveries, completedDeliveries, occurrences } = selectedDriver;

    return (
      <DetailSheet
        open={open}
        onOpenChange={handleOpenChange}
        leading={
          <Button ref={backRef} variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => setSelectedDriver(null)}>
            <ArrowLeft aria-hidden="true" />
            Voltar para a lista
          </Button>
        }
        title={driver.name}
        description={`Romaneio ${manifest.manifest_code} · ${completedDeliveries} de ${plural(totalDeliveries, "entrega", "entregas")}`}
        summary={<RouteResultBadge occurrences={occurrences} />}
        bodyLabel={`Notas de ${driver.name}`}
      >
        <FinishedRouteInvoices route={selectedDriver} />
      </DetailSheet>
    );
  }

  // Lista: todos que finalizaram
  return (
    <DetailSheet
      open={open}
      onOpenChange={handleOpenChange}
      icon={CheckCircle2}
      tone="success"
      title="Rotas finalizadas hoje"
      description={`${plural(data.length, "motorista concluiu", "motoristas concluíram")} o romaneio hoje`}
      bodyLabel="Rotas finalizadas"
    >
      {data.length === 0 ? (
        <EmptyState
          compact
          icon={CheckCircle2}
          title="Nenhuma rota finalizada hoje"
          description="Quando um motorista concluir o romaneio, ele aparece aqui."
        />
      ) : (
        <ul ref={listRef} className="divide-y overflow-hidden rounded-lg border bg-card">
          {data.map((item) => {
            const { driver, manifest, finishedAt, totalDeliveries, completedDeliveries, occurrences } = item;
            return (
              <li key={manifest.id}>
                <button
                  type="button"
                  data-row={manifest.id}
                  onClick={() => {
                    lastId.current = manifest.id;
                    setSelectedDriver(item);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <DriverAvatar name={driver.name} photo={driver.photo_url || driver.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 break-words font-medium text-foreground">{driver.name}</span>
                      <RouteResultBadge occurrences={occurrences} />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" aria-hidden="true" />
                        {completedDeliveries} de {totalDeliveries}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {format(new Date(finishedAt), "HH:mm", { locale: ptBR })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Truck className="h-3 w-3" aria-hidden="true" />
                        {plateLabel(driver.vehicle_plate)}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DetailSheet>
  );
}
