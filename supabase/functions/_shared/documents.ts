// Validacao de CPF/CNPJ para as edge functions.
// Mantenha em sincronia com src/lib/documentValidation.ts.

export type DocumentType = "cpf" | "cnpj";

export function onlyDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
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

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
  const check = (rest: number) => (rest < 2 ? 0 : 11 - rest);

  const firstDigit = check(calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);
  const secondDigit = check(calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);

  return Number(cnpj[12]) === firstDigit && Number(cnpj[13]) === secondDigit;
}

export function detectDocumentType(value: string): DocumentType | null {
  const digits = onlyDigits(value);
  if (digits.length === 11 && isValidCpf(digits)) return "cpf";
  if (digits.length === 14 && isValidCnpj(digits)) return "cnpj";
  return null;
}
