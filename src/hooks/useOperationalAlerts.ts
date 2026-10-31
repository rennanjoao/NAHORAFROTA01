import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readDeliveryOccurrences } from "@/lib/deliveryOccurrences";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime";
import { plateText } from "@/lib/vehicles";
import { getOccurrenceLabel } from "@/hooks/useSLADB";

export type OperationalAlertKind = "delivery" | "vehicle";

export interface OperationalAlert {
  id: string;
  kind: OperationalAlertKind;
  severity: "critical" | "high" | "medium";
  title: string;
  message: string;
  createdAt: Date;
  href: string;
}

// Ocorrencias abertas pelo app do motorista (OccurrenceModal).
const VEHICLE_OCCURRENCE_LABELS: Record<string, string> = {
  accident: "Acidente",
  delay: "Atraso",
  mechanical: "Problema mecânico",
  other: "Outro problema",
};

const WINDOW_HOURS = 48;
const LIMIT = 20;

const storageKey = (userId: string) => `nahora:alerts-read:${userId}`;

interface ReadState {
  seenAt: number;
  ids: string[];
}

function loadReadState(userId: string): ReadState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { seenAt: Number(parsed.seenAt) || 0, ids: Array.isArray(parsed.ids) ? parsed.ids : [] };
    }
  } catch {
    // Sem armazenamento local: tudo aparece como nao lido.
  }
  return { seenAt: 0, ids: [] };
}

function saveReadState(userId: string, state: ReadState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Ignora: a leitura so nao fica lembrada.
  }
}

async function fetchAlerts(): Promise<OperationalAlert[]> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const [deliveryRes, vehicleRes] = await Promise.all([
    readDeliveryOccurrences<{ id: string; invoice_id: string | null; driver_id: string | null; occurrence_type: string; description: string | null; created_at: string }>((typeColumn) =>
      supabase
        .from("delivery_occurrences")
        .select(`id, invoice_id, driver_id, ${typeColumn}, description, created_at`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    supabase
      .from("driver_occurrences")
      .select("id, driver_id, type, description, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  const deliveryRows = deliveryRes.data;
  const vehicleRows = vehicleRes.data || [];

  const invoiceIds = [...new Set(deliveryRows.map((r) => r.invoice_id).filter(Boolean))] as string[];
  const driverIds = [
    ...new Set([...deliveryRows, ...vehicleRows].map((r) => r.driver_id).filter(Boolean)),
  ] as string[];

  const [invoicesRes, driversRes] = await Promise.all([
    invoiceIds.length
      ? supabase.from("invoices").select("id, nfe_number, recipient_name").in("id", invoiceIds)
      : Promise.resolve({ data: [] as { id: string; nfe_number: string | null; recipient_name: string | null }[] }),
    driverIds.length
      ? supabase.from("drivers").select("id, name, vehicle_plate").in("id", driverIds)
      : Promise.resolve({ data: [] as { id: string; name: string; vehicle_plate: string | null }[] }),
  ]);

  const invoices = new Map((invoicesRes.data || []).map((i) => [i.id, i]));
  const drivers = new Map((driversRes.data || []).map((d) => [d.id, d]));

  const alerts: OperationalAlert[] = [];

  for (const row of deliveryRows) {
    const invoice = row.invoice_id ? invoices.get(row.invoice_id) : undefined;
    const driver = row.driver_id ? drivers.get(row.driver_id) : undefined;
    const nf = invoice?.nfe_number ? `NF ${invoice.nfe_number}` : "Entrega";
    alerts.push({
      id: `delivery-${row.id}`,
      kind: "delivery",
      severity: "high",
      title: `${nf}: ${getOccurrenceLabel(row.occurrence_type)}`,
      message: [invoice?.recipient_name, driver?.name, row.description].filter(Boolean).join(" • "),
      createdAt: new Date(row.created_at),
      href: invoice?.nfe_number ? `/deliveries?q=${encodeURIComponent(invoice.nfe_number)}` : "/deliveries?status=occurrence",
    });
  }

  for (const row of vehicleRows) {
    const driver = row.driver_id ? drivers.get(row.driver_id) : undefined;
    const label = VEHICLE_OCCURRENCE_LABELS[row.type] || getOccurrenceLabel(row.type);
    const plate = plateText(driver?.vehicle_plate);
    alerts.push({
      id: `vehicle-${row.id}`,
      kind: "vehicle",
      severity: row.type === "accident" || row.type === "mechanical" ? "critical" : "medium",
      title: `${label}${plate ? ` • ${plate}` : ""}`,
      message: [driver?.name, row.description].filter(Boolean).join(" • "),
      createdAt: new Date(row.created_at),
      href: driver?.name ? `/drivers?q=${encodeURIComponent(driver.name)}` : "/drivers",
    });
  }

  return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, LIMIT);
}

/**
 * Alertas do sino: ocorrencias de entrega e de veiculo registradas pelos
 * motoristas nas ultimas 48h, atualizadas em tempo real. A leitura fica
 * guardada por usuario neste navegador.
 */
export function useOperationalAlerts() {
  const { user, roles, isDriverUser } = useAuth();
  const userId = user?.id ?? null;
  const isStaff = !isDriverUser && roles.some((r) => r === "admin" || r === "fleet_manager" || r === "dispatcher");
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [readState, setReadState] = useState<ReadState>({ seenAt: 0, ids: [] });

  useEffect(() => {
    if (userId) setReadState(loadReadState(userId));
  }, [userId]);

  const refresh = useCallback(async () => {
    try {
      setAlerts(await fetchAlerts());
    } catch (error) {
      console.error("Error loading alerts:", error);
    }
  }, []);

  useEffect(() => {
    if (!userId || !isStaff) {
      setAlerts([]);
      return;
    }

    refresh();
    const channel = supabase
      .channel(uniqueChannelName("operational-alerts"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_occurrences" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_occurrences" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isStaff, refresh]);

  const isUnread = useCallback(
    (alert: OperationalAlert) => alert.createdAt.getTime() > readState.seenAt && !readState.ids.includes(alert.id),
    [readState],
  );

  const unreadCount = useMemo(() => alerts.filter(isUnread).length, [alerts, isUnread]);

  const update = (next: ReadState) => {
    setReadState(next);
    if (userId) saveReadState(userId, next);
  };

  const markAsRead = (id: string) => {
    if (readState.ids.includes(id)) return;
    // Guarda so ids ainda dentro da janela para a lista nao crescer sem fim.
    const visible = new Set(alerts.map((a) => a.id));
    update({ seenAt: readState.seenAt, ids: [...readState.ids.filter((x) => visible.has(x)), id] });
  };

  const markAllAsRead = () => update({ seenAt: Date.now(), ids: [] });

  return { alerts, unreadCount, isUnread, markAsRead, markAllAsRead, refresh, enabled: isStaff };
}
