import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, type Tone } from "@/components/patterns";
import type { DeliveryStatus } from "./types";

interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

/**
 * Significado fixo das cores de status de nota (manual da marca):
 * cinza = pendente, azul = em rota, verde = entregue,
 * vermelho = atraso/ocorrencia, amarelo = voltando/devolvida (pede atencao).
 */
export const DELIVERY_STATUS: Record<DeliveryStatus, StatusMeta> = {
  pending: { label: "Pendente", tone: "neutral", icon: Clock },
  in_transit: { label: "Em rota", tone: "info", icon: Truck },
  delivered: { label: "Entregue", tone: "success", icon: CheckCircle2 },
  delayed: { label: "Atrasada", tone: "danger", icon: AlertTriangle },
  occurrence: { label: "Ocorrência", tone: "danger", icon: AlertTriangle },
  returning: { label: "Voltando ao galpão", tone: "warning", icon: RotateCcw },
  returned: { label: "Devolvida", tone: "warning", icon: Warehouse },
};

export function getDeliveryStatus(status: string): StatusMeta {
  return DELIVERY_STATUS[status as DeliveryStatus] ?? { label: status, tone: "neutral", icon: Clock };
}

interface BadgeProps {
  status: string;
  /** Ponto pulsando (so no detalhe aberto, nunca em listas). */
  live?: boolean;
  className?: string;
}

export function DeliveryStatusBadge({ status, live, className }: BadgeProps) {
  const meta = getDeliveryStatus(status);
  return (
    <StatusBadge tone={meta.tone} pulse={live && status === "in_transit"} className={className}>
      {meta.label}
    </StatusBadge>
  );
}

/** Status do romaneio. */
export const MANIFEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Aguardando saída", tone: "neutral" },
  in_progress: { label: "Em rota", tone: "info" },
  completed: { label: "Concluído", tone: "success" },
  paid: { label: "Pago", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

export function ManifestStatusBadge({ status, live, className }: BadgeProps) {
  const meta = MANIFEST_STATUS[status] ?? MANIFEST_STATUS.pending;
  return (
    <StatusBadge tone={meta.tone} pulse={live && status === "in_progress"} className={className}>
      {meta.label}
    </StatusBadge>
  );
}

/** Nomes do tipo de veiculo e de frete em portugues simples. */
export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  truck: "Caminhão",
  van: "Van/VUC",
  moto: "Moto",
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  carreta: "Carreta",
};

export function vehicleTypeLabel(type?: string | null) {
  if (!type) return "Veículo";
  return VEHICLE_TYPE_LABELS[type.toLowerCase()] || type;
}

export const FREIGHT_TYPE_LABELS: Record<string, string> = {
  fixed: "Frete fixo (por entrega)",
  lumpsum: "Frete fechado (rota inteira)",
  per_km: "Frete por km",
};
