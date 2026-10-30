import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getDayBoundsUTC, getTodayBrazil, toDateStringBrazil } from "@/lib/timezone";
import { getInvoiceEventDate } from "@/lib/reportFilters";
import { getCurrentTenantId } from "@/lib/tenant";
import { onTableChange } from "@/lib/sharedRealtime";

export interface TodayInvoice {
  id: string;
  nfe_number: string | null;
  recipient_name: string;
  address_full: string;
  status: string;
  driver_id: string | null;
}

export interface TodayInvoices {
  pending: TodayInvoice[];
  inRoute: TodayInvoice[];
  delivered: TodayInvoice[];
  /** Com ocorrencia ou devolvidas hoje. */
  occurrence: TodayInvoice[];
}

const EMPTY: TodayInvoices = { pending: [], inRoute: [], delivered: [], occurrence: [] };

async function loadTodayInvoices(): Promise<TodayInvoices> {
  // NFs em operacao (pendentes/em rota) + as finalizadas hoje.
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return EMPTY;
  const todayStart = getDayBoundsUTC(getTodayBrazil()).start;
  const { data, error } = await supabase
    .from("invoices")
    .select("id, nfe_number, recipient_name, address_full, status, driver_id, delivered_at, updated_at, imported_at")
    .eq("tenant_id", tenantId)
    .or(`status.in.(pending,in_transit),updated_at.gte.${todayStart}`)
    .order("imported_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const finishedToday = (inv: (typeof data)[number]) => toDateStringBrazil(getInvoiceEventDate(inv)) === getTodayBrazil();
  return {
    pending: data.filter((i) => i.status === "pending"),
    inRoute: data.filter((i) => i.status === "in_transit"),
    delivered: data.filter((i) => i.status === "delivered" && finishedToday(i)),
    occurrence: data.filter((i) => (i.status === "returned" || i.status === "occurrence") && finishedToday(i)),
  };
}

/** Notas de hoje por situacao, compartilhadas pelo mapa e pelas janelas do Inicio. */
export function useTodayInvoices() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["today-invoices", user?.id];
  const query = useQuery({ queryKey: key, queryFn: loadTodayInvoices, enabled: !!user, staleTime: 30 * 1000 });

  // Tempo real pelo canal compartilhado (rajadas viram uma recarga so)
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    return onTableChange("invoices", () => void queryClient.invalidateQueries({ queryKey: ["today-invoices", userId] }));
  }, [queryClient, userId]);

  return { data: query.data ?? EMPTY, isLoading: query.isLoading };
}
