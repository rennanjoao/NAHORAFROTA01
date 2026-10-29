import { useId } from "react";
import { cn } from "@/lib/utils";
import { NODES, ROUTE_TILE_H as H, ROUTE_TILE_W as W, ROWS, routeNode } from "./brandRoutesGeometry";

/*
 * Padrao "rotas" do manual da marca (brand/padroes/nhf-padrao-rotas-*.svg):
 * diagonais a 45 graus a cada 160, ruas horizontais a cada 120 e paradas em
 * alguns cruzamentos. Ladrilho de 960 x 480 (repete sem emenda: 960 e 480 sao
 * multiplos de 160). A origem fica no centro do elemento, para o desenho cair
 * no mesmo lugar em relacao ao conteudo centralizado em qualquer largura.
 */
type Props = {
  className?: string;
  /** Escala do ladrilho (1 = tamanho do manual). */
  scale?: number;
  /** Paradas acesas em verde, em coordenadas a partir do centro (antes da escala). */
  lit?: [number, number][];
};

export function BrandRoutes({ className, scale = 1, lit = [] }: Props) {
  const id = useId().replace(/:/g, "");
  const sw = 1 / scale;
  return (
    <svg aria-hidden="true" className={cn("brand-routes pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={`r-${id}`} width={W} height={H} patternUnits="userSpaceOnUse" patternTransform={`scale(${scale})`}>
          <g fill="none" stroke="currentColor" strokeWidth={sw}>
            <g className="brand-routes-diag">
              {Array.from({ length: (W + H) / 160 + 1 }, (_, i) => {
                const c = i * 160;
                return <path key={c} d={`M${c + 20} -20 L${c - H - 20} ${H + 20}`} />;
              })}
            </g>
            <g className="brand-routes-street">
              {ROWS.map((y) => (
                <path key={y} d={`M-10 ${y} H${W + 10}`} />
              ))}
            </g>
          </g>
          <g className="brand-routes-node" fill="currentColor">
            {NODES.map(([r, k]) => {
              const [x, y] = routeNode(r, k);
              return <circle key={`${r}-${k}`} cx={x} cy={y} r={4.5 * sw} />;
            })}
          </g>
        </pattern>
      </defs>
      <svg x="50%" overflow="visible">
        <rect x={-4000} y={0} width={8000} height={4000} fill={`url(#r-${id})`} />
        {lit.map(([x, y], i) => (
          <g key={i} transform={`translate(${x * scale} ${y * scale})`}>
            <circle r={4.5} className="brand-routes-lit ping-ring" style={{ animationDelay: `${i * 0.9}s`, animationDuration: "3.6s" }} />
            <circle r={4.5} className="brand-routes-lit" />
          </g>
        ))}
      </svg>
    </svg>
  );
}
