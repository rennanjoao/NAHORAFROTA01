/**
 * Textos e cores de status usados no painel. Cor com significado fixo
 * (docs/DESIGN.md): verde ok, amarelo atencao, vermelho atraso/ocorrencia,
 * azul em rota, cinza inativo.
 */
import type { Tone } from "@/components/patterns";
import { getSLAColorScheme } from "@/lib/slaThresholds";
import { getOccurrenceLabel } from "@/hooks/useSLADB";

export interface StatusInfo {
  tone: Tone;
  label: string;
}

/** Situacao da nota fiscal em linguagem simples. */
export function invoiceStatus(status: string, occurrenceType?: string | null): StatusInfo {
  switch (status) {
    case "pending":
      return { tone: "warning", label: "Pendente" };
    case "in_transit":
      return { tone: "info", label: "Em rota" };
    case "delivered":
      return { tone: "success", label: "Entregue" };
    case "occurrence":
      return { tone: "danger", label: occurrenceType ? getOccurrenceLabel(occurrenceType) : "Ocorrência" };
    case "returned":
      return { tone: "danger", label: "Devolvida" };
    default:
      return { tone: "neutral", label: status };
  }
}

/** Situacao do romaneio. */
export function manifestStatus(status: string): StatusInfo {
  switch (status) {
    case "pending":
      return { tone: "warning", label: "Pendente" };
    case "in_progress":
      return { tone: "info", label: "Em andamento" };
    case "completed":
      return { tone: "success", label: "Concluído" };
    case "paid":
      return { tone: "success", label: "Pago" };
    default:
      return { tone: "neutral", label: status };
  }
}

/** Faixa do SLA: meta batida (verde), abaixo da meta (amarelo), critico (vermelho). */
export function slaStatus(sla: number): StatusInfo {
  const scheme = getSLAColorScheme(sla);
  const tone: Tone = scheme.level === "excellent" ? "success" : scheme.level === "critical" ? "danger" : "warning";
  return { tone, label: scheme.labelPt };
}

/** "75%", "89,9%". */
export const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** "1 motorista", "3 motoristas". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? singular : pluralForm}`;
}

/** Numero da nota para exibir ("NF 1234"). */
export function invoiceNumber(nfeNumber: string | null | undefined, id: string): string {
  return `NF ${nfeNumber || id.slice(0, 8)}`;
}

/** Placa para mostrar: "PENDENTE" (cadastro sem placa) e vazio viram "Sem placa". */
export function plateLabel(plate: string | null | undefined): string {
  return !plate || plate.trim().toUpperCase() === "PENDENTE" ? "Sem placa" : plate;
}

/** Peso em pt-BR ("12,5 kg"). */
export function formatWeight(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}

/** Hora curta ("14:05"). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
