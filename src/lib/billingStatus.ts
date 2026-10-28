// Regras de trial e de aviso de cobranca, sem dependencia de React/Supabase.
// O estado de acesso vem da RPC get_my_tenant_access().

import { formatInTimeZone } from "date-fns-tz";
import { BRAZIL_TIMEZONE } from "@/lib/timezone";

export const TRIAL_DAYS = 7;
/** A partir de quantos dias restantes o pop-up de fim de teste aparece. */
export const TRIAL_WARNING_DAYS = 3;
/** A partir de quantos dias para o vencimento o pop-up de cobranca aparece. */
export const DUE_WARNING_DAYS = 5;

export type AccessState = "trial" | "trial_expired" | "active" | "pending" | "blocked" | "none";

export interface TenantAccess {
  tenant_id: string | null;
  razao_social?: string | null;
  status?: string | null;
  plan?: string | null;
  access_state: AccessState;
  has_access: boolean;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_extensions?: number | null;
  next_due_date?: string | null;
  financial_status?: string | null;
  is_platform_admin?: boolean;
}

export type SubscriptionStatus =
  | "loading"
  | "no_date"
  | "active"
  | "warning"
  | "due_today"
  | "expired"
  | "trial"
  | "trial_expired"
  | "pending"
  | "blocked";

export type BillingNoticeType = "trial_ending" | "trial_expired" | "due_soon" | "due_today" | "overdue";

export interface BillingAlert {
  type: BillingNoticeType;
  /** Data (YYYY-MM-DD) a que o aviso se refere: fim do teste ou vencimento. */
  referenceDate: string;
  /** Dias de calendario ate a data de referencia (negativo = atrasado). */
  daysRemaining: number;
  severity: "warning" | "critical";
  title: string;
  message: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toBrazilDate(date: Date | string): string {
  return formatInTimeZone(typeof date === "string" ? new Date(date) : date, BRAZIL_TIMEZONE, "yyyy-MM-dd");
}

/** Diferenca em dias de calendario entre duas datas YYYY-MM-DD. */
export function calendarDaysBetween(fromDate: string, toDate: string): number {
  const from = Date.UTC(+fromDate.slice(0, 4), +fromDate.slice(5, 7) - 1, +fromDate.slice(8, 10));
  const to = Date.UTC(+toDate.slice(0, 4), +toDate.slice(5, 7) - 1, +toDate.slice(8, 10));
  return Math.round((to - from) / DAY_MS);
}

/** Empresa ainda marcada como "trial" mas cujo periodo ja terminou. */
export function isTrialExpired(tenant: { status: string; trial_ends_at?: string | null }, now: Date = new Date()): boolean {
  return tenant.status === "trial" && (!tenant.trial_ends_at || new Date(tenant.trial_ends_at) <= now);
}

/** Dias de calendario (horario de Brasilia) ate o fim do teste; 0 = termina hoje. */
export function getTrialDaysLeft(trialEndsAt: string, now: Date = new Date()): number {
  return calendarDaysBetween(toBrazilDate(now), toBrazilDate(trialEndsAt));
}

function plural(days: number, singular: string, pluralWord: string) {
  return `${days} ${days === 1 ? singular : pluralWord}`;
}

export function getSubscriptionStatus(access: TenantAccess | null | undefined, now: Date = new Date()): {
  status: SubscriptionStatus;
  daysRemaining: number;
} {
  if (!access || access.access_state === "none") return { status: "no_date", daysRemaining: 999 };

  switch (access.access_state) {
    case "blocked":
      return { status: "blocked", daysRemaining: 0 };
    case "pending":
      return { status: "pending", daysRemaining: 0 };
    case "trial_expired":
      return { status: "trial_expired", daysRemaining: 0 };
    case "trial":
      return {
        status: "trial",
        daysRemaining: access.trial_ends_at ? getTrialDaysLeft(access.trial_ends_at, now) : TRIAL_DAYS,
      };
  }

  if (!access.next_due_date) return { status: "no_date", daysRemaining: 999 };

  const diff = calendarDaysBetween(toBrazilDate(now), access.next_due_date.slice(0, 10));
  if (diff < 0) return { status: "expired", daysRemaining: diff };
  if (diff === 0) return { status: "due_today", daysRemaining: 0 };
  if (diff <= DUE_WARNING_DAYS) return { status: "warning", daysRemaining: diff };
  return { status: "active", daysRemaining: diff };
}

/** Aviso que o pop-up de cobranca deve mostrar agora, ou null. */
export function getBillingAlert(access: TenantAccess | null | undefined, now: Date = new Date()): BillingAlert | null {
  if (!access || access.is_platform_admin) return null;

  if (access.access_state === "trial" && access.trial_ends_at) {
    const days = getTrialDaysLeft(access.trial_ends_at, now);
    if (days > TRIAL_WARNING_DAYS) return null;
    const when = days <= 0 ? "termina hoje" : days === 1 ? "termina amanhã" : `termina em ${plural(days, "dia", "dias")}`;
    return {
      type: "trial_ending",
      referenceDate: toBrazilDate(access.trial_ends_at),
      daysRemaining: days,
      severity: days <= 1 ? "critical" : "warning",
      title: "Seu teste grátis está acabando",
      message: `Seu período de teste ${when}. Contrate um plano para continuar usando o NaHora Frota sem interrupções.`,
    };
  }

  if (access.access_state === "trial_expired" && access.trial_ends_at) {
    return {
      type: "trial_expired",
      referenceDate: toBrazilDate(access.trial_ends_at),
      daysRemaining: getTrialDaysLeft(access.trial_ends_at, now),
      severity: "critical",
      title: "Seu teste grátis terminou",
      message: "O período de teste acabou e o acesso foi suspenso. Fale com a equipe NaHora Frota para contratar.",
    };
  }

  if (access.access_state !== "active" || !access.next_due_date) return null;

  const referenceDate = access.next_due_date.slice(0, 10);
  const diff = calendarDaysBetween(toBrazilDate(now), referenceDate);
  if (diff > DUE_WARNING_DAYS) return null;

  if (diff < 0) {
    const late = Math.abs(diff);
    return {
      type: "overdue",
      referenceDate,
      daysRemaining: diff,
      severity: "critical",
      title: "Pagamento em atraso",
      message: `Sua fatura está vencida há ${plural(late, "dia", "dias")}. Regularize para evitar a suspensão do acesso.`,
    };
  }

  if (diff === 0) {
    return {
      type: "due_today",
      referenceDate,
      daysRemaining: 0,
      severity: "critical",
      title: "Sua fatura vence hoje",
      message: "O pagamento da sua assinatura vence hoje. Regularize para evitar interrupções.",
    };
  }

  return {
    type: "due_soon",
    referenceDate,
    daysRemaining: diff,
    severity: diff <= 2 ? "critical" : "warning",
    title: "Sua fatura está vencendo",
    message: `O pagamento da sua assinatura vence em ${plural(diff, "dia", "dias")}. Regularize para evitar interrupções.`,
  };
}
