import { ArrowRight, Truck, Warehouse, Handshake, PackageCheck } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { Tilt } from "../motion/Tilt";

const WHO = [
  { icon: Truck, title: "Transportadoras regionais", text: "Vários romaneios por dia, frota mista e cliente cobrando prazo. O mapa e o SLA respondem antes do telefone tocar.", plan: "Standard" },
  { icon: Warehouse, title: "Distribuidoras com frota própria", text: "Entregas recorrentes para os mesmos pontos. Rota otimizada, canhoto digital e relatório por região.", plan: "Basic ou Standard" },
  { icon: Handshake, title: "Operações com agregados", text: "Frete por romaneio, adiantamento e desconto. Acerto em lote com recibo e, no Premium, relatório de pagamento por motorista.", plan: "Premium" },
  { icon: PackageCheck, title: "Last mile e e-commerce", text: "Muitas notas pequenas e prazo curto. Importação do XML ou da planilha de pedidos e prova de entrega com hora.", plan: "Standard" },
];

export function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-nav py-24 lg:py-32" aria-labelledby="para-quem-title">
      <div className="container">
        <SectionHeader eyebrow="Para quem é" title="Feito para quem tem placa na rua e prazo para cumprir." accent="prazo para cumprir." />
        <Stagger className="mt-12 lg:mt-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4" gap={0.06}>
          {WHO.map((w, i) => (
            <StaggerItem key={w.title}>
              <Tilt as="article" max={6} className="site-card flex h-full flex-col p-6">
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${i % 2 === 0 ? "bg-brand text-nhf-ink" : "bg-nhf-ink text-nhf-green dark:bg-white dark:text-nhf-ink"}`}>
                  <w.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-heading text-lg font-semibold leading-tight tracking-tight">{w.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{w.text}</p>
                <a href="#planos" className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold underline decoration-brand decoration-2 underline-offset-[6px] hover:text-brand">
                  Costuma usar: {w.plan} <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
