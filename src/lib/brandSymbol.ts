/** Geometria do simbolo Na Hora Frota (brand/logo/svg/nhf-simbolo-*.svg, viewBox 0 0 365 212). */
export const SYMBOL_VIEWBOX = "0 0 365 212";
export const SYMBOL_PATHS = [
  "M0,161 L129.22,27.78 A11,11 0 0 1 144.78,27.78 L216.96,99.96 L181.6,135.31 L137,90.71 L70.71,161 Z",
  "M117.64,212 L297.64,32 L203,32 L235,0 L365,0 L365,98 L333,130 L333,67.36 L188.36,212 Z",
];

/** Cores funcionais do manual (significado fixo). */
export const STATUS_HEX = {
  ok: "#04E8A4", // no prazo, online, entregue
  alert: "#FFC53D", // atencao, SLA a vencer
  late: "#FF4D4F", // atrasado, ocorrencia
  info: "#3B9CFF", // em transito, informacao
  idle: "#8A9199", // inativo, sem sinal, finalizado
  ink: "#080808",
} as const;

/**
 * Marcador de veiculo do manual: simbolo sobre circulo preto, anel na cor do status
 * e a seta apontando o sentido do veiculo (heading em graus, 0 = norte).
 */
export function vehicleMarkerHtml(color: string, heading = 0, size = 38): string {
  // A seta do simbolo aponta para nordeste (45 graus).
  const rotation = Number(heading || 0) - 45;
  const paths = SYMBOL_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join("");
  return `
    <div style="width:${size}px;height:${size}px;border-radius:999px;background:${STATUS_HEX.ink};border:2px solid ${color};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.6)">
      <svg viewBox="${SYMBOL_VIEWBOX}" width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.36)}" style="transform:rotate(${rotation}deg)" aria-hidden="true">${paths}</svg>
    </div>`;
}
