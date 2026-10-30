/** Situacao do veiculo no mapa ao vivo: cor do marcador, contagem e legenda. */
import type { Tone } from "@/components/patterns";
import { STATUS_HEX } from "@/lib/brandSymbol";

export interface MapStatusCounts {
  inRoute: number;
  occurrence: number;
  stale: number;
}

/** Posicao minima que o mapa precisa para classificar o veiculo. */
interface StatusSource {
  gpsStale?: boolean;
  /** A ultima atualizacao do motorista foi uma ocorrencia. */
  hasOccurrence?: boolean;
}

export type VehicleMapStatus = "inRoute" | "occurrence" | "stale";

/** Mesma regra para cor do marcador, contagem e legenda. */
export function vehicleStatus(position: StatusSource): VehicleMapStatus {
  if (position.gpsStale) return "stale";
  if (position.hasOccurrence) return "occurrence";
  return "inRoute";
}

export const VEHICLE_STATUS: Record<VehicleMapStatus, { label: string; tone: Tone; hex: string }> = {
  inRoute: { label: "Em rota", tone: "info", hex: STATUS_HEX.info },
  occurrence: { label: "Com ocorrência", tone: "danger", hex: STATUS_HEX.late },
  stale: { label: "Sem sinal", tone: "neutral", hex: STATUS_HEX.idle },
};

export function countByStatus(positions: StatusSource[]): MapStatusCounts {
  const counts: MapStatusCounts = { inRoute: 0, occurrence: 0, stale: 0 };
  positions.forEach((position) => {
    counts[vehicleStatus(position)] += 1;
  });
  return counts;
}
