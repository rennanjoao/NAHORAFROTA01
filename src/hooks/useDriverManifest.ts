import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from '@/contexts/AuthContext';
import { resolveDriverForUser } from '@/lib/driverIdentity';

const FINISHED_STATUSES = new Set(['delivered', 'returned', 'occurrence']);

function sortByRouteOrder<T extends { status: string; route_sequence?: number | null; nfe_number?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const finishedA = FINISHED_STATUSES.has(a.status) ? 1 : 0;
    const finishedB = FINISHED_STATUSES.has(b.status) ? 1 : 0;
    if (finishedA !== finishedB) return finishedA - finishedB;
    const seqA = a.route_sequence ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.route_sequence ?? Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    return String(a.nfe_number || '').localeCompare(String(b.nfe_number || ''), 'pt-BR', { numeric: true });
  });
}

export interface DriverDelivery {
  id: string;
  recipient_name: string;
  address_full: string;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  nfe_number: string | null;
  arrived_at: string | null;
}

export interface DriverManifest {
  id: string;
  manifest_code: string;
  manifest_number: number | null;
  status: string;
  deliveries_count: number;
  total_value: number | null;
  total_weight: number | null;
  scheduled_date: string;
  driver_name: string;
  vehicle_plate: string | null;
}

interface UseDriverManifestReturn {
  manifest: DriverManifest | null;
  deliveries: DriverDelivery[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markDelivered: (deliveryId: string) => Promise<void>;
  markArrived: (deliveryId: string, arrivedAt: string) => void;
}

export function useDriverManifest(): UseDriverManifestReturn {
  const { user } = useAuth();
  const [manifest, setManifest] = useState<DriverManifest | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManifestAndDeliveries = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const driverData = await resolveDriverForUser(user);
      if (!driverData?.id) {
        setManifest(null);
        setDeliveries([]);
        return;
      }
      const driverId = driverData.id;

      // Fetch active manifest for this driver
      const { data: manifestData, error: manifestError } = await supabase
        .from('manifests')
        .select(`
          id,
          manifest_code,
          manifest_number,
          status,
          deliveries_count,
          total_value,
          total_weight,
          scheduled_date,
          driver_name,
          vehicle_plate
        `)
        .eq('driver_id', driverId)
        .not('status', 'in', '("completed","paid","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (manifestError) throw manifestError;

      setManifest(manifestData);

      // If we have a manifest, fetch ALL its invoices (including those with occurrences)
      // Only exclude "delivered" with success - show everything else
      if (manifestData?.id) {
        const baseColumns = 'id, recipient_name, address_full, address_street, address_number, address_city, latitude, longitude, status, nfe_number';
        const fetchInvoices = (columns: string) =>
          supabase
            .from('invoices')
            .select(columns)
            .eq('manifest_id', manifestData.id);

        let { data: invoicesData, error: invoicesError } = await fetchInvoices(`${baseColumns}, arrived_at, route_sequence`);

        // Banco ainda sem arrived_at/route_sequence (migration pendente): segue sem elas.
        if (invoicesError?.code === '42703') {
          ({ data: invoicesData, error: invoicesError } = await fetchInvoices(baseColumns));
        }

        if (invoicesError) throw invoicesError;

        // Show ALL invoices in this manifest - no date or occurrence filtering
        // Abertas primeiro, na ordem da roteirizacao; finalizadas no fim.
        // (Antes ordenava por status em ordem alfabetica: "delivered" vinha primeiro.)
        setDeliveries(
          sortByRouteOrder(
            ((invoicesData || []) as unknown as Array<Omit<DriverDelivery, 'arrived_at'> & { arrived_at?: string | null; route_sequence?: number | null }>)
              .map(invoice => ({ ...invoice, arrived_at: invoice.arrived_at ?? null }))
          )
        );
      } else {
        setDeliveries([]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar romaneio:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Mark a delivery as delivered
  const markDelivered = useCallback(async (deliveryId: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'delivered',
          occurrence_type: null,
          delivered_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      if (error) throw error;

      // Update local state
      setDeliveries(prev => 
        prev.map(d => d.id === deliveryId ? { ...d, status: 'delivered' } : d)
      );
    } catch (err: any) {
      console.error('Erro ao marcar entrega:', err);
      throw err;
    }
  }, []);

  // Chegada registrada pelo raio de 100 m (atualizacao local, sem refetch)
  const markArrived = useCallback((deliveryId: string, arrivedAt: string) => {
    setDeliveries(prev =>
      prev.map(d => d.id === deliveryId ? { ...d, arrived_at: arrivedAt } : d)
    );
  }, []);

  useEffect(() => {
    fetchManifestAndDeliveries();
  }, [fetchManifestAndDeliveries]);

  // Subscribe to realtime changes for manifests (new manifest assigned to driver)
  useEffect(() => {
    if (!user) return;

    // Get the driver_id for this user
    const setupManifestSubscription = async () => {
      const driverData = await resolveDriverForUser(user);
      if (!driverData?.id) return null;
      const driverId = driverData.id;

      // Subscribe to manifest changes for this driver
      const channel = supabase
        .channel(uniqueChannelName("driver-manifest-updates"))
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'manifests',
            filter: `driver_id=eq.${driverId}`,
          },
          () => {
            console.log('[Realtime] Manifest updated, refreshing...');
            fetchManifestAndDeliveries();
          }
        )
        .subscribe();

      return channel;
    };

    // Se o efeito for desfeito antes da assinatura ficar pronta, remove o canal
    // assim que ele chegar (antes ficava aberto para sempre).
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    setupManifestSubscription().then(ch => {
      if (cancelled) {
        if (ch) supabase.removeChannel(ch);
        return;
      }
      channel = ch;
    });

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, fetchManifestAndDeliveries]);

  // Subscribe to realtime changes for invoices (delivery status updates)
  useEffect(() => {
    if (!manifest?.id) return;

    const channel = supabase
      .channel(uniqueChannelName("driver-invoice-changes"))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `manifest_id=eq.${manifest.id}`,
        },
        () => {
          console.log('[Realtime] Invoice updated, refreshing...');
          fetchManifestAndDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [manifest?.id, fetchManifestAndDeliveries]);

  return {
    manifest,
    deliveries,
    isLoading,
    error,
    refetch: fetchManifestAndDeliveries,
    markDelivered,
    markArrived,
  };
}
