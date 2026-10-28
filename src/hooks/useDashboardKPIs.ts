/**
 * Dashboard KPIs Hook - Real-time dashboard metrics
 * All KPIs are filtered by current day unless specified otherwise
 * Uses Supabase Realtime for instant updates
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTodayBrazil, isOnBrazilDate } from "@/lib/timezone";
import { getCurrentTenantId } from "@/lib/tenant";

// Types for dashboard data
export interface DashboardDriver {
  id: string;
  name: string;
  phone: string;
  photo_url: string | null;
  avatar: string;
  vehicle_plate: string;
  vehicle_type: string;
  status: string;
  is_own_fleet: boolean;
}

export interface DashboardFleetPosition {
  id: string;
  driver_id: string;
  driver_name: string | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
  is_active: boolean;
  last_update: string;
}

export interface DashboardManifest {
  id: string;
  manifest_code: string;
  manifest_number: number | null;
  driver_id: string | null;
  driver_name: string;
  driver_cpf: string | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
  is_own_fleet: boolean;
  freight_type: string;
  freight_value: number;
  deliveries_count: number;
  total_value: number;
  total_weight: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardInvoice {
  id: string;
  nfe_number: string | null;
  recipient_name: string;
  address_full: string;
  total_value: number;
  total_weight: number | null;
  status: string;
  driver_id: string | null;
  manifest_id: string | null;
  occurrence_type: string | null;
  imported_at: string;
  updated_at: string;
  delivered_at: string | null;
}

export interface FinishedDriverData {
  driver: DashboardDriver;
  manifest: DashboardManifest;
  invoices: DashboardInvoice[];
  finishedAt: string;
  totalDeliveries: number;
  completedDeliveries: number;
  occurrences: number;
}

export interface DriversInRouteData {
  driver: DashboardDriver;
  manifest: DashboardManifest;
  invoices: DashboardInvoice[];
  totalDeliveries: number;
  completedDeliveries: number;
  inProgress: number;
}

export function useDashboardKPIs() {
  const [manifests, setManifests] = useState<DashboardManifest[]>([]);
  const [invoices, setInvoices] = useState<DashboardInvoice[]>([]);
  const [drivers, setDrivers] = useState<DashboardDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get today's date string in Brazil timezone (America/Sao_Paulo)
  const today = useMemo(() => getTodayBrazil(), []);

  // Fetch all data
  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setManifests([]);
        setInvoices([]);
        setDrivers([]);
        return;
      }

      const [manifestsRes, invoicesRes, driversRes] = await Promise.all([
        supabase
          .from("manifests")
          .select("*")
          .eq("tenant_id", tenantId)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("imported_at", { ascending: false }),
        supabase
          .from("drivers")
          .select("id, name, phone, photo_url, avatar, vehicle_plate, vehicle_type, status, is_own_fleet")
          .eq("tenant_id", tenantId),
      ]);

      setManifests((manifestsRes.data as DashboardManifest[]) ?? []);
      setInvoices((invoicesRes.data as DashboardInvoice[]) ?? []);
      setDrivers((driversRes.data as DashboardDriver[]) ?? []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    fetchData(true);

    const manifestsChannel = supabase
      .channel("dashboard-manifests")
      .on("postgres_changes", { event: "*", schema: "public", table: "manifests" }, fetchData)
      .subscribe();

    const invoicesChannel = supabase
      .channel("dashboard-invoices")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, fetchData)
      .subscribe();

    const driversChannel = supabase
      .channel("dashboard-drivers")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(manifestsChannel);
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(driversChannel);
    };
  }, [fetchData]);

  // Helper: Get driver by ID
  const getDriver = useCallback(
    (driverId: string | null): DashboardDriver | null => {
      if (!driverId) return null;
      return drivers.find((d) => d.id === driverId) || null;
    },
    [drivers]
  );

  // === KPI 1: Motoristas na Rua (today's manifests with active invoices in transit) ===
  const driversInRoute = useMemo((): DriversInRouteData[] => {
    const todayManifests = manifests.filter(
      (m) => isOnBrazilDate(m.created_at, today) && !["completed", "paid", "cancelled"].includes(m.status)
    );

    const seenDriverIds = new Set<string>();

    const routesFromManifests = todayManifests
      .filter((manifest) => Boolean(manifest.driver_id))
      .map((manifest) => {
        const driver = getDriver(manifest.driver_id);
        const manifestInvoices = invoices.filter((inv) => inv.manifest_id === manifest.id);
        const completed = manifestInvoices.filter((inv) => inv.status === "delivered").length;
        const inProgress = manifestInvoices.filter((inv) => inv.status === "in_transit").length;

        return {
          driver: driver || {
            id: manifest.driver_id || "",
            name: manifest.driver_name,
            phone: "",
            photo_url: null,
            avatar: "",
            vehicle_plate: manifest.vehicle_plate || "",
            vehicle_type: manifest.vehicle_type || "",
            status: "in_route",
            is_own_fleet: manifest.is_own_fleet,
          },
          manifest,
          invoices: manifestInvoices,
          totalDeliveries: manifestInvoices.length,
          completedDeliveries: completed,
          inProgress,
        };
      })
      .filter((route) => {
        if (!route.driver.id || seenDriverIds.has(route.driver.id)) return false;
        seenDriverIds.add(route.driver.id);
        return true;
      });

    return routesFromManifests;
  }, [manifests, invoices, today, getDriver]);

  // === KPI 2: Motoristas que já Finalizaram (Today's completed manifests) ===
  const finishedDrivers = useMemo((): FinishedDriverData[] => {
    const todayCompletedManifests = manifests
      .filter(
        (m) => isOnBrazilDate(m.created_at, today) && ["completed", "paid"].includes(m.status)
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return todayCompletedManifests.map((manifest) => {
      const driver = getDriver(manifest.driver_id);
      const manifestInvoices = invoices.filter((inv) => inv.manifest_id === manifest.id);
      const completed = manifestInvoices.filter((inv) => inv.status === "delivered").length;
      const occurrences = manifestInvoices.filter(
        (inv) => inv.status === "occurrence" || inv.status === "returned"
      ).length;

      return {
        driver: driver || {
          id: manifest.driver_id || "",
          name: manifest.driver_name,
          phone: "",
          photo_url: null,
          avatar: "",
          vehicle_plate: manifest.vehicle_plate || "",
          vehicle_type: manifest.vehicle_type || "",
          status: "active",
          is_own_fleet: manifest.is_own_fleet,
        },
        manifest,
        invoices: manifestInvoices,
        finishedAt: manifest.updated_at,
        totalDeliveries: manifestInvoices.length,
        completedDeliveries: completed,
        occurrences,
      };
    });
  }, [manifests, invoices, today, getDriver]);

  // === KPI 3: Em Rota (invoices actively in transit in today's active manifests) ===
  const invoicesInTransit = useMemo(() => {
    const activeManifestIds = new Set(driversInRoute.map((route) => route.manifest.id));
    return invoices.filter(
      (inv) => inv.status === "in_transit" && inv.manifest_id && activeManifestIds.has(inv.manifest_id)
    );
  }, [driversInRoute, invoices]);

  // === KPI 4: Notas Carregadas Hoje (NFs in today's manifests + delivered today + occurrences today) ===
  const todayLoadedInvoices = useMemo(() => {
    const todayManifestIds = manifests
      .filter((m) => isOnBrazilDate(m.created_at, today))
      .map((m) => m.id);

    return invoices.filter((inv) => {
      // NF is in a manifest created today
      const inTodayManifest = inv.manifest_id && todayManifestIds.includes(inv.manifest_id);
      // NF was delivered today (Brazil timezone)
      const deliveredToday = inv.status === "delivered" && isOnBrazilDate(inv.delivered_at, today);
      // NF had occurrence/return today (by updated_at, Brazil timezone)
      const occurrenceToday = (inv.status === "occurrence" || inv.status === "returned") && 
        isOnBrazilDate(inv.updated_at, today);
      
      return inTodayManifest || deliveredToday || occurrenceToday;
    });
  }, [manifests, invoices, today]);

  // === KPI 5: Entregas Realizadas Hoje (Delivered today by delivered_at) ===
  const todayDeliveredInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.status === "delivered" && isOnBrazilDate(inv.delivered_at, today)
    );
  }, [invoices, today]);

  // === KPI 6: Receita Total (Sum of total_value from today's loaded invoices) ===
  const todayRevenue = useMemo(() => {
    return todayLoadedInvoices.reduce((sum, inv) => sum + (inv.total_value || 0), 0);
  }, [todayLoadedInvoices]);

  // === KPI 7: Custo de Frete do Dia (Sum of freight from today's manifests) ===
  const todayFreightCost = useMemo(() => {
    const todayManifests = manifests.filter((m) => isOnBrazilDate(m.created_at, today));
    return todayManifests.reduce((sum, m) => sum + (m.freight_value || 0), 0);
  }, [manifests, today]);

  // List of today's manifests with freight details
  const todayManifestsWithFreight = useMemo(() => {
    return manifests
      .filter((m) => isOnBrazilDate(m.created_at, today))
      .map((m) => ({
        ...m,
        driver: getDriver(m.driver_id),
      }));
  }, [manifests, today, getDriver]);

  // === KPI 8: Frota Própria Hoje ===
  const ownFleetToday = useMemo(() => {
    return manifests.filter((m) => isOnBrazilDate(m.created_at, today) && m.is_own_fleet === true);
  }, [manifests, today]);

  // === KPI 9: Terceiros Hoje ===
  const thirdPartyToday = useMemo(() => {
    return manifests.filter((m) => isOnBrazilDate(m.created_at, today) && m.is_own_fleet === false);
  }, [manifests, today]);

  // Entregas Não Roterizadas (pending or returned without manifest)
  const unroutedInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        (inv.status === "pending" || inv.status === "returned") && !inv.manifest_id
    );
  }, [invoices]);

  return {
    isLoading,
    refetch: fetchData,
    today,
    // Raw data
    manifests,
    invoices,
    drivers,
    fleetPositions: [],
    // KPIs
    driversInRoute,
    driversInRouteCount: driversInRoute.length,
    finishedDrivers,
    finishedDriversCount: finishedDrivers.length,
    invoicesInTransit,
    invoicesInTransitCount: invoicesInTransit.length,
    todayLoadedInvoices,
    todayLoadedCount: todayLoadedInvoices.length,
    todayDeliveredInvoices,
    todayDeliveredCount: todayDeliveredInvoices.length,
    todayRevenue,
    todayFreightCost,
    todayManifestsWithFreight,
    ownFleetToday,
    ownFleetCount: ownFleetToday.length,
    thirdPartyToday,
    thirdPartyCount: thirdPartyToday.length,
    unroutedInvoices,
    unroutedCount: unroutedInvoices.length,
  };
}
