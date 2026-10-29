/**
 * Currency formatting utility for Brazilian Real (BRL)
 * Uses proper locale formatting: R$ 1.234,56
 */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as Brazilian Real currency
 * @param value - The numeric value to format
 * @returns Formatted string like "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return brlFormatter.format(value);
}

/**
 * Format currency without the R$ symbol (just the number)
 * @param value - The numeric value to format
 * @returns Formatted string like "1.234,56"
 */
export function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parse a Brazilian currency string back to number
 * @param value - String like "1.234,56" or "R$ 1.234,56"
 * @returns Numeric value
 */
export function parseCurrency(value: string): number {
  // Remove R$, spaces, and dots (thousand separator)
  const cleaned = value.replace(/R\$|\s|\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Le numero digitado em formato brasileiro ou com ponto decimal:
 * "R$ 1.234,56" -> 1234.56, "10,5kg" -> 10.5, "10.5" -> 10.5. Vazio/invalido -> null.
 */
export function parseDecimalInput(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? "").replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
