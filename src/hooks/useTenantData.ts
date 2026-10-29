import { useState, useEffect, useCallback } from 'react';
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
}

export function useTenantData() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTenant = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const { data: membership } = await supabase
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership?.tenant_id) return;

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', membership.tenant_id)
        .single();

      if (error) throw error;

      setTenant({
        id: data.id,
        razao_social: data.razao_social,
        cnpj: data.cnpj,
        telefone: (data as any).telefone ?? null,
        logradouro: (data as any).logradouro ?? null,
        numero: (data as any).numero ?? null,
        bairro: (data as any).bairro ?? null,
        cidade: (data as any).cidade ?? null,
        uf: (data as any).uf ?? null,
        cep: (data as any).cep ?? null,
        latitude: (data as any).latitude ?? null,
        longitude: (data as any).longitude ?? null,
        plan: data.plan,
        status: data.status,
        next_due_date: data.next_due_date ?? null,
      });
    } catch (err: any) {
      console.error('Error fetching tenant:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const updateTenant = async (updates: Partial<Omit<TenantData, 'id' | 'plan' | 'status'>>) => {
    if (!tenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update(updates as any)
        .eq('id', tenant.id);

      if (error) throw error;

      setTenant(prev => prev ? { ...prev, ...updates } : null);

      toast({
        title: 'Dados da empresa salvos',
        description: 'As informações foram atualizadas com sucesso.',
      });
    } catch (err: any) {
      console.error('Error updating tenant:', err);
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar os dados.',
        variant: 'destructive',
      });
    }
  };

  return { tenant, isLoading, updateTenant, refetch: fetchTenant };
}
