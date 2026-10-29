/* Geometria do padrao "rotas" da marca (ver BrandRoutes.tsx). */
export const ROUTE_TILE_W = 960;
export const ROUTE_TILE_H = 480;
export const ROWS = [60, 180, 300, 420];
/* Primeiro cruzamento de cada rua no ladrilho (x = -y mod 160). */
const FIRST = ROWS.map((y) => (((-y % 160) + 160) % 160));
/* Paradas escolhidas a mao, irregulares como no manual: [rua, cruzamento]. */
export const NODES: [number, number][] = [[0, 0], [0, 1], [0, 3], [1, 3], [1, 4], [2, 0], [2, 2], [2, 5], [3, 1], [3, 4]];

export function routeNode(row: number, k: number): [number, number] {
  return [FIRST[((row % 4) + 4) % 4] + 160 * k, ROWS[((row % 4) + 4) % 4] + ROUTE_TILE_H * Math.floor(row / 4)];
}
