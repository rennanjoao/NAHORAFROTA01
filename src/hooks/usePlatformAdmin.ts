import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllPages } from '@/lib/supabasePaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TenantData {
  id: string;
  razao_social: string;
  cnpj: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
  plan_started_at: string | null;
  contract_start_date?: string | null;
  payment_cycle?: string | null;
  next_due_date?: string | null;
  financial_status?: string | null;
  auto_block_days?: number | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_extensions?: number | null;
  converted_at?: string | null;
  billing_document?: string | null;
  billing_document_type?: string | null;
  telefone?: string | null;
  last_billing_notice?: BillingNoticeSummary | null;
  members_count?: number;
  system_users_count?: number;
  drivers_count?: number;
  admin_name?: string;
  admin_email?: string;
}

export interface BillingNoticeSummary {
  notice_type: string;
  reference_date: string;
  channel: string;
  shown_at: string;
  acknowledged_at: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * So a checagem "e Super Admin?", compartilhada (react-query). Telas comuns usam
 * esta: usePlatformAdmin() tambem carrega a lista completa de empresas.
 */
export function useIsPlatformAdmin() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['is-platform-admin', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
  });
  return { isPlatformAdmin: query.data ?? false, checking: !!user && query.isLoading };
}

export function usePlatformAdmin() {
  const { isPlatformAdmin, checking } = useIsPlatformAdmin();
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setIsLoading(true);
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Latest billing notice per tenant ("cobranca avisada")
      const { data: noticesData } = await supabase
        .from('billing_notices')
        .select('tenant_id, notice_type, reference_date, channel, shown_at, acknowledged_at, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      const latestNoticeByTenant = new Map<string, BillingNoticeSummary>();
      (noticesData || []).forEach((notice) => {
        if (!latestNoticeByTenant.has(notice.tenant_id)) latestNoticeByTenant.set(notice.tenant_id, notice);
      });

      // Contagens em lote (antes eram ~6 consultas por empresa).
      const [memberships, driverRows, roleRows] = await Promise.all([
        fetchAllPages((from, to) =>
          supabase.from('tenant_memberships').select('tenant_id, user_id, role').order('user_id').range(from, to)
        ),
        fetchAllPages((from, to) =>
          supabase.from('drivers').select('id, tenant_id').order('id').range(from, to)
        ),
        fetchAllPages((from, to) =>
          supabase.from('user_roles').select('user_id, role').order('user_id').range(from, to)
        ),
      ]);

      const systemRoles = new Set(['admin', 'dispatcher', 'fleet_manager', 'manager', 'owner']);
      const systemUserIds = new Set(
        (roleRows as Array<{ user_id: string; role: string }>)
          .filter((r) => systemRoles.has(r.role))
          .map((r) => r.user_id)
      );

      const adminUserIds = [
        ...new Set(
          (memberships as Array<{ tenant_id: string; user_id: string; role: string }>)
            .filter((m) => m.role === 'admin')
            .map((m) => m.user_id)
        ),
      ];
      const profilesById = new Map<string, { name: string | null; email: string | null }>();
      for (let i = 0; i < adminUserIds.length; i += 200) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', adminUserIds.slice(i, i + 200));
        (profiles || []).forEach((p) => profilesById.set(p.id, { name: p.name, email: p.email }));
      }

      const enriched: TenantData[] = (tenantsData || []).map((t) => {
        const tenantMembers = (memberships as Array<{ tenant_id: string; user_id: string; role: string }>).filter(
          (m) => m.tenant_id === t.id
        );
        const adminMember = tenantMembers.find((m) => m.role === 'admin');
        const adminProfile = adminMember ? profilesById.get(adminMember.user_id) : undefined;
        return {
          ...t,
          last_billing_notice: latestNoticeByTenant.get(t.id) || null,
          members_count: tenantMembers.length,
          system_users_count: tenantMembers.filter((m) => systemUserIds.has(m.user_id)).length,
          drivers_count: (driverRows as Array<{ tenant_id: string | null }>).filter((d) => d.tenant_id === t.id).length,
          admin_name: adminProfile?.name || '',
          admin_email: adminProfile?.email || '',
        };
      });

      setTenants(enriched);
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (isPlatformAdmin) fetchTenants();
  }, [isPlatformAdmin, fetchTenants]);

  const updateTenantStatus = async (tenantId: string, status: string) => {
    const { error } = await supabase
      .from('tenants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tenantId);
    
    // When activating a tenant, ensure all members have user_roles
    if (!error && status === 'active') {
      try {
        // Get all members of this tenant
        const { data: members } = await supabase
          .from('tenant_memberships')
          .select('user_id, role')
          .eq('tenant_id', tenantId);

        if (members && members.length > 0) {
          // Check which members already have user_roles
          const userIds = members.map(m => m.user_id);
          const { data: existingRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('user_id', userIds);

          const usersWithRoles = new Set((existingRoles || []).map(r => r.user_id));

          // Create missing user_roles
          const missingRoles = members
            .filter(m => !usersWithRoles.has(m.user_id))
            .map(m => ({
              user_id: m.user_id,
              role: (m.role === 'admin' ? 'admin' : 'viewer') as 'admin' | 'fleet_manager' | 'dispatcher' | 'viewer',
              tenant_id: tenantId,
            }));

          if (missingRoles.length > 0) {
            await supabase.from('user_roles').insert(missingRoles);
            console.log(`[MASTER] Auto-assigned roles for ${missingRoles.length} user(s) in tenant ${tenantId}`);
          }
        }
      } catch (roleErr) {
        console.error('[MASTER] Error auto-assigning roles:', roleErr);
      }
    }

    if (!error) fetchTenants();
    return { error };
  };

  const updateTenantPlan = async (tenantId: string, plan: string) => {
    const { error } = await supabase
      .from('tenants')
      .update({ plan, plan_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', tenantId);
    if (!error) fetchTenants();
    return { error };
  };

  const extendTrial = async (tenantId: string, days = 7) => {
    const { error } = await supabase.rpc('extend_tenant_trial', { p_tenant_id: tenantId, p_days: days });
    if (!error) fetchTenants();
    return { error };
  };

  return {
    isPlatformAdmin,
    checking,
    tenants,
    isLoading,
    fetchTenants,
    updateTenantStatus,
    updateTenantPlan,
    extendTrial,
  };
}
