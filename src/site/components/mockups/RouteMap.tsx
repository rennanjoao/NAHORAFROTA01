import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const ROUTES = [
  { id: "r-ok", d: "M90,330 C160,250 230,290 300,210 S420,120 540,90", color: "hsl(var(--brand))", plate: "ABC1D23", dur: "14s", begin: "0s", stops: [[230, 262], [372, 150], [540, 90]] },
  { id: "r-warn", d: "M90,330 C200,360 300,380 420,320 S560,300 590,220", color: "#FFC53D", plate: "DEF7G89", dur: "18s", begin: "-6s", stops: [[300, 372], [470, 311], [590, 220]] },
  { id: "r-late", d: "M90,330 C120,200 180,150 230,80 S330,40 420,60", color: "#FF4D4F", plate: "GHI4J56", dur: "16s", begin: "-10s", stops: [[160, 160], [300, 48], [420, 60]] },
] as const;

type Props = { className?: string; showLegend?: boolean; compact?: boolean };

/** Mapa de rotas animado (SVG puro): grade de ruas, três rotas e placas em movimento. */
export function RouteMap({ className, showLegend = true, compact = false }: Props) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 640 420" className={cn("h-full w-full", className)} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="streets" width="80" height="60" patternUnits="userSpaceOnUse">
          <path d="M80 0H0V60" fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth="1" />
        </pattern>
        <radialGradient id="depot-glow" r="0.5">
          <stop offset="0" stopColor="hsl(var(--brand))" stopOpacity="0.45" />
          <stop offset="1" stopColor="hsl(var(--brand))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fade-r" x1="0" x2="1">
          <stop offset="0" stopColor="hsl(var(--card))" stopOpacity="0" />
          <stop offset="1" stopColor="hsl(var(--card))" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect width="640" height="420" fill="url(#streets)" />
      {/* quarteirões */}
      <g fill="hsl(var(--foreground) / 0.035)">
        <rect x="88" y="68" width="150" height="48" />
        <rect x="330" y="128" width="130" height="48" />
        <rect x="250" y="248" width="150" height="48" />
        <rect x="490" y="308" width="100" height="48" />
        <rect x="8" y="188" width="150" height="48" />
      </g>
      {/* avenidas */}
      <g stroke="hsl(var(--foreground) / 0.14)" strokeWidth="3" fill="none">
        <path d="M0 240 H640" />
        <path d="M400 0 V420" />
      </g>

      {/* rotas */}
      {ROUTES.map((r) => (
        <g key={r.id}>
          <path id={r.id} d={r.d} fill="none" stroke={r.color} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.9" />
          <path d={r.d} fill="none" stroke={r.color} strokeWidth="8" strokeLinecap="round" strokeOpacity="0.12" />
          {r.stops.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="hsl(var(--card))" stroke={r.color} strokeWidth="2" />
            </g>
          ))}
        </g>
      ))}

      {/* pátio */}
      <circle cx="90" cy="330" r="46" fill="url(#depot-glow)" />
      <circle cx="90" cy="330" r="7" fill="hsl(var(--brand))" />
      <circle cx="90" cy="330" r="7" fill="none" stroke="hsl(var(--brand))" strokeWidth="2">
        {!reduce && <animate attributeName="r" values="7;26" dur="2.2s" repeatCount="indefinite" />}
        {!reduce && <animate attributeName="opacity" values="0.8;0" dur="2.2s" repeatCount="indefinite" />}
      </circle>
      <text x="90" y="366" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="10" fontWeight="700" letterSpacing="1" fill="hsl(var(--foreground) / 0.7)">
        PÁTIO
      </text>

      {/* veículos */}
      {ROUTES.map((r, i) => (
        <g key={`v-${r.id}`}>
          <g>
            {!reduce ? (
              <animateMotion dur={r.dur} begin={r.begin} repeatCount="indefinite" rotate="auto" calcMode="linear">
                <mpath href={`#${r.id}`} />
              </animateMotion>
            ) : null}
            {reduce && <animateMotion dur="1s" begin="0s" fill="freeze" keyPoints={`${0.45 + i * 0.15};${0.45 + i * 0.15}`} keyTimes="0;1" rotate="auto"><mpath href={`#${r.id}`} /></animateMotion>}
            <rect x="-11" y="-6" width="22" height="12" rx="2" fill={r.color} />
            <rect x="4" y="-6" width="7" height="12" rx="1.5" fill="hsl(var(--background))" fillOpacity="0.55" />
            <circle cx="-5" cy="7" r="2" fill="hsl(var(--background))" />
            <circle cx="6" cy="7" r="2" fill="hsl(var(--background))" />
          </g>
          {!compact && (
            <g>
              {!reduce ? (
                <animateMotion dur={r.dur} begin={r.begin} repeatCount="indefinite" calcMode="linear">
                  <mpath href={`#${r.id}`} />
                </animateMotion>
              ) : (
                <animateMotion dur="1s" begin="0s" fill="freeze" keyPoints={`${0.45 + i * 0.15};${0.45 + i * 0.15}`} keyTimes="0;1"><mpath href={`#${r.id}`} /></animateMotion>
              )}
              <rect x="-26" y="-30" width="52" height="16" rx="2" fill="hsl(var(--background))" stroke={r.color} strokeWidth="1" />
              <text x="0" y="-18.5" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="9.5" fontWeight="700" letterSpacing="0.8" fill="hsl(var(--foreground))">
                {r.plate}
              </text>
            </g>
          )}
        </g>
      ))}

      {showLegend && (
        <g fontFamily="Space Grotesk, sans-serif" fontSize="9.5" fontWeight="600" letterSpacing="0.8">
          <rect x="12" y="382" width="226" height="26" rx="3" fill="hsl(var(--card))" fillOpacity="0.9" stroke="hsl(var(--border))" />
          <circle cx="26" cy="395" r="4" fill="hsl(var(--brand))" />
          <text x="35" y="398.5" fill="hsl(var(--foreground) / 0.85)">NO PRAZO</text>
          <circle cx="104" cy="395" r="4" fill="#FFC53D" />
          <text x="113" y="398.5" fill="hsl(var(--foreground) / 0.85)">ATENÇÃO</text>
          <circle cx="176" cy="395" r="4" fill="#FF4D4F" />
          <text x="185" y="398.5" fill="hsl(var(--foreground) / 0.85)">ATRASADO</text>
        </g>
      )}
    </svg>
  );
}
