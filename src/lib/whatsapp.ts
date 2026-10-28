/**
 * Numero no formato do WhatsApp (55 + DDD + numero). Aceita com ou sem 55 e com
 * mascara; devolve null quando nao da para montar um numero valido.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const number = whatsappNumber(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  if (number) return `https://wa.me/${number}${query}`;
  return text ? `https://wa.me/${query}` : null;
}

/** Abre a conversa; sem telefone valido nao faz nada e devolve false. */
export function openWhatsApp(phone: string | null | undefined, text?: string): boolean {
  const url = whatsappUrl(phone, text);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
