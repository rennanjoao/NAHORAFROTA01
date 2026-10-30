/**
 * Hook for fetching drivers from database with realtime sync
 * Used by manifest/romaneio creation to get active drivers
 * Includes availability check based on open manifests
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { getCurrentTenantId } from "@/lib/tenant";

export interface DBDriver {
  id: string;
  user_id?: string;
  name: string;
  cpf: string;
  phone: string;
  avatar: string;
  photo?: string;
  address?: string;
  vehicle_plate: string;
  vehicle_type: string;
  cnh: string;
  cnh_category: string;
  status: string;
  current_delay?: number;
  individual_sla?: number;
  daily_sla?: number;
  deliveries_completed?: number;
  total_deliveries?: number;
  is_own_fleet?: boolean;
  finished_time?: string;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string | null;
  chave_pix?: string | null;
  /** Transportadora que recebe pelo motorista (null = recebe direto, TAC). */
  carrier_id?: string | null;
  created_at: string;
  updated_at: string;
  // Computed field: does driver have an open manifest?
  hasOpenManifest?: boolean;
  openManifestId?: string;
  openManifestCode?: string;
}

/**
 * Motoristas com romaneio aberto e NF em rota (para nao escalar quem ja esta na rua).
 * Duas consultas simples em vez de "manifests!inner(...)": o embutido depende de uma
 * chave estrangeira invoices -> manifests que o banco de producao pode nao ter, e ai a
 * consulta falhava calada e todo motorista aparecia livre.
 */
async function loadOpenManifestsByDriver(tenantId: string): Promise<Map<string, { id: string; code: string }>> {
  const { data: inTransit, error: invoicesError } = await supabase
    .from("invoices")
    .select("driver_id, manifest_id")
    .eq("tenant_id", tenantId)
    .eq("status", "in_transit")
    .not("driver_id", "is", null)
    .not("manifest_id", "is", null);
  if (invoicesError) throw invoicesError;
  const manifestIds = [...new Set((inTransit || []).map((i) => i.manifest_id as string))];
  const byDriver = new Map<string, { id: string; code: string }>();
  if (manifestIds.length === 0) return byDriver;
  const { data: open, error: manifestsError } = await supabase
    .from("manifests")
    .select("id, manifest_code, status")
    .eq("tenant_id", tenantId)
    .in("id", manifestIds)
    .not("status", "in", '("completed","cancelled","paid")');
  if (manifestsError) throw manifestsError;
  const openById = new Map((open || []).map((m) => [m.id, m]));
  for (const inv of inTransit || []) {
    const m = openById.get(inv.manifest_id as string);
    if (inv.driver_id && m) byDriver.set(inv.driver_id, { id: m.id, code: m.manifest_code });
  }
  return byDriver;
}

export function useDBDrivers() {
  const [drivers, setDrivers] = useState<DBDriver[]>([]);
  const [driversWithOpenManifests, setDriversWithOpenManifests] = useState<Set<string>>(new Set());
  const [openManifestsByDriver, setOpenManifestsByDriver] = useState<Map<string, { id: string; code: string }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch drivers with open manifests
  const fetchOpenManifests = useCallback(async () => {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return;

      const manifestMap = await loadOpenManifestsByDriver(tenantId);
      setDriversWithOpenManifests(new Set(manifestMap.keys()));
      setOpenManifestsByDriver(manifestMap);
    } catch (err: any) {
      console.error("Error fetching open manifests:", err);
    }
  }, []);

  // Fetch all active drivers (exclude inactive from selection lists).
  // The routing flow needs the latest registration data (CPF, CNH and vehicle),
  // so we read directly from the drivers table.
  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setDrivers([]);
        return;
      }

      // Fetch active and in_route drivers. In_route without an invoice in transit is treated as available below.
      const columns = "id, user_id, name, cpf, phone, avatar, photo_url, vehicle_plate, vehicle_type, cnh, cnh_category, status, current_delay, individual_sla, daily_sla, deliveries_completed, total_deliveries, is_own_fleet, finished_time, banco, agencia, conta, tipo_conta, chave_pix, created_at, updated_at";
      const queryDrivers = (select: string) =>
        supabase
          .from("drivers")
          .select(select)
          .eq("tenant_id", tenantId)
          .in("status", ["active", "in_route"]) // Exclude inactive drivers from selection
          .order("name", { ascending: true });
      const [firstDriversResult, manifestsResult] = await Promise.all([
        queryDrivers(`${columns}, carrier_id`),
        loadOpenManifestsByDriver(tenantId).catch((err) => {
          console.error("Error fetching open manifests:", err);
          return new Map<string, { id: string; code: string }>();
        }),
      ]);

      // Banco ainda sem a coluna da transportadora (atualizacao nao rodada): busca sem ela.
      const missingColumn = firstDriversResult.error?.code === "42703" || /carrier_id/.test(firstDriversResult.error?.message ?? "");
      const driversResult = missingColumn ? await queryDrivers(columns) : firstDriversResult;
      if (driversResult.error) throw driversResult.error;

      // Map database rows to the selector shape.
      const mappedDrivers: DBDriver[] = (driversResult.data || []).map((d: any) => ({
        id: d.id,
        user_id: d.user_id || undefined,
        name: d.name || '',
        cpf: d.cpf || '',
        phone: d.phone || '',
        avatar: d.avatar || '',
        photo: d.photo_url,
        vehicle_plate: d.vehicle_plate || '',
        vehicle_type: d.vehicle_type || '',
        cnh: d.cnh || '',
        cnh_category: d.cnh_category || '',
        status: d.status || 'active',
        current_delay: d.current_delay,
        individual_sla: d.individual_sla,
        daily_sla: d.daily_sla,
        deliveries_completed: d.deliveries_completed,
        total_deliveries: d.total_deliveries,
        is_own_fleet: d.is_own_fleet,
        finished_time: d.finished_time,
        banco: d.banco,
        agencia: d.agencia,
        conta: d.conta,
        tipo_conta: d.tipo_conta,
        chave_pix: d.chave_pix,
        carrier_id: d.carrier_id ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));

      // Process open manifests
      const manifestMap = manifestsResult;
      setDriversWithOpenManifests(new Set(manifestMap.keys()));
      setOpenManifestsByDriver(manifestMap);
      setDrivers(mappedDrivers);
    } catch (err: any) {
      console.error("Error fetching drivers:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to realtime changes on drivers and manifests
  useEffect(() => {
    fetchDrivers();

    // Drivers realtime subscription
    const driversChannel = supabase
      .channel(uniqueChannelName("db-drivers-realtime-sync"))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        (payload) => {
          console.log('📡 Driver DB update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newDriver = payload.new as DBDriver;
            if (newDriver.status === 'active' || newDriver.status === 'in_route') {
              setDrivers((prev) => [...prev, newDriver].sort((a, b) => a.name.localeCompare(b.name)));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedDriver = payload.new as DBDriver;
            setDrivers((prev) => {
              if (!["active", "in_route"].includes(updatedDriver.status)) {
                return prev.filter((d) => d.id !== updatedDriver.id);
              }
              const exists = prev.some((d) => d.id === updatedDriver.id);
              if (exists) {
                return prev.map((d) => (d.id === updatedDriver.id ? updatedDriver : d));
              } else {
                return [...prev, updatedDriver].sort((a, b) => a.name.localeCompare(b.name));
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setDrivers((prev) => prev.filter((d) => d.id !== deletedId));
          }
        }
      )
      .subscribe();

    // Manifests realtime subscription - track open manifests
    const manifestsChannel = supabase
      .channel(uniqueChannelName("db-manifests-availability-sync"))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manifests' },
        (payload) => {
          console.log('📡 Manifest update for availability:', payload.eventType);
          // Refetch open manifests when any manifest changes
          fetchOpenManifests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driversChannel);
      supabase.removeChannel(manifestsChannel);
    };
  }, [fetchDrivers, fetchOpenManifests]);

  // Compute drivers with availability info
  const driversWithAvailability = useMemo(() => {
    return drivers.map((driver) => {
      const manifestInfo = openManifestsByDriver.get(driver.id);
      return {
        ...driver,
        hasOpenManifest: driversWithOpenManifests.has(driver.id),
        openManifestId: manifestInfo?.id,
        openManifestCode: manifestInfo?.code,
      };
    });
  }, [drivers, driversWithOpenManifests, openManifestsByDriver]);

  // Available drivers (no open manifests)
  const availableDrivers = useMemo(() => {
    return driversWithAvailability.filter((d) => !d.hasOpenManifest);
  }, [driversWithAvailability]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  return {
    drivers: driversWithAvailability,
    availableDrivers,
    driversWithOpenManifests,
    isLoading,
    error,
    refetch,
  };
}
