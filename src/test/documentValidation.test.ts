import { describe, expect, it } from "vitest";
import { detectDocumentType, formatDocument, isValidCNPJ, isValidCPF } from "@/lib/documentValidation";

describe("documentValidation", () => {
  it("valida CPF", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("valida CNPJ", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-80")).toBe(false);
    expect(isValidCNPJ("00000000000000")).toBe(false);
  });

  it("detecta o tipo do documento de cobranca", () => {
    expect(detectDocumentType("52998224725")).toBe("cpf");
    expect(detectDocumentType("11222333000181")).toBe("cnpj");
    expect(detectDocumentType("123")).toBeNull();
  });

  it("formata CPF e CNPJ conforme a quantidade de digitos", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });
});
