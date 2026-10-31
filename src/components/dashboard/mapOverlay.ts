/*
 * Painel de atualizacoes flutuando no canto direito do mapa (telas de 1280 px para cima;
 * abaixo disso ele vai para baixo do mapa). O "Mostrar todos" deixa os veiculos a
 * esquerda dele.
 */
export const MAP_OVERLAY_QUERY = "(min-width: 1280px)";

/** Largura do painel (21rem) mais as folgas em volta. */
const OVERLAY_SPACE = 336 + 12 + 40;

export function mapFitPadding(hasOverlay: boolean): { top: number; bottom: number; left: number; right: number } {
  const floating = hasOverlay && typeof window !== "undefined" && window.matchMedia(MAP_OVERLAY_QUERY).matches;
  return { top: 50, bottom: 50, left: 50, right: floating ? OVERLAY_SPACE : 50 };
}
