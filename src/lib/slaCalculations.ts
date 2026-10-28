/**
 * SLA CALCULATION MODULE
 * Implements logistics SLA (Service Level Agreement) calculation rules
 * 
 * Base Rule: Each driver starts with 100 points daily
 * V = 100 / Total Deliveries in Daily Manifest
 * 
 * Severity Discounts:
 * - Delivered: 0%
 * - Light (Closed/Absent, Refused, Missing in Package): 50% of V
 * - Severe (Partial Delivery): 100% of V
 * - Very Severe (Damaged, Not Found): 200% of V
 */

// ============== OCCURRENCE TYPES WITH SEVERITY ==============

export type OccurrenceSeverity = "none" | "light" | "severe" | "very_severe";

export interface OccurrenceRule {
  id: string;
  label: string;
  labelPt: string;
  severity: OccurrenceSeverity;
  discountMultiplier: number; // 0 = 0%, 0.5 = 50%, 1 = 100%, 2 = 200%
  description: string;
}

export const OCCURRENCE_RULES: Record<string, OccurrenceRule> = {
  delivered: {
    id: "delivered",
    label: "Delivered",
    labelPt: "Entrega Realizada",
    severity: "none",
    discountMultiplier: 0,
    description: "Entrega concluída com sucesso",
  },
  closed_location: {
    id: "closed_location",
    label: "Closed Location",
    labelPt: "Local Fechado",
    severity: "light",
    discountMultiplier: 0.5,
    description: "Estabelecimento ou residência fechada no momento da entrega",
  },
  absent_recipient: {
    id: "absent_recipient",
    label: "Absent Recipient",
    labelPt: "Cliente Ausente",
    severity: "light",
    discountMultiplier: 0.5,
    description: "Destinatário não encontrado no endereço",
  },
  refused: {
    id: "refused",
    label: "Refused Delivery",
    labelPt: "Entrega Recusada",
    severity: "light",
    discountMultiplier: 0.5,
    description: "Cliente recusou receber a mercadoria",
  },
  missing_in_package: {
    id: "missing_in_package",
    label: "Missing in Package",
    labelPt: "Mercadoria Faltando na Embalagem",
    severity: "light",
    discountMultiplier: 0.5,
    description: "Itens faltando dentro da embalagem original",
  },
  partial_delivery: {
    id: "partial_delivery",
    label: "Partial Delivery",
    labelPt: "Entrega Parcial",
    severity: "severe",
    discountMultiplier: 1,
    description: "Apenas parte dos itens foi entregue",
  },
  damaged: {
    id: "damaged",
    label: "Damaged Goods",
    labelPt: "Mercadoria Avariada",
    severity: "very_severe",
    discountMultiplier: 2,
    description: "Mercadoria danificada durante transporte",
  },
  not_found: {
    id: "not_found",
    label: "Not Found in Truck",
    labelPt: "Mercadoria Não Localizada no Caminhão",
    severity: "very_severe",
    discountMultiplier: 2,
    description: "Mercadoria não encontrada no veículo durante rota",
  },
};

// ============== SLA DATA STRUCTURES ==============

export interface DailySLARecord {
  date: Date;
  driverId: number;
  totalDeliveries: number;
  basePoints: number; // Always 100
  pointValue: number; // V = 100 / totalDeliveries
  deductions: SLADeduction[];
  finalScore: number;
  occurrenceBreakdown: Record<string, number>;
}

export interface SLADeduction {
  occurrenceType: string;
  deliveryId: string;
  pointsDeducted: number;
  timestamp: Date;
}

export interface WeeklySLARecord {
  weekStart: Date;
  weekEnd: Date;
  driverId: number;
  dailyScores: DailySLARecord[];
  weeklyAverage: number;
}

export interface CollectiveSLAReport {
  startDate: Date;
  endDate: Date;
  driverCount: number;
  totalScoreSum: number;
  averageScore: number;
  driverBreakdown: Array<{
    driverId: number;
    driverName: string;
    averageScore: number;
    totalDeliveries: number;
  }>;
}

// ============== CALCULATION FUNCTIONS ==============

/**
 * Calculate the point value (V) for a manifest
 * V = 100 / Total Deliveries
 */
export function calculatePointValue(totalDeliveries: number): number {
  if (totalDeliveries <= 0) return 0;
  return 100 / totalDeliveries;
}

/**
 * Calculate deduction for a specific occurrence
 * @param pointValue - The V value for this manifest
 * @param occurrenceType - Type of occurrence from OCCURRENCE_RULES
 */
export function calculateOccurrenceDeduction(
  pointValue: number,
  occurrenceType: string
): number {
  const rule = OCCURRENCE_RULES[occurrenceType];
  if (!rule) return 0;
  return pointValue * rule.discountMultiplier;
}

/**
 * Calculate daily SLA score for a driver
 */
export function calculateDailySLA(
  driverId: number,
  totalDeliveries: number,
  occurrences: Array<{ type: string; deliveryId: string; timestamp: Date }>
): DailySLARecord {
  const basePoints = 100;
  const pointValue = calculatePointValue(totalDeliveries);
  
  const deductions: SLADeduction[] = [];
  const occurrenceBreakdown: Record<string, number> = {};
  
  let totalDeduction = 0;
  
  occurrences.forEach(occ => {
    const deduction = calculateOccurrenceDeduction(pointValue, occ.type);
    totalDeduction += deduction;
    
    deductions.push({
      occurrenceType: occ.type,
      deliveryId: occ.deliveryId,
      pointsDeducted: deduction,
      timestamp: occ.timestamp,
    });
    
    occurrenceBreakdown[occ.type] = (occurrenceBreakdown[occ.type] || 0) + 1;
  });
  
  // SLA cannot go below 0
  const finalScore = Math.max(0, basePoints - totalDeduction);
  
  return {
    date: new Date(),
    driverId,
    totalDeliveries,
    basePoints,
    pointValue,
    deductions,
    finalScore,
    occurrenceBreakdown,
  };
}

/**
 * Calculate weekly SLA average
 */
export function calculateWeeklySLA(dailyRecords: DailySLARecord[]): number {
  if (dailyRecords.length === 0) return 100;
  const sum = dailyRecords.reduce((acc, record) => acc + record.finalScore, 0);
  return sum / dailyRecords.length;
}

/**
 * Calculate collective SLA for a period
 */
export function calculateCollectiveSLA(
  driverData: Array<{ driverId: number; driverName: string; dailyScores: number[]; totalDeliveries: number }>
): CollectiveSLAReport {
  const driverBreakdown = driverData.map(driver => ({
    driverId: driver.driverId,
    driverName: driver.driverName,
    averageScore: driver.dailyScores.length > 0 
      ? driver.dailyScores.reduce((a, b) => a + b, 0) / driver.dailyScores.length 
      : 100,
    totalDeliveries: driver.totalDeliveries,
  }));
  
  const totalScoreSum = driverBreakdown.reduce((sum, d) => sum + d.averageScore, 0);
  const averageScore = driverBreakdown.length > 0 ? totalScoreSum / driverBreakdown.length : 0;
  
  return {
    startDate: new Date(),
    endDate: new Date(),
    driverCount: driverData.length,
    totalScoreSum,
    averageScore,
    driverBreakdown,
  };
}

// ============== UI HELPERS ==============

export type SLALevel = "excellent" | "good" | "attention" | "critical";

export interface SLAColorScheme {
  level: SLALevel;
  label: string;
  labelPt: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  progressClass: string;
}

/**
 * Get SLA level and color scheme based on score
 * >97: Verde Esmeralda (Excelente)
 * 90-96: Azul (Bom)
 * 75-89: Amarelo/Laranja (Atenção)
 * <75: Vermelho (Crítico)
 */
export function getSLAColorScheme(score: number): SLAColorScheme {
  if (score >= 97) {
    return {
      level: "excellent",
      label: "Excellent",
      labelPt: "Excelente",
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-600",
      borderClass: "border-emerald-500",
      progressClass: "bg-emerald-500",
    };
  } else if (score >= 90) {
    return {
      level: "good",
      label: "Good",
      labelPt: "Bom",
      bgClass: "bg-blue-500/10",
      textClass: "text-blue-600",
      borderClass: "border-blue-500",
      progressClass: "bg-blue-500",
    };
  } else if (score >= 75) {
    return {
      level: "attention",
      label: "Attention",
      labelPt: "Atenção",
      bgClass: "bg-warning/10",
      textClass: "text-warning",
      borderClass: "border-warning",
      progressClass: "bg-warning",
    };
  } else {
    return {
      level: "critical",
      label: "Critical",
      labelPt: "Crítico",
      bgClass: "bg-destructive/10",
      textClass: "text-destructive",
      borderClass: "border-destructive",
      progressClass: "bg-destructive",
    };
  }
}

/**
 * Check if an occurrence is "Very Severe" (triggers critical alert)
 */
export function isVerySevereOccurrence(occurrenceType: string): boolean {
  const rule = OCCURRENCE_RULES[occurrenceType];
  return rule?.severity === "very_severe";
}

/**
 * Get severity badge color
 */
export function getSeverityBadgeClass(severity: OccurrenceSeverity): string {
  switch (severity) {
    case "none":
      return "bg-success/10 text-success border-success/30";
    case "light":
      return "bg-warning/10 text-warning border-warning/30";
    case "severe":
      return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "very_severe":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Format SLA score to 1 decimal place
 */
export function formatSLAScore(score: number): string {
  return score.toFixed(1);
}
