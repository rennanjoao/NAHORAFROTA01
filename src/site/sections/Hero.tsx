import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, Gift, MapPin, Satellite, Truck, Wallet, FileCode2, Smartphone, Globe, Users, Download, Route } from "lucide-react";
import { Cta } from "../components/Cta";
import { PhoneMockup } from "../components/mockups/PhoneMockup";
import { RouteMap } from "../components/mockups/RouteMap";

const EASE = [0.2, 0.8, 0.2, 1] as const;

const TRUST = [
  { icon: Clock, text: "Acesso na hora, após o pagamento" },
  { icon: Satellite, text: "Sem rastreador: o GPS do celular basta" },
  { icon: Gift, text: "7 dias grátis para testar" },
];

const WORKS_WITH = [
  { icon: FileCode2, label: "XML da NF-e" },
  { icon: Smartphone, label: "Android e iPhone" },
  { icon: Globe, label: "Chrome, Edge e Safari" },
  { icon: Download, label: "Sem instalar no PC" },
  { icon: Users, label: "Frota própria e agregados" },
  { icon: Route, label: "Rota otimizada" },
];

function In({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** Selo flutuante da ilustracao: entra em sequencia e depois flutua devagar. */
function Badge({ children, className, delay, float = "float-slow" }: { children: React.ReactNode; className: string; delay: number; float?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={`absolute ${className}`} initial={reduce ? false : { opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: EASE }}>
      <div className={float}>{children}</div>
    </motion.div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section id="inicio" className="relative overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      {/* fundo: brilho verde + grade com alguns quadros acesos */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow absolute inset-0" />
        <div className="hero-grid absolute inset-0" />
        {[
          "left-[2%] top-[14%]",
          "left-[46%] top-[62%]",
          "right-[8%] top-[10%]",
          "right-[30%] bottom-[18%]",
        ].map((pos) => (
          <span key={pos} className={`absolute ${pos} hidden h-14 w-14 border border-brand/30 bg-brand/10 lg:block`} />
        ))}
      </div>

      <div className="container grid items-center gap-14 pb-14 pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-20 lg:pt-20">
        <div className="min-w-0 max-w-[40rem]">
          <In delay={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 shadow-sm">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
              Gestão de entregas e frota em tempo real
            </span>
          </In>
          <In delay={0.06}>
            <h1 id="hero-title" className="mt-6 font-heading text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-[3.4rem] lg:text-[3.75rem]">
              Sua frota no mapa.
              <br />
              Suas entregas <span className="marker whitespace-nowrap">na hora.</span>
            </h1>
          </In>
          <In delay={0.12}>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Painel para transportadoras e distribuidoras: romaneio no celular do motorista, posição de cada veículo, canhoto com foto e acerto do frete. Tudo no navegador, sem instalar nada.
            </p>
          </In>
          <In delay={0.18}>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Cta href="#planos" size="lg" arrow>
                Ver planos
              </Cta>
              <a href="#na-pratica" className="inline-flex items-center gap-2 self-start font-heading text-base font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-[6px] transition-colors hover:text-brand sm:self-auto">
                Ver um dia de operação
              </a>
            </div>
          </In>
          <In delay={0.24}>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-center gap-2.5 text-sm font-medium text-foreground/80">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-nhf-ink">
                    <t.icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {t.text}
                </li>
              ))}
            </ul>
          </In>

          {/* funciona com */}
          <In delay={0.32} className="mt-10 border-t border-foreground/10 pt-6">
            <p className="text-sm text-muted-foreground">Funciona com o que a sua operação já usa</p>
            <div className="marquee mt-3 overflow-hidden" aria-hidden="true">
              <div className="marquee-track flex w-max gap-8" style={{ ["--marquee-duration" as string]: "32s" }}>
                {[...WORKS_WITH, ...WORKS_WITH].map((w, i) => (
                  <span key={i} className="flex shrink-0 items-center gap-2 font-heading text-base font-semibold text-muted-foreground">
                    <w.icon className="h-4 w-4" /> {w.label}
                  </span>
                ))}
              </div>
            </div>
            <p className="sr-only">Funciona com XML da NF-e, Android e iPhone, Chrome, Edge e Safari, sem instalar no computador, com frota própria e agregados, e com rota otimizada.</p>
          </In>
        </div>

        {/* ilustracao do produto */}
        <motion.div
          className="relative mx-auto w-full max-w-[560px]"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          role="img"
          aria-label="App do motorista com a próxima entrega, um mapa com os veículos em rota e cartões do painel: entrega confirmada com foto, SLA do dia em 98% e acerto do frete fechado."
        >
          <div aria-hidden="true" className="relative h-[600px] sm:h-[640px]">
            {/* mapa ao fundo */}
            <div className="site-card absolute left-0 top-16 w-[290px] overflow-hidden p-2 shadow-xl sm:w-[330px]">
              <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
                <span className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3 w-3 text-brand" /> Mapa ao vivo
                </span>
                <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-data text-[9px] font-semibold uppercase tracking-wider text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> 14 em rota
                </span>
              </div>
              <div className="aspect-[16/11] overflow-hidden rounded-xl bg-muted">
                <RouteMap compact showLegend={false} />
              </div>
            </div>

            {/* celular */}
            <div className="absolute right-2 top-0 w-[250px] drop-shadow-2xl sm:right-6 sm:w-[272px]">
              <PhoneMockup className="w-full" />
            </div>

            {/* selos */}
            <Badge className="left-6 top-0 sm:left-16" delay={0.55}>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3 shadow-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-nhf-ink">
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Entregue · 14:32</span>
                  <span className="block text-xs text-muted-foreground">NF 48213 · foto e assinatura</span>
                </span>
              </div>
            </Badge>

            <Badge className="bottom-28 right-0 sm:right-[-12px]" delay={0.75} float="float-slower">
              <div className="w-[172px] rounded-2xl border border-foreground/10 bg-card p-4 shadow-lg">
                <span className="label-caps text-[10px] text-muted-foreground">SLA do dia</span>
                <span className="mt-1 block font-data text-3xl font-bold tracking-tight text-brand">98%</span>
                <span className="mt-2 flex h-7 items-end gap-1">
                  {[70, 85, 60, 95, 80, 90, 100].map((h, i) => (
                    <span key={i} className={`flex-1 rounded-sm ${h < 65 ? "bg-nhf-alert" : "bg-brand"}`} style={{ height: `${h}%` }} />
                  ))}
                </span>
              </div>
            </Badge>

            <Badge className="bottom-6 left-4 sm:left-12" delay={0.95}>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3 shadow-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Wallet className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Acerto fechado · R$ 1.240</span>
                  <span className="block text-xs text-muted-foreground">João Silva · pago por Pix</span>
                </span>
              </div>
            </Badge>

            {/* fichas flutuantes */}
            <Badge className="left-[44%] top-[44%] hidden sm:block" delay={1.1} float="float-slower">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-nhf-ink shadow-[0_10px_30px_-8px_hsl(var(--brand)/0.8)]">
                <Truck className="h-5 w-5" />
              </span>
            </Badge>
            <Badge className="right-[-18px] top-24 hidden sm:block" delay={1.2}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-nhf-ink text-nhf-green shadow-lg">
                <MapPin className="h-5 w-5" />
              </span>
            </Badge>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
