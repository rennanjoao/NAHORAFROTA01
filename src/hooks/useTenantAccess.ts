import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantAccess } from "@/lib/billingStatus";

export const TENANT_ACCESS_QUERY_KEY = "tenant-access";

async function fetchTenantAccess(): Promise<TenantAccess | null> {
  const { data, error } = await supabase.rpc("get_my_tenant_access");
  if (error) throw error;
  const payload = typeof data === "string" ? JSON.parse(data) : data;
  return (payload as unknown as TenantAccess) ?? null;
}

/**
 * Estado de acesso da empresa do usuario logado (trial, ativo, bloqueado...).
 * Compartilhado via react-query para nao repetir a consulta a cada rota.
 */
export function useTenantAccess() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [TENANT_ACCESS_QUERY_KEY, user?.id],
    queryFn: fetchTenantAccess,
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    access: query.data ?? null,
    isLoading: !!user && query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
