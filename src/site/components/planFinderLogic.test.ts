import { describe, expect, it } from "vitest";
import { FINDER_DEFAULT, recommend } from "./planFinderLogic";

const base = { ...FINDER_DEFAULT, drivers: 10, vehicles: 5, users: 2 };

describe("recomendador de plano", () => {
  it("operação pequena sem recursos extras fica no Básico", () => {
    expect(recommend(base).plan).toBe("basic");
  });

  it("passar de 50 motoristas, 20 veículos ou 5 usuários leva ao Controle", () => {
    expect(recommend({ ...base, drivers: 51 }).plan).toBe("control");
    expect(recommend({ ...base, vehicles: 21 }).plan).toBe("control");
    const r = recommend({ ...base, users: 6 });
    expect(r.plan).toBe("control");
    expect(r.reasons[0]).toContain("6 pessoas");
  });

  it("passar dos limites do Controle leva ao Controle Total", () => {
    expect(recommend({ ...base, drivers: 201 }).plan).toBe("total");
    expect(recommend({ ...base, vehicles: 101 }).plan).toBe("total");
    expect(recommend({ ...base, users: 21 }).plan).toBe("total");
  });

  it("XML em lote e SLA pedem o Controle; acerto e relatórios financeiros pedem o Total", () => {
    expect(recommend({ ...base, xml: true }).plan).toBe("control");
    expect(recommend({ ...base, sla: true }).plan).toBe("control");
    expect(recommend({ ...base, acerto: true }).plan).toBe("total");
    expect(recommend({ ...base, financeiro: true }).plan).toBe("total");
  });

  it("explica cada motivo", () => {
    const r = recommend({ ...base, drivers: 80, acerto: true });
    expect(r.plan).toBe("total");
    expect(r.reasons).toHaveLength(2);
  });
});
