import { describe, expect, it } from "vitest";
import { invoiceError, workDaysLabel } from "./providerInvoices";

describe("workDaysLabel", () => {
  it("junta os dias do mesmo mes", () => {
    expect(workDaysLabel(["2026-10-03", "2026-10-01", "2026-10-02"])).toBe("1, 2 e 3/out");
  });
  it("mostra o mes de cada dia quando muda de mes", () => {
    expect(workDaysLabel(["2026-10-01", "2026-09-30"])).toBe("30/set e 1/out");
  });
  it("um dia so", () => {
    expect(workDaysLabel(["2026-10-09"])).toBe("9/out");
  });
});

describe("invoiceError", () => {
  it("mostra a mensagem do banco escrita para o usuario", () => {
    expect(invoiceError({ message: "Algum desses dias já está na nota 1001. Tire o dia repetido." })).toContain("nota 1001");
  });
  it("esconde erro tecnico", () => {
    expect(invoiceError({ message: "permission denied for function submit_provider_invoice" })).toBe("Confira a internet e tente de novo.");
  });
});
