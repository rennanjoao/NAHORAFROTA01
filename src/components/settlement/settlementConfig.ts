import type { Tone } from "@/components/patterns";
import type { DBManifest } from "@/hooks/useManifestsDB";

/** Tipos e rotulos compartilhados da tela de Acerto financeiro. */

export type AdjustmentCategory = "discount" | "bonus" | "unloading" | "toll" | "fuel" | "other";

/** Credito/debito avulso do motorista (tabela driver_wallet). */
export interface LocalAdjustment {
  id: string;
  date: Date;
  description: string;
  value: number;
  type: "credit" | "debit";
  category?: AdjustmentCategory;
  observation?: string;
  /** pending = entra no saldo a pagar; paid = ja quitado. */
  status?: string;
}

export const categoryLabels: Record<AdjustmentCategory, string> = {
  discount: "Desconto",
  bonus: "Bônus",
  unloading: "Descarga",
  toll: "Pedágio",
  fuel: "Combustível",
  other: "Outros",
};

export type PeriodFilter = "daily" | "weekly" | "monthly" | "quarterly" | "semester" | "annual";

// Rotulos dizem exatamente o que entra na conta (hoje - N dias).
export const periodLabels: Record<PeriodFilter, string> = {
  daily: "Últimas 24 horas",
  weekly: "Últimos 7 dias",
  monthly: "Últimos 30 dias",
  quarterly: "Últimos 90 dias",
  semester: "Últimos 6 meses",
  annual: "Últimos 12 meses",
};

export const periodDays: Record<PeriodFilter, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semester: 180,
  annual: 365,
};

export const freightTypeLabels: Record<string, string> = {
  fixed: "Frete fixo",
  lumpsum: "Frete fechado",
  per_km: "Frete por km",
};

/** Situacao do romaneio no acerto: ponto + texto (StatusBadge). */
export const manifestStatusInfo: Record<DBManifest["status"], { label: string; tone: Tone }> = {
  pending: { label: "Não iniciado", tone: "neutral" },
  in_progress: { label: "Em rota", tone: "info" },
  completed: { label: "A pagar", tone: "warning" },
  paid: { label: "Pago", tone: "success" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

/** Resumo de um motorista com romaneios ainda nao pagos. */
export interface PendingDriverSummary {
  driverId: string;
  driverName: string;
  driverCpf: string;
  manifestCount: number;
  totalValue: number;
}
