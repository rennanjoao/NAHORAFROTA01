/*
 * Avatares de iniciais do DiceBear vinham com cor de fundo aleatoria. Agora cada pessoa
 * tem uma cor fixa (pelo nome), sempre fundo escuro com texto vivo da paleta da marca,
 * que passa o contraste nos dois temas.
 */
const AVATAR_PAIRS: Array<[string, string]> = [
  ["0f3d30", "04e8a4"], // verde
  ["10284a", "5eb1ff"], // azul
  ["3d2a06", "ffc53d"], // ambar
  ["2a1f4a", "b69cff"], // violeta
  ["0b3640", "4fd6e6"], // petroleo
];

function pairFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length];
}

export function brandAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!url.includes("api.dicebear.com") || !url.includes("/initials/")) return url;
  try {
    const parsed = new URL(url);
    const [bg, text] = pairFor(parsed.searchParams.get("seed") || url);
    parsed.searchParams.set("backgroundColor", bg);
    parsed.searchParams.set("textColor", text);
    parsed.searchParams.set("fontFamily", "Helvetica");
    parsed.searchParams.set("fontWeight", "600");
    return parsed.toString();
  } catch {
    return url;
  }
}
