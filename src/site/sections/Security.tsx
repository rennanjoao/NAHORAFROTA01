import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { Check, Lock, ShieldCheck, X } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const ITEMS = [
  ["Isolamento por empresa", "Cada cliente enxerga só os próprios dados. A regra vale no servidor, não só na tela."],
  ["Login por pessoa", "Senha temporária trocada no primeiro acesso. Perfis por função e motorista só no app dele."],
  ["Conexão segura", "HTTPS em tudo. Fotos e assinaturas em armazenamento privado."],
  ["Banco gerenciado", "Postgres no Supabase, com regra de acesso por linha em todas as tabelas."],
  ["LGPD", "Dados usados só para operar o serviço. Você exporta ou apaga quando quiser."],
];

/* ---------- ilustracao: a sua empresa isolada (isometrico em SVG) ---------- */
const VB = { w: 520, h: 400 };
const O = { x: 260, y: 214 };
const S = 64; // lado de cada empresa
const G = 24; // rua entre elas
const iso = (X: number, Y: number, Z = 0): [number, number] => [O.x + (X - Y) * 0.866, O.y + (X + Y) * 0.5 - Z];
const pts = (list: [number, number, number][]) => list.map(([X, Y, Z]) => iso(X, Y, Z).map((n) => n.toFixed(1)).join(",")).join(" ");
const pct = ([x, y]: [number, number]) => ({ left: `${(x / VB.w) * 100}%`, top: `${(y / VB.h) * 100}%` });

function boxFaces(X0: number, Y0: number, h: number) {
  return {
    top: pts([[X0, Y0, h], [X0 + S, Y0, h], [X0 + S, Y0 + S, h], [X0, Y0 + S, h]]),
    left: pts([[X0, Y0 + S, 0], [X0 + S, Y0 + S, 0], [X0 + S, Y0 + S, h], [X0, Y0 + S, h]]),
    right: pts([[X0 + S, Y0, 0], [X0 + S, Y0 + S, 0], [X0 + S, Y0 + S, h], [X0 + S, Y0, h]]),
  };
}

const NEIGHBORS = [-1, 0, 1]
  .flatMap((i) => [-1, 0, 1].map((j) => [i, j] as const))
  .filter(([i, j]) => i || j)
  .sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

const LOW = 8;
const HIGH = 60;
/* Rua do seu acesso (Y = 44) e da tentativa de fora (X = 44). */
const OWN_PATH = [iso(-150, 44), iso(0, 44), iso(0, 33)];
const BLOCKED_PATH = [iso(44, -150), iso(44, -44), iso(38, -38)];
const d = (list: [number, number][]) => "M" + list.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join(" L");

function TenantIsolation() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const mv = useMotionValue(reduce ? HIGH : LOW);
  const [h, setH] = useState(reduce ? HIGH : LOW);
  useMotionValueEvent(mv, "change", setH);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(mv, HIGH, { duration: 1.3, delay: 0.25, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, reduce, mv]);
  const raised = h > HIGH - 6;
  const own = boxFaces(-S / 2, -S / 2, h);
  const floor = pts([[-150, -150, 0], [150, -150, 0], [150, 150, 0], [-150, 150, 0]]);
  const floorL = pts([[-150, 150, 0], [150, 150, 0], [150, 150, -12], [-150, 150, -12]]);
  const floorR = pts([[150, -150, 0], [150, 150, 0], [150, 150, -12], [150, -150, -12]]);
  const ring = pts([[-38, -38, 0], [38, -38, 0], [38, 38, 0], [-38, 38, 0]]);
  const gate = iso(0, 38);
  const stop = iso(44, -44);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[580px]" role="img" aria-label="Ilustração: a sua empresa num bloco separado. A sua equipe entra depois de o login ser conferido; outra empresa que tenta acessar os seus dados é bloqueada.">
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="ti-glow" r="0.5">
            <stop offset="0" stopColor="hsl(var(--brand))" stopOpacity="0.45" />
            <stop offset="1" stopColor="hsl(var(--brand))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ti-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5BF5C6" />
            <stop offset="1" stopColor="#04E8A4" />
          </linearGradient>
        </defs>

        {/* chao com espessura e ruas */}
        <polygon points={floorL} fill="hsl(var(--foreground) / 0.10)" />
        <polygon points={floorR} fill="hsl(var(--foreground) / 0.06)" />
        <polygon points={floor} fill="hsl(var(--background))" stroke="hsl(var(--foreground) / 0.10)" />
        {[-44, 44].map((k) => (
          <g key={k} stroke="hsl(var(--foreground) / 0.10)" strokeDasharray="3 6">
            <path d={d([iso(k, -150), iso(k, 150)])} />
            <path d={d([iso(-150, k), iso(150, k)])} />
          </g>
        ))}
        <ellipse cx={O.x} cy={O.y} rx="120" ry="66" fill="url(#ti-glow)" opacity={raised ? 1 : 0.4} style={{ transition: "opacity .8s ease" }} />

        {/* outras empresas: baixas, cinza, trancadas */}
        {NEIGHBORS.map(([i, j]) => {
          const f = boxFaces(i * (S + G) - S / 2, j * (S + G) - S / 2, LOW);
          const [cx, cy] = iso(i * (S + G), j * (S + G), LOW);
          return (
            <g key={`${i}${j}`}>
              <polygon points={f.left} fill="hsl(var(--foreground) / 0.14)" />
              <polygon points={f.right} fill="hsl(var(--foreground) / 0.08)" />
              <polygon points={f.top} fill="hsl(var(--card))" stroke="hsl(var(--foreground) / 0.14)" />
              <g transform={`translate(${cx} ${cy})`} fill="none" stroke="hsl(var(--foreground) / 0.35)" strokeWidth="1.6" strokeLinecap="round">
                <rect x="-6" y="-3" width="12" height="9" rx="2" fill="hsl(var(--foreground) / 0.08)" />
                <path d="M-3.5 -3 v-2.5 a3.5 3.5 0 0 1 7 0 v2.5" />
              </g>
            </g>
          );
        })}

        {/* perimetro da sua empresa (regra no servidor) */}
        <polygon points={ring} fill="none" stroke="hsl(var(--brand))" strokeWidth="2" className="route-flow" opacity="0.9" />

        {/* a sua empresa: sobe ao aparecer */}
        <polygon points={own.left} fill="#02B47F" />
        <polygon points={own.right} fill="#03CF92" />
        <polygon points={own.top} fill="url(#ti-top)" stroke="#8DFFD9" strokeWidth="1" />
        {/* simbolo da marca na face da frente (mesma inclinacao da face) */}
        {(() => {
          const [ex, ey] = iso(-S / 2 + 9, S / 2, h * 0.5 + 13);
          return (
            <g transform={`matrix(0.866 0.5 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}) scale(0.125)`} fill="#080808" fillOpacity="0.32">
              <path d="M0,161 L129.22,27.78 A11,11 0 0 1 144.78,27.78 L216.96,99.96 L181.6,135.31 L137,90.71 L70.71,161 Z" />
              <path d="M117.64,212 L297.64,32 L203,32 L235,0 L365,0 L365,98 L333,130 L333,67.36 L188.36,212 Z" />
            </g>
          );
        })()}

        {/* seu acesso: entra pela porta conferida */}
        <path d={d(OWN_PATH)} fill="none" stroke="hsl(var(--brand))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {!reduce && (
          <circle r="5" fill="#080808" stroke="hsl(var(--brand))" strokeWidth="2.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" path={d(OWN_PATH)} keyTimes="0;1" keySplines="0.45 0 0.25 1" calcMode="spline" />
          </circle>
        )}
        <g transform={`translate(${gate[0]} ${gate[1]})`}>
          <circle r="9" fill="hsl(var(--brand))" stroke="hsl(var(--card))" strokeWidth="2.5" />
          <path d="M-3.5 0 l2.4 2.4 l4.6 -4.8" fill="none" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* tentativa de outra empresa: para no perimetro */}
        <path d={d(BLOCKED_PATH)} fill="none" stroke="hsl(var(--late-text))" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" opacity="0.85" />
        <g transform={`translate(${stop[0]} ${stop[1]})`}>
          <circle r="9" fill="hsl(var(--late-text))" stroke="hsl(var(--card))" strokeWidth="2.5" />
          <path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>

      {/* selo e etiquetas (HTML por cima do SVG, nos pontos do desenho) */}
      <span aria-hidden="true" className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-2 sm:gap-3" style={pct(iso(0, 0, h + 22))}>
        <span className="whitespace-nowrap rounded-full bg-nhf-ink px-3 py-1 text-xs font-semibold text-white shadow-md transition-opacity duration-500 dark:bg-white dark:text-nhf-ink" style={{ opacity: raised ? 1 : 0 }}>
          Sua empresa
        </span>
        <span className="coin coin-dark bob flex h-10 w-10 sm:h-14 sm:w-14">
          <Lock className="h-4 w-4 sm:h-6 sm:w-6" strokeWidth={2.4} />
        </span>
      </span>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-nhf-ink">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          Sua equipe entra com login conferido
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--late-text))] text-white">
            <X className="h-3 w-3" strokeWidth={3} />
          </span>
          Outra empresa não enxerga nada
        </li>
      </ul>
    </div>
  );
}

export function Security() {
  return (
    <section id="seguranca" className="scroll-mt-nav border-y border-foreground/10 bg-card py-24 lg:py-32" aria-labelledby="seguranca-title">
      <div className="container grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <SectionHeader eyebrow="Confiança" title="Seus dados, só da sua empresa." accent="só da sua empresa." lead="Operação é informação sensível: cliente, endereço, valor de frete. Tratamos como tal." />
          <a href="mailto:suporte@nahorafrota.com.br?subject=Documenta%C3%A7%C3%A3o%20de%20seguran%C3%A7a" className="mt-6 inline-flex font-heading text-sm font-semibold underline decoration-brand decoration-2 underline-offset-[6px] hover:text-brand">
            Pedir documentação de segurança
          </a>
          <Reveal className="mt-8">
            <TenantIsolation />
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-foreground/10 bg-brand-soft px-6 py-4">
              <p className="flex items-center gap-2 font-heading font-semibold">
                <ShieldCheck aria-hidden="true" className="h-5 w-5 text-brand" /> Proteção da plataforma
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-nhf-ink">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-nhf-ink" /> Ativa
              </span>
            </div>
            <ul className="divide-y divide-foreground/10">
              {ITEMS.map(([t, d]) => (
                <li key={t} className="flex gap-3 px-6 py-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-nhf-ink">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-heading font-semibold">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
