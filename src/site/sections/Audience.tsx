import { Truck, Warehouse, Handshake, PackageCheck } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import vanPhoto from "@/assets/brand/van.jpg";
import truckPhoto from "@/assets/brand/caminhao-bau.jpg";
import yardPhoto from "@/assets/brand/placa-patio.jpg";
import badgePhoto from "@/assets/brand/cracha.jpg";

const WHO = [
  { icon: Truck, title: "Transportadoras regionais", text: "Vários romaneios por dia, frota mista e cliente cobrando prazo. O mapa e o SLA respondem antes do telefone tocar.", photo: truckPhoto, alt: "Caminhão baú com a marca Na Hora Frota" },
  { icon: Warehouse, title: "Distribuidoras com frota própria", text: "Entregas recorrentes para os mesmos pontos. Rota otimizada, canhoto digital e relatório por região.", photo: yardPhoto, alt: "Placa do pátio com a marca Na Hora Frota" },
  { icon: Handshake, title: "Operações com agregados", text: "Frete por romaneio, adiantamento e desconto. O acerto fecha sozinho e o histórico fica guardado.", photo: badgePhoto, alt: "Crachá de motorista da Na Hora Frota" },
  { icon: PackageCheck, title: "Last mile e e-commerce", text: "Muitas notas pequenas e prazo curto. Importação em lote do XML e prova de entrega com hora.", photo: vanPhoto, alt: "Van de carga com a marca Na Hora Frota, à noite" },
];

export function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-nav relative border-t hairline py-24 lg:py-36" aria-labelledby="para-quem-title">
      <div className="container">
        <SectionHeader index="06" size="xl" eyebrow="Para quem é" title="Feito para quem tem placa na rua e prazo para cumprir." accent="prazo para cumprir." />
        <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" gap={0.1}>
          {WHO.map((w) => (
            <StaggerItem key={w.title}>
              <article className="group relative aspect-[4/5] overflow-hidden rounded-lg border hairline bg-nhf-ink text-white">
                <img
                  src={w.photo}
                  alt={w.alt}
                  loading="lazy"
                  width={1200}
                  height={1500}
                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-[1.4s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-nhf-ink via-nhf-ink/55 to-nhf-ink/5" />
                <div className="relative flex h-full flex-col justify-end p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-nhf-green/40 bg-nhf-ink/60 text-nhf-green backdrop-blur">
                    <w.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-heading text-xl font-bold leading-tight tracking-tight">{w.title}</h3>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-white/70">{w.text}</p>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
