import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useResolvedTheme } from "@/components/theme/PreferencesProvider";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Clock, Lock, MonitorSmartphone } from "lucide-react";
import { Cta } from "../components/Cta";
import { LiveClock } from "../components/LiveClock";
import { Magnetic } from "../motion/Magnetic";
import { TextReveal, LineReveal } from "../motion/TextReveal";
import { Counter } from "../motion/Counter";
import { RouteMap } from "../components/mockups/RouteMap";

const Hero3D = lazy(() => import("../components/Hero3D"));

const TRUST = [
  { icon: Clock, text: "Acesso liberado na hora, após o pagamento" },
  { icon: MonitorSmartphone, text: "Sem instalação: navegador no PC, app no celular" },
  { icon: Lock, text: "Dados isolados por empresa" },
];

/** Capa: cidade 3D com rotas ao vivo e a mensagem principal. Ocupa a tela inteira. */
export function Hero() {
  const resolvedTheme = useResolvedTheme();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -20% 0px" });
  const [mounted, setMounted] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const rise = useTransform(scrollYProgress, [0, 1], [0, -120]);

  useEffect(() => {
    setMounted(true);
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    const id = window.setTimeout(() => setShow3D(wide && webgl), 200);
    return () => window.clearTimeout(id);
  }, []);
  const dark = mounted ? resolvedTheme !== "light" : true;

  return (
    <section ref={ref} id="inicio" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-title">
      {/* cena */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        {show3D ? (
          <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)]">
            <Suspense fallback={null}>
              <Hero3D dark={dark} animate={!reduce && inView} scroll={scrollYProgress} />
            </Suspense>
          </div>
        ) : (
          <div className="absolute inset-0 opacity-70 [mask-image:radial-gradient(70%_70%_at_70%_40%,#000_20%,transparent_100%)]">
            <RouteMap showLegend={false} compact className="scale-[1.6] lg:scale-100" />
          </div>
        )}
        {/* legibilidade do texto: sombra a esquerda e base que funde com a proxima secao */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent lg:via-background/40 lg:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-background" />
        <div className="orb -left-40 top-20 h-[520px] w-[520px] bg-brand/10" />
      </div>

      {/* HUD do topo: hora ao vivo e numeros da operacao */}
      <div className="container relative z-10 flex items-center justify-between pt-[96px]">
        <motion.div initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <LiveClock label="Ao vivo" />
        </motion.div>
        <motion.ul
          className="hidden items-center gap-6 font-data text-[11px] uppercase tracking-[0.12em] text-muted-foreground md:flex"
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          aria-label="Exemplo de indicadores do painel"
        >
          <li><span className="text-brand"><Counter to={14} /></span> em rota</li>
          <li><span className="text-foreground"><Counter to={148} /></span> entregues hoje</li>
          <li><span className="text-brand"><Counter to={98} suffix="%" /></span> no prazo</li>
        </motion.ul>
      </div>

      {/* mensagem */}
      <motion.div style={reduce ? undefined : { opacity: fade, y: rise }} className="container relative z-10 flex flex-1 flex-col justify-center py-14 lg:py-10">
        <div className="max-w-[46rem]">
          <TextReveal
            as="h1"
            id="hero-title"
            text="Quem vê a rota inteira chega primeiro."
            accent="chega primeiro."
            className="display text-[clamp(2.9rem,8.2vw,6.6rem)]"
            delay={0.15}
          />
          <LineReveal delay={0.55} className="mt-7 max-w-xl">
            <p className="text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Romaneio na mão do motorista. Cada placa no mapa. SLA medido por entrega e acerto fechado no mesmo dia. Tudo numa tela, no navegador e no celular.
            </p>
          </LineReveal>
          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <Magnetic>
              <Cta href="#planos" size="lg" arrow>
                Ver planos e começar
              </Cta>
            </Magnetic>
            <Magnetic strength={0.2}>
              <Cta href="#produto" size="lg" variant="outline">
                Ver o painel
              </Cta>
            </Magnetic>
          </motion.div>
          <motion.ul
            className="mt-12 flex flex-col gap-3 sm:flex-row sm:gap-8"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            {TRUST.map((t) => (
              <li key={t.text} className="flex items-start gap-2.5 text-sm text-foreground/75">
                <t.icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{t.text}</span>
              </li>
            ))}
          </motion.ul>
        </div>
      </motion.div>

      {/* indicador de rolagem */}
      <motion.div style={reduce ? undefined : { opacity: fade }} className="container relative z-10 flex items-end justify-between pb-8" aria-hidden="true">
        <div className="flex items-center gap-3 font-data text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="scroll-cue h-10 w-px overflow-hidden" />
          <span className="flex items-center gap-1.5">
            Role para ver o painel <ArrowDown className="h-3 w-3" />
          </span>
        </div>
        <p className="hidden font-data text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">Gestão de entregas e frota · Brasil</p>
      </motion.div>
    </section>
  );
}
