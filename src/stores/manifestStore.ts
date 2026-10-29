// Simple in-memory manifest store to connect operational → financial flow
// In production, this would be persisted to a database via Lovable Cloud
// UPDATED: Uses enterprise-scale financial data for realistic figures

import { ExtendedDriver } from "@/components/deliveries/DriverCombobox";
import { FINANCIAL_CONSTANTS, generateFinancialData } from "@/lib/driverUtils";

export interface ManifestRecord {
  id: string;
  driverId: number;
  driverName: string;
  driverCpf: string;
  driverPlate: string;
  vehicleType: string;
  isOwnVehicle: boolean;  // true = Frota Própria, false = Terceirizado
  vehicleId?: string;     // ID do veículo da casa (se isOwnVehicle = true)
  vehiclePlate?: string;  // Placa do veículo da casa (se isOwnVehicle = true)
  freightType: "fixed" | "lumpsum" | "per_km";
  unitValue?: number;
  totalValue?: number;
  perKmValue?: number;
  estimatedDistance?: number;
  calculatedTotal: number;
  deliveriesCount: number;
  deliveryIds: number[];
  createdAt: Date;
  status: "pending" | "paid";
  // Modification tracking
  modifiedBy?: string;
  modifiedAt?: Date;
  lastSentToDriver?: Date;
}

// In-memory store (resets on page refresh - use DB for persistence)
let manifests: ManifestRecord[] = [];
let listeners: (() => void)[] = [];

// Generate unique ID
const generateId = () => `ROM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Sample drivers for mock data (expanded for enterprise scale)
const sampleDrivers = [
  { id: 1, name: "Carlos Silva", cpf: "123.456.789-00", plate: "ABC-1234", vehicleType: "Van" },
  { id: 2, name: "Ana Santos", cpf: "987.654.321-00", plate: "DEF-5678", vehicleType: "Truck" },
  { id: 3, name: "Pedro Costa", cpf: "456.789.123-00", plate: "GHI-9012", vehicleType: "Fiorino" },
  { id: 4, name: "Maria Oliveira", cpf: "321.654.987-00", plate: "JKL-3456", vehicleType: "VUC" },
  { id: 5, name: "João Mendes", cpf: "654.987.321-00", plate: "MNO-7890", vehicleType: "Toco" },
  { id: 6, name: "Roberto Lima", cpf: "789.123.456-00", plate: "PQR-1111", vehicleType: "Carreta" },
  { id: 7, name: "Fernanda Dias", cpf: "147.258.369-00", plate: "STU-2222", vehicleType: "Van" },
  { id: 8, name: "Lucas Almeida", cpf: "258.369.147-00", plate: "VWX-3333", vehicleType: "Fiorino" },
];

const freightTypes: ("fixed" | "lumpsum" | "per_km")[] = ["fixed", "lumpsum", "per_km"];

// Generate enterprise-scale mock data
// Target: Annual > R$5M, which means ~R$416k/month, ~R$14k/day
const initializeMockData = () => {
  if (manifests.length > 0) return;
  
  // Generate manifests for the past 365 days to achieve enterprise scale
  // Average ~40-60 manifests per day at R$300-500 each = ~R$15-25k daily
  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    
    // More manifests on weekdays
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const manifestsPerDay = isWeekend ? 20 + Math.floor(Math.random() * 15) : 40 + Math.floor(Math.random() * 25);
    
    for (let j = 0; j < manifestsPerDay; j++) {
      const driver = sampleDrivers[Math.floor(Math.random() * sampleDrivers.length)];
      const manifestDate = new Date(date);
      manifestDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      
      // Higher value manifests for enterprise scale (R$200-800 average)
      const baseValue = 200 + Math.floor(Math.random() * 600);
      
      // Determine status based on age (older = more likely paid)
      const isPaid = dayOffset > 14 ? Math.random() > 0.2 : 
                     dayOffset > 7 ? Math.random() > 0.5 : 
                     dayOffset > 3 ? Math.random() > 0.7 : false;
      
      manifests.push({
        id: generateId(),
        driverId: driver.id,
        driverName: driver.name,
        driverCpf: driver.cpf,
        driverPlate: driver.plate,
        vehicleType: driver.vehicleType,
        isOwnVehicle: Math.random() > 0.3, // 70% próprio, 30% terceirizado
        freightType: freightTypes[Math.floor(Math.random() * 3)],
        calculatedTotal: baseValue,
        deliveriesCount: Math.floor(Math.random() * 12) + 3,
        deliveryIds: [],
        createdAt: manifestDate,
        status: isPaid ? "paid" : "pending",
      });
    }
  }
  
  // Sort by date descending
  manifests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Initialize on first access
initializeMockData();

export const manifestStore = {
  // Get all manifests
  getAll: (): ManifestRecord[] => [...manifests],
  
  // Get manifests by driver
  getByDriver: (driverId: number): ManifestRecord[] => 
    manifests.filter(m => m.driverId === driverId),
  
  // Get pending manifests grouped by driver
  getPendingByDriver: (): Map<number, ManifestRecord[]> => {
    const pending = manifests.filter(m => m.status === "pending");
    const grouped = new Map<number, ManifestRecord[]>();
    
    pending.forEach(m => {
      const existing = grouped.get(m.driverId) || [];
      grouped.set(m.driverId, [...existing, m]);
    });
    
    return grouped;
  },
  
  // Get summary of pending drivers
  getPendingDriversSummary: () => {
    const pending = manifests.filter(m => m.status === "pending");
    const summary = new Map<number, { 
      driverId: number;
      driverName: string;
      driverCpf: string;
      manifestCount: number;
      totalValue: number;
    }>();
    
    pending.forEach(m => {
      const existing = summary.get(m.driverId);
      if (existing) {
        existing.manifestCount++;
        existing.totalValue += m.calculatedTotal;
      } else {
        summary.set(m.driverId, {
          driverId: m.driverId,
          driverName: m.driverName,
          driverCpf: m.driverCpf,
          manifestCount: 1,
          totalValue: m.calculatedTotal,
        });
      }
    });
    
    return Array.from(summary.values());
  },
  
  // Get global stats
  getGlobalStats: (days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filtered = manifests.filter(m => m.createdAt >= cutoffDate);
    
    const totalPaid = filtered
      .filter(m => m.status === "paid")
      .reduce((sum, m) => sum + m.calculatedTotal, 0);
    
    const totalPending = filtered
      .filter(m => m.status === "pending")
      .reduce((sum, m) => sum + m.calculatedTotal, 0);
    
    return {
      totalPaid,
      totalPending,
      totalGeneral: totalPaid + totalPending,
      manifestCount: filtered.length,
    };
  },
  
  // Add new manifest
  add: (manifest: Omit<ManifestRecord, "id" | "createdAt" | "status">): ManifestRecord => {
    const newManifest: ManifestRecord = {
      ...manifest,
      id: generateId(),
      createdAt: new Date(),
      status: "pending",
    };
    
    manifests = [newManifest, ...manifests];
    notifyListeners();
    
    return newManifest;
  },
  
  // Mark manifest as paid
  markAsPaid: (id: string) => {
    manifests = manifests.map(m => 
      m.id === id ? { ...m, status: "paid" as const } : m
    );
    notifyListeners();
  },

  // Update manifest (for modifications, resends, etc.)
  updateManifest: (id: string, updates: Partial<ManifestRecord>) => {
    manifests = manifests.map(m => 
      m.id === id ? { ...m, ...updates } : m
    );
    notifyListeners();
  },

  // Remove delivery from manifest
  removeDeliveryFromManifest: (manifestId: string, deliveryId: number, modifiedBy: string) => {
    manifests = manifests.map(m => {
      if (m.id !== manifestId) return m;
      
      const newDeliveryIds = m.deliveryIds.filter(id => id !== deliveryId);
      return {
        ...m,
        deliveryIds: newDeliveryIds,
        deliveriesCount: newDeliveryIds.length,
        modifiedBy,
        modifiedAt: new Date(),
      };
    });
    notifyListeners();
  },

  // Add delivery to existing manifest
  addDeliveryToManifest: (manifestId: string, deliveryId: number, modifiedBy: string): ManifestRecord | null => {
    let updatedManifest: ManifestRecord | null = null;
    
    manifests = manifests.map(m => {
      if (m.id !== manifestId) return m;
      
      // Avoid duplicates
      if (m.deliveryIds.includes(deliveryId)) return m;
      
      updatedManifest = {
        ...m,
        deliveryIds: [...m.deliveryIds, deliveryId],
        deliveriesCount: m.deliveriesCount + 1,
        modifiedBy,
        modifiedAt: new Date(),
      };
      
      return updatedManifest;
    });
    
    notifyListeners();
    return updatedManifest;
  },

  // Get manifest by ID
  getById: (id: string): ManifestRecord | undefined => {
    return manifests.find(m => m.id === id);
  },

  // Delete manifest and return delivery IDs for reversal
  deleteManifest: (id: string): { success: boolean; deliveryIds: number[]; error?: string } => {
    const manifest = manifests.find(m => m.id === id);
    
    if (!manifest) {
      return { success: false, deliveryIds: [], error: "Romaneio não encontrado" };
    }
    
    const deliveryIds = manifest.deliveryIds;
    
    // Remove manifest from store
    manifests = manifests.filter(m => m.id !== id);
    notifyListeners();
    
    return { success: true, deliveryIds };
  },

  // Check if manifest can be deleted (no completed deliveries)
  canDeleteManifest: (id: string, completedDeliveryIds: string[]): { canDelete: boolean; reason?: string; completedCount?: number } => {
    const manifest = manifests.find(m => m.id === id);
    
    if (!manifest) {
      return { canDelete: false, reason: "Romaneio não encontrado" };
    }
    
    // Check if any delivery in this manifest has been completed
    const completedInManifest = manifest.deliveryIds.filter(deliveryId => 
      completedDeliveryIds.includes(String(deliveryId))
    );
    
    if (completedInManifest.length > 0) {
      return { 
        canDelete: false, 
        reason: `Existem ${completedInManifest.length} entrega(s) já finalizada(s) neste romaneio`,
        completedCount: completedInManifest.length
      };
    }
    
    return { canDelete: true };
  },
  
  // Subscribe to changes
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
};

const notifyListeners = () => {
  listeners.forEach(l => l());
};
