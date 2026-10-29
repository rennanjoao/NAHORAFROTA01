export function onlyDigits(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function isValidCnpj(cnpj: string): boolean {
  const c = onlyDigits(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (digits: string, weights: number[]) => digits.split("").reduce((s, d, i) => s + Number(d) * weights[i], 0);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = ((r) => (r < 2 ? 0 : 11 - r))(calc(c.slice(0, 12), w1) % 11);
  const d2 = ((r) => (r < 2 ? 0 : 11 - r))(calc(c.slice(0, 13), w2) % 11);
  return Number(c[12]) === d1 && Number(c[13]) === d2;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v) && v.length <= 254;
}

export function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function cleanText(v: unknown, max = 120): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isValidWhatsApp(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

export function formatCnpj(c: string): string {
  const d = onlyDigits(c);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
