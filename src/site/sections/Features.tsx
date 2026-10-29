import { useEffect, useRef, useState, type ComponentType } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { MapPin, FileCode2, FileText, Route, Smartphone, Camera, AlertTriangle, Gauge, Wallet, FileDown, ShieldAlert, Users, Check, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem, EASE } from "../components/Reveal";
import { BrandRoutes } from "../components/BrandRoutes";
import { Tilt } from "../motion/Tilt";

type Item = { icon: LucideIcon; title: string; text: string };
type Phase = { n: string; when: string; title: string; Art: ComponentType; alt: string; items: Item[] };

/* ---------- 01 · antes de sair: XML entra, romaneio se reordena ---------- */
const ROUTE_STOPS = [
  { who: "Mercado Bom Preço", km: "1,2 km" },
  { who: "Drogaria Central", km: "3,4 km" },
  { who: "Padaria Nova Era", km: "5,1 km" },
];

function PlanArt() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [opt, setOpt] = useState(true);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => setOpt((o) => !o), 2800);
    return () => window.clearInterval(id);
  }, [inView, reduce]);
  const order = opt ? [0, 1, 2] : [2, 0, 1];
  return (
    <div ref={ref} className="relative flex h-full items-center justify-center gap-3 px-5">
      <div className="flex flex-col gap-2">
        {["48213", "48219", "48225"].map((nf, i) => (
          <span key={nf} className="float-slow flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-card px-2 py-1 font-data text-[10px] font-semibold shadow-sm" style={{ animationDelay: `${-i * 2.1}s` }}>
            <FileCode2 className="h-3 w-3 text-brand" /> {nf}.xml
          </span>
        ))}
      </div>
      <svg width="30" height="12" viewBox="0 0 30 12" className="shrink-0">
        <path d="M0 6 H24" stroke="hsl(var(--brand))" strokeWidth="2" className="route-flow" />
        <path d="M21 2 L27 6 L21 10" fill="none" stroke="hsl(var(--brand))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="w-[218px] shrink-0 rounded-xl border border-foreground/10 bg-card p-2.5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="label-caps whitespace-nowrap text-[9px] text-muted-foreground">Romaneio #1042</p>
          <span className={cn("whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors duration-300", opt ? "bg-brand text-nhf-ink" : "bg-foreground/10 text-muted-foreground")}>
            {opt ? "Rota otimizada" : "Sem otimizar"}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {order.map((idx, pos) => (
            <motion.li key={idx} layout={!reduce} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-2 py-1.5 text-[11px]">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-nhf-ink font-data text-[9px] font-bold text-nhf-green">{pos + 1}</span>
              <span className="truncate font-semibold">{ROUTE_STOPS[idx].who}</span>
              <span className="ml-auto shrink-0 font-data text-[9px] text-muted-foreground">{ROUTE_STOPS[idx].km}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- 02 · na rua: mapa vivo + canhoto chegando ---------- */
const TRACK_PATH = "M28 168 H112 V112 H212 V64 H300 V40 H352";

function TrackArt() {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-full">
      <svg viewBox="0 0 380 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g fill="hsl(var(--foreground) / 0.05)">
          <rect x="40" y="24" width="56" height="64" rx="4" />
          <rect x="128" y="132" width="70" height="44" rx="4" />
          <rect x="228" y="92" width="62" height="56" rx="4" />
          <rect x="128" y="20" width="62" height="70" rx="4" />
          <rect x="310" y="76" width="50" height="80" rx="4" />
        </g>
        <path d={TRACK_PATH} fill="none" stroke="hsl(var(--foreground) / 0.16)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={TRACK_PATH} fill="none" stroke="hsl(var(--brand))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="route-flow" />
        {[[112, 112], [212, 64], [352, 40]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="7" fill={i < 2 ? "hsl(var(--brand))" : "hsl(var(--card))"} stroke={i < 2 ? "hsl(var(--brand))" : "hsl(var(--foreground) / 0.35)"} strokeWidth="2" />
            {i < 2 && <path d="M-3 0 l2 2 l4 -4" fill="none" stroke="#080808" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        ))}
        <rect x="14" y="158" width="28" height="18" rx="4" fill="#080808" />
        <text x="28" y="170" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="8" fontWeight="700" fill="#04E8A4">PÁTIO</text>
        {/* veiculo: anda pela rota (parado no meio do caminho com movimento reduzido) */}
        <g transform={reduce ? "translate(256 64)" : undefined}>
          <circle r="13" fill="hsl(var(--brand) / 0.25)" />
          <circle r="8.5" fill="#080808" stroke="hsl(var(--card))" strokeWidth="2.5" />
          <path d="M-3 -3.2 L3.6 0 L-3 3.2 L-1.4 0 Z" fill="#04E8A4" />
          {!reduce && <animateMotion dur="9s" repeatCount="indefinite" path={TRACK_PATH} rotate="auto" />}
        </g>
      </svg>
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-2.5 py-1 text-[10px] font-semibold shadow-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="ping-ring absolute inset-0 rounded-full bg-brand" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        Ao vivo · 12 veículos
      </span>
      <span className="toast-loop absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border border-foreground/10 bg-card px-2.5 py-2 shadow-md">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-nhf-ink">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold">NF 48219 entregue</span>
          <span className="block font-data text-[9px] text-muted-foreground">14:32 · foto e assinatura</span>
        </span>
      </span>
    </div>
  );
}

/* ---------- 03 · depois da entrega: SLA da semana + acerto ---------- */
const WEEK = [
  ["S", 82], ["T", 88], ["Q", 85], ["Q", 91], ["S", 94], ["S", 90], ["D", 98],
] as const;

function CloseArt() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const show = !!reduce || inView;
  return (
    <div ref={ref} className="relative flex h-full items-center justify-center gap-3 px-5">
      <div className="w-[176px] rounded-xl border border-foreground/10 bg-card p-2.5 shadow-md">
        <div className="flex items-baseline justify-between">
          <p className="label-caps text-[9px] text-muted-foreground">SLA da semana</p>
          <p className="font-data text-sm font-bold text-brand">98%</p>
        </div>
        <div className="mt-2 flex h-[72px] items-end gap-1.5">
          {WEEK.map(([d, v], i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <motion.span
                className={cn("block w-full origin-bottom rounded-t-[3px]", i === WEEK.length - 1 ? "bg-brand" : "bg-brand/35")}
                style={{ height: `${((v - 60) / 40) * 56}px` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={show ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.07, ease: EASE }}
              />
              <span className="font-data text-[8px] text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-[156px] -rotate-2 rounded-xl border border-foreground/10 bg-card p-2.5 shadow-lg">
        <p className="label-caps text-[9px] text-muted-foreground">Acerto · João</p>
        <dl className="mt-1.5 space-y-1 font-data text-[10px]">
          <div className="flex justify-between"><dt className="text-muted-foreground">Frete</dt><dd>R$ 1.480,00</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Adiant.</dt><dd className="text-late">− R$ 240,00</dd></div>
          <div className="flex justify-between border-t border-foreground/10 pt-1 text-[11px] font-bold"><dt>Total</dt><dd>R$ 1.240,00</dd></div>
        </dl>
        <span className="mt-2 flex items-center justify-center gap-1 rounded-md bg-nhf-ink py-1 text-[9px] font-bold text-nhf-green">
          <Wallet className="h-3 w-3" /> Pagar no Pix
        </span>
      </div>
    </div>
  );
}

const PHASES: Phase[] = [
  {
    n: "01",
    when: "Antes de sair",
    title: "Planeje o dia",
    Art: PlanArt,
    alt: "Notas em XML entrando num romaneio que se reordena pela rota otimizada",
    items: [
      { icon: FileCode2, title: "Importação de XML", text: "Notas da NF-e entram sem digitar." },
      { icon: FileText, title: "Romaneio digital", text: "Monte, imprima ou mande para o celular." },
      { icon: Route, title: "Rota otimizada", text: "A ordem das paradas em um clique." },
      { icon: ShieldAlert, title: "Áreas de risco", text: "Onde mais acontecem roubos de carga." },
    ],
  },
  {
    n: "02",
    when: "Na rua",
    title: "Acompanhe ao vivo",
    Art: TrackArt,
    alt: "Mapa com o veículo andando na rota e um aviso de entrega confirmada com foto e assinatura",
    items: [
      { icon: MapPin, title: "Mapa ao vivo", text: "Posição de cada motorista pelo GPS do celular." },
      { icon: Smartphone, title: "App do motorista", text: "Instala pelo navegador. Android e iPhone." },
      { icon: Camera, title: "Canhoto digital", text: "Foto, assinatura e nome de quem recebeu." },
      { icon: AlertTriangle, title: "Ocorrências", text: "Registradas no app, com foto e hora." },
    ],
  },
  {
    n: "03",
    when: "Depois da entrega",
    title: "Feche e meça",
    Art: CloseArt,
    alt: "Gráfico do SLA da semana em 98% e um acerto de agregado com total a pagar no Pix",
    items: [
      { icon: Gauge, title: "SLA medido", text: "Por entrega, motorista, região e semana." },
      { icon: Wallet, title: "Acerto financeiro", text: "Frete, adiantamento e desconto por romaneio." },
      { icon: FileDown, title: "Relatórios em PDF", text: "Custos, eficiência e ocorrências do período." },
      { icon: Users, title: "Perfis de acesso", text: "Admin, gestor, despachante e motorista." },
    ],
  },
];

export function Features() {
  return (
    <section id="recursos" className="scroll-mt-nav border-y border-foreground/10 bg-card py-24 lg:py-32" aria-labelledby="recursos-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="Recursos" title="Tudo o que vem no painel." accent="no painel." lead="Doze recursos, na ordem em que a sua operação usa: antes de o caminhão sair, enquanto ele está na rua e depois da última entrega." />
        <Stagger className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-3" gap={0.12}>
          {PHASES.map((p) => (
            <StaggerItem key={p.n} className="h-full min-w-0">
              <Tilt max={2.5} glare={false} className="flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-sm transition-shadow hover:shadow-xl">
                <div role="img" aria-label={p.alt} className="relative h-52 overflow-hidden border-b border-foreground/10 bg-muted/50">
                  <BrandRoutes scale={0.42} />
                  {/* a miniatura tem largura fixa; no celular ela encolhe inteira, sem cortar */}
                  <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                    <div className="h-full w-[400px] shrink-0 origin-center scale-[0.8] min-[400px]:scale-[0.88] sm:scale-100">
                      <p.Art />
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="label-caps text-brand">{p.n} · {p.when}</p>
                  <h3 className="mt-2 font-heading text-2xl font-semibold tracking-tight">{p.title}</h3>
                  <ul className="mt-5 flex-1 space-y-1">
                    {p.items.map((it) => (
                      <li key={it.title} className="group/item -mx-2 flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/70">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition-colors duration-300 group-hover/item:bg-brand group-hover/item:text-nhf-ink">
                          <it.icon aria-hidden="true" className="h-[18px] w-[18px]" />
                        </span>
                        <span>
                          <span className="block font-heading text-[0.95rem] font-semibold">{it.title}</span>
                          <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{it.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Alguns recursos dependem do plano.{" "}
          <a href="#planos" className="inline-flex items-center gap-1 font-heading font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-[6px] hover:text-brand">
            Ver o que entra em cada plano <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
    </section>
  );
}
