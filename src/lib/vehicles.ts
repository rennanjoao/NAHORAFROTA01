/** Nome do tipo de veiculo em linguagem simples ("van" -> "Van/VUC"). */
export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  truck: "Caminhão",
  van: "Van/VUC",
  moto: "Moto",
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  carreta: "Carreta",
};

/** Placa gravada quando o motorista ainda nao tem veiculo (CLT usa o da empresa). */
export const PENDING_PLATE = "PENDENTE";

/** Placa para mostrar; o marcador "PENDENTE" (cadastro sem placa) e vazio viram null. */
export function plateText(plate?: string | null): string | null {
  return !plate || plate.trim().toUpperCase() === PENDING_PLATE ? null : plate;
}

export function vehicleTypeLabel(type?: string | null) {
  if (!type) return "Veículo";
  return VEHICLE_TYPE_LABELS[type.toLowerCase()] || type;
}
