import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getCurrentTenantId } from "@/lib/tenant";
import { onTableChange } from "@/lib/sharedRealtime";

export type Carrier = Tables<"carriers">;

async function loadCarriers(): Promise<Carrier[]> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];
  const { data, error } = await supabase.from("carriers").select("*").eq("tenant_id", tenantId).order("razao_social");
  // Banco sem a atualizacao ainda: lista vazia (a tela avisa).
  if (error) return [];
  return data ?? [];
}

/** Transportadoras da empresa, compartilhadas pelo cadastro, motoristas e acerto. */
export function useCarriers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["carriers", user?.id], queryFn: loadCarriers, enabled: !!user, staleTime: 60 * 1000 });
  useEffect(() => {
    if (!user?.id) return;
    return onTableChange("carriers", () => void queryClient.invalidateQueries({ queryKey: ["carriers"] }));
  }, [queryClient, user?.id]);
  return {
    carriers: query.data ?? [],
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["carriers"] }),
  };
}

/** Nome curto da transportadora (fantasia, senao razao social). */
export const carrierName = (carrier?: Pick<Carrier, "nome_fantasia" | "razao_social"> | null) =>
  carrier ? carrier.nome_fantasia?.trim() || carrier.razao_social : "";
