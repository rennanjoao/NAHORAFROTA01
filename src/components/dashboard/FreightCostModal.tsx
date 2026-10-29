/**
 * Custo de frete dos romaneios de hoje.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Package, Truck, UserCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/patterns";
import { DashboardManifest, DashboardDriver } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { DetailSheet } from "./DetailPanel";
import { plural } from "./status";

interface ManifestWithDriver extends DashboardManifest {
  driver?: DashboardDriver | null;
}

interface FreightCostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ManifestWithDriver[];
  totalCost: number;
}

const FREIGHT_TYPE_LABEL: Record<string, string> = {
  fixed: "Valor fixo",
  lumpsum: "Frete fechado",
  per_km: "Por km",
};

export function FreightCostModal({ open, onOpenChange, data, totalCost }: FreightCostModalProps) {
  const ownFleetCost = data.filter((m) => m.is_own_fleet).reduce((sum, m) => sum + (m.freight_value || 0), 0);
  const thirdPartyCost = data.filter((m) => !m.is_own_fleet).reduce((sum, m) => sum + (m.freight_value || 0), 0);

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Wallet}
      title="Custo de frete de hoje"
      description={`${plural(data.length, "romaneio", "romaneios")} · ${formatCurrency(totalCost)} no total`}
      bodyLabel="Romaneios e frete"
      summary={
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              Frota própria
            </dt>
            <dd className="mt-1 font-data text-lg font-semibold text-foreground">{formatCurrency(ownFleetCost)}</dd>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Terceiros
            </dt>
            <dd className="mt-1 font-data text-lg font-semibold text-foreground">{formatCurrency(thirdPartyCost)}</dd>
          </div>
        </dl>
      }
    >
      {data.length === 0 ? (
        <EmptyState compact icon={Wallet} title="Nenhum romaneio criado hoje" description="O frete de cada romaneio aparece aqui." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {data.map((manifest) => (
            <li key={manifest.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-data text-sm font-semibold text-foreground">{manifest.manifest_code}</span>
                  <Badge variant="secondary">{manifest.is_own_fleet ? "Frota própria" : "Terceiro"}</Badge>
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
                  <span>{FREIGHT_TYPE_LABEL[manifest.freight_type] ?? manifest.freight_type}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="whitespace-nowrap font-data text-sm font-semibold text-foreground">{formatCurrency(manifest.freight_value)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{format(new Date(manifest.created_at), "HH:mm", { locale: ptBR })}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DetailSheet>
  );
}
