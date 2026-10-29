/**
 * Timezone utility for Brazil (America/Sao_Paulo)
 * All date comparisons and filtering must use this module
 * to ensure consistency regardless of server/client timezone.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Get today's date string (YYYY-MM-DD) in Brazil timezone.
 */
export function getTodayBrazil(): string {
  return formatInTimeZone(new Date(), BRAZIL_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Convert a UTC ISO string to a date string (YYYY-MM-DD) in Brazil timezone.
 * Use this to compare created_at / updated_at / delivered_at fields against "today".
 */
export function toDateStringBrazil(isoString: string | null | undefined): string {
  if (!isoString) return '';
  return formatInTimeZone(new Date(isoString), BRAZIL_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get the start and end of a given day in Brazil timezone, returned as UTC ISO strings.
 * Useful for database queries with .gte() and .lt().
 *
 * Example: getDayBoundsUTC('2026-02-11')
 *   → start: '2026-02-11T03:00:00.000Z' (midnight BRT = UTC-3)
 *   → end:   '2026-02-12T03:00:00.000Z'
 */
export function getDayBoundsUTC(dateStr?: string): { start: string; end: string } {
  const target = dateStr || getTodayBrazil();
  // Parse as midnight in Brazil timezone
  const startLocal = new Date(`${target}T00:00:00`);
  const endLocal = new Date(`${target}T00:00:00`);

  // Convert from Brazil local to UTC by adding 3 hours (BRT is UTC-3)
  // Using date-fns-tz for accuracy (handles DST if applicable)
  const zonedStart = toZonedTime(new Date(), BRAZIL_TIMEZONE);
  // Build proper UTC dates from the Brazil date string
  const startUTC = new Date(
    formatInTimeZone(
      new Date(`${target}T00:00:00-03:00`),
      'UTC',
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
    )
  );
  const endUTC = new Date(
    formatInTimeZone(
      new Date(`${target}T23:59:59.999-03:00`),
      'UTC',
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
    )
  );

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  };
}

/**
 * Check if an ISO timestamp falls on the given Brazil date (YYYY-MM-DD).
 * This is the core comparison function used across the app.
 */
export function isOnBrazilDate(isoString: string | null | undefined, brazilDate: string): boolean {
  if (!isoString) return false;
  return toDateStringBrazil(isoString) === brazilDate;
}

/**
 * Format a date for display in Brazil timezone.
 */
export function formatBrazilDateTime(isoString: string, pattern: string = 'dd/MM/yyyy HH:mm'): string {
  return formatInTimeZone(new Date(isoString), BRAZIL_TIMEZONE, pattern);
}

/**
 * Date local (meio-dia) para um campo so de data ("YYYY-MM-DD"). new Date("2026-10-28")
 * le como meia-noite UTC e, no Brasil, mostra o dia anterior. Valores com hora
 * (ISO completo) seguem o parse normal.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (match && value.length <= 10) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** dd/MM/yyyy de um campo so de data, sem deslocar o dia. */
export function formatDateOnly(value: string | null | undefined): string {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString('pt-BR') : '—';
}
