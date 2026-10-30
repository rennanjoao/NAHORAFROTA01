import { describe, expect, it } from "vitest";
import { cargoTheft, riskLevelForShare, summarizeTheft, type CargoTheftData } from "./riskStats";

const data: CargoTheftData = {
  source: "teste",
  sourceUrl: "",
  updatedAt: "2026-10-30",
  latestMonth: "2026-03",
  byState: {
    SP: { "2024": Array(12).fill(10), "2025": [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], "2026": [5, 5, 5] },
    RJ: { "2024": Array(12).fill(5), "2025": [5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0], "2026": [10, 10, 10] },
    AC: { "2024": Array(12).fill(0), "2025": Array(12).fill(0), "2026": [0, 0, 0] },
  },
};

describe("summarizeTheft", () => {
  it("compara o ano atual com o mesmo periodo do ano anterior", () => {
    const s = summarizeTheft(data);
    expect(s.periodLabel).toBe("jan a mar/2026");
    expect(s.nationalYtd).toBe(45);
    expect(s.nationalPreviousYtd).toBe(45);
    expect(s.nationalChange).toBe(0);
    expect(s.lastYearTotal).toBe(135);
    expect(s.lastYearChange).toBe(-25);
  });

  it("ordena os estados e calcula parte, media e variacao", () => {
    const [rj, sp, ac] = summarizeTheft(data).states;
    expect(rj).toMatchObject({ uf: "RJ", ytd: 30, share: 66.7, monthlyAverage: 10, change: 100 });
    expect(sp).toMatchObject({ uf: "SP", ytd: 15, share: 33.3, change: -50 });
    expect(ac.change).toBeNull();
  });

  it("classifica o risco pela parte do pais", () => {
    expect(riskLevelForShare(52)).toBe("critical");
    expect(riskLevelForShare(3.3)).toBe("high");
    expect(riskLevelForShare(2.4)).toBe("medium");
  });

  it("le a base oficial gerada pelo script (Sinesp)", () => {
    expect(cargoTheft.year).toBeGreaterThanOrEqual(2026);
    expect(cargoTheft.states).toHaveLength(27);
    expect(cargoTheft.nationalYtd).toBeGreaterThan(0);
  });
});
