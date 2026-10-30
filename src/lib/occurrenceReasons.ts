import { getOccurrenceLabel } from "@/hooks/useSLADB";

/*
 * Motivos de ocorrencia cadastrados pela empresa (tabela occurrence_reasons). O motorista
 * so escolhe entre os ativos; a observacao e livre. A lista padrao abaixo e a mesma que a
 * migration grava para cada empresa (e o que o app usa se o banco ainda nao tiver a tabela).
 */
export interface OccurrenceReason {
  id: string;
  code: string;
  label: string;
  active: boolean;
  sort_order: number;
}

export const DEFAULT_OCCURRENCE_REASONS: Omit<OccurrenceReason, "id">[] = [
  { code: "cliente_ausente", label: "Cliente ausente", active: true, sort_order: 10 },
  { code: "estabelecimento_fechado", label: "Estabelecimento fechado", active: true, sort_order: 20 },
  { code: "recusado", label: "Cliente recusou", active: true, sort_order: 30 },
  { code: "endereco_errado", label: "Endereço não encontrado", active: true, sort_order: 40 },
  { code: "horario_restrito", label: "Fora do horário de recebimento", active: true, sort_order: 50 },
  { code: "avaria", label: "Mercadoria avariada", active: true, sort_order: 60 },
  { code: "falta_mercadoria", label: "Falta de mercadoria", active: true, sort_order: 70 },
  { code: "area_risco", label: "Área de risco", active: true, sort_order: 80 },
  { code: "extravio", label: "Mercadoria extraviada", active: true, sort_order: 90 },
];

/** Codigo gravado no banco a partir do nome ("Loja fechada" -> "loja_fechada"). */
export function reasonCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Nome do motivo: o cadastrado pela empresa; codigo antigo cai no nome padrao. */
export function reasonLabel(code: string | null | undefined, reasons: Pick<OccurrenceReason, "code" | "label">[]): string {
  if (!code) return "Ocorrência";
  return reasons.find((reason) => reason.code === code)?.label ?? getOccurrenceLabel(code);
}
