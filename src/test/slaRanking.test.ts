import { describe, expect, it } from "vitest";
import { periodStart, rankBySLA } from "@/lib/slaRanking";

interface Row {
  name: string;
  sla: number;
  total: number;
}

const rank = (rows: Row[]) =>
  rankBySLA(rows, (r) => r.sla, (r) => r.total, (r) => r.name).map(({ item, rank }) => [item.name, rank]);

describe("rankBySLA", () => {
  it("ordena do melhor para o pior SLA", () => {
    expect(
      rank([
        { name: "Carlos", sla: 80, total: 10 },
        { name: "Ana", sla: 100, total: 4 },
        { name: "Bruno", sla: 92.5, total: 8 },
      ]),
    ).toEqual([["Ana", 1], ["Bruno", 2], ["Carlos", 3]]);
  });

  it("desempata por volume e depois por nome", () => {
    expect(
      rank([
        { name: "Zé", sla: 100, total: 3 },
        { name: "Bia", sla: 100, total: 9 },
        { name: "Ari", sla: 100, total: 3 },
      ]),
    ).toEqual([["Bia", 1], ["Ari", 2], ["Zé", 3]]);
  });

  it("coloca quem nao tem entregas no fim, sem posicao", () => {
    expect(
      rank([
        { name: "Sem baixa", sla: 100, total: 0 },
        { name: "Com baixa", sla: 50, total: 2 },
      ]),
    ).toEqual([["Com baixa", 1], ["Sem baixa", null]]);
  });
});

describe("periodStart", () => {
  it("volta N dias a partir de agora", () => {
    expect(periodStart(7, new Date("2026-10-28T12:00:00Z"))).toBe("2026-10-21T12:00:00.000Z");
  });
});
