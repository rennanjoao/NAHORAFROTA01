/* Mapa pontilhado do Brasil (contorno aproximado) com rotas saindo de Sao Paulo. Decorativo. */
const OUTLINE: [number, number][] = [
  [-60.7, 5.2], [-57.5, 2.0], [-55.0, 2.4], [-52.0, 2.4], [-51.6, 4.4], [-50.0, 1.0], [-48.5, -0.8], [-46.0, -1.0], [-44.3, -2.5], [-41.8, -2.8],
  [-39.0, -3.0], [-37.2, -4.8], [-35.2, -5.5], [-34.8, -7.5], [-35.2, -9.0], [-36.5, -10.5], [-37.5, -12.0], [-38.6, -13.2], [-39.0, -15.0], [-39.2, -17.5],
  [-39.8, -19.6], [-40.9, -21.5], [-42.0, -22.9], [-44.6, -23.3], [-46.4, -24.1], [-48.0, -25.5], [-48.6, -27.0], [-48.8, -28.5], [-50.2, -30.5], [-51.5, -32.0],
  [-53.4, -33.7], [-53.5, -32.5], [-55.5, -31.0], [-57.6, -30.2], [-56.0, -28.2], [-54.6, -27.0], [-53.8, -25.6], [-54.6, -25.5], [-54.3, -24.0], [-55.4, -23.9],
  [-55.8, -22.3], [-57.8, -22.1], [-57.9, -20.0], [-58.2, -17.4], [-60.2, -16.3], [-60.0, -14.3], [-61.6, -13.5], [-63.5, -12.5], [-65.0, -11.8], [-65.4, -9.8],
  [-67.0, -10.4], [-68.8, -11.0], [-70.6, -10.9], [-70.6, -9.5], [-72.4, -9.5], [-73.2, -9.4], [-73.9, -7.5], [-73.0, -5.2], [-71.0, -4.4], [-70.0, -4.3],
  [-69.4, -1.2], [-69.6, 0.6], [-69.3, 1.5], [-67.3, 2.0], [-66.8, 1.2], [-65.5, 0.8], [-64.2, 1.5], [-63.4, 2.2], [-64.0, 4.0], [-62.8, 4.0], [-61.0, 4.5],
];
const K = 11;
const xy = ([lon, lat]: [number, number]) => [(lon + 75) * K, (6 - lat) * K] as const;
const CITIES: { name: string; ll: [number, number] }[] = [
  { name: "Rio", ll: [-43.2, -22.9] },
  { name: "BH", ll: [-43.9, -19.9] },
  { name: "Curitiba", ll: [-49.3, -25.4] },
  { name: "Porto Alegre", ll: [-51.2, -30.0] },
  { name: "Brasília", ll: [-47.9, -15.8] },
  { name: "Salvador", ll: [-38.5, -13.0] },
  { name: "Recife", ll: [-34.9, -8.05] },
  { name: "Goiânia", ll: [-49.3, -16.7] },
  { name: "Manaus", ll: [-60.0, -3.1] },
];
const HUB = xy([-46.6, -23.5]);

export function BrazilMap({ className }: { className?: string }) {
  const d = OUTLINE.map((p, i) => `${i ? "L" : "M"}${xy(p).join(" ")}`).join(" ") + " Z";
  return (
    <svg viewBox="0 0 460 440" className={className} aria-hidden="true">
      <defs>
        <pattern id="br-dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.7" fill="#04E8A4" fillOpacity="0.55" />
        </pattern>
        <clipPath id="br-clip">
          <path d={d} />
        </clipPath>
        <radialGradient id="br-glow" r="0.5">
          <stop offset="0" stopColor="#04E8A4" stopOpacity="0.35" />
          <stop offset="1" stopColor="#04E8A4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={HUB[0]} cy={HUB[1]} r="140" fill="url(#br-glow)" />
      <rect width="460" height="440" fill="url(#br-dots)" clipPath="url(#br-clip)" />
      <path d={d} fill="none" stroke="#04E8A4" strokeOpacity="0.35" strokeWidth="1.2" strokeLinejoin="round" />
      {CITIES.map((c) => {
        const [x, y] = xy(c.ll);
        const mx = (x + HUB[0]) / 2;
        const my = (y + HUB[1]) / 2 - Math.hypot(x - HUB[0], y - HUB[1]) * 0.25;
        return (
          <g key={c.name}>
            <path d={`M${HUB[0]} ${HUB[1]} Q${mx} ${my} ${x} ${y}`} fill="none" stroke="#04E8A4" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="3 4" />
            <circle cx={x} cy={y} r="3.5" fill="#04E8A4" />
          </g>
        );
      })}
      <circle cx={HUB[0]} cy={HUB[1]} r="6" fill="#04E8A4" />
      <circle cx={HUB[0]} cy={HUB[1]} r="6" fill="#04E8A4" className="ping-ring" />
    </svg>
  );
}
