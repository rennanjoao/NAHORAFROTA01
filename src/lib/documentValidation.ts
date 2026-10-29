// Validacao e formatacao de documentos de cobranca (CPF ou CNPJ).
// A mesma regra roda no servidor em supabase/functions/_shared/documents.ts.

export type DocumentType = "cpf" | "cnpj";

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0);
  const check = (rest: number) => (rest < 2 ? 0 : 11 - rest);

  const d1 = check(calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);
  const d2 = check(calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);

  return Number(cnpj[12]) === d1 && Number(cnpj[13]) === d2;
}

/** Retorna o tipo do documento quando ele e valido, ou null. */
export function detectDocumentType(value: string): DocumentType | null {
  const digits = onlyDigits(value);
  if (digits.length === 11 && isValidCPF(digits)) return "cpf";
  if (digits.length === 14 && isValidCNPJ(digits)) return "cnpj";
  return null;
}

/** Mascara progressiva: CPF ate 11 digitos, CNPJ a partir do 12o. */
export function formatDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
