import { describe, expect, it } from "vitest";
import { FINDER_DEFAULT, recommend } from "./planFinderLogic";

const base = { ...FINDER_DEFAULT, drivers: 2, users: 2 };

describe("recomendador de plano", () => {
  it("operação pequena sem recursos extras fica no Basic", () => {
    const r = recommend(base);
    expect(r.plan).toBe("basic");
    expect(r.monthlyCents).toBe(19700);
  });

  it("de 4 a 15 motoristas ou mais de 5 pessoas leva ao Standard", () => {
    expect(recommend({ ...base, drivers: 4 }).plan).toBe("control");
    expect(recommend({ ...base, drivers: 15 }).plan).toBe("control");
    const r = recommend({ ...base, users: 6 });
    expect(r.plan).toBe("control");
    expect(r.reasons[0]).toContain("6 pessoas");
  });

  it("de 16 motoristas ou mais de 20 pessoas leva ao Premium", () => {
    expect(recommend({ ...base, drivers: 16 }).plan).toBe("total");
    expect(recommend({ ...base, drivers: 50 }).extraDrivers).toBe(0);
    expect(recommend({ ...base, users: 21 }).plan).toBe("total");
  });

  it("acima de 50 motoristas soma R$ 10 por motorista", () => {
    const r = recommend({ ...base, drivers: 60 });
    expect(r.plan).toBe("total");
    expect(r.extraDrivers).toBe(10);
    expect(r.monthlyCents).toBe(59900 + 10 * 1000);
    expect(r.reasons.at(-1)).toContain("10 saem por R$");
  });

  it("mapa e SLA pedem o Standard; tempo real e rentabilidade pedem o Premium", () => {
    expect(recommend({ ...base, mapa: true }).plan).toBe("control");
    expect(recommend({ ...base, sla: true }).plan).toBe("control");
    expect(recommend({ ...base, tempoReal: true }).plan).toBe("total");
    expect(recommend({ ...base, analise: true }).plan).toBe("total");
  });

  it("explica cada motivo", () => {
    const r = recommend({ ...base, drivers: 10, tempoReal: true });
    expect(r.plan).toBe("total");
    expect(r.reasons).toHaveLength(2);
  });
});
