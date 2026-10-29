import { describe, it, expect } from "vitest";
import { buildWhatsAppLink } from "./checkout";

describe("buildWhatsAppLink", () => {
  it("prefixa o DDI 55 e codifica a mensagem", () => {
    const url = buildWhatsAppLink("(11) 99999-8888", "Login: a@b.com\nSenha: X");
    expect(url).toBe("https://wa.me/5511999998888?text=Login%3A%20a%40b.com%0ASenha%3A%20X");
  });
  it("não duplica o 55", () => {
    expect(buildWhatsAppLink("5511999998888", "x")).toContain("wa.me/5511999998888?");
  });
});
