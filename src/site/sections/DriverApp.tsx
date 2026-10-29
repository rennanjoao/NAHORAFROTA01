import { Smartphone, Satellite, Camera, UserCheck } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

const POINTS = [
  { icon: Smartphone, title: "Instala em um minuto", text: "Abre no navegador do celular e vira app na tela inicial. Android e iPhone, sem loja." },
  { icon: Satellite, title: "Posição a cada 30 segundos", text: "Enquanto o romaneio está em rota, o GPS do celular alimenta o mapa do gestor." },
  { icon: Camera, title: "Canhoto com foto e assinatura", text: "Confirmação na porta do cliente, com hora e nota fiscal ligadas ao comprovante." },
  { icon: UserCheck, title: "Login próprio, só o romaneio dele", text: "Cada motorista vê a rota do dia. Nada de painel do gestor." },
];

export function DriverApp() {
  return (
    <section id="motorista" className="scroll-mt-nav bg-card/50 py-20 lg:py-28" aria-labelledby="motorista-title">
      <div className="container grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <Reveal className="order-2 flex justify-center lg:order-1">
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-0 -z-10 scale-110 rounded-full bg-brand/15 blur-3xl" />
            <PhoneMockup className="w-[270px] sm:w-[290px]" />
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeader eyebrow="App do motorista" title="Na mão do motorista, sem treinamento." accent="sem treinamento." lead="Lista de entregas em ordem, próxima parada com endereço, canhoto com foto e assinatura, ocorrência com um toque." />
          <Stagger className="mt-10 grid gap-5 sm:grid-cols-2" gap={0.06}>
            {POINTS.map((p) => (
              <StaggerItem key={p.title}>
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <p.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-semibold">{p.title}</h3>
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
