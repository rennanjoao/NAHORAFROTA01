import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readDeliveryOccurrences } from "@/lib/deliveryOccurrences";
import { getDayBoundsUTC, getTodayBrazil } from "@/lib/timezone";
import { getCurrentTenantId } from "@/lib/tenant";
import { onTableChange } from "@/lib/sharedRealtime";

/*
 * O que os motoristas registraram hoje, do mais novo para o mais antigo: chegada no
 * cliente (aguardando recebimento), entrega e ocorrencia. Sai do que o app do motorista
 * ja grava (invoices.arrived_at/delivered_at e delivery_occurrences), sem tabela nova.
 * Ocorrencia sem linha em delivery_occurrences (banco antigo nao salvava o detalhe) sai
 * do status da propria nota.
 */

export type DriverActivityKind = "arrived" | "delivered" | "occurrence";

export interface DriverActivity {
  id: string;
  kind: DriverActivityKind;
  at: string;
  driverId: string | null;
  driverName: string;
  driverPhoto: string | null;
  invoiceId: string | null;
  nfe: string | null;
  /** Cliente/loja da nota. */
  place: string | null;
  /** Ocorrencia: codigo do motivo. */
  reason: string | null;
  /** Ocorrencia: observacao do motorista. */
  note: string | null;
  /** Chegada: a nota ainda espera o recebimento. */
  waiting: boolean;
}

const FEED_LIMIT = 60;

interface InvoiceRow {
  id: string;
  nfe_number: string | null;
  recipient_name: string | null;
  driver_id: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  status: string;
  occurrence_type: string | null;
  observation: string | null;
  updated_at: string | null;
}

const INVOICE_COLUMNS = "id, nfe_number, recipient_name, driver_id, arrived_at, delivered_at, status, occurrence_type, observation, updated_at";

type OccurrenceRow = { id: string; created_at: string; driver_id: string | null; invoice_id: string | null; occurrence_type: string; description: string | null };

/** Junta as tres fontes numa linha do tempo (exportada para teste). */
export function buildActivity(
  invoices: InvoiceRow[],
  occurrences: OccurrenceRow[],
  drivers: Map<string, { name: string; photo: string | null }>,
  since: string,
): DriverActivity[] {
  const byInvoice = new Map(invoices.map((inv) => [inv.id, inv]));
  const sinceMs = new Date(since).getTime();
  const after = (iso: string | null) => !!iso && new Date(iso).getTime() >= sinceMs;
  const who = (driverId: string | null) => {
    const driver = driverId ? drivers.get(driverId) : undefined;
    return { driverId, driverName: driver?.name || "Motorista", driverPhoto: driver?.photo ?? null };
  };

  const events: DriverActivity[] = [];
  for (const inv of invoices) {
    const base = { invoiceId: inv.id, nfe: inv.nfe_number, place: inv.recipient_name, reason: null, note: null };
    if (after(inv.arrived_at)) {
      const waiting = inv.status === "in_transit";
      events.push({ id: `arrived-${inv.id}`, kind: "arrived", at: inv.arrived_at!, ...who(inv.driver_id), ...base, waiting });
    }
    if (inv.status === "delivered" && after(inv.delivered_at)) {
      events.push({ id: `delivered-${inv.id}`, kind: "delivered", at: inv.delivered_at!, ...who(inv.driver_id), ...base, waiting: false });
    }
  }
  for (const occ of occurrences) {
    if (!after(occ.created_at)) continue;
    const inv = occ.invoice_id ? byInvoice.get(occ.invoice_id) : undefined;
    events.push({
      id: `occurrence-${occ.id}`,
      kind: "occurrence",
      at: occ.created_at,
      ...who(occ.driver_id ?? inv?.driver_id ?? null),
      invoiceId: occ.invoice_id,
      nfe: inv?.nfe_number ?? null,
      place: inv?.recipient_name ?? null,
      reason: occ.occurrence_type,
      note: occ.description?.trim() || null,
      waiting: false,
    });
  }
  const withDetail = new Set(occurrences.map((occ) => occ.invoice_id));
  for (const inv of invoices) {
    if (inv.status !== "occurrence" || !inv.occurrence_type || withDetail.has(inv.id) || !after(inv.updated_at)) continue;
    events.push({
      id: `occurrence-${inv.id}`,
      kind: "occurrence",
      at: inv.updated_at!,
      ...who(inv.driver_id),
      invoiceId: inv.id,
      nfe: inv.nfe_number,
      place: inv.recipient_name,
      reason: inv.occurrence_type,
      note: inv.observation?.trim() || null,
      waiting: false,
    });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);
}

async function loadActivity(): Promise<DriverActivity[]> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];
  const since = getDayBoundsUTC(getTodayBrazil()).start;

  const [invoicesRes, occurrencesRes, driversRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .eq("tenant_id", tenantId)
      .or(`arrived_at.gte.${since},delivered_at.gte.${since},and(status.eq.occurrence,updated_at.gte.${since})`)
      .limit(500),
    readDeliveryOccurrences<OccurrenceRow>((typeColumn) =>
      supabase
        .from("delivery_occurrences")
        .select(`id, created_at, driver_id, invoice_id, ${typeColumn}, description`)
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT),
    ),
    supabase.from("drivers").select("id, name, photo_url, photo, avatar").eq("tenant_id", tenantId),
  ]);
  if (invoicesRes.error) throw invoicesRes.error;
  // Sem o detalhe das ocorrencias a lista segue com chegadas, entregas e o status das notas.
  if (occurrencesRes.error) console.warn("Ocorrências fora do feed:", occurrencesRes.error);

  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[];
  const occurrences = occurrencesRes.data;
  // Notas das ocorrencias que nao vieram na busca do dia (ex.: sem chegada registrada)
  const known = new Set(invoices.map((inv) => inv.id));
  const missing = [...new Set(occurrences.map((o) => o.invoice_id).filter((id): id is string => !!id && !known.has(id)))];
  if (missing.length > 0) {
    const { data } = await supabase.from("invoices").select(INVOICE_COLUMNS).in("id", missing);
    // Entram so para dar numero e cliente as ocorrencias (chegada/entrega antigas ficam de fora pela data)
    invoices.push(...((data ?? []) as unknown as InvoiceRow[]));
  }

  const drivers = new Map<string, { name: string; photo: string | null }>();
  for (const d of driversRes.data ?? []) drivers.set(d.id, { name: d.name, photo: d.photo_url || d.photo || d.avatar || null });

  return buildActivity(invoices, occurrences, drivers, since);
}

/** Linha do tempo dos motoristas hoje, compartilhada pelo feed e pelo mapa. */
export function useDriverActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const query = useQuery({ queryKey: ["driver-activity", userId], queryFn: loadActivity, enabled: !!userId, staleTime: 30 * 1000 });

  useEffect(() => {
    if (!userId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["driver-activity", userId] });
    const offs = [onTableChange("invoices", refresh, 800), onTableChange("delivery_occurrences", refresh, 800)];
    return () => offs.forEach((off) => off());
  }, [queryClient, userId]);

  const events = useMemo(() => query.data ?? [], [query.data]);
  // Motoristas cuja ultima atualizacao foi uma ocorrencia (marcador vermelho no mapa)
  const withOccurrence = useMemo(() => {
    const latest = new Map<string, DriverActivityKind>();
    for (const event of events) if (event.driverId && !latest.has(event.driverId)) latest.set(event.driverId, event.kind);
    return new Set([...latest].filter(([, kind]) => kind === "occurrence").map(([id]) => id));
  }, [events]);

  return { events, withOccurrence, isLoading: query.isLoading, isError: query.isError };
}
