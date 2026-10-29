import type { Tone } from "@/components/patterns";
import { PLATE_REGEX } from "@/components/vehicles/vehicleConfig";
import type { VehicleType } from "@/contexts/LogisticsContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDocument, onlyDigits } from "@/lib/documentValidation";

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

/* Telefone e placa: mesma regra da importacao por planilha (src/lib/driverImport.ts). */

/** So os digitos do telefone com DDD (tira o 55 do pais, se vier). */
function phoneDigits(value: string): string {
  const digits = onlyDigits(value);
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

/** DDD + numero: 10 digitos (fixo) ou 11 (celular). */
export const isValidPhone = (value: string) => [10, 11].includes(phoneDigits(value).length);

/** Telefone no formato (11) 98888-7777 ou (11) 3888-7777. */
export function formatPhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return value.trim();
}

/** Placa so com letras e numeros, em maiusculas ("abc-1d23" vira "ABC1D23"). */
export const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). */
export const isValidPlate = (value: string) => PLATE_REGEX.test(normalizePlate(value));

export const OFFLINE_MESSAGE = "Sem conexão com a internet. Confira a conexão e tente de novo.";

/**
 * Erro em linguagem simples para a tela. Sem internet, sem permissao ou mensagem
 * tecnica do banco (em ingles) viram frases curtas; mensagens ja em portugues
 * (ex.: "Limite de 5 motoristas atingido...") passam como estao.
 */
export function plainError(error: unknown, fallback = "Tente de novo em instantes."): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return OFFLINE_MESSAGE;
  const message =
    typeof error === "string" ? error : error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "");
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) return OFFLINE_MESSAGE;
  if (/row-level security|permission denied|not authorized|jwt|policy/i.test(message)) {
    return "Você não tem permissão para esta tarefa. Fale com o administrador.";
  }
  if (!message || /violates|constraint|null value|column|relation|syntax|invalid input|duplicate key|json|schema|function|non-2xx|edge function/i.test(message)) {
    return fallback;
  }
  return message;
}

export const PHONE_ERROR = "Telefone inválido. Informe DDD e número, como (11) 99999-0000.";
export const PLATE_ERROR = "Placa inválida. Use ABC1234 ou ABC1D23.";

/**
 * O banco nao impede CPF repetido: confere antes de gravar. O CPF pode estar
 * salvo com ou sem pontuacao. `exceptId` ignora o proprio motorista (edicao).
 */
export async function isCpfTaken(cpf: string, exceptId?: string | null): Promise<boolean> {
  const digits = onlyDigits(cpf);
  if (!digits) return false;
  let query = supabase.from("drivers").select("id").in("cpf", [formatDocument(digits), digits]).limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) {
    console.warn("Error checking driver CPF:", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

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
