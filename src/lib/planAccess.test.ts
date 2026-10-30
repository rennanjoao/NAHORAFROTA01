import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateFeatureAccess, type Feature, type PlanFlags } from "./planAccess";

/* Interruptores de cada plano, lidos da migration que o banco usa (get_plan_limits). */
const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261029160000_plans_basic_standard_premium.sql"), "utf8");
function flags(block: string): PlanFlags {
  const get = (k: string) => new RegExp(`'${k}', (true|false)`).exec(block)?.[1] === "true";
  return { realtime: get("realtime"), batch_import: get("batch_import"), sla_weekly: get("sla_weekly"), sla_drilldown: get("sla_drilldown"), financial_dashboard: get("financial_dashboard") };
}
const LIMITS: Record<string, PlanFlags> = {
  total: flags(sql.slice(sql.indexOf("WHEN 'total'"), sql.indexOf("WHEN 'control'"))),
  control: flags(sql.slice(sql.indexOf("WHEN 'control'"), sql.indexOf("ELSE"))),
  basic: flags(sql.slice(sql.indexOf("ELSE"))),
};
const can = (plan: string, f: Feature) => evaluateFeatureAccess(f, plan, LIMITS[plan]).allowed;

describe("acesso por plano (planilha de 29/10/2026)", () => {
  it("todos os planos: XML, acerto financeiro e relatório de uso da frota", () => {
    for (const plan of ["basic", "control", "total"]) {
      expect(can(plan, "batch_import")).toBe(true);
      expect(can(plan, "settlement")).toBe(true);
      expect(can(plan, "reports")).toBe(true);
    }
  });

  it("Basic: sem mapa, sem SLA, sem números do frete, sem desempenho", () => {
    for (const f of ["realtime_dashboard", "sla_weekly", "financial_dashboard", "reports_performance", "sla_drilldown", "financial_reports", "reports_export"] as Feature[]) {
      expect(can("basic", f), f).toBe(false);
    }
  });

  it("Standard: mapa, SLA em tempo real, números do frete e desempenho; o resto é do Premium", () => {
    for (const f of ["realtime_dashboard", "sla_weekly", "sla_evolution", "financial_dashboard", "reports_performance"] as Feature[]) {
      expect(can("control", f), f).toBe(true);
    }
    for (const f of ["sla_drilldown", "financial_reports", "reports_export"] as Feature[]) {
      expect(can("control", f), f).toBe(false);
      expect(evaluateFeatureAccess(f, "control", LIMITS.control).upgradePlanLabel).toBe("Premium");
    }
  });

  it("Premium: tudo", () => {
    for (const f of ["realtime_dashboard", "sla_weekly", "sla_drilldown", "financial_dashboard", "financial_reports", "reports_performance", "reports_export", "settlement"] as Feature[]) {
      expect(can("total", f), f).toBe(true);
    }
  });
});
