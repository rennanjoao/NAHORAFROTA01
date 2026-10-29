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
import { getOccurrenceLabel } from "@/hooks/useSLADB";
import type { DeliveryStatus } from "./types";

/**
 * Motivos de ocorrencia registrados pelo painel (lista unica para a tela toda:
 * menu da nota e detalhe do romaneio gravam os mesmos codigos).
 */
export const OCCURRENCE_TYPES = [
  { value: "cliente_ausente", label: "Cliente ausente" },
  { value: "endereco_nao_encontrado", label: "Endereço não encontrado" },
  { value: "recusa_recebimento", label: "Recusa de recebimento" },
  { value: "avaria_mercadoria", label: "Avaria na mercadoria" },
  { value: "falta_mercadoria", label: "Falta de mercadoria" },
  { value: "documentacao_incorreta", label: "Documentação incorreta" },
  { value: "area_risco", label: "Área de risco" },
  { value: "horario_restrito", label: "Horário restrito" },
  { value: "veiculo_quebrado", label: "Veículo quebrado" },
  { value: "outros", label: "Outros" },
];

/** Nome do motivo em frase simples ("Cliente ausente", nao "Cliente Ausente"). */
export function occurrenceLabel(type: string | null | undefined) {
  const known = OCCURRENCE_TYPES.find((option) => option.value === type);
  if (known) return known.label;
  const label = getOccurrenceLabel(type);
  return label.charAt(0) + label.slice(1).toLowerCase();
}

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
// Nomes dos tipos de veiculo moram em src/lib/vehicles (usados tambem pela busca).
export { VEHICLE_TYPE_LABELS, plateText, vehicleTypeLabel } from "@/lib/vehicles";


export const FREIGHT_TYPE_LABELS: Record<string, string> = {
  fixed: "Frete fixo (por entrega)",
  lumpsum: "Frete fechado (rota inteira)",
  per_km: "Frete por km",
};
