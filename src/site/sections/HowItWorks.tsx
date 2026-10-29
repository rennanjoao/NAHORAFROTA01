import { motion, useReducedMotion } from "framer-motion";
import { Upload, Route, Eye } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { Cta } from "../components/Cta";

const STEPS = [
  { n: "01", icon: Upload, title: "Importe as notas", text: "Suba o XML da NF-e, uma ou em lote. Endereço, cliente e volumes entram preenchidos.", time: "2 min" },
  { n: "02", icon: Route, title: "Monte o romaneio e despache", text: "Escolha o motorista, defina o frete, otimize a ordem das paradas e envie para o celular dele.", time: "5 min" },
  { n: "03", icon: Eye, title: "Acompanhe e feche", text: "Veja a rota no mapa, receba cada canhoto na hora e feche o acerto do agregado com um clique.", time: "o dia todo" },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="como-funciona" className="scroll-mt-nav border-y border-foreground/10 bg-card py-20 lg:py-28" aria-labelledby="como-funciona-title">
      <div className="container">
        <SectionHeader eyebrow="Como funciona" title="Três passos. O primeiro leva dois minutos." accent="dois minutos." lead="Não tem implantação nem treinamento. A equipe entra no painel e o motorista abre o app no celular." />

        <div className="relative mt-16">
          {/* linha que liga os passos (enche ao entrar na tela) */}
          <div aria-hidden="true" className="absolute left-[16.66%] right-[16.66%] top-8 hidden h-0.5 bg-foreground/10 md:block">
            <motion.div
              className="h-full origin-left bg-brand"
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-80px 0px" }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeInOut" }}
            />
          </div>
          <Stagger className="grid gap-10 md:grid-cols-3 md:gap-6" gap={0.18}>
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <article className="relative flex flex-col items-center text-center">
                  <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-nhf-ink shadow-[0_12px_30px_-10px_hsl(var(--brand)/0.9)] ring-8 ring-card">
                    <s.icon aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <span className="mt-5 rounded-full bg-nhf-ink px-2.5 py-0.5 font-data text-xs font-bold text-nhf-green dark:bg-white dark:text-nhf-ink">{s.n}</span>
                  <h3 className="mt-3 font-heading text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 max-w-xs text-pretty text-[0.95rem] leading-relaxed text-muted-foreground">{s.text}</p>
                  <p className="mt-3 label-caps text-brand">{s.time}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-14 flex justify-center">
          <Cta href="#na-pratica" variant="outline" arrow>
            Ver um dia de operação
          </Cta>
        </div>
      </div>
    </section>
  );
}
