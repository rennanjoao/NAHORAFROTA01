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

export function vehicleTypeLabel(type?: string | null) {
  if (!type) return "Veículo";
  return VEHICLE_TYPE_LABELS[type.toLowerCase()] || type;
}
