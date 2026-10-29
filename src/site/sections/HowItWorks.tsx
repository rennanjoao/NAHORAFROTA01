import { Upload, Route, Eye } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { Cta } from "../components/Cta";

const STEPS = [
  {
    n: "01",
    icon: Upload,
    title: "Importe as notas",
    text: "Suba o XML da NF-e, uma ou em lote. Endereço, cliente e volumes já entram preenchidos e geolocalizados.",
    time: "2 min",
  },
  {
    n: "02",
    icon: Route,
    title: "Monte o romaneio e despache",
    text: "Escolha frota própria ou agregado, defina o frete, otimize a ordem das paradas e envie para o celular do motorista.",
    time: "5 min",
  },
  {
    n: "03",
    icon: Eye,
    title: "Acompanhe e feche",
    text: "Veja a rota no mapa, receba cada canhoto na hora e feche o acerto do agregado com um clique.",
    time: "o dia todo, sem ligar",
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="como-funciona" className="scroll-mt-nav border-t border-border py-20 lg:py-28" aria-labelledby="como-funciona-title">
      <div className="container">
        <SectionHeader
          eyebrow="Como funciona"
          title="Da coleta ao acerto, sem ponto cego."
          accent="sem ponto cego."
          lead="Três passos. O primeiro leva dois minutos. O terceiro você faz sem sair do painel."
        />

        <div className="relative mt-14">
          {/* linha de progresso */}
          <motion.div
            aria-hidden="true"
            className="absolute left-0 top-10 hidden h-0.5 w-full origin-left bg-brand/70 md:block"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />

          <Stagger className="grid gap-6 md:grid-cols-3" gap={0.15}>
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <article className="relative h-full">
                  <div className="relative z-10 flex h-20 w-20 items-center justify-center bg-background">
                    <span className="nhf-chamfer flex h-16 w-16 items-center justify-center bg-brand text-nhf-ink">
                      <s.icon aria-hidden="true" className="h-7 w-7" />
                    </span>
                  </div>
                  <p className="mt-4 font-data text-sm font-bold text-brand">
                    {s.n} <span className="ml-2 font-normal uppercase tracking-[0.08em] text-muted-foreground">{s.time}</span>
                  </p>
                  <h3 className="mt-2 font-heading text-2xl font-bold leading-tight">{s.title}</h3>
                  <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{s.text}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-12">
          <Cta href="#planos" variant="outline" arrow>
            Ver planos
          </Cta>
        </div>
      </div>
    </section>
  );
}
