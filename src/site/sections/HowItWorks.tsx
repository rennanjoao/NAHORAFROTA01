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
  return (
    <section id="como-funciona" className="scroll-mt-nav bg-card/50 py-20 lg:py-28" aria-labelledby="como-funciona-title">
      <div className="container">
        <SectionHeader eyebrow="Como funciona" title="Três passos. O primeiro leva dois minutos." accent="dois minutos." lead="Não tem implantação nem treinamento. A equipe entra no painel e o motorista abre o app no celular." />
        <Stagger className="mt-12 grid gap-5 md:grid-cols-3" gap={0.08}>
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <article className="site-card flex h-full flex-col p-6 lg:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <s.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="font-data text-sm font-bold text-muted-foreground">{s.n}</span>
                </div>
                <h3 className="mt-6 font-heading text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{s.text}</p>
                <p className="mt-auto pt-6 label-caps text-brand">{s.time}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-10">
          <Cta href="#planos" variant="outline" arrow>
            Ver planos
          </Cta>
        </div>
      </div>
    </section>
  );
}
