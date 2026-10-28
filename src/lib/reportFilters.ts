// Filtros e rankings da tela de Relatorios, sem dependencia de React.

import { calculateRegiaoLogistica } from "@/lib/cepRegionMapping";
import { getTodayBrazil, toDateStringBrazil } from "@/lib/timezone";

export type OperationTypeFilter = "all" | "own_fleet" | "third_party";

export interface ReportFilterValues {
  dateRange: { from: Date | undefined; to: Date | undefined };
  client: string;
  route: string;
  driver: string;
  operationType: string;
}

export interface ReportInvoice {
  id: string;
  status: string;
  recipient_name: string;
  regiao_logistica: string | null;
  address_zip: string | null;
  driver_id: string | null;
  manifest_id: string | null;
  occurrence_type: string | null;
  imported_at: string;
  updated_at: string;
  delivered_at: string | null;
}

export interface ReportManifest {
  id: string;
  driver_id: string | null;
  driver_name?: string | null;
  is_own_fleet: boolean | null;
  scheduled_date: string;
  status?: string;
}

const FINALIZED_OCCURRENCE = new Set(["occurrence", "returned", "devolvido"]);
const DELIVERED = new Set(["delivered", "entregue"]);

export function isDeliveredStatus(status: string): boolean {
  return DELIVERED.has(status);
}

export function isReturnedStatus(status: string): boolean {
  return status === "returned" || status === "devolvido";
}

export function hasOccurrence(inv: Pick<ReportInvoice, "status" | "occurrence_type">): boolean {
  return FINALIZED_OCCURRENCE.has(inv.status) || !!inv.occurrence_type;
}

/** Regiao da roteirizacao (ZS, ZN, ZL...): a gravada na NF ou a calculada pelo CEP. */
export function resolveInvoiceRegion(inv: Pick<ReportInvoice, "regiao_logistica" | "address_zip">): string {
  return inv.regiao_logistica?.trim() || calculateRegiaoLogistica(inv.address_zip);
}

/**
 * Data em que a NF "aconteceu" para o relatorio: entrega para entregues,
 * ultima atualizacao para ocorrencias/devolucoes e importacao para as demais.
 */
export function getInvoiceEventDate(inv: Pick<ReportInvoice, "status" | "delivered_at" | "updated_at" | "imported_at">): string {
  if (isDeliveredStatus(inv.status)) return inv.delivered_at || inv.updated_at || inv.imported_at;
  if (FINALIZED_OCCURRENCE.has(inv.status)) return inv.updated_at || inv.imported_at;
  return inv.imported_at;
}

/** YYYY-MM-DD (dia de Brasilia) de um Date escolhido no calendario. */
function calendarDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Faixa de dias (inclusiva). Datas ausentes deixam a ponta aberta. */
export function isDayInRange(day: string, range: ReportFilterValues["dateRange"]): boolean {
  if (!day) return false;
  if (range.from && day < calendarDay(range.from)) return false;
  if (range.to && day > calendarDay(range.to)) return false;
  return true;
}

function matchesOperation(manifest: ReportManifest | undefined, operationType: string): boolean {
  if (operationType === "all") return true;
  if (!manifest) return false;
  return operationType === "own_fleet" ? manifest.is_own_fleet === true : manifest.is_own_fleet !== true;
}

export function buildManifestIndex(manifests: ReportManifest[]): Map<string, ReportManifest> {
  return new Map(manifests.map((m) => [m.id, m]));
}

/** Filtros de cliente/rota/motorista/operacao (sem o periodo). */
export function filterInvoicesByEntity<T extends ReportInvoice>(
  invoices: T[],
  manifestsById: Map<string, ReportManifest>,
  filters: ReportFilterValues,
): T[] {
  return invoices.filter((inv) => {
    const manifest = inv.manifest_id ? manifestsById.get(inv.manifest_id) : undefined;
    if (filters.client !== "all" && inv.recipient_name !== filters.client) return false;
    if (filters.route !== "all" && resolveInvoiceRegion(inv) !== filters.route) return false;
    if (filters.driver !== "all" && (inv.driver_id || manifest?.driver_id) !== filters.driver) return false;
    if (!matchesOperation(manifest, filters.operationType)) return false;
    return true;
  });
}

export function filterInvoicesForReport<T extends ReportInvoice>(
  invoices: T[],
  manifestsById: Map<string, ReportManifest>,
  filters: ReportFilterValues,
): T[] {
  return filterInvoicesByEntity(invoices, manifestsById, filters).filter((inv) =>
    isDayInRange(toDateStringBrazil(getInvoiceEventDate(inv)), filters.dateRange),
  );
}

export function filterManifestsForReport<T extends ReportManifest>(manifests: T[], filters: ReportFilterValues): T[] {
  return manifests.filter((m) => {
    // scheduled_date e uma data pura (YYYY-MM-DD); comparar como texto evita o
    // deslocamento de fuso de new Date("YYYY-MM-DD") (meia-noite UTC).
    if (!isDayInRange(m.scheduled_date?.slice(0, 10), filters.dateRange)) return false;
    if (filters.driver !== "all" && m.driver_id !== filters.driver) return false;
    if (!matchesOperation(m, filters.operationType)) return false;
    return true;
  });
}

/**
 * NF atrasada: entregue em dia posterior ao programado no romaneio, ou ainda
 * nao entregue com a data programada ja passada.
 */
export function isInvoiceLate(
  inv: ReportInvoice,
  manifestsById: Map<string, ReportManifest>,
  today: string = getTodayBrazil(),
): boolean {
  const manifest = inv.manifest_id ? manifestsById.get(inv.manifest_id) : undefined;
  const scheduled = manifest?.scheduled_date?.slice(0, 10);
  if (!scheduled) return false;
  if (isDeliveredStatus(inv.status)) {
    const deliveredDay = toDateStringBrazil(inv.delivered_at || inv.updated_at);
    return !!deliveredDay && deliveredDay > scheduled;
  }
  if (inv.status === "in_transit" || inv.status === "pending") return scheduled < today;
  return false;
}

export interface RegionRanking {
  rank: number;
  region: string;
  total: number;
  delays: number;
  occurrences: number;
  /** Variacao % de atrasos vs periodo anterior de mesmo tamanho (0 sem base). */
  trend: number;
}

function countByRegion(invoices: ReportInvoice[], manifestsById: Map<string, ReportManifest>, today: string) {
  const stats = new Map<string, { total: number; delays: number; occurrences: number }>();
  invoices.forEach((inv) => {
    const region = resolveInvoiceRegion(inv);
    const entry = stats.get(region) || { total: 0, delays: 0, occurrences: 0 };
    entry.total += 1;
    if (isInvoiceLate(inv, manifestsById, today)) entry.delays += 1;
    if (hasOccurrence(inv)) entry.occurrences += 1;
    stats.set(region, entry);
  });
  return stats;
}

/**
 * Top regioes da roteirizacao por atraso (desempate: ocorrencias), com a
 * tendencia de atrasos contra o periodo anterior.
 */
export function rankRegionsByDelay(
  current: ReportInvoice[],
  previous: ReportInvoice[],
  manifestsById: Map<string, ReportManifest>,
  limit = 5,
  today: string = getTodayBrazil(),
): RegionRanking[] {
  const now = countByRegion(current, manifestsById, today);
  const before = countByRegion(previous, manifestsById, today);

  return Array.from(now.entries())
    .filter(([, s]) => s.delays > 0 || s.occurrences > 0)
    .sort(([aName, a], [bName, b]) => b.delays - a.delays || b.occurrences - a.occurrences || aName.localeCompare(bName, "pt-BR"))
    .slice(0, limit)
    .map(([region, s], index) => {
      const prevDelays = before.get(region)?.delays ?? 0;
      const trend = prevDelays > 0 ? Math.round(((s.delays - prevDelays) / prevDelays) * 100) : 0;
      return { rank: index + 1, region, total: s.total, delays: s.delays, occurrences: s.occurrences, trend };
    });
}

/** Periodo imediatamente anterior, com o mesmo numero de dias. */
export function previousRange(range: ReportFilterValues["dateRange"]): ReportFilterValues["dateRange"] {
  if (!range.from || !range.to) return { from: undefined, to: undefined };
  const from = new Date(range.from);
  const to = new Date(range.to);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: prevFrom, to: prevTo };
}
