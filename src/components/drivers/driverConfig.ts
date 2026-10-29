import type { Tone } from "@/components/patterns";
import type { VehicleType } from "@/contexts/LogisticsContext";

// Situacao do motorista (valores do banco): active = disponivel, in_route = em rota.
export const DRIVER_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Disponível", tone: "success" },
  in_route: { label: "Em rota", tone: "info" },
  inactive: { label: "Inativo", tone: "neutral" },
  pending_approval: { label: "Aguardando aprovação", tone: "warning" },
};

export function getDriverStatus(status: string | null | undefined) {
  return DRIVER_STATUS[status || ""] || DRIVER_STATUS.inactive;
}

/** Cor do SLA: verde a partir de 95%, amarelo a partir de 85%, vermelho abaixo. */
export function slaTone(sla: number): Tone {
  if (sla >= 95) return "success";
  if (sla >= 85) return "warning";
  return "danger";
}

export const DRIVER_VEHICLE_TYPES: VehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van", "Moto"];

export const CNH_CATEGORIES = ["a", "b", "c", "d", "e"];

export const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Conta poupança" },
  { value: "salario", label: "Conta salário" },
];

export type DriverDocumentKey = "cnh" | "addressProof" | "vehicleDoc" | "trailerDoc";

export const DRIVER_DOCUMENT_LABELS: Record<DriverDocumentKey, string> = {
  cnh: "CNH",
  addressProof: "Comprovante de endereço",
  vehicleDoc: "Documento do veículo (CRLV)",
  trailerDoc: "Documento da carreta",
};

export const DRIVER_DOCUMENT_KEYS = Object.keys(DRIVER_DOCUMENT_LABELS) as DriverDocumentKey[];

export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

/** Placa gravada quando o motorista ainda nao tem veiculo (CLT usa o da empresa). */
export const PENDING_PLATE = "PENDENTE";

/** Campos extras que a tela de motoristas junta ao Driver do contexto. */
export interface DriverExtras {
  _dbId?: string;
  tenant_id?: string | null;
  cnh?: string;
  cnh_category?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  chave_pix?: string;
  /** Login do app (e-mail interno), quando o acesso foi criado. */
  appLogin?: string | null;
}
