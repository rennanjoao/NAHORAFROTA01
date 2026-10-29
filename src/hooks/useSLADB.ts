/**
 * USE SLA DB HOOK
 * Database-driven SLA calculations using invoice occurrence weights
 * 
 * SLA Calculation: Proportional weight system
 * Each invoice in a manifest represents an equal fraction of 100%
 * Formula: (Sum of Invoice Weights / Total Invoices) * 100
 * 
 * Weight Table:
 * - Delivered (delivered), Incorrect Address (endereco_incorreto), Incorrect Doc (doc_incorreta): 1.0
 * - Restricted Hours (horario_restrito), Risk Area (area_risco): 0.9
 * - Refused (recusa_recebimento), Others (outros): 0.8
 * - Vehicle Broke Down (veiculo_quebrou): 0.5
 * - Damaged (avaria), Missing Goods (falta_mercadoria): 0.0
 * 
 * SLA Thresholds (4 Tiers):
 * - Excelente (Verde Esmeralda): >97% - Meta atingida
 * - Bom (Azul): 90-96% - Performance aceitável
 * - Atenção (Amarelo): 75-89% - Requer monitoramento
 * - Crítico (Vermelho): <75% - Alto risco operacional
 */

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTableChanges } from "@/lib/sharedRealtime";
import { supabase } from "@/integrations/supabase/client";
import { formatSLA } from "@/lib/formatSLA";
import { getSLAColorScheme, isSLAHealthy, isSLACritical, isSLAAttention, isSLAGood, SLA_THRESHOLDS } from "@/lib/slaThresholds";
import { getDayBoundsUTC, getTodayBrazil } from "@/lib/timezone";
import { fetchAllPages } from "@/lib/supabasePaging";
import { SLA_PERIODS, periodStart, type PeriodSLA, type SLAPeriodDays } from "@/lib/slaRanking";

// Re-export threshold utilities for convenience
export { getSLAColorScheme, isSLAHealthy, isSLACritical, isSLAAttention, isSLAGood, SLA_THRESHOLDS };

// Occurrence type weights for SLA calculation
export const SLA_OCCURRENCE_WEIGHTS: Record<string, number> = {
  // Weight 1.0 - Full credit
  delivered: 1.0,
  endereco_incorreto: 1.0,
  doc_incorreta: 1.0,
  
  // Weight 0.9 - Minor issues
  horario_restrito: 0.9,
  area_risco: 0.9,
  
  // Weight 0.8 - Customer related issues
  recusa_recebimento: 0.8,
  outros: 0.8,
  
  // Weight 0.5 - Operational issues
  veiculo_quebrou: 0.5,
  
  // Weight 0.0 - Critical issues (total loss)
  avaria: 0.0,
  avaria_mercadoria: 0.0, // Alias for avaria
  falta_mercadoria: 0.0,
  falta: 0.0, // Alias for falta_mercadoria
};

// Nome de cada tipo de ocorrencia (frase simples, so a primeira letra maiuscula).
export const OCCURRENCE_LABELS: Record<string, string> = {
  delivered: "Entrega realizada",
  cliente_ausente: "Cliente ausente",
  ausente: "Cliente ausente",
  recusado: "Recusado pelo cliente",
  recusa_recebimento: "Recusa de recebimento",
  endereco_incorreto: "Endereço incorreto",
  endereco_errado: "Endereço errado ou não encontrado",
  endereco_nao_localizado: "Endereço não localizado",
  endereco_nao_encontrado: "Endereço não encontrado",
  doc_incorreta: "Doc. incorreta",
  documentacao_incorreta: "Documentação incorreta",
  horario_restrito: "Horário restrito",
  fora_horario: "Fora do horário",
  area_risco: "Área de risco",
  veiculo_quebrou: "Veículo quebrou",
  veiculo_quebrado: "Veículo quebrado",
  avaria: "Avaria",
  avaria_mercadoria: "Avaria de mercadoria",
  mercadoria_avariada: "Mercadoria avariada",
  extravio: "Mercadoria extraviada",
  falta_mercadoria: "Falta de mercadoria",
  falta: "Falta de mercadoria",
  mercadoria_nao_localizada: "Mercadoria não localizada",
  recusa_cliente: "Recusa do cliente",
  avaria_transporte: "Avaria no transporte",
  tentativa_entrega: "Tentativa de entrega",
  aguardando_pagamento: "Aguardando pagamento",
  outro: "Outros",
  outros: "Outros",
};

/** Nome legivel do tipo de ocorrencia; codigo desconhecido vira texto ("cliente_x" -> "Cliente x"). */
export function getOccurrenceLabel(type: string | null | undefined): string {
  if (!type) return "Ocorrência";
  const known = OCCURRENCE_LABELS[type];
  if (known) return known;
  const text = type.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Get weight for an occurrence type (defaults to 0.8 for unknown types)
export function getOccurrenceWeight(occurrenceType: string | null, status: string): number {
  // Delivered status = full weight
  if (status === "delivered") return 1.0;
  
  // Pending/in_transit = not yet finalized, don't count
  if (status === "pending" || status === "in_transit") return -1; // Skip
  
  // For occurrence status, use the occurrence_type weight
  if (occurrenceType && SLA_OCCURRENCE_WEIGHTS[occurrenceType] !== undefined) {
    return SLA_OCCURRENCE_WEIGHTS[occurrenceType];
  }
  
  // Default weight for unknown occurrence types
  return 0.8;
}

export interface InvoiceOccurrence {
  invoiceId: string;
  nfeNumber: string;
  occurrenceType: string;
  weight: number;
  recipientName: string;
  status: string;
}

export interface SLAInvoiceItem {
  invoiceId: string;
  nfeNumber: string;
  recipientName: string;
  recipientPhone: string | null;
  addressFull: string;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  status: string;
  occurrenceType: string | null;
  weight: number;
  totalValue: number | null;
  totalWeight: number | null;
  observation: string | null;
  manifestId: string | null;
  importedAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  receiverName: string | null;
  receiverDocument: string | null;
}

export interface DriverSLAStats {
  driver_id: string;
  driver_name: string;
  photo_url: string | null;
  phone: string;
  vehicle_plate: string;
  status: string;
  
  // Today's stats
  todayTotalInvoices: number;
  todayDeliveredCount: number;
  todayOccurrenceCount: number;
  todaySLA: number;
  todayOccurrences: InvoiceOccurrence[];
  todayInvoices: SLAInvoiceItem[];
  
  // Weekly stats (last 7 days)
  weeklySLA: number;
  weeklyTotalInvoices: number;
  weeklyDeliveredCount: number;
  weeklyOccurrenceCount: number;
  weeklyOccurrences: InvoiceOccurrence[];
  weeklyInvoices: SLAInvoiceItem[];
  
  // Previous week stats (for trend comparison)
  previousWeeklySLA: number;
  previousWeeklyTotalInvoices: number;
  
  // Historical stats (6 months)
  historicalSLA: number;
  historicalTotalInvoices: number;

  // SLA por janela de historico (7, 15, 30, 90 dias e geral)
  periodStats: Record<SLAPeriodDays, PeriodSLA>;
}

// Orphan invoices (no driver_id) that affect fleet SLA
export interface OrphanInvoice {
  id: string;
  nfeNumber: string;
  recipientName: string;
  occurrenceType: string;
  weight: number;
  status: string;
  updatedAt: string;
}

interface InvoiceForSLA {
  id: string;
  nfe_number: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  address_full: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  status: string;
  occurrence_type: string | null;
  driver_id: string | null;
  manifest_id: string | null;
  total_value: number | null;
  total_weight: number | null;
  observation: string | null;
  imported_at: string;
  delivered_at: string | null;
  updated_at: string;
  receiver_name: string | null;
  receiver_document: string | null;
}

interface ManifestForSLA {
  id: string;
  driver_id: string | null;
  driver_name: string;
  scheduled_date: string;
  status: string;
}

interface DriverInfo {
  id: string;
  name: string | null;
  photo_url: string | null;
  phone: string;
  vehicle_plate: string;
  status: string;
}

/**
 * Calculate SLA from a list of invoices
 * Returns percentage (0-100)
 */
function calculateSLAFromInvoices(invoices: InvoiceForSLA[]): { sla: number; delivered: number; occurrences: number; total: number } {
  // Filter only finalized invoices (delivered or occurrence)
  const finalizedInvoices = invoices.filter(inv => 
    inv.status === "delivered" || inv.status === "occurrence" || inv.status === "returned"
  );
  
  if (finalizedInvoices.length === 0) {
    return { sla: 100, delivered: 0, occurrences: 0, total: 0 };
  }
  
  let totalWeight = 0;
  let deliveredCount = 0;
  let occurrenceCount = 0;
  
  finalizedInvoices.forEach(inv => {
    const weight = getOccurrenceWeight(inv.occurrence_type, inv.status);
    if (weight >= 0) {
      totalWeight += weight;
      if (inv.status === "delivered") {
        deliveredCount++;
      } else {
        occurrenceCount++;
      }
    }
  });
  
  const sla = (totalWeight / finalizedInvoices.length) * 100;
  
  return {
    sla: Math.min(100, Math.max(0, sla)),
    delivered: deliveredCount,
    occurrences: occurrenceCount,
    total: finalizedInvoices.length,
  };
}

function mapInvoiceItem(inv: InvoiceForSLA): SLAInvoiceItem {
  return {
    invoiceId: inv.id,
    nfeNumber: inv.nfe_number || inv.id.slice(0, 8),
    recipientName: inv.recipient_name,
    recipientPhone: inv.recipient_phone,
    addressFull: inv.address_full,
    addressStreet: inv.address_street,
    addressCity: inv.address_city,
    addressState: inv.address_state,
    addressZip: inv.address_zip,
    status: inv.status,
    occurrenceType: inv.occurrence_type,
    weight: getOccurrenceWeight(inv.occurrence_type, inv.status),
    totalValue: inv.total_value,
    totalWeight: inv.total_weight,
    observation: inv.observation,
    manifestId: inv.manifest_id,
    importedAt: inv.imported_at,
    updatedAt: inv.updated_at,
    deliveredAt: inv.delivered_at,
    receiverName: inv.receiver_name,
    receiverDocument: inv.receiver_document,
  };
}

export interface SLAData {
  driverStats: DriverSLAStats[];
  orphanInvoices: OrphanInvoice[];
  fleetSLA: { today: number; weekly: number; previousWeekly: number; yesterday: number };
  fleetPeriodSLA: Record<SLAPeriodDays, PeriodSLA> | null;
}

const DEFAULT_FLEET_SLA: SLAData["fleetSLA"] = { today: 100, weekly: 100, previousWeekly: 100, yesterday: 100 };
const NO_DRIVER_STATS: DriverSLAStats[] = [];
const NO_ORPHANS: OrphanInvoice[] = [];

/** Busca e calcula o SLA (6 meses de NFs). Chamado uma vez so, pelo cache compartilhado. */
async function loadSLAData(): Promise<SLAData> {
  // Calculate date ranges using Brazil timezone
  const todayStr = getTodayBrazil();
  const { start: todayStart, end: todayEnd } = getDayBoundsUTC(todayStr);

  // Yesterday in Brazil timezone
  const yesterdayDate = new Date(todayStr + 'T12:00:00-03:00');
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const { start: yesterdayStartStr, end: yesterdayEndStr } = getDayBoundsUTC(yesterdayStr);
  const yesterdayStart = { toISOString: () => yesterdayStartStr };
  const yesterdayEnd = { toISOString: () => yesterdayEndStr };

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const invoiceColumns = "id, nfe_number, recipient_name, recipient_phone, address_full, address_street, address_city, address_state, address_zip, status, occurrence_type, driver_id, manifest_id, total_value, total_weight, observation, imported_at, delivered_at, updated_at, receiver_name, receiver_document";

  // Uma unica busca paginada dos ultimos 6 meses; hoje, ontem, semana e as
  // janelas de historico sao recortes em memoria (antes eram 5 consultas,
  // todas limitadas a 1000 linhas pelo Supabase).
  const [driversResult, historicalInvoices, manifestsResult] = await Promise.all([
    // All drivers
    supabase.from("drivers").select("id, name, photo_url, phone, vehicle_plate, status"),

    fetchAllPages<InvoiceForSLA>((from, to) =>
      supabase
        .from("invoices")
        .select(invoiceColumns)
        .gte("updated_at", sixMonthsAgo)
        .in("status", ["delivered", "occurrence", "returned"])
        // Ordem por id (imutavel): NFs atualizadas durante a leitura nao
        // trocam de pagina, entao nada e pulado nem contado duas vezes.
        .order("id", { ascending: true })
        .range(from, to)
    ),

    // Recent manifests used to recover driver links when invoices only have manifest_id
    supabase
      .from("manifests")
      .select("id, driver_id, driver_name, scheduled_date, status")
      .gte("scheduled_date", sixMonthsAgo.slice(0, 10)),
  ]);

  const updatedMs = (inv: InvoiceForSLA) => Date.parse(inv.updated_at);
  const updatedBetween = (inv: InvoiceForSLA, fromIso: string, toIso?: string) =>
    updatedMs(inv) >= Date.parse(fromIso) && (!toIso || updatedMs(inv) < Date.parse(toIso));

  const drivers = (driversResult.data || []) as DriverInfo[];
  const todayInvoices = historicalInvoices.filter(inv => updatedBetween(inv, todayStart));
  const yesterdayInvoices = historicalInvoices.filter(inv => updatedBetween(inv, yesterdayStart.toISOString(), yesterdayEnd.toISOString()));
  const weeklyInvoices = historicalInvoices.filter(inv => updatedBetween(inv, weekAgo));
  const previousWeekInvoices = historicalInvoices.filter(inv => updatedBetween(inv, twoWeeksAgo, weekAgo));
  const manifests = (manifestsResult.data || []) as ManifestForSLA[];
  const periodStarts = SLA_PERIODS.map(days => [days, Date.parse(periodStart(days, today))] as const);
  const manifestDriverMap = new Map(manifests.map(manifest => [manifest.id, manifest.driver_id]));
  const getEffectiveDriverId = (invoice: InvoiceForSLA) =>
    invoice.driver_id || (invoice.manifest_id ? manifestDriverMap.get(invoice.manifest_id) || null : null);

  // Calculate stats per driver
  const stats: DriverSLAStats[] = drivers.map(driver => {
    // Filter invoices for this driver
    const driverTodayInvoices = todayInvoices.filter(inv => getEffectiveDriverId(inv) === driver.id);
    const driverWeeklyInvoices = weeklyInvoices.filter(inv => getEffectiveDriverId(inv) === driver.id);
    const driverPreviousWeekInvoices = previousWeekInvoices.filter(inv => getEffectiveDriverId(inv) === driver.id);
    const driverHistoricalInvoices = historicalInvoices.filter(inv => getEffectiveDriverId(inv) === driver.id);

    // Calculate SLAs
    const todayCalc = calculateSLAFromInvoices(driverTodayInvoices);
    const weeklyCalc = calculateSLAFromInvoices(driverWeeklyInvoices);
    const previousWeekCalc = calculateSLAFromInvoices(driverPreviousWeekInvoices);
    const historicalCalc = calculateSLAFromInvoices(driverHistoricalInvoices);
    const periodStats = Object.fromEntries(
      periodStarts.map(([days, startMs]) => {
        const calc = calculateSLAFromInvoices(driverHistoricalInvoices.filter(inv => updatedMs(inv) >= startMs));
        return [days, { sla: calc.sla, total: calc.total, delivered: calc.delivered, occurrences: calc.occurrences }];
      })
    ) as Record<SLAPeriodDays, PeriodSLA>;

    // Get today's occurrences for detail view
    const todayOccurrences: InvoiceOccurrence[] = driverTodayInvoices
      .filter(inv => inv.status === "occurrence" || inv.status === "returned")
      .map(inv => ({
        invoiceId: inv.id,
        nfeNumber: inv.nfe_number || inv.id.slice(0, 8),
        occurrenceType: inv.occurrence_type || "outros",
        weight: getOccurrenceWeight(inv.occurrence_type, inv.status),
        recipientName: inv.recipient_name,
        status: inv.status,
      }));
    const todayInvoiceItems = driverTodayInvoices
      .filter(inv => inv.status === "delivered" || inv.status === "occurrence" || inv.status === "returned")
      .map(mapInvoiceItem);

    // Get weekly occurrences for detail view
    const weeklyOccurrences: InvoiceOccurrence[] = driverWeeklyInvoices
      .filter(inv => inv.status === "occurrence" || inv.status === "returned")
      .map(inv => ({
        invoiceId: inv.id,
        nfeNumber: inv.nfe_number || inv.id.slice(0, 8),
        occurrenceType: inv.occurrence_type || "outros",
        weight: getOccurrenceWeight(inv.occurrence_type, inv.status),
        recipientName: inv.recipient_name,
        status: inv.status,
      }));
    const weeklyInvoiceItems = driverWeeklyInvoices
      .filter(inv => inv.status === "delivered" || inv.status === "occurrence" || inv.status === "returned")
      .map(mapInvoiceItem);

    return {
      driver_id: driver.id,
      driver_name: driver.name || "Sem nome",
      photo_url: driver.photo_url,
      phone: driver.phone,
      vehicle_plate: driver.vehicle_plate,
      status: driver.status,

      todayTotalInvoices: todayCalc.total,
      todayDeliveredCount: todayCalc.delivered,
      todayOccurrenceCount: todayCalc.occurrences,
      todaySLA: todayCalc.sla,
      todayOccurrences,
      todayInvoices: todayInvoiceItems,

      weeklySLA: weeklyCalc.sla,
      weeklyTotalInvoices: weeklyCalc.total,
      weeklyDeliveredCount: weeklyCalc.delivered,
      weeklyOccurrenceCount: weeklyCalc.occurrences,
      weeklyOccurrences,
      weeklyInvoices: weeklyInvoiceItems,

      previousWeeklySLA: previousWeekCalc.sla,
      previousWeeklyTotalInvoices: previousWeekCalc.total,

      historicalSLA: historicalCalc.sla,
      historicalTotalInvoices: historicalCalc.total,

      periodStats,
    };
  });

  // Calculate fleet-wide SLAs
  const todayFleetCalc = calculateSLAFromInvoices(todayInvoices);
  const yesterdayFleetCalc = calculateSLAFromInvoices(yesterdayInvoices);
  const weeklyFleetCalc = calculateSLAFromInvoices(weeklyInvoices);
  const previousWeekFleetCalc = calculateSLAFromInvoices(previousWeekInvoices);

  // Track orphan invoices (no driver_id) that affect SLA
  const weeklyOrphans: OrphanInvoice[] = weeklyInvoices
    .filter(inv => !getEffectiveDriverId(inv) && (inv.status === "occurrence" || inv.status === "returned"))
    .map(inv => ({
      id: inv.id,
      nfeNumber: inv.nfe_number || inv.id.slice(0, 8),
      recipientName: inv.recipient_name,
      occurrenceType: inv.occurrence_type || "outros",
      weight: getOccurrenceWeight(inv.occurrence_type, inv.status),
      status: inv.status,
      updatedAt: inv.updated_at,
    }));

  return {
    driverStats: stats,
    orphanInvoices: weeklyOrphans,
    fleetPeriodSLA: Object.fromEntries(
      periodStarts.map(([days, startMs]) => {
        const calc = calculateSLAFromInvoices(historicalInvoices.filter(inv => updatedMs(inv) >= startMs));
        return [days, { sla: calc.sla, total: calc.total, delivered: calc.delivered, occurrences: calc.occurrences }];
      })
    ) as Record<SLAPeriodDays, PeriodSLA>,
    fleetSLA: {
      today: todayFleetCalc.sla,
      yesterday: yesterdayFleetCalc.sla,
      weekly: weeklyFleetCalc.sla,
      previousWeekly: previousWeekFleetCalc.sla,
    },
  };
}

export const SLA_QUERY_KEY = "sla-db";

/**
 * SLA do painel. Antes cada bloco que usava o hook baixava os 6 meses de NFs (tres vezes
 * no Inicio) e recarregava tudo a cada mudanca de NF. Agora a busca e compartilhada e
 * guardada entre telas; mudancas de NF reagendam uma recarga so.
 */
export function useSLADB() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [SLA_QUERY_KEY, user?.id], queryFn: loadSLAData, enabled: !!user, staleTime: 60 * 1000 });
  const isLoading = query.isLoading;
  const driverStats = query.data?.driverStats ?? NO_DRIVER_STATS;
  const orphanInvoices = query.data?.orphanInvoices ?? NO_ORPHANS;
  const fleetSLA = query.data?.fleetSLA ?? DEFAULT_FLEET_SLA;
  const fleetPeriodSLA = query.data?.fleetPeriodSLA ?? null;

  const fetchSLAData = useCallback(() => queryClient.invalidateQueries({ queryKey: [SLA_QUERY_KEY] }), [queryClient]);
  useTableChanges(["invoices"], fetchSLAData);

  // Derived data

  // Drivers with activity (have invoices)
  const activeDriverStats = useMemo(() => 
    driverStats.filter(d => d.todayTotalInvoices > 0 || d.weeklyTotalInvoices > 0),
    [driverStats]
  );

  // Weekly: Drivers below 97% (grouped by severity)
  const worstWeeklyDrivers = useMemo(() => 
    driverStats
      .filter(d => d.weeklyTotalInvoices > 0 && d.weeklySLA < SLA_THRESHOLDS.EXCELLENT)
      .sort((a, b) => a.weeklySLA - b.weeklySLA),
    [driverStats]
  );

  // Critical weekly drivers (<75%)
  const criticalWeeklyDrivers = useMemo(() => 
    worstWeeklyDrivers.filter(d => isSLACritical(d.weeklySLA)),
    [worstWeeklyDrivers]
  );

  // Attention weekly drivers (75-89%)
  const attentionWeeklyDrivers = useMemo(() => 
    worstWeeklyDrivers.filter(d => isSLAAttention(d.weeklySLA)),
    [worstWeeklyDrivers]
  );

  // Good weekly drivers (90-96%)
  const goodWeeklyDrivers = useMemo(() => 
    worstWeeklyDrivers.filter(d => isSLAGood(d.weeklySLA)),
    [worstWeeklyDrivers]
  );

  // Today: Drivers with occurrences that dropped below 97%
  const todayProblematicDrivers = useMemo(() => 
    driverStats
      .filter(d => d.todayOccurrenceCount > 0 && d.todaySLA < SLA_THRESHOLDS.EXCELLENT)
      .sort((a, b) => a.todaySLA - b.todaySLA),
    [driverStats]
  );

  // Historical: Drivers with historical SLA < 97% (for attention card)
  const driversRequiringAttention = useMemo(() => {
    return driverStats
      .filter(d => d.historicalTotalInvoices > 10 && d.historicalSLA < SLA_THRESHOLDS.EXCELLENT)
      .sort((a, b) => a.historicalSLA - b.historicalSLA);
  }, [driverStats]);

  // Critical historical drivers (<75%)
  const criticalHistoricalDrivers = useMemo(() => 
    driversRequiringAttention.filter(d => isSLACritical(d.historicalSLA)),
    [driversRequiringAttention]
  );

  // Attention historical drivers (75-89%)
  const attentionHistoricalDrivers = useMemo(() => 
    driversRequiringAttention.filter(d => isSLAAttention(d.historicalSLA)),
    [driversRequiringAttention]
  );

  // Good historical drivers (90-96%)
  const goodHistoricalDrivers = useMemo(() => 
    driversRequiringAttention.filter(d => isSLAGood(d.historicalSLA)),
    [driversRequiringAttention]
  );

  // Check if operation is healthy (fleet SLA >= 97%)
  const isOperationHealthy = useMemo(() => 
    isSLAHealthy(fleetSLA.weekly),
    [fleetSLA.weekly]
  );

  // Trend calculations
  const weeklyTrend = useMemo((): "up" | "down" | "stable" => {
    const diff = fleetSLA.weekly - fleetSLA.previousWeekly;
    if (Math.abs(diff) < 0.5) return "stable";
    return diff > 0 ? "up" : "down";
  }, [fleetSLA.weekly, fleetSLA.previousWeekly]);

  const todayTrend = useMemo((): "up" | "down" | "stable" => {
    const diff = fleetSLA.today - fleetSLA.yesterday;
    if (Math.abs(diff) < 0.5) return "stable";
    return diff > 0 ? "up" : "down";
  }, [fleetSLA.today, fleetSLA.yesterday]);

  return {
    isLoading,
    refetch: fetchSLAData,
    
    // Fleet SLAs
    fleetSLA,
    fleetPeriodSLA,
    
    // Trends
    weeklyTrend,
    todayTrend,
    
    // Driver stats
    driverStats,
    activeDriverStats,
    
    // Orphan invoices (no driver assigned)
    orphanInvoices,
    
    // Weekly analysis (grouped by severity)
    worstWeeklyDrivers,
    criticalWeeklyDrivers,
    attentionWeeklyDrivers,
    goodWeeklyDrivers,
    isOperationHealthy,
    
    // Real-time (today) analysis  
    todayProblematicDrivers,
    
    // Historical analysis (for attention card)
    driversRequiringAttention,
    criticalHistoricalDrivers,
    attentionHistoricalDrivers,
    goodHistoricalDrivers,
    
    // Helpers
    formatSLA,
    getOccurrenceWeight,
    OCCURRENCE_LABELS,
    SLA_OCCURRENCE_WEIGHTS,
    getSLAColorScheme,
    isSLAHealthy,
    isSLACritical,
    isSLAAttention,
    isSLAGood,
  };
}

export default useSLADB;
