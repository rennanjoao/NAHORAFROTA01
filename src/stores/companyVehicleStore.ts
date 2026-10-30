// Company Vehicles Store - Manages house fleet vehicles with Supabase persistence
// These are vehicles owned by the company (Frota Própria)

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId as getCachedTenantId } from "@/lib/tenant";

export type VehicleStatus = "available" | "in_use" | "maintenance";
export type CompanyVehicleType = "Fiorino" | "VUC" | "Toco" | "Truck" | "Carreta" | "Van";

export interface CompanyVehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  type: CompanyVehicleType;
  status: VehicleStatus;
  capacity?: string;
  year?: number;
  renavam?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  currentDriverId?: string;
  currentDriverName?: string;
}

interface DBVehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  type: string;
  status: string;
  capacity: string | null;
  year: number | null;
  renavam: string | null;
  photo_url?: string | null;
  current_driver_id: string | null;
  current_driver_name: string | null;
  created_at: string;
  updated_at: string;
}

const capacityByType: Record<CompanyVehicleType, string> = {
  Fiorino: "650kg",
  VUC: "3.5t",
  Toco: "8t",
  Truck: "15t",
  Carreta: "25t",
  Van: "1.5t",
};

/** null em ano/RENAVAM apaga o valor salvo. */
export type CompanyVehicleUpdate = Partial<Omit<CompanyVehicle, "id" | "createdAt" | "year" | "renavam" | "photoUrl">> & {
  year?: number | null;
  renavam?: string | null;
  photoUrl?: string | null;
};

// Convert DB record to CompanyVehicle
const mapDBToVehicle = (db: DBVehicle): CompanyVehicle => ({
  id: db.id,
  plate: db.plate,
  model: db.model,
  brand: db.brand,
  type: db.type as CompanyVehicleType,
  status: db.status as VehicleStatus,
  capacity: db.capacity || undefined,
  year: db.year || undefined,
  renavam: db.renavam || undefined,
  photoUrl: db.photo_url || undefined,
  currentDriverId: db.current_driver_id || undefined,
  currentDriverName: db.current_driver_name || undefined,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
});

// In-memory cache
let vehiclesCache: CompanyVehicle[] = [];
let listeners: (() => void)[] = [];
let initialized = false;
let cachedUserId: string | null = null;

// O cache e por usuario: sem isso, sair e entrar com outra conta na mesma aba
// mostrava os veiculos da empresa anterior.
supabase.auth.onAuthStateChange((_event, session) => {
  const userId = session?.user?.id ?? null;
  if (userId === cachedUserId) return;
  cachedUserId = userId;
  vehiclesCache = [];
  initialized = false;
  listeners.forEach((l) => l());
});

// Empresa do usuario: mesma consulta (em cache) das outras telas.
const getCurrentTenantId = async (): Promise<string> => {
  const tenantId = await getCachedTenantId();
  if (!tenantId) throw new Error("Tenant não identificado para o usuário atual.");
  return tenantId;
};

const notifyListeners = () => {
  listeners.forEach(l => l());
};

// Fetch all vehicles from database
const fetchVehicles = async (): Promise<CompanyVehicle[]> => {
  const tenantId = await getCurrentTenantId();
  const { data, error } = await supabase
    .from("company_vehicles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching vehicles:", error);
    throw new Error(error.message);
  }

  vehiclesCache = (data || []).map(mapDBToVehicle);
  initialized = true;
  return vehiclesCache;
};

export { capacityByType as vehicleCapacityByType };

export const companyVehicleStore = {
  // Initialize and get all vehicles
  initialize: async (): Promise<CompanyVehicle[]> => {
    return fetchVehicles();
  },

  // Get all vehicles (sync from cache)
  getAll: (): CompanyVehicle[] => [...vehiclesCache],

  // Get all vehicles async
  getAllAsync: async (): Promise<CompanyVehicle[]> => {
    if (!initialized) {
      await fetchVehicles();
    }
    return [...vehiclesCache];
  },

  // Refresh from database
  refresh: async (): Promise<void> => {
    await fetchVehicles();
    notifyListeners();
  },

  // Get vehicles by status
  getByStatus: (status: VehicleStatus): CompanyVehicle[] =>
    vehiclesCache.filter(v => v.status === status),

  // Get available vehicles
  getAvailable: (): CompanyVehicle[] =>
    vehiclesCache.filter(v => v.status === "available"),

  // Get available vehicles by type
  getAvailableByType: (type: CompanyVehicleType): CompanyVehicle[] =>
    vehiclesCache.filter(v => v.status === "available" && v.type === type),

  // Get vehicle by ID
  getById: (id: string): CompanyVehicle | undefined =>
    vehiclesCache.find(v => v.id === id),

  // Get vehicle by plate
  getByPlate: (plate: string): CompanyVehicle | undefined =>
    vehiclesCache.find(v => v.plate.toLowerCase() === plate.toLowerCase()),

  // Add new vehicle
  add: async (vehicle: Omit<CompanyVehicle, "id" | "createdAt" | "updatedAt">): Promise<CompanyVehicle> => {
    const tenantId = await getCurrentTenantId();

    const { data, error } = await supabase
      .from("company_vehicles")
      .insert({
        plate: vehicle.plate.toUpperCase(),
        model: vehicle.model,
        brand: vehicle.brand,
        type: vehicle.type,
        status: vehicle.status || "available",
        capacity: vehicle.capacity || capacityByType[vehicle.type],
        year: vehicle.year,
        renavam: vehicle.renavam,
        photo_url: vehicle.photoUrl || null,
        current_driver_id: vehicle.currentDriverId,
        current_driver_name: vehicle.currentDriverName,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding vehicle:", error);
      if (error.code === "23505") {
        throw new Error("Já existe um veículo com esta placa");
      }
      throw new Error(error.message);
    }

    const newVehicle = mapDBToVehicle(data);
    vehiclesCache = [newVehicle, ...vehiclesCache];
    notifyListeners();

    return newVehicle;
  },

  // Update vehicle
  update: async (id: string, updates: CompanyVehicleUpdate): Promise<CompanyVehicle | null> => {
    const updateData: Record<string, unknown> = {};
    
    if (updates.plate !== undefined) updateData.plate = updates.plate.toUpperCase();
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
    if (updates.year !== undefined) updateData.year = updates.year;
    if (updates.renavam !== undefined) updateData.renavam = updates.renavam;
    if (updates.photoUrl !== undefined) updateData.photo_url = updates.photoUrl;
    // Chave presente com valor undefined = desvincular o motorista (liberar/manutencao).
    if ("currentDriverId" in updates) updateData.current_driver_id = updates.currentDriverId ?? null;
    if ("currentDriverName" in updates) updateData.current_driver_name = updates.currentDriverName ?? null;

    const { data, error } = await supabase
      .from("company_vehicles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating vehicle:", error);
      throw new Error(error.message);
    }

    const updatedVehicle = mapDBToVehicle(data);
    vehiclesCache = vehiclesCache.map(v => v.id === id ? updatedVehicle : v);
    notifyListeners();

    return updatedVehicle;
  },

  // Assign vehicle to driver
  assignToDriver: async (vehicleId: string, driverId: string, driverName: string): Promise<boolean> => {
    try {
      await companyVehicleStore.update(vehicleId, {
        status: "in_use",
        currentDriverId: driverId,
        currentDriverName: driverName,
      });
      return true;
    } catch {
      return false;
    }
  },

  // Release vehicle from driver
  releaseFromDriver: async (vehicleId: string): Promise<boolean> => {
    try {
      await companyVehicleStore.update(vehicleId, {
        status: "available",
        currentDriverId: undefined,
        currentDriverName: undefined,
      });
      return true;
    } catch {
      return false;
    }
  },

  // Set vehicle to maintenance
  setMaintenance: async (vehicleId: string): Promise<boolean> => {
    try {
      await companyVehicleStore.update(vehicleId, {
        status: "maintenance",
        currentDriverId: undefined,
        currentDriverName: undefined,
      });
      return true;
    } catch {
      return false;
    }
  },

  // Delete vehicle
  delete: async (id: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("company_vehicles")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Error deleting vehicle:", error);
      throw new Error(error.message);
    }

    // RLS sem permissao nao da erro: so nao apaga nada.
    if (!data?.length) {
      throw new Error("Você não tem permissão para remover este veículo.");
    }

    vehiclesCache = vehiclesCache.filter(v => v.id !== id);
    notifyListeners();
    return true;
  },

  // Get stats
  getStats: () => {
    const total = vehiclesCache.length;
    const available = vehiclesCache.filter(v => v.status === "available").length;
    const inUse = vehiclesCache.filter(v => v.status === "in_use").length;
    const maintenance = vehiclesCache.filter(v => v.status === "maintenance").length;

    return { total, available, inUse, maintenance };
  },

  // Subscribe to changes
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
};
