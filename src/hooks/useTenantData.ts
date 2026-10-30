import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentTenantId } from '@/lib/tenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TenantData {
  id: string;
  razao_social: string;
  cnpj: string;
  telefone: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  plan: string;
  status: string;
  next_due_date: string | null;
  /** Logo da empresa (romaneio impresso). */
  logo_url: string | null;
  /** So paga agregado mediante nota fiscal? null = nao respondeu; undefined = banco sem a pergunta. */
  pays_only_with_invoice?: boolean | null;
}

async function fetchTenantRow(): Promise<TenantData | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
  if (error) throw error;
  return {
    id: data.id,
    razao_social: data.razao_social,
    cnpj: data.cnpj,
    telefone: data.telefone ?? null,
    logradouro: data.logradouro ?? null,
    numero: data.numero ?? null,
    bairro: data.bairro ?? null,
    cidade: data.cidade ?? null,
    uf: data.uf ?? null,
    cep: data.cep ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    plan: data.plan,
    status: data.status,
    next_due_date: data.next_due_date ?? null,
    logo_url: data.logo_url ?? null,
    pays_only_with_invoice: "pays_only_with_invoice" in data ? data.pays_only_with_invoice : undefined,
  };
}

/** Dados da empresa: uma busca so, compartilhada por todas as telas (antes cada uma buscava a sua). */
export function useTenantData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['tenant-data', user?.id];
  const query = useQuery({ queryKey: key, queryFn: fetchTenantRow, enabled: !!user, staleTime: 5 * 60 * 1000 });
  const tenant = query.data ?? null;
  const setTenant = (fn: (prev: TenantData | null) => TenantData | null) => queryClient.setQueryData<TenantData | null>(key, (prev) => fn(prev ?? null));

  const updateTenant = async (updates: Partial<Omit<TenantData, 'id' | 'plan' | 'status'>>) => {
    if (!tenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenant.id);

      if (error) throw error;

      setTenant(prev => prev ? { ...prev, ...updates } : null);

      toast({
        title: 'Dados da empresa salvos',
        description: 'As informações foram atualizadas com sucesso.',
      });
    } catch (err) {
      console.error('Error updating tenant:', err);
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Não foi possível salvar os dados.',
        variant: 'destructive',
      });
    }
  };

  return { tenant, isLoading: query.isLoading, updateTenant, refetch: query.refetch };
}
