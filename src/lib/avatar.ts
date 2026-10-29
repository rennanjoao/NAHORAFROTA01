/**
 * Avatares de iniciais do DiceBear vinham com cor de fundo aleatoria (vermelho,
 * roxo...). Manual da marca: Verde Tinta com texto Verde Na Hora (7,6:1).
 */
export function brandAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!url.includes("api.dicebear.com") || !url.includes("/initials/")) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("backgroundColor", "0f3d30");
    parsed.searchParams.set("textColor", "04e8a4");
    parsed.searchParams.set("fontFamily", "Helvetica");
    parsed.searchParams.set("fontWeight", "600");
    return parsed.toString();
  } catch {
    return url;
  }
}
