import type { ReactNode } from "react";
import { AlertTriangle, Maximize2, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { VEHICLE_STATUS, type MapStatusCounts, type VehicleMapStatus } from "./mapStatus";
import { plural } from "./status";

interface LiveMapFrameProps {
  vehicleCount: number;
  counts?: MapStatusCounts;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onFitAll?: () => void;
  /** Conteudo do mapa. */
  children?: ReactNode;
  state?: "ready" | "loading" | "error";
  error?: string;
  onRetry?: () => void;
}

const ORDER: VehicleMapStatus[] = ["onTime", "atRisk", "delayed", "stale"];

/**
 * Moldura do mapa ao vivo (Mapbox ou OpenStreetMap): barra com a contagem por
 * situacao (que tambem e a legenda das cores) e os botoes do mapa.
 */
export function LiveMapFrame({ vehicleCount, counts, onRefresh, isRefreshing, onFitAll, children, state = "ready", error, onRetry }: LiveMapFrameProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {state === "loading" ? "Carregando o mapa…" : plural(vehicleCount, "veículo com GPS ligado", "veículos com GPS ligado")}
          </p>
          {counts && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Situação dos veículos (cor no mapa)">
              {ORDER.map((key) => (
                <li key={key}>
                  <StatusBadge tone={VEHICLE_STATUS[key].tone}>
                    {counts[key]} {VEHICLE_STATUS[key].label.toLowerCase()}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {state === "ready" && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {onFitAll && (
              <Button variant="outline" size="sm" onClick={onFitAll} disabled={vehicleCount === 0}>
                <Maximize2 aria-hidden="true" />
                Mostrar todos
              </Button>
            )}
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                <RefreshCw className={cn(isRefreshing && "animate-spin")} aria-hidden="true" />
                {isRefreshing ? "Atualizando…" : "Atualizar"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="relative h-[24rem] sm:h-[32rem]">
        {state === "loading" && <div className="skeleton-shimmer absolute inset-0" aria-hidden="true" />}
        {state === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <p className="font-heading font-semibold text-foreground">Não foi possível carregar o mapa</p>
            {error && <p className="max-w-sm text-sm text-muted-foreground">{error}</p>}
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw aria-hidden="true" />
                Tentar de novo
              </Button>
            )}
          </div>
        )}
        {state === "ready" && children}
        {state === "ready" && vehicleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center p-6">
            <div className="max-w-xs rounded-lg border bg-popover/95 p-5 text-center shadow-lg backdrop-blur">
              <span aria-hidden="true" className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Truck className="h-5 w-5" />
              </span>
              <p className="font-heading text-sm font-semibold text-foreground">Nenhum veículo com GPS ligado</p>
              <p className="mt-1 text-sm text-muted-foreground">O motorista aparece aqui quando abre o aplicativo e inicia a rota.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
