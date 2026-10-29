import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Clock, Gift, Satellite, FileCode2, Smartphone, Globe, Users, Download, Route } from "lucide-react";
import { Cta } from "../components/Cta";
import { HeroScene } from "../components/HeroScene";

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

export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const sceneY = useTransform(p, [0, 1], [0, 24]);
  const sceneRotate = useTransform(p, [0, 1], [0, 10]);
  const sceneScale = useTransform(p, [0, 1], [1, 0.94]);
  const sceneOpacity = useTransform(p, [0, 0.9], [1, 0.35]);
  const textY = useTransform(p, [0, 1], [0, 24]);
  const textOpacity = useTransform(p, [0, 0.9], [1, 0.4]);
  return (
    <section ref={ref} id="inicio" className="relative overflow-x-clip pt-[72px]" aria-labelledby="hero-title">
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
        <motion.div className="relative z-10 min-w-0 max-w-[40rem]" style={reduce ? undefined : { y: textY, opacity: textOpacity }}>
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
        </motion.div>

        {/* cena do produto (3D leve, so CSS) */}
        <motion.div className="relative w-full lg:-mr-6" style={reduce ? undefined : { y: sceneY, rotateX: sceneRotate, scale: sceneScale, opacity: sceneOpacity, transformPerspective: 1600 }}>
          <HeroScene />
        </motion.div>
      </div>
    </section>
  );
}
