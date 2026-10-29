import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  getBillingAlert,
  getSubscriptionStatus,
  getTrialDaysLeft,
  type TenantAccess,
} from "@/lib/billingStatus";

// 28/10/2026 10:00 em Brasilia (UTC-3)
const NOW = new Date("2026-10-28T13:00:00Z");

function access(overrides: Partial<TenantAccess>): TenantAccess {
  return {
    tenant_id: "t1",
    access_state: "active",
    has_access: true,
    trial_ends_at: null,
    next_due_date: null,
    is_platform_admin: false,
    ...overrides,
  };
}

describe("calendarDaysBetween", () => {
  it("conta dias de calendario", () => {
    expect(calendarDaysBetween("2026-10-28", "2026-11-04")).toBe(7);
    expect(calendarDaysBetween("2026-10-28", "2026-10-27")).toBe(-1);
    expect(calendarDaysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
});

describe("getTrialDaysLeft", () => {
  it("usa o dia no horario de Brasilia", () => {
    // 01:00 UTC do dia 29 ainda e dia 28 em Brasilia
    expect(getTrialDaysLeft("2026-10-29T01:00:00Z", NOW)).toBe(0);
    expect(getTrialDaysLeft("2026-11-04T13:00:00Z", NOW)).toBe(7);
  });
});

describe("getSubscriptionStatus", () => {
  it("mapeia os estados de trial e bloqueio", () => {
    expect(getSubscriptionStatus(access({ access_state: "trial", trial_ends_at: "2026-11-01T13:00:00Z" }), NOW)).toEqual({
      status: "trial",
      daysRemaining: 4,
    });
    expect(getSubscriptionStatus(access({ access_state: "trial_expired" }), NOW).status).toBe("trial_expired");
    expect(getSubscriptionStatus(access({ access_state: "blocked" }), NOW).status).toBe("blocked");
    expect(getSubscriptionStatus(access({ access_state: "pending" }), NOW).status).toBe("pending");
    expect(getSubscriptionStatus(null, NOW).status).toBe("no_date");
  });

  it("mantem as regras de vencimento da assinatura", () => {
    // Atraso dentro do prazo: so aviso. Passado o prazo o banco devolve access_state "overdue" (bloqueia).
    expect(getSubscriptionStatus(access({ next_due_date: "2026-10-27" }), NOW)).toEqual({ status: "overdue", daysRemaining: -1 });
    expect(getSubscriptionStatus(access({ access_state: "overdue", next_due_date: "2026-10-20" }), NOW)).toEqual({
      status: "expired",
      daysRemaining: -8,
    });
    expect(getSubscriptionStatus(access({ next_due_date: "2026-10-28" }), NOW).status).toBe("due_today");
    expect(getSubscriptionStatus(access({ next_due_date: "2026-11-02" }), NOW)).toEqual({ status: "warning", daysRemaining: 5 });
    expect(getSubscriptionStatus(access({ next_due_date: "2026-11-03" }), NOW).status).toBe("active");
    expect(getSubscriptionStatus(access({ next_due_date: null }), NOW).status).toBe("no_date");
  });
});

describe("getBillingAlert", () => {
  it("avisa o fim do teste nos ultimos 3 dias", () => {
    expect(getBillingAlert(access({ access_state: "trial", trial_ends_at: "2026-11-01T13:00:00Z" }), NOW)).toBeNull();
    const alert = getBillingAlert(access({ access_state: "trial", trial_ends_at: "2026-10-31T13:00:00Z" }), NOW);
    expect(alert).toMatchObject({ type: "trial_ending", referenceDate: "2026-10-31", daysRemaining: 3, severity: "warning" });
    expect(getBillingAlert(access({ access_state: "trial", trial_ends_at: "2026-10-29T13:00:00Z" }), NOW)?.message).toContain(
      "termina amanhã",
    );
  });

  it("avisa vencimento proximo, no dia e atrasado", () => {
    expect(getBillingAlert(access({ next_due_date: "2026-11-03" }), NOW)).toBeNull();
    expect(getBillingAlert(access({ next_due_date: "2026-11-02" }), NOW)).toMatchObject({ type: "due_soon", daysRemaining: 5 });
    expect(getBillingAlert(access({ next_due_date: "2026-10-28" }), NOW)).toMatchObject({ type: "due_today", severity: "critical" });
    expect(getBillingAlert(access({ next_due_date: "2026-10-25" }), NOW)).toMatchObject({ type: "overdue", daysRemaining: -3 });
    expect(getBillingAlert(access({ next_due_date: "2026-10-25", auto_block_days: 5 }), NOW)?.message).toContain(
      "suspenso em 3 dias",
    );
  });

  it("nao incomoda o Super Admin nem empresas sem data", () => {
    expect(getBillingAlert(access({ next_due_date: "2026-10-28", is_platform_admin: true }), NOW)).toBeNull();
    expect(getBillingAlert(access({}), NOW)).toBeNull();
    expect(getBillingAlert(access({ access_state: "blocked", next_due_date: "2026-10-28" }), NOW)).toBeNull();
  });
});
