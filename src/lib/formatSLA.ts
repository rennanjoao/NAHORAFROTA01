/**
 * Utility function to format SLA percentages consistently across the app
 * Always displays exactly 1 decimal place
 * @param value - The SLA percentage value (e.g., 97.92, 85, 100)
 * @returns Formatted string with 1 decimal place (e.g., "97,9", "85,0", "100,0")
 */
export function formatSLA(value: number): string {
  // Manual da marca: decimal com virgula ("97,9").
  return value.toFixed(1).replace(".", ",");
}

/**
 * Format SLA with percentage symbol
 * @param value - The SLA percentage value
 * @returns Formatted string with percentage (e.g., "97,9%")
 */
export function formatSLAPercent(value: number): string {
  return `${formatSLA(value)}%`;
}
