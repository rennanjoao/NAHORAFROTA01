import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PLANS, PLAN_BY_ID, formatBRL, formatPriceShort, isPlanId } from "./plans";

describe("planos", () => {
  it("tem os três planos com os preços vendidos", () => {
    expect(PLANS.map((p) => [p.id, p.amountCents])).toEqual([
      ["basic", 19700],
      ["control", 37000],
      ["total", 55000],
    ]);
  });

  it("formata preço em reais", () => {
    expect(formatPriceShort(19700).replace(/\s/g, " ")).toBe("R$ 197");
    expect(formatBRL(37000).replace(/\s/g, " ")).toBe("R$ 370,00");
    expect(isPlanId("control")).toBe(true);
    expect(isPlanId("gold")).toBe(false);
  });

  it("é igual ao espelho do servidor (supabase/functions/_shared/plans.ts)", () => {
    const src = readFileSync(path.join(process.cwd(), "supabase/functions/_shared/plans.ts"), "utf8");
    for (const p of PLANS) {
      const re = new RegExp(`${p.id}: \\{ id: "${p.id}", name: "${p.name}", amountCents: ${p.amountCents}, limits: \\{ users: ${p.limits.users}, drivers: ${p.limits.drivers}, vehicles: ${p.limits.vehicles} \\} \\}`);
      expect(src, `plano ${p.id} divergente no servidor`).toMatch(re);
    }
    expect(PLAN_BY_ID.control.highlight).toBe(true);
  });
});
