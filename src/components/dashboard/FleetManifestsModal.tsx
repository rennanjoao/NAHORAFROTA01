/**
 * Romaneios de hoje da frota propria ou de terceiros (agregados).
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Clock, Package, Truck, UserCheck } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/patterns";
import { DashboardManifest } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { DetailSheet } from "./DetailPanel";
import { manifestStatus, plural } from "./status";

interface FleetManifestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardManifest[];
  type: "own" | "third_party";
}

export function FleetManifestsModal({ open, onOpenChange, data, type }: FleetManifestsModalProps) {
  const isOwnFleet = type === "own";
  const totalFreight = data.reduce((sum, m) => sum + (m.freight_value || 0), 0);
  const totalDeliveries = data.reduce((sum, m) => sum + (m.deliveries_count || 0), 0);
  const Icon = isOwnFleet ? Building2 : UserCheck;

  const description = [
    plural(data.length, "romaneio", "romaneios"),
    plural(totalDeliveries, "nota", "notas"),
    !isOwnFleet ? `Frete ${formatCurrency(totalFreight)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Icon}
      tone="neutral"
      title={isOwnFleet ? "Frota própria hoje" : "Terceiros e agregados hoje"}
      description={description}
      bodyLabel="Romaneios"
    >
      {data.length === 0 ? (
        <EmptyState
          compact
          icon={Icon}
          title={`Nenhum romaneio de ${isOwnFleet ? "frota própria" : "terceiros"} hoje`}
          description="Os romaneios criados hoje aparecem aqui."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {data.map((manifest) => {
            const status = manifestStatus(manifest.status);
            return (
              <li key={manifest.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-data text-sm font-semibold text-foreground">{manifest.manifest_code}</span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                  <p className="truncate text-sm text-foreground">{manifest.driver_name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" aria-hidden="true" />
                      {manifest.vehicle_plate || "Sem placa"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3 w-3" aria-hidden="true" />
                      {plural(manifest.deliveries_count, "nota", "notas")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {format(new Date(manifest.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                  </p>
                </div>
                {!isOwnFleet && (
                  <span className="shrink-0 whitespace-nowrap font-data text-sm font-semibold text-foreground">
                    {formatCurrency(manifest.freight_value)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DetailSheet>
  );
}
