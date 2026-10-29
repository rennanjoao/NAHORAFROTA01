import { Truck, Warehouse, Handshake, PackageCheck } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";

const WHO = [
  { icon: Truck, title: "Transportadoras regionais", text: "Vários romaneios por dia, frota mista e cliente cobrando prazo. O mapa e o SLA respondem antes do telefone tocar." },
  { icon: Warehouse, title: "Distribuidoras com frota própria", text: "Entregas recorrentes para os mesmos pontos. Rota otimizada, canhoto digital e relatório por região." },
  { icon: Handshake, title: "Operações com agregados", text: "Frete por romaneio, adiantamento e desconto. O acerto fecha sozinho e o histórico fica guardado." },
  { icon: PackageCheck, title: "Last mile e e-commerce", text: "Muitas notas pequenas e prazo curto. Importação em lote do XML e prova de entrega com hora." },
];

export function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="para-quem-title">
      <div className="container">
        <SectionHeader eyebrow="Para quem é" title="Feito para quem tem placa na rua e prazo para cumprir." accent="prazo para cumprir." />
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4" gap={0.06}>
          {WHO.map((w) => (
            <StaggerItem key={w.title}>
              <article className="site-card h-full p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <w.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-heading text-lg font-semibold leading-tight tracking-tight">{w.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{w.text}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
