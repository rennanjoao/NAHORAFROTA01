import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { onTableChange } from "@/lib/sharedRealtime";
import type { ProviderInvoice } from "@/lib/providerInvoices";

/** Notas fiscais dos agregados TAC: todas da empresa (acerto) ou so as de um motorista. */
export function useProviderInvoices(filter: { driverId?: string | null } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["provider-invoices", user?.id, filter.driverId ?? null];
  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ProviderInvoice[]> => {
      let request = supabase.from("provider_invoices").select("*").order("created_at", { ascending: false }).limit(500);
      if (filter.driverId) request = request.eq("driver_id", filter.driverId);
      const { data, error } = await request;
      // Banco sem a atualizacao ainda: sem notas (a tela continua funcionando).
      if (error) return [];
      return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount), expected_amount: Number(row.expected_amount) })) as ProviderInvoice[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    return onTableChange("provider_invoices", () => void queryClient.invalidateQueries({ queryKey: ["provider-invoices"] }), 600);
  }, [queryClient, user?.id]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["provider-invoices"] });
  return { invoices: query.data ?? [], isLoading: query.isLoading, refresh };
}
