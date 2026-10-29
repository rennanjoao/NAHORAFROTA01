/** Situacao do veiculo no mapa ao vivo: cor do marcador, contagem e legenda. */
import type { Tone } from "@/components/patterns";
import { STATUS_HEX } from "@/lib/brandSymbol";

export interface MapStatusCounts {
  onTime: number;
  atRisk: number;
  delayed: number;
  stale: number;
}

/** Posicao minima que o mapa precisa para classificar o veiculo. */
interface StatusSource {
  gpsStale?: boolean;
  current_delay?: number;
  individual_sla?: number;
}

export type VehicleMapStatus = "stale" | "delayed" | "atRisk" | "onTime";

/** Mesma regra para cor do marcador, contagem e legenda. */
export function vehicleStatus(position: StatusSource): VehicleMapStatus {
  if (position.gpsStale) return "stale";
  if (position.current_delay && position.current_delay > 0) return "delayed";
  if (position.individual_sla && position.individual_sla < 90) return "atRisk";
  return "onTime";
}

/** `plural`: legenda com contagem ("0 atrasados", "1 atrasado"). */
export const VEHICLE_STATUS: Record<VehicleMapStatus, { label: string; plural: string; tone: Tone; hex: string }> = {
  onTime: { label: "No prazo", plural: "No prazo", tone: "success", hex: STATUS_HEX.ok },
  atRisk: { label: "Em risco", plural: "Em risco", tone: "warning", hex: STATUS_HEX.alert },
  delayed: { label: "Atrasado", plural: "Atrasados", tone: "danger", hex: STATUS_HEX.late },
  stale: { label: "Sem sinal", plural: "Sem sinal", tone: "neutral", hex: STATUS_HEX.idle },
};

export function countByStatus(positions: StatusSource[]): MapStatusCounts {
  const counts: MapStatusCounts = { onTime: 0, atRisk: 0, delayed: 0, stale: 0 };
  positions.forEach((position) => {
    counts[vehicleStatus(position)] += 1;
  });
  return counts;
}
