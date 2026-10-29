import { calendarDaysBetween } from "@/lib/billingStatus";
import { getTodayBrazil } from "@/lib/timezone";

/** Dias de calendario (Brasilia) ate o vencimento; negativo = atrasado. */
export function daysUntilDue(nextDueDate: string): number {
  // differenceInDays truncava as horas: vencido ontem aparecia como "Vence hoje".
  return calendarDaysBetween(getTodayBrazil(), nextDueDate.slice(0, 10));
}

export function getDueSoonCount(tenants: Array<{ next_due_date?: string | null }>, withinDays = 5): number {
  return tenants.filter((t) => {
    if (!t.next_due_date) return false;
    const diff = daysUntilDue(t.next_due_date);
    return diff >= 0 && diff <= withinDays;
  }).length;
}

export function getOverdueCount(tenants: Array<{ next_due_date?: string | null }>): number {
  return tenants.filter((t) => isOverdue(t)).length;
}

/** Empresa com vencimento ja passado (filtro "Inadimplentes"). */
export function isOverdue(tenant: { next_due_date?: string | null }): boolean {
  return !!tenant.next_due_date && daysUntilDue(tenant.next_due_date) < 0;
}
