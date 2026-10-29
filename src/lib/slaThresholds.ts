/**
 * SLA THRESHOLDS - Centralized SLA classification rules
 * 
 * Performance Ruler (4 Tiers):
 * - Excelente (Verde Esmeralda): Score > 97% - Meta atingida
 * - Bom (Azul/Verde Lima): Score 90% – 96% - Performance aceitável
 * - Atenção (Amarelo/Laranja): Score 75% – 89% - Requer monitoramento
 * - Crítico (Vermelho): Score < 75% - Alto risco operacional
 */

export const SLA_THRESHOLDS = {
  EXCELLENT: 97,
  GOOD: 90,
  ATTENTION: 75,
  CRITICAL: 75, // Below this is critical
} as const;

export type SLALevel = "excellent" | "good" | "attention" | "critical";

export interface SLAColorScheme {
  level: SLALevel;
  labelPt: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  progressClass: string;
  ringColor: string;
  badgeBgClass: string;
}

/**
 * Get SLA classification and color scheme based on value
 * @param sla - SLA percentage (0-100)
 * @returns Color scheme object with all styling classes
 */
export function getSLAColorScheme(sla: number): SLAColorScheme {
  if (sla >= SLA_THRESHOLDS.EXCELLENT) {
    return {
      level: "excellent",
      labelPt: "Excelente",
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-600",
      borderClass: "border-emerald-500",
      progressClass: "[&>div]:bg-emerald-500",
      ringColor: "text-emerald-500",
      badgeBgClass: "bg-emerald-600",
    };
  }
  
  if (sla >= SLA_THRESHOLDS.GOOD) {
    return {
      level: "good",
      labelPt: "Atenção",
      bgClass: "bg-blue-500/10",
      textClass: "text-blue-600",
      borderClass: "border-blue-500",
      progressClass: "[&>div]:bg-blue-500",
      ringColor: "text-blue-500",
      badgeBgClass: "bg-blue-600",
    };
  }
  
  if (sla >= SLA_THRESHOLDS.ATTENTION) {
    return {
      level: "attention",
      labelPt: "Atenção",
      bgClass: "bg-warning/10",
      textClass: "text-warning",
      borderClass: "border-warning",
      progressClass: "[&>div]:bg-warning",
      ringColor: "text-warning",
      badgeBgClass: "bg-warning",
    };
  }
  
  return {
    level: "critical",
    labelPt: "Crítico",
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    borderClass: "border-destructive",
    progressClass: "[&>div]:bg-destructive",
    ringColor: "text-destructive",
    badgeBgClass: "bg-destructive",
  };
}

/**
 * Get simple color class for SLA value
 * @param sla - SLA percentage (0-100)
 * @returns Tailwind text color class
 */
export function getSLATextColor(sla: number): string {
  if (sla >= SLA_THRESHOLDS.EXCELLENT) return "text-emerald-600";
  if (sla >= SLA_THRESHOLDS.GOOD) return "text-blue-600";
  if (sla >= SLA_THRESHOLDS.ATTENTION) return "text-warning";
  return "text-destructive";
}

/**
 * Check if SLA meets the target (97%+)
 */
export function isSLAHealthy(sla: number): boolean {
  return sla >= SLA_THRESHOLDS.EXCELLENT;
}

/**
 * Check if SLA is in critical zone (<75%)
 */
export function isSLACritical(sla: number): boolean {
  return sla < SLA_THRESHOLDS.CRITICAL;
}

/**
 * Check if SLA is in attention zone (75-89%)
 */
export function isSLAAttention(sla: number): boolean {
  return sla >= SLA_THRESHOLDS.ATTENTION && sla < SLA_THRESHOLDS.GOOD;
}

/**
 * Check if SLA is in good zone (90-96%)
 */
export function isSLAGood(sla: number): boolean {
  return sla >= SLA_THRESHOLDS.GOOD && sla < SLA_THRESHOLDS.EXCELLENT;
}

/**
 * Calculate trend direction between two SLA values
 * @returns "up" if current > previous, "down" if current < previous, "stable" otherwise
 */
export function getSLATrend(current: number, previous: number): "up" | "down" | "stable" {
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return "stable";
  return diff > 0 ? "up" : "down";
}
