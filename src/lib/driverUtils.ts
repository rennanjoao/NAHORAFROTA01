/**
 * DRIVER UTILITY FUNCTIONS
 * Shared utilities for SLA calculations and status formatting
 * These functions are used across dashboard, reports, and driver components
 */

export interface DriverBase {
  id: string;
  name: string;
  photo: string | null;
  phone: string;
  address: string | null;
  vehicle_plate: string;
  vehicle_type: string;
  cnh: string;
  cnh_category: string;
  status: string;
  individual_sla: number | null;
  daily_sla: number | null;
  current_delay: number | null;
  deliveries_completed: number | null;
  total_deliveries: number | null;
  finished_time: string | null;
  is_own_fleet: boolean | null;
}

export interface VehicleType {
  type: "Fiorino" | "Van" | "VUC" | "Toco" | "Truck" | "Carreta";
  capacity: string;
  capacityKg: number;
}

export const vehicleTypes: VehicleType[] = [
  { type: "Fiorino", capacity: "650 kg", capacityKg: 650 },
  { type: "Van", capacity: "1.5 ton", capacityKg: 1500 },
  { type: "VUC", capacity: "3.5 ton", capacityKg: 3500 },
  { type: "Toco", capacity: "6 ton", capacityKg: 6000 },
  { type: "Truck", capacity: "14 ton", capacityKg: 14000 },
  { type: "Carreta", capacity: "25 ton", capacityKg: 25000 },
];

export const vehicleLabels: Record<string, string> = {
  truck: "Caminhão VUC",
  van: "Van/Fiorino",
  moto: "Motocicleta",
  Fiorino: "Fiorino",
  Van: "Van",
  VUC: "VUC",
  Toco: "Toco",
  Truck: "Truck",
  Carreta: "Carreta",
};

export interface SLAStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const getSLAStatus = (sla: number | null): SLAStatusConfig => {
  const slaValue = sla || 0;
  if (slaValue >= 98) return { label: "EXCELENTE", color: "text-emerald-600", bgColor: "bg-emerald-500", borderColor: "border-emerald-500" };
  if (slaValue >= 95) return { label: "BOM", color: "text-green-500", bgColor: "bg-green-500", borderColor: "border-green-500" };
  if (slaValue >= 90) return { label: "REGULAR / ALERTA", color: "text-yellow-500", bgColor: "bg-yellow-500", borderColor: "border-yellow-500" };
  if (slaValue >= 85) return { label: "RUIM", color: "text-orange-500", bgColor: "bg-orange-500", borderColor: "border-orange-500" };
  return { label: "PÉSSIMO", color: "text-red-600", bgColor: "bg-red-600", borderColor: "border-red-600" };
};

export const getIndividualSLAColor = (sla: number | null): string => {
  const slaValue = sla || 0;
  if (slaValue >= 98) return "text-emerald-600";
  if (slaValue >= 95) return "text-green-500";
  if (slaValue >= 90) return "text-yellow-500";
  if (slaValue >= 85) return "text-orange-500";
  return "text-red-600";
};

// ============== GEOGRAPHIC DATA FOR RISK MAP ==============
export const BRAZIL_ZONES = {
  Norte: ["Manaus", "Belém", "Porto Velho", "Macapá", "Boa Vista", "Rio Branco", "Palmas"],
  Sul: ["Curitiba", "Porto Alegre", "Florianópolis", "Joinville", "Londrina", "Caxias do Sul"],
  Leste: ["São Paulo", "Rio de Janeiro", "Vitória", "Salvador", "Recife", "Fortaleza"],
  Oeste: ["Cuiabá", "Campo Grande", "Goiânia", "Brasília", "Rio Branco"],
  Centro: ["Brasília", "Goiânia", "Uberlândia", "Ribeirão Preto"],
};

export const CITY_NEIGHBORHOODS: Record<string, string[]> = {
  "São Paulo": ["Centro", "Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste", "ABC Paulista", "Guarulhos", "Osasco"],
  "Rio de Janeiro": ["Centro", "Zona Norte", "Zona Sul", "Zona Oeste", "Baixada Fluminense", "Niterói"],
  "Curitiba": ["Centro", "Batel", "Água Verde", "Portão", "Cajuru", "Cidade Industrial"],
  "Belo Horizonte": ["Centro", "Savassi", "Pampulha", "Contagem", "Betim", "Ribeirão das Neves"],
  "Porto Alegre": ["Centro", "Zona Norte", "Zona Sul", "Canoas", "Gravataí", "Novo Hamburgo"],
  "Salvador": ["Centro", "Ondina", "Pituba", "Lauro de Freitas", "Camaçari"],
  "Recife": ["Centro", "Boa Viagem", "Casa Forte", "Olinda", "Jaboatão"],
  "Fortaleza": ["Centro", "Aldeota", "Meireles", "Messejana", "Caucaia"],
  "Goiânia": ["Centro", "Setor Oeste", "Setor Marista", "Aparecida de Goiânia", "Anápolis"],
  "Brasília": ["Asa Norte", "Asa Sul", "Taguatinga", "Ceilândia", "Samambaia"],
};

// All cities for dropdown
export const ALL_CITIES = Object.values(BRAZIL_ZONES).flat().filter((v, i, a) => a.indexOf(v) === i);

// Get neighborhoods for a city
export const getNeighborhoods = (city: string): string[] => {
  return CITY_NEIGHBORHOODS[city] || ["Centro", "Zona Industrial", "Zona Comercial"];
};

// ============== ENTERPRISE FINANCIAL CONSTANTS ==============
// Based on ~1200 drivers, average 15 manifests/driver/month at ~R$350/manifest
export const FINANCIAL_CONSTANTS = {
  // Daily: ~200 manifests average
  dailyAverage: 70000, // R$ 70k
  // Weekly: ~1400 manifests
  weeklyAverage: 490000, // R$ 490k
  // Monthly: ~6000 manifests
  monthlyAverage: 2100000, // R$ 2.1M
  // Quarterly: ~18000 manifests
  quarterlyMin: 1200000, // R$ 1.2M
  quarterlyMax: 1500000, // R$ 1.5M
  // Semester: ~36000 manifests
  semesterMin: 2500000, // R$ 2.5M
  semesterMax: 3000000, // R$ 3M
  // Annual: ~72000 manifests
  annualMin: 5000000, // R$ 5M+
  annualMax: 8000000, // R$ 8M
};

// Generate realistic financial data based on period
export const generateFinancialData = (period: "daily" | "weekly" | "monthly" | "quarterly" | "semester" | "annual") => {
  const config = {
    daily: { min: 55000, max: 85000, paidRatio: 0.7 },
    weekly: { min: 400000, max: 580000, paidRatio: 0.6 },
    monthly: { min: 1800000, max: 2400000, paidRatio: 0.5 },
    quarterly: { min: FINANCIAL_CONSTANTS.quarterlyMin, max: FINANCIAL_CONSTANTS.quarterlyMax, paidRatio: 0.45 },
    semester: { min: FINANCIAL_CONSTANTS.semesterMin, max: FINANCIAL_CONSTANTS.semesterMax, paidRatio: 0.4 },
    annual: { min: FINANCIAL_CONSTANTS.annualMin, max: FINANCIAL_CONSTANTS.annualMax, paidRatio: 0.35 },
  };
  
  const { min, max, paidRatio } = config[period];
  const total = min + Math.random() * (max - min);
  const paid = total * paidRatio;
  const pending = total - paid;
  
  return {
    totalGeneral: Math.round(total),
    totalPaid: Math.round(paid),
    totalPending: Math.round(pending),
    manifestCount: Math.round(total / 350), // Average R$350 per manifest
  };
};

// Invoice status types
export type FinishedRouteStatus = "finalizada" | "finalizada_ocorrencia" | "interrompida";

export const getFinishedStatusConfig = (status: FinishedRouteStatus) => {
  switch (status) {
    case "finalizada":
      return {
        label: "Finalizada",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500",
        borderColor: "border-emerald-500/30",
        bgLight: "bg-emerald-500/10",
      };
    case "finalizada_ocorrencia":
      return {
        label: "Finalizada com Ocorrência",
        color: "text-blue-600",
        bgColor: "bg-blue-500",
        borderColor: "border-blue-500/30",
        bgLight: "bg-blue-500/10",
      };
    case "interrompida":
      return {
        label: "Interrompida",
        color: "text-yellow-600",
        bgColor: "bg-yellow-500",
        borderColor: "border-yellow-500/30",
        bgLight: "bg-yellow-500/10",
      };
  }
};
