import { useRef } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Upload, Route, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { Cta } from "../components/Cta";
import { Magnetic } from "../motion/Magnetic";

const STEPS = [
  { n: "01", icon: Upload, title: "Importe as notas", text: "Suba o XML da NF-e, uma ou em lote. Endereço, cliente e volumes já entram preenchidos e geolocalizados.", time: "2 min" },
  { n: "02", icon: Route, title: "Monte o romaneio e despache", text: "Escolha frota própria ou agregado, defina o frete, otimize a ordem das paradas e envie para o celular do motorista.", time: "5 min" },
  { n: "03", icon: Eye, title: "Acompanhe e feche", text: "Veja a rota no mapa, receba cada canhoto na hora e feche o acerto do agregado com um clique.", time: "o dia todo, sem ligar" },
];

// Rota desenhada entre os tres passos (viewBox 1200 x 160).
const PATH = "M 40 120 C 160 120, 200 40, 330 40 S 520 120, 620 120 S 820 30, 900 36 S 1100 110, 1160 60";

/** Linha de rota que se desenha com a rolagem e um veiculo que a percorre. */
export function HowItWorks() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const truckRef = useRef<SVGGElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 22 });
  const dash = useTransform(p, [0, 1], [0, 1]);
  useMotionValueEvent(p, "change", (v) => {
    const path = pathRef.current;
    const g = truckRef.current;
    if (!path || !g) return;
    const len = path.getTotalLength();
    const at = path.getPointAtLength(Math.max(0, Math.min(1, v)) * len);
    const ahead = path.getPointAtLength(Math.min(len, Math.max(0, Math.min(1, v)) * len + 2));
    const ang = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
    g.setAttribute("transform", `translate(${at.x} ${at.y}) rotate(${ang})`);
  });
  const activeStep = useTransform(p, (v) => (v < 0.33 ? 0 : v < 0.7 ? 1 : 2));

  return (
    <section id="como-funciona" className="scroll-mt-nav relative border-t hairline py-24 lg:py-36" aria-labelledby="como-funciona-title">
      <div className="container">
        <SectionHeader
          index="03"
          size="xl"
          eyebrow="Como funciona"
          title="Da coleta ao acerto, sem ponto cego."
          accent="sem ponto cego."
          lead="Três passos. O primeiro leva dois minutos. O terceiro você faz sem sair do painel."
        />

        <div ref={ref} className="relative mt-16">
          {/* trilho */}
          <svg viewBox="0 0 1200 160" className="hidden h-auto w-full md:block" aria-hidden="true" preserveAspectRatio="none">
            <path d={PATH} fill="none" stroke="hsl(var(--foreground) / 0.12)" strokeWidth="2" strokeDasharray="4 8" />
            <motion.path ref={pathRef} d={PATH} fill="none" stroke="hsl(var(--brand))" strokeWidth="2.5" strokeLinecap="round" style={reduce ? { pathLength: 1 } : { pathLength: dash }} />
            {[40, 620, 1160].map((x, i) => (
              <circle key={i} cx={x} cy={i === 2 ? 60 : 120} r="6" fill="hsl(var(--background))" stroke="hsl(var(--brand))" strokeWidth="2" />
            ))}
            <g ref={truckRef} transform="translate(40 120)">
              <rect x="-16" y="-8" width="32" height="16" rx="3" fill="hsl(var(--brand))" />
              <rect x="7" y="-8" width="9" height="16" rx="2" fill="hsl(var(--background))" fillOpacity="0.55" />
              <circle cx="-7" cy="9" r="3" fill="hsl(var(--background))" />
              <circle cx="8" cy="9" r="3" fill="hsl(var(--background))" />
            </g>
          </svg>

          <Stagger className="mt-6 grid gap-8 md:grid-cols-3 md:gap-6" gap={0.14}>
            {STEPS.map((s, i) => (
              <StaggerItem key={s.n}>
                <StepCard s={s} index={i} active={activeStep} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-4">
          <Magnetic>
            <Cta href="#planos" arrow>
              Ver planos
            </Cta>
          </Magnetic>
          <p className="text-sm text-muted-foreground">Acesso liberado na hora, depois do pagamento.</p>
        </div>
      </div>
    </section>
  );
}

function StepCard({ s, index, active }: { s: (typeof STEPS)[number]; index: number; active: ReturnType<typeof useTransform<number, number>> }) {
  const borderOpacity = useTransform(active, (a) => (a >= index ? 1 : 0));
  return (
    <motion.article className="relative overflow-hidden rounded-lg border hairline bg-card/50 p-6 lg:p-8">
      <motion.span aria-hidden="true" style={{ opacity: borderOpacity }} className="pointer-events-none absolute inset-0 rounded-lg border border-brand/50 shadow-[0_0_0_1px_hsl(var(--brand)/0.2),0_20px_60px_-30px_hsl(var(--brand)/0.5)]" />
      <span aria-hidden="true" className="text-outline absolute -right-2 -top-3 select-none font-heading text-[7rem] font-bold leading-none">{s.n}</span>
      <span className="nhf-chamfer nhf-chamfer-sm flex h-12 w-12 items-center justify-center bg-brand text-nhf-ink">
        <s.icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <p className="mt-6 font-data text-sm font-bold text-brand">
        {s.n} <span className={cn("ml-2 font-normal uppercase tracking-[0.1em] text-muted-foreground")}>{s.time}</span>
      </p>
      <h3 className="mt-2 font-heading text-2xl font-bold leading-tight tracking-tight">{s.title}</h3>
      <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{s.text}</p>
    </motion.article>
  );
}
