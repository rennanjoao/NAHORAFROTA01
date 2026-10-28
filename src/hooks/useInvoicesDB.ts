import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getCurrentTenantId } from '@/lib/tenant';
import { fetchAllPages } from '@/lib/supabasePaging';

// Storage bucket name for invoice attachments (if any)
const INVOICE_ATTACHMENTS_BUCKET = 'invoice-attachments';

export interface DBInvoice {
  id: string;
  access_key: string;
  nfe_number: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  address_full: string;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  latitude: number | null;
  longitude: number | null;
  total_value: number;
  total_weight: number | null;
  volume_quantity: number | null;
  status: string;
  driver_id: string | null;
  manifest_id: string | null;
  observation: string | null;
  occurrence_type: string | null;
  imported_at: string;
  updated_at: string;
  imported_by: string | null;
  updated_by: string | null;
  regiao_logistica: string | null;
  receiver_name: string | null;
  receiver_document: string | null;
  delivered_at: string | null;
  arrived_at?: string | null;
  arrival_distance_m?: number | null;
  // Joined data for friendly display
  driver_name?: string | null;
  manifest_number?: number | null;
  manifest_driver_name?: string | null;
  manifest_created_at?: string | null;
}

export interface InvoiceFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
   regions?: string[];
}

export function useInvoicesDB() {
  const [invoices, setInvoices] = useState<DBInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (filters?: InvoiceFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setInvoices([]);
        return;
      }

      // First, fetch invoices (paginado: o Supabase devolve no maximo 1000 linhas por vez)
      const buildQuery = () => {
        let query = supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('imported_at', { ascending: false })
          .order('id', { ascending: true });

        // Apply filters
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        if (filters?.dateFrom) {
          query = query.gte('imported_at', filters.dateFrom.toISOString());
        }

        if (filters?.dateTo) {
          query = query.lte('imported_at', filters.dateTo.toISOString());
        }

        if (filters?.search) {
          query = query.or(`recipient_name.ilike.%${filters.search}%,nfe_number.ilike.%${filters.search}%,address_full.ilike.%${filters.search}%`);
        }

        if (filters?.regions && filters.regions.length > 0) {
          query = query.in('regiao_logistica', filters.regions);
        }

        return query;
      };

      const invoicesData = await fetchAllPages((from, to) => buildQuery().range(from, to));

      // Collect unique IDs for batch fetching related data
      const driverIds = [...new Set((invoicesData || []).map(inv => inv.driver_id).filter(Boolean))];
      const manifestIds = [...new Set((invoicesData || []).map(inv => inv.manifest_id).filter(Boolean))];

      // Fetch related data in parallel
      const [driversResult, manifestsResult] = await Promise.all([
        driverIds.length > 0 
          ? supabase.from('drivers').select('id, name').in('id', driverIds)
            .eq('tenant_id', tenantId)
          : { data: [] },
        manifestIds.length > 0 
          ? supabase.from('manifests').select('id, manifest_number, driver_name, created_at').in('id', manifestIds)
            .eq('tenant_id', tenantId)
          : { data: [] },
      ]);

      // Create lookup maps
      const driversMap = new Map((driversResult.data || []).map(d => [d.id, d.name]));
      const manifestsMap = new Map((manifestsResult.data || []).map(m => [m.id, m]));

      // Transform data with related info
      const transformedData: DBInvoice[] = (invoicesData || []).map((inv: any) => {
        const manifest = manifestsMap.get(inv.manifest_id);
        return {
          ...inv,
          driver_name: driversMap.get(inv.driver_id) || null,
          manifest_number: manifest?.manifest_number || null,
          manifest_driver_name: manifest?.driver_name || null,
          manifest_created_at: manifest?.created_at || null,
        };
      });

      setInvoices(transformedData);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Erro ao carregar notas fiscais');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();

    // Subscribe to realtime changes - refetch to get joined data
    const channel = supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => {
          // Refetch to ensure we have fresh joined data
          fetchInvoices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInvoices]);

  const updateInvoice = async (id: string, updates: Partial<DBInvoice>) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '✅ NF atualizada',
        description: 'Nota fiscal atualizada com sucesso.',
      });
    } catch (err: any) {
      console.error('Error updating invoice:', err);
      toast({
        title: 'Erro ao atualizar',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const updateInvoiceStatus = async (id: string, status: string, occurrenceType?: string, observation?: string) => {
    try {
      const updates: Partial<DBInvoice> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (occurrenceType) updates.occurrence_type = occurrenceType;
      if (observation) updates.observation = observation;

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '✅ Status atualizado',
        description: `NF alterada para ${status}.`,
      });
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast({
        title: 'Erro ao atualizar status',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const assignToManifest = async (invoiceIds: string[], manifestId: string, driverId: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          manifest_id: manifestId,
          driver_id: driverId,
          status: 'in_transit',
          updated_at: new Date().toISOString(),
        })
        .in('id', invoiceIds);

      if (error) throw error;

      toast({
        title: '✅ NFs atribuídas',
        description: `${invoiceIds.length} nota(s) atribuída(s) ao romaneio.`,
      });
    } catch (err: any) {
      console.error('Error assigning invoices:', err);
      toast({
        title: 'Erro ao atribuir',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const removeFromManifest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          manifest_id: null,
          driver_id: null,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '✅ NF removida do romaneio',
        description: 'A nota fiscal voltou para pendente.',
      });
    } catch (err: any) {
      console.error('Error removing from manifest:', err);
      toast({
        title: 'Erro ao remover',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      // First, get the invoice to check for any attachments
      const invoiceToDelete = invoices.find(inv => inv.id === id);
      
      // If there are any file attachments in storage, try to delete them
      // Currently invoices store xml_raw in the DB column, not in storage
      // But if there were files in a bucket, we would delete them here:
      if (invoiceToDelete) {
        try {
          // Attempt to delete any files associated with this invoice
          // Files would be stored with pattern: {invoice_id}/*
          const { data: files } = await supabase.storage
            .from(INVOICE_ATTACHMENTS_BUCKET)
            .list(id);
          
          if (files && files.length > 0) {
            const filePaths = files.map(f => `${id}/${f.name}`);
            await supabase.storage
              .from(INVOICE_ATTACHMENTS_BUCKET)
              .remove(filePaths);
          }
        } catch (storageError) {
          // Storage bucket may not exist or no files - continue with deletion
          console.log('No storage files to delete or bucket does not exist');
        }
      }

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '🗑️ NF removida',
        description: 'Nota fiscal excluída com sucesso.',
      });
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Stats
  const stats = {
    total: invoices.length,
    pending: invoices.filter(inv => inv.status === 'pending').length,
    inTransit: invoices.filter(inv => inv.status === 'in_transit').length,
    delivered: invoices.filter(inv => inv.status === 'delivered').length,
    occurrence: invoices.filter(inv => inv.status === 'occurrence').length,
    returning: invoices.filter(inv => inv.status === 'returning').length,
    returned: invoices.filter(inv => inv.status === 'returned').length,
    // Não roteirizadas: pendentes OU devolvidas, sem romaneio vinculado
    unrouted: invoices.filter(inv => 
      (inv.status === 'pending' || inv.status === 'returned') && 
      inv.manifest_id === null
    ).length,
  };

   // Stats por região
   const regionStats = useMemo(() => {
     const stats: Record<string, number> = {};
     invoices.forEach(inv => {
       const region = inv.regiao_logistica || 'Sem Região';
       stats[region] = (stats[region] || 0) + 1;
     });
     return stats;
   }, [invoices]);

   // Lista de regiões disponíveis
   const availableRegions = useMemo(() => {
     return [...new Set(invoices.map(inv => inv.regiao_logistica).filter(Boolean) as string[])];
   }, [invoices]);

  return {
    invoices,
    isLoading,
    error,
    stats,
     regionStats,
     availableRegions,
    refetch: fetchInvoices,
    updateInvoice,
    updateInvoiceStatus,
    assignToManifest,
    removeFromManifest,
    deleteInvoice,
  };
}
