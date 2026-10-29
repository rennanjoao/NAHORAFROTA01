import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, FileText, MapPin, Truck, Gauge } from "lucide-react";
import { PhoneMockup } from "./mockups/PhoneMockup";
import { useParallax } from "../motion/useParallax";

/*
  Cena da capa, montada numa prancha de 600 x 620 e escalada para caber:
    1. mapa da cidade deitado em perspectiva (fundo)
    2. celular do motorista em pe, inclinado em 3D (centro)
    3. canhoto da entrega na frente, a esquerda (apoio)
    4. dois selos presos ao celular, a direita
    5. quatro moedas flutuando em volta, em profundidades diferentes
  Cada camada mexe com o ponteiro (parallax) numa profundidade propria.
*/

const W = 600;
const H = 620;
const SPRING = { type: "spring", stiffness: 90, damping: 18, mass: 0.9 } as const;

function Layer({ depth, className, style, children }: { depth: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={`plx absolute ${className ?? ""}`} style={{ ["--depth" as string]: `${depth}px`, ...style }}>
      {children}
    </div>
  );
}

/** Entrada com mola: sobe, cresce e aparece. */
function Enter({ delay, children, from = { y: 30, scale: 0.94 } }: { delay: number; children: ReactNode; from?: { y?: number; x?: number; scale?: number; rotate?: number } }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, ...from }} animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }} transition={{ ...SPRING, delay }}>
      {children}
    </motion.div>
  );
}

/** "Foto" do canhoto: caixa entregue na porta do cliente (ilustracao). */
function ProofPhoto() {
  return (
    <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pp-wall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#dfe6e3" />
          <stop offset="1" stopColor="#c7d0cc" />
        </linearGradient>
        <linearGradient id="pp-box" x1="0" x2="1">
          <stop offset="0" stopColor="#d4a373" />
          <stop offset="1" stopColor="#b9875a" />
        </linearGradient>
      </defs>
      <rect width="92" height="92" fill="url(#pp-wall)" />
      <rect x="52" y="8" width="30" height="62" rx="2" fill="#30363a" />
      <circle cx="56" cy="42" r="1.6" fill="#04E8A4" />
      <rect x="0" y="70" width="92" height="22" fill="#a8b2ad" />
      <path d="M14 52 L40 46 L62 52 L36 58 Z" fill="#e2b98c" />
      <path d="M14 52 L36 58 L36 80 L14 74 Z" fill="url(#pp-box)" />
      <path d="M36 58 L62 52 L62 74 L36 80 Z" fill="#a9784d" />
      <path d="M25 49 L51 55" stroke="#f3e3c9" strokeWidth="3" />
      <path d="M25 55.2 L25 77" stroke="#f3e3c9" strokeWidth="2.5" />
      <rect x="18" y="62" width="10" height="7" rx="1" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function CityMap() {
  // Ruas em grade, quarteiroes, tres rotas correndo e um veiculo em cada.
  const routes = [
    { d: "M60 300 L60 220 L180 220 L180 140 L300 140 L300 80 L420 80", c: "#04E8A4", dur: "9s" },
    { d: "M60 300 L140 300 L140 260 L260 260 L260 200 L380 200 L380 260 L460 260", c: "#04E8A4", dur: "11s" },
    { d: "M60 300 L60 340 L220 340 L220 300 L340 300 L340 360", c: "#FFC53D", dur: "13s" },
  ];
  return (
    <svg viewBox="0 0 500 400" className="h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="hs-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity="0.09" strokeWidth="1.5" />
        </pattern>
        <radialGradient id="hs-depot" r="0.5">
          <stop offset="0" stopColor="#04E8A4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#04E8A4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="500" height="400" fill="url(#hs-grid)" />
      <g fill="currentColor" fillOpacity="0.06">
        {[[84, 236, 72, 56], [204, 156, 72, 40], [324, 96, 72, 80], [204, 276, 112, 40], [84, 316, 112, 64], [404, 216, 56, 72], [284, 216, 72, 40], [364, 296, 96, 64], [84, 156, 72, 40]].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="6" />
        ))}
      </g>
      {routes.map((r, i) => (
        <g key={i}>
          <path d={r.d} fill="none" stroke={r.c} strokeOpacity="0.25" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
          <path d={r.d} fill="none" stroke={r.c} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" className="route-flow" />
          <circle r="8" fill={r.c} stroke="#fff" strokeWidth="3">
            <animateMotion dur={r.dur} repeatCount="indefinite" path={r.d} />
          </circle>
        </g>
      ))}
      <circle cx="60" cy="300" r="46" fill="url(#hs-depot)" />
      <rect x="40" y="288" width="40" height="24" rx="6" fill="#080808" />
      <text x="60" y="304" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="10" fontWeight="700" fill="#04E8A4">PÁTIO</text>
      {[[420, 80], [460, 260], [340, 360]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="#fff" stroke={i === 2 ? "#FFC53D" : "#04E8A4"} strokeWidth="3" />
          <circle cx={x} cy={y} r="9" fill={i === 2 ? "#FFC53D" : "#04E8A4"} className="ping-ring" />
        </g>
      ))}
    </svg>
  );
}

export function HeroScene() {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useParallax(stage, wrap);

  // Escala a prancha para a largura disponivel (celular, tablet, computador).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrap}
      className="relative mx-auto w-full max-w-[600px]"
      style={{ height: H * scale }}
      role="img"
      aria-label="O app do motorista em primeiro plano, sobre o mapa da cidade com três rotas em andamento. Ao lado, o canhoto digital de uma entrega e os selos de entrega confirmada e de 98% no prazo."
    >
      <div
        ref={stage}
        aria-hidden="true"
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: W, height: H, transform: `scale(${scale})`, perspective: "1600px" }}
      >
        {/* 1. mapa deitado */}
        <Layer depth={-10} className="left-[-96px] top-[168px]" style={{ width: 560, height: 420 }}>
          <Enter delay={0.05} from={{ y: 40, scale: 0.9 }}>
            <div style={{ transform: "rotateX(58deg) rotateZ(-30deg)", transformStyle: "preserve-3d" }}>
              <div className="h-[420px] w-[540px] overflow-hidden rounded-[28px] border border-foreground/10 bg-card text-foreground shadow-[0_40px_80px_-40px_rgba(0,0,0,0.35)]">
                <CityMap />
              </div>
            </div>
          </Enter>
        </Layer>

        {/* sombra do celular sobre o mapa */}
        <Layer depth={-6} className="left-[318px] top-[566px]">
          <div className="h-10 w-64 rounded-[50%] bg-black/25 blur-2xl dark:bg-black/60" />
        </Layer>

        {/* 2. celular */}
        <Layer depth={14} className="left-[292px] top-[6px]">
          <Enter delay={0.2} from={{ y: 60, scale: 0.92 }}>
            <div className="bob-slow">
              <div
                style={{
                  transform: "rotateY(calc(-16deg + var(--px, 0) * 8deg)) rotateX(calc(6deg - var(--py, 0) * 6deg)) rotateZ(1.5deg)",
                  transformStyle: "preserve-3d",
                  transition: "transform 0.1s linear",
                }}
              >
                <div className="relative">
                  <PhoneMockup className="w-[272px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.6)]" />
                  {/* reflexo no vidro */}
                  <div
                    className="pointer-events-none absolute inset-[6px] rounded-[2rem]"
                    style={{ background: "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.10) 48%, transparent 58%)", transform: "translateX(calc(var(--px, 0) * -24px))" }}
                  />
                </div>
              </div>
            </div>
          </Enter>
        </Layer>

        {/* 3. canhoto na frente */}
        <Layer depth={26} className="left-[30px] top-[438px]">
          <Enter delay={0.45} from={{ x: -40, y: 20, rotate: -14 }}>
            <div className="bob bob-delay">
              <div className="w-[250px] rounded-2xl border border-foreground/10 bg-card p-3.5 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)]" style={{ transform: "rotate(-6deg) rotateY(12deg)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-data text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Canhoto digital</span>
                  <span className="rounded-full bg-brand px-2 py-0.5 font-data text-[9px] font-bold uppercase tracking-wider text-nhf-ink">NF 48213</span>
                </div>
                <div className="mt-3 grid grid-cols-[92px_1fr] gap-3">
                  <div className="relative aspect-square overflow-hidden rounded-xl">
                    <ProofPhoto />
                    <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-nhf-ink ring-2 ring-white">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                  </div>
                  <div className="flex flex-col justify-between">
                    <svg viewBox="0 0 120 40" className="h-9 w-full text-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M4 30 C 14 6, 22 34, 34 16 S 52 6, 60 26 S 82 36, 92 14 S 110 8, 116 20" />
                    </svg>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">Maria Santos</p>
                      <p className="text-[11px] text-muted-foreground">Entregue às 14:32</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Enter>
        </Layer>

        {/* 4. selos presos ao celular */}
        <Layer depth={32} className="left-[400px] top-[78px]">
          <Enter delay={0.65} from={{ x: 24, scale: 0.85 }}>
            <div className="bob">
              <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-foreground/10 bg-card py-2 pl-2 pr-4 text-sm font-semibold shadow-[0_16px_36px_-14px_rgba(0,0,0,0.35)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-nhf-ink">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                </span>
                Entregue 18 min antes
              </span>
            </div>
          </Enter>
        </Layer>
        <Layer depth={22} className="left-[430px] top-[340px]">
          <Enter delay={0.8} from={{ x: 24, scale: 0.85 }}>
            <div className="bob-slow bob-delay">
              <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-foreground/10 bg-card py-2 pl-2 pr-4 text-sm font-semibold shadow-[0_16px_36px_-14px_rgba(0,0,0,0.35)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nhf-ink text-nhf-green">
                  <Gauge className="h-4 w-4" />
                </span>
                98% no prazo hoje
              </span>
            </div>
          </Enter>
        </Layer>

        {/* 5. moedas */}
        {[
          { left: 226, top: 96, size: 66, icon: Truck, dark: false, depth: 40, delay: 0.95 },
          { left: 556, top: 214, size: 50, icon: MapPin, dark: true, depth: 48, delay: 1.05 },
          { left: 40, top: 150, size: 48, icon: FileText, dark: true, depth: 34, delay: 1.15 },
          { left: 560, top: 506, size: 44, icon: CheckCircle2, dark: false, depth: 56, delay: 1.25 },
        ].map((c, i) => (
          <Layer key={i} depth={c.depth} style={{ left: c.left, top: c.top }}>
            <Enter delay={c.delay} from={{ scale: 0.4, y: 10 }}>
              <div className={i % 2 ? "bob bob-delay" : "bob-slow"} style={{ perspective: "400px" }}>
                <div className={reduce ? "" : "wobble"} style={{ animationDelay: `${-i * 1.7}s` }}>
                  <span className={`coin ${c.dark ? "coin-dark" : ""}`} style={{ width: c.size, height: c.size }}>
                    <c.icon style={{ width: c.size * 0.4, height: c.size * 0.4 }} strokeWidth={2.2} />
                  </span>
                </div>
              </div>
            </Enter>
          </Layer>
        ))}
      </div>
    </div>
  );
}
