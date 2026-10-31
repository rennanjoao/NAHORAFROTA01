/**
 * LOGISTICS CONTEXT - Single Source of Truth
 * All modules consume and update the SAME data here.
 * 
 * Interconnectivity Rules:
 * - Rule A: Delivery "Completed" → Driver balance increases
 * - Rule B: Occurrence added → Driver SLA decreases
 * - Rule C: All KPIs are calculated functions from live state
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { formatCurrency } from "@/lib/formatCurrency";

// ============== TYPE DEFINITIONS ==============

export type DeliveryStatus = "available" | "loaded" | "in_transit" | "delivered" | "returned" | "occurrence";
export type OccurrenceType = "delay" | "damage" | "wrong_address" | "absent_recipient" | "refusal" | "theft" | "other";
export type VehicleType = "Fiorino" | "VUC" | "Toco" | "Truck" | "Carreta" | "Van" | "Moto";
// Status values matching database: active = Disponível, in_route = Em Rota, inactive = Inativo
export type DriverStatus = "active" | "inactive" | "in_route" | "pending_approval";
export type ManifestStatus = "pending" | "paid" | "disputed";
export type FreightType = "fixed" | "lumpsum" | "per_km";
export type VehicleRequestStatus = "pending" | "approved" | "rejected" | "in_progress";

export interface Occurrence {
  id: string;
  deliveryId: string;
  type: OccurrenceType;
  description: string;
  observation?: string;
  evidenceUrls?: string[];
  createdAt: Date;
  resolvedAt?: Date;
  impactValue?: number;
}

export interface Delivery {
  id: string;
  nfNumber: string;
  recipient: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  weight: number;
  value: number;
  status: DeliveryStatus;
  driverId?: number;
  manifestId?: string;
  clientId: string;
  clientName: string;
  routeId?: string;
  routeName?: string;
  scheduledDate: Date;
  deliveredAt?: Date;
  observation?: string;
  occurrences: Occurrence[];
  createdAt: Date;
  riskLevel?: "low" | "medium" | "high";
  coordinates?: { lat: number; lng: number };
  routeSequence?: number; // Ordem na sequência de roteirização (1, 2, 3...)
}

export interface Driver {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  photo: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  status: DriverStatus;
  rating: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  region: string;
  joinedAt: Date;
  isOwnFleet: boolean;  // true = Frota Própria (não gera valor a receber), false = Terceiro
  /** Foto do veiculo do motorista (agregado com veiculo proprio). */
  vehiclePhoto?: string | null;
  /** Transportadora que recebe por ele (null = direto, TAC). */
  carrierId?: string | null;
  /** SLA dos ultimos 6 meses (null = sem NFs finalizadas). */
  sla?: number | null;
  /** Frete a pagar (romaneios ainda nao pagos) - so agregados. */
  balance?: number;
  bankInfo?: {
    bank: string;
    agency: string;
    account: string;
    pix?: string;
  };
}

export interface Manifest {
  id: string;
  driverId: number;
  driverName: string;
  driverCpf: string;
  driverPlate: string;
  vehicleType: VehicleType;
  isOwnVehicle: boolean;  // true = Frota Própria, false = Terceirizado
  freightType: FreightType;
  unitValue?: number;
  totalValue: number;
  deliveryIds: string[];
  deliveriesCount: number;
  createdAt: Date;
  paidAt?: Date;
  status: ManifestStatus;
  observation?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

export interface FinancialTransaction {
  id: string;
  driverId: number;
  manifestId?: string;
  type: "credit" | "debit";
  category: "freight" | "bonus" | "advance" | "discount" | "penalty" | "fuel_voucher";
  description: string;
  value: number;
  createdAt: Date;
  status: "pending" | "completed";
}

export interface VehicleRequest {
  id: string;
  cargoValue: number;
  productType: string;
  vehicleType: VehicleType;
  region: "grande_sp" | "nacional";
  estimatedDeadline: string;
  status: VehicleRequestStatus;
  requestedAt: Date;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  cnpj: string;
  totalDeliveries: number;
  returnRate: number;
}

export interface Route {
  id: string;
  name: string;
  region: string;
  avgDeliveryTime: number;
  delayRate: number;
}

// ============== CONTEXT STATE ==============

interface LogisticsState {
  drivers: Driver[];
  deliveries: Delivery[];
  manifests: Manifest[];
  transactions: FinancialTransaction[];
  occurrences: Occurrence[];
  vehicleRequests: VehicleRequest[];
  clients: Client[];
  routes: Route[];
  isLoading: boolean;
}

interface LogisticsActions {
  // Delivery actions
  updateDeliveryStatus: (deliveryId: string, status: DeliveryStatus, observation?: string) => void;
  addOccurrence: (deliveryId: string, occurrence: Omit<Occurrence, "id" | "createdAt">) => void;
  updateDeliveryObservation: (deliveryId: string, observation: string) => void;
  
  // Driver actions
  updateDriverStatus: (driverId: number, status: DriverStatus) => void;
  
  // Manifest actions
  createManifest: (manifest: Omit<Manifest, "id" | "createdAt" | "status">) => Manifest;
  markManifestPaid: (manifestId: string) => void;
  revertManifestToPending: (manifestId: string) => void;
  updateManifest: (manifestId: string, newValue: number, observation: string, updatedBy?: string) => void;
  
  // Financial actions
  addTransaction: (transaction: Omit<FinancialTransaction, "id" | "createdAt">) => void;
  
  // Vehicle request actions
  createVehicleRequest: (request: Omit<VehicleRequest, "id" | "requestedAt" | "status">) => void;
  
  // Recalculation trigger
  recalculateDriverStats: (driverId: number) => void;
}

interface LogisticsKPIs {
  // Overall KPIs
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  returnedDeliveries: number;
  delayedDeliveries: number;
  
  // SLA Calculations
  overallSLA: number;
  otifRate: number;
  
  // Financial KPIs
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  totalDisputed: number;
  
  // Cost calculations
  returnCost: number;
  delayCost: number;
  reworkRate: number;
  totalImpact: number;
  
  // Driver stats
  activeDrivers: number;
  driversOnRoute: number;
  
  // Helpers
  getDriverSLA: (driverId: number) => number;
  getDriverBalance: (driverId: number) => number;
  getDriverManifests: (driverId: number) => Manifest[];
  getDriverTransactions: (driverId: number) => FinancialTransaction[];
}

interface LogisticsContextValue extends LogisticsState, LogisticsActions, LogisticsKPIs {}

const LogisticsContext = createContext<LogisticsContextValue | undefined>(undefined);

// ============== MOCK DATA GENERATOR ==============

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

const FIRST_NAMES = ["Carlos", "Ana", "Pedro", "Maria", "João", "Fernanda", "Lucas", "Julia", "Roberto", "Patricia", "Ricardo", "Camila", "Bruno", "Larissa", "Diego", "Amanda", "Felipe", "Beatriz", "Gustavo", "Mariana"];
const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Costa", "Ferreira", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Gomes", "Martins", "Araújo", "Melo", "Barbosa", "Ribeiro", "Cardoso", "Rocha", "Correia"];
const CITIES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Salvador", "Brasília", "Fortaleza", "Recife", "Campinas"];
const STATES = ["SP", "RJ", "MG", "PR", "RS", "BA", "DF", "CE", "PE", "SP"];
const VEHICLE_TYPES: VehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van"];
const CLIENT_NAMES = ["Magazine Luiza", "Americanas", "Mercado Livre", "Amazon Brasil", "Casas Bahia", "Shopee", "Carrefour", "Pão de Açúcar", "B2W Digital", "Via Varejo"];
const ROUTE_NAMES = ["Rota Centro SP", "Rota Zona Sul", "Rota Zona Norte", "Rota ABC", "Rota Interior", "Rota Litoral", "Rota Capital RJ", "Rota Metropolitana", "Rota Express", "Rota Premium"];
const PRODUCTS = ["Eletrônicos", "Vestuário", "Alimentos", "Medicamentos", "Móveis", "Cosméticos", "Livros", "Brinquedos", "Ferramentas", "Autopeças"];

function generateMockDrivers(count: number): Driver[] {
  return Array.from({ length: count }, (_, i) => {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const totalDeliveries = 100 + Math.floor(Math.random() * 500);
    const successRate = 0.85 + Math.random() * 0.14;
    const successfulDeliveries = Math.floor(totalDeliveries * successRate);
    
    return {
      id: i + 1,
      name: `${firstName} ${lastName}`,
      cpf: `${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}.${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}.${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}-${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`,
      phone: `(11) 9${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${i}`,
      vehiclePlate: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
      vehicleType: VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)],
      status: ["active", "in_route"][Math.floor(Math.random() * 2)] as DriverStatus,
      rating: 3.5 + Math.random() * 1.5,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries: totalDeliveries - successfulDeliveries,
      region: CITIES[Math.floor(Math.random() * CITIES.length)],
      joinedAt: new Date(Date.now() - Math.floor(Math.random() * 365 * 3) * 24 * 60 * 60 * 1000),
      isOwnFleet: Math.random() > 0.7, // 30% são frota própria
      bankInfo: {
        bank: ["Itaú", "Bradesco", "Santander", "Banco do Brasil", "Caixa"][Math.floor(Math.random() * 5)],
        agency: String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
        account: `${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}-${Math.floor(Math.random() * 10)}`,
        pix: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      },
    };
  });
}

function generateMockDeliveries(count: number, drivers: Driver[], clients: Client[], routes: Route[]): Delivery[] {
  const statuses: DeliveryStatus[] = ["available", "loaded", "in_transit", "delivered", "returned", "occurrence"];
  const statusWeights = [0.1, 0.15, 0.2, 0.4, 0.08, 0.07];
  
  const deliveries = Array.from({ length: count }, (_, i) => {
    const randomStatus = () => {
      const rand = Math.random();
      let cumulative = 0;
      for (let j = 0; j < statuses.length; j++) {
        cumulative += statusWeights[j];
        if (rand < cumulative) return statuses[j];
      }
      return statuses[0];
    };
    
    const status = randomStatus();
    const driver = status !== "available" ? drivers[Math.floor(Math.random() * drivers.length)] : undefined;
    const client = clients[Math.floor(Math.random() * clients.length)];
    const route = routes[Math.floor(Math.random() * routes.length)];
    const cityIndex = Math.floor(Math.random() * CITIES.length);
    const daysAgo = Math.floor(Math.random() * 30);
    const scheduledDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    const hasOccurrence = status === "occurrence" || (status === "returned" && Math.random() > 0.5);
    const occurrences: Occurrence[] = hasOccurrence ? [{
      id: generateId(),
      deliveryId: "",
      type: ["delay", "damage", "wrong_address", "absent_recipient", "refusal"][Math.floor(Math.random() * 5)] as OccurrenceType,
      description: "Ocorrência registrada automaticamente",
      createdAt: new Date(scheduledDate.getTime() + Math.random() * 24 * 60 * 60 * 1000),
    }] : [];
    
    const delivery: Delivery = {
      id: generateId(),
      nfNumber: `NF-${String(100000 + i).padStart(6, "0")}`,
      recipient: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
      address: `Rua ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}, ${Math.floor(Math.random() * 2000) + 1}`,
      city: CITIES[cityIndex],
      state: STATES[cityIndex],
      zipCode: `${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
      weight: Math.floor(Math.random() * 500) + 1,
      value: Math.floor(Math.random() * 5000) + 50,
      status,
      driverId: driver?.id,
      clientId: client.id,
      clientName: client.name,
      routeId: route.id,
      routeName: route.name,
      scheduledDate,
      deliveredAt: status === "delivered" ? new Date(scheduledDate.getTime() + Math.random() * 48 * 60 * 60 * 1000) : undefined,
      occurrences,
      createdAt: new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000),
      riskLevel: ["low", "medium", "high"][Math.floor(Math.random() * 3)] as "low" | "medium" | "high",
      coordinates: {
        lat: -23.5505 + (Math.random() - 0.5) * 0.5,
        lng: -46.6333 + (Math.random() - 0.5) * 0.5,
      },
    };
    
    // Link occurrence to delivery
    occurrences.forEach(occ => occ.deliveryId = delivery.id);
    
    return delivery;
  });
  
  // Atribuir sequência de roteirização por motorista
  const driverSequences = new Map<number, number>();
  return deliveries.map(delivery => {
    if (delivery.driverId) {
      const currentSeq = driverSequences.get(delivery.driverId) || 0;
      const newSeq = currentSeq + 1;
      driverSequences.set(delivery.driverId, newSeq);
      return { ...delivery, routeSequence: newSeq };
    }
    return delivery;
  });
}

function generateMockManifests(deliveries: Delivery[], drivers: Driver[]): Manifest[] {
  const manifests: Manifest[] = [];
  const completedDeliveries = deliveries.filter(d => d.status === "delivered" && d.driverId);
  
  // Group by driver
  const byDriver = new Map<number, Delivery[]>();
  completedDeliveries.forEach(d => {
    if (!d.driverId) return;
    const existing = byDriver.get(d.driverId) || [];
    byDriver.set(d.driverId, [...existing, d]);
  });
  
  byDriver.forEach((driverDeliveries, driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    
    // Create manifests (batch every 5-15 deliveries)
    let batch: Delivery[] = [];
    driverDeliveries.forEach((delivery, idx) => {
      batch.push(delivery);
      if (batch.length >= 5 + Math.floor(Math.random() * 10) || idx === driverDeliveries.length - 1) {
        const totalValue = 200 + Math.floor(Math.random() * 600);
        const isPaid = Math.random() > 0.35;
        
        manifests.push({
          id: generateId(),
          driverId,
          driverName: driver.name,
          driverCpf: driver.cpf,
          driverPlate: driver.vehiclePlate,
          vehicleType: driver.vehicleType,
          isOwnVehicle: Math.random() > 0.3, // 70% próprio, 30% terceirizado
          freightType: ["fixed", "lumpsum", "per_km"][Math.floor(Math.random() * 3)] as FreightType,
          totalValue,
          deliveryIds: batch.map(d => d.id),
          deliveriesCount: batch.length,
          createdAt: batch[0].deliveredAt || new Date(),
          paidAt: isPaid ? new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000) : undefined,
          status: isPaid ? "paid" : Math.random() > 0.9 ? "disputed" : "pending",
        });
        
        batch = [];
      }
    });
  });
  
  return manifests;
}

function generateMockClients(): Client[] {
  return CLIENT_NAMES.map((name, i) => ({
    id: generateId(),
    name,
    cnpj: `${String(Math.floor(Math.random() * 100)).padStart(2, "0")}.${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}.${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}/0001-${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`,
    totalDeliveries: 500 + Math.floor(Math.random() * 2000),
    returnRate: 2 + Math.random() * 8,
  }));
}

function generateMockRoutes(): Route[] {
  return ROUTE_NAMES.map((name, i) => ({
    id: generateId(),
    name,
    region: CITIES[i % CITIES.length],
    avgDeliveryTime: 30 + Math.floor(Math.random() * 90),
    delayRate: 5 + Math.random() * 15,
  }));
}

// ============== PROVIDER ==============

export function LogisticsProvider({ children }: { children: ReactNode }) {
  // Empty initial state - all data comes from database
  const initialClients: Client[] = [];
  const initialRoutes: Route[] = [];
  const initialDrivers: Driver[] = [];
  const initialDeliveries: Delivery[] = [];
  const initialManifests: Manifest[] = [];
  
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [manifests, setManifests] = useState<Manifest[]>(initialManifests);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [vehicleRequests, setVehicleRequests] = useState<VehicleRequest[]>([]);
  const [clients] = useState<Client[]>(initialClients);
  const [routes] = useState<Route[]>(initialRoutes);
  const [isLoading] = useState(false);
  
  // ============== ACTIONS ==============
  
  const updateDeliveryStatus = useCallback((deliveryId: string, status: DeliveryStatus, observation?: string) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id !== deliveryId) return d;
      
      const updated = { 
        ...d, 
        status,
        observation: observation || d.observation,
        deliveredAt: status === "delivered" ? new Date() : d.deliveredAt,
      };
      
      // Rule A: If completed, create transaction for driver
      if (status === "delivered" && d.driverId && d.status !== "delivered") {
        const freightValue = Math.floor(d.value * 0.08); // 8% freight
        setTransactions(prev => [...prev, {
          id: generateId(),
          driverId: d.driverId!,
          type: "credit",
          category: "freight",
          description: `Frete NF ${d.nfNumber}`,
          value: freightValue,
          createdAt: new Date(),
          status: "pending",
        }]);
      }
      
      return updated;
    }));
  }, []);
  
  const addOccurrence = useCallback((deliveryId: string, occurrence: Omit<Occurrence, "id" | "createdAt">) => {
    const newOccurrence: Occurrence = {
      ...occurrence,
      id: generateId(),
      createdAt: new Date(),
    };
    
    setOccurrences(prev => [...prev, newOccurrence]);
    
    // Rule B: Update delivery and recalculate driver SLA
    setDeliveries(prev => prev.map(d => {
      if (d.id !== deliveryId) return d;
      return {
        ...d,
        status: "occurrence" as DeliveryStatus,
        occurrences: [...d.occurrences, newOccurrence],
      };
    }));
  }, []);
  
  const updateDeliveryObservation = useCallback((deliveryId: string, observation: string) => {
    setDeliveries(prev => prev.map(d => 
      d.id === deliveryId ? { ...d, observation } : d
    ));
  }, []);
  
  const updateDriverStatus = useCallback((driverId: number, status: DriverStatus) => {
    setDrivers(prev => prev.map(d => 
      d.id === driverId ? { ...d, status } : d
    ));
  }, []);
  
  const createManifest = useCallback((manifestData: Omit<Manifest, "id" | "createdAt" | "status">): Manifest => {
    const newManifest: Manifest = {
      ...manifestData,
      id: `ROM-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date(),
      status: "pending",
    };
    
    setManifests(prev => [newManifest, ...prev]);
    
    // Update delivery manifest IDs
    setDeliveries(prev => prev.map(d => 
      manifestData.deliveryIds.includes(d.id) ? { ...d, manifestId: newManifest.id } : d
    ));
    
    return newManifest;
  }, []);
  
  const markManifestPaid = useCallback((manifestId: string) => {
    setManifests(prev => prev.map(m => 
      m.id === manifestId ? { ...m, status: "paid" as ManifestStatus, paidAt: new Date() } : m
    ));
    
    // Create paid transaction
    const manifest = manifests.find(m => m.id === manifestId);
    if (manifest) {
      setTransactions(prev => [...prev, {
        id: generateId(),
        driverId: manifest.driverId,
        manifestId,
        type: "credit",
        category: "freight",
        description: `Pagamento Romaneio ${manifestId}`,
        value: manifest.totalValue,
        createdAt: new Date(),
        status: "completed",
      }]);
    }
  }, [manifests]);

  const revertManifestToPending = useCallback((manifestId: string) => {
    setManifests(prev => prev.map(m => 
      m.id === manifestId ? { ...m, status: "pending" as ManifestStatus, paidAt: undefined } : m
    ));
    
    // Remove the paid transaction if exists
    setTransactions(prev => prev.filter(t => 
      !(t.manifestId === manifestId && t.category === "freight" && t.description?.includes("Pagamento"))
    ));
  }, []);
  
  const updateManifest = useCallback((manifestId: string, newValue: number, observation: string, updatedBy?: string) => {
    setManifests(prev => prev.map(m => 
      m.id === manifestId 
        ? { 
            ...m, 
            totalValue: newValue, 
            observation,
            lastUpdatedBy: updatedBy || "Sistema",
            lastUpdatedAt: new Date(),
          } 
        : m
    ));
  }, []);
  
  const addTransaction = useCallback((transaction: Omit<FinancialTransaction, "id" | "createdAt">) => {
    setTransactions(prev => [...prev, {
      ...transaction,
      id: generateId(),
      createdAt: new Date(),
    }]);
  }, []);
  
  const createVehicleRequest = useCallback((request: Omit<VehicleRequest, "id" | "requestedAt" | "status">) => {
    setVehicleRequests(prev => [...prev, {
      ...request,
      id: generateId(),
      requestedAt: new Date(),
      status: "pending",
    }]);
  }, []);
  
  const recalculateDriverStats = useCallback((driverId: number) => {
    const driverDeliveries = deliveries.filter(d => d.driverId === driverId);
    const successful = driverDeliveries.filter(d => d.status === "delivered").length;
    const failed = driverDeliveries.filter(d => ["returned", "occurrence"].includes(d.status)).length;
    
    setDrivers(prev => prev.map(d => {
      if (d.id !== driverId) return d;
      return {
        ...d,
        totalDeliveries: driverDeliveries.length,
        successfulDeliveries: successful,
        failedDeliveries: failed,
      };
    }));
  }, [deliveries]);
  
  // ============== KPI CALCULATIONS ==============
  
  const kpis = useMemo((): Omit<LogisticsKPIs, "getDriverSLA" | "getDriverBalance" | "getDriverManifests" | "getDriverTransactions"> => {
    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter(d => d.status === "delivered").length;
    const pendingDeliveries = deliveries.filter(d => ["available", "loaded", "in_transit"].includes(d.status)).length;
    const returnedDeliveries = deliveries.filter(d => d.status === "returned").length;
    const delayedDeliveries = deliveries.filter(d => 
      d.status === "occurrence" && d.occurrences.some(o => o.type === "delay")
    ).length;
    
    // Rule C: SLA calculated from live state
    const validFailures = returnedDeliveries + delayedDeliveries;
    const overallSLA = totalDeliveries > 0 
      ? ((totalDeliveries - validFailures) / totalDeliveries) * 100 
      : 0;
    
    const onTimeDeliveries = completedDeliveries - delayedDeliveries;
    const otifRate = completedDeliveries > 0 
      ? (onTimeDeliveries / completedDeliveries) * 100 
      : 0;
    
    // Financial calculations from manifests
    const totalRevenue = manifests.reduce((sum, m) => sum + m.totalValue, 0);
    const totalPaid = manifests.filter(m => m.status === "paid").reduce((sum, m) => sum + m.totalValue, 0);
    const totalPending = manifests.filter(m => m.status === "pending").reduce((sum, m) => sum + m.totalValue, 0);
    const totalDisputed = manifests.filter(m => m.status === "disputed").reduce((sum, m) => sum + m.totalValue, 0);
    
    // Cost calculations
    const RETURN_COST = 85; // Average return cost
    const DELAY_PENALTY = 45; // Delay penalty per occurrence
    const returnCost = returnedDeliveries * RETURN_COST;
    const delayCost = delayedDeliveries * DELAY_PENALTY;
    const reworkRate = totalDeliveries > 0 
      ? ((returnedDeliveries + delayedDeliveries) / totalDeliveries) * 100 
      : 0;
    const totalImpact = returnCost + delayCost;
    
    // Driver stats - use in_route as the DB status value
    const activeDrivers = drivers.filter(d => d.status === "active" || d.status === "in_route").length;
    const driversOnRoute = drivers.filter(d => d.status === "in_route").length;
    
    return {
      totalDeliveries,
      completedDeliveries,
      pendingDeliveries,
      returnedDeliveries,
      delayedDeliveries,
      overallSLA,
      otifRate,
      totalRevenue,
      totalPaid,
      totalPending,
      totalDisputed,
      returnCost,
      delayCost,
      reworkRate,
      totalImpact,
      activeDrivers,
      driversOnRoute,
    };
  }, [deliveries, manifests, drivers]);
  
  const getDriverSLA = useCallback((driverId: number): number => {
    const driverDeliveries = deliveries.filter(d => d.driverId === driverId);
    if (driverDeliveries.length === 0) return 100;
    
    const successful = driverDeliveries.filter(d => d.status === "delivered").length;
    const failed = driverDeliveries.filter(d => ["returned", "occurrence"].includes(d.status)).length;
    
    return ((driverDeliveries.length - failed) / driverDeliveries.length) * 100;
  }, [deliveries]);
  
  const getDriverBalance = useCallback((driverId: number): number => {
    const driverManifests = manifests.filter(m => m.driverId === driverId);
    const pending = driverManifests.filter(m => m.status === "pending").reduce((sum, m) => sum + m.totalValue, 0);
    const driverTransactions = transactions.filter(t => t.driverId === driverId);
    const debits = driverTransactions.filter(t => t.type === "debit").reduce((sum, t) => sum + t.value, 0);
    
    return pending - debits;
  }, [manifests, transactions]);
  
  const getDriverManifests = useCallback((driverId: number): Manifest[] => {
    return manifests.filter(m => m.driverId === driverId);
  }, [manifests]);
  
  const getDriverTransactions = useCallback((driverId: number): FinancialTransaction[] => {
    return transactions.filter(t => t.driverId === driverId);
  }, [transactions]);
  
  const value: LogisticsContextValue = {
    // State
    drivers,
    deliveries,
    manifests,
    transactions,
    occurrences,
    vehicleRequests,
    clients,
    routes,
    isLoading,
    
    // Actions
    updateDeliveryStatus,
    addOccurrence,
    updateDeliveryObservation,
    updateDriverStatus,
    createManifest,
    markManifestPaid,
    revertManifestToPending,
    updateManifest,
    addTransaction,
    createVehicleRequest,
    recalculateDriverStats,
    
    // KPIs
    ...kpis,
    getDriverSLA,
    getDriverBalance,
    getDriverManifests,
    getDriverTransactions,
  };
  
  return (
    <LogisticsContext.Provider value={value}>
      {children}
    </LogisticsContext.Provider>
  );
}

// ============== HOOK ==============

export function useLogistics() {
  const context = useContext(LogisticsContext);
  if (!context) {
    throw new Error("useLogistics must be used within LogisticsProvider");
  }
  return context;
}

export default LogisticsContext;
