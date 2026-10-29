import { Suspense, lazy, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, Lock, MonitorSmartphone } from "lucide-react";
import { Cta } from "../components/Cta";
import { LiveClock } from "../components/LiveClock";
import { Tilt3D } from "../components/Tilt3D";
import { DashboardMockup } from "../components/mockups/DashboardMockup";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

const Hero3D = lazy(() => import("../components/Hero3D"));

const TRUST = [
  { icon: Clock, text: "Acesso liberado na hora, após o pagamento" },
  { icon: MonitorSmartphone, text: "Sem instalação: navegador no PC, app no celular" },
  { icon: Lock, text: "Dados isolados por empresa" },
];

export function Hero() {
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [show3D, setShow3D] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Só carrega o 3D em telas maiores e quando o navegador tem WebGL.
    const wide = window.matchMedia("(min-width: 768px)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    const id = window.setTimeout(() => setShow3D(wide && webgl), 300);
    return () => window.clearTimeout(id);
  }, []);
  const dark = mounted ? resolvedTheme !== "light" : true;

  return (
    <section id="inicio" className="relative isolate overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      {/* fundo 3D */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-routes opacity-70 mask-fade-b" />
        {show3D && (
          <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(62%_95%_at_74%_52%,#000_10%,transparent_96%)]">
            <Suspense fallback={null}>
              <Hero3D dark={dark} animate={!reduce} />
            </Suspense>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="container grid items-center gap-12 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24 lg:pt-20">
        <div className="relative z-10 max-w-2xl">
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <LiveClock label="Ao vivo" />
          </motion.div>

          <motion.h1
            id="hero-title"
            className="mt-6 text-balance font-heading text-[2.6rem] font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.4rem]"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            Quem vê a rota inteira <span className="text-brand">chega primeiro.</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
          >
            Romaneio na mão do motorista. Cada placa no mapa. SLA medido por entrega e acerto fechado no mesmo dia. Tudo numa tela, no navegador e no celular.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
          >
            <Cta href="#planos" size="lg" arrow>
              Ver planos e começar
            </Cta>
            <Cta href="#como-funciona" size="lg" variant="outline">
              Como funciona
            </Cta>
          </motion.div>

          <motion.ul
            className="mt-10 grid gap-3 sm:grid-cols-3"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {TRUST.map((t) => (
              <li key={t.text} className="flex items-start gap-2.5 text-sm text-foreground/80">
                <t.icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{t.text}</span>
              </li>
            ))}
          </motion.ul>
        </div>

        {/* mockups 3D */}
        <motion.div
          className="relative z-10 mx-auto w-full max-w-[640px] pb-8 lg:max-w-none xl:pr-12"
          initial={reduce ? false : { opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Tilt3D className="relative">
            <div className="relative" style={{ transform: "translateZ(0)" }}>
              <DashboardMockup className="glow-brand" />
            </div>
            <div className="absolute -bottom-16 -right-16 hidden w-[172px] xl:block 2xl:-right-24 2xl:w-[180px]" style={{ transform: "translateZ(60px)" }}>
              <PhoneMockup className="w-full" static />
            </div>
            <motion.div
              className="absolute -bottom-8 -left-3 hidden w-[250px] rounded border border-border bg-card p-3 shadow-lift md:block lg:-left-8"
              style={{ transform: "translateZ(40px)" }}
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            >
              <p className="flex items-center gap-2 font-data text-[11px] uppercase tracking-wider text-brand">
                <CheckCircle2 className="h-3.5 w-3.5" /> 14:32 · Entrega confirmada
              </p>
              <p className="mt-1 text-sm font-semibold">ABC1D23 entregou em Osasco</p>
              <p className="text-xs text-muted-foreground">Canhoto com foto e assinatura · 3 paradas restantes</p>
            </motion.div>
          </Tilt3D>
        </motion.div>
      </div>
    </section>
  );
}
