import { Truck, Warehouse, Handshake, PackageCheck } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import vanPhoto from "@/assets/brand/van.jpg";

const WHO = [
  { icon: Truck, title: "Transportadoras regionais", text: "Vários romaneios por dia, frota mista e cliente cobrando prazo. O mapa e o SLA respondem antes do telefone tocar." },
  { icon: Warehouse, title: "Distribuidoras com frota própria", text: "Entregas recorrentes para os mesmos pontos. Rota otimizada, canhoto digital e relatório por região." },
  { icon: Handshake, title: "Operações com agregados", text: "Frete por romaneio, adiantamento e desconto. O acerto fecha sozinho e o histórico fica guardado." },
  { icon: PackageCheck, title: "Last mile e e-commerce", text: "Muitas notas pequenas e prazo curto. Importação em lote do XML e prova de entrega com hora." },
];

export function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-nav border-t border-border bg-muted/30 py-20 lg:py-28" aria-labelledby="para-quem-title">
      <div className="container grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHeader eyebrow="Para quem é" title="Feito para quem tem placa na rua e prazo para cumprir." accent="prazo para cumprir." />
          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2">
            {WHO.map((w) => (
              <StaggerItem key={w.title}>
                <article className="h-full rounded border border-border bg-card p-5 transition-colors hover:border-brand/60">
                  <w.icon aria-hidden="true" className="h-6 w-6 text-brand" />
                  <h3 className="mt-3 font-heading text-lg font-bold leading-tight">{w.title}</h3>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{w.text}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <Reveal delay={0.1} className="relative">
          <div className="nhf-chamfer nhf-chamfer-lg relative overflow-hidden rounded bg-nhf-ink">
            <img src={vanPhoto} alt="Van de carga preta com a marca Na Hora Frota na lateral, estacionada à noite." className="aspect-[4/3] w-full object-cover opacity-90" loading="lazy" width={1800} height={1012} />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-nhf-ink/90 to-transparent p-5 pt-16 text-white">
              <p className="label-caps text-nhf-green">Operação real</p>
              <p className="mt-1 font-heading text-lg font-bold">Cada placa, um ponto no mapa. Cada entrega, uma hora certa.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
