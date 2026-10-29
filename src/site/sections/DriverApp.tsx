import { Smartphone, Satellite, Sun, UserCheck, Camera } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { Tilt3D } from "../components/Tilt3D";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

const POINTS = [
  { icon: Smartphone, title: "Instala em um minuto", text: "Abre no navegador do celular e vira app na tela inicial. Android e iPhone, sem loja." },
  { icon: Satellite, title: "Posição a cada 30 segundos", text: "Enquanto o romaneio está em rota, o GPS do celular alimenta o mapa do gestor." },
  { icon: Camera, title: "Canhoto com foto e assinatura", text: "Confirmação na porta do cliente, com hora e nota fiscal ligadas ao comprovante." },
  { icon: Sun, title: "Tela acordada em rota", text: "O app mantém a tela ligada e avisa quando o GPS cai. Menos entrega sem posição." },
  { icon: UserCheck, title: "Login próprio, só o romaneio dele", text: "Cada motorista entra com a conta dele e vê só a rota do dia. Nada de painel do gestor." },
];

export function DriverApp() {
  return (
    <section id="motorista" className="scroll-mt-nav border-t border-border bg-nhf-ink py-20 text-white lg:py-28 dark:bg-muted/30" aria-labelledby="motorista-title">
      <div className="container grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal className="order-2 flex justify-center lg:order-1">
          <Tilt3D restX={4} restY={12} max={9}>
            <div className="relative">
              <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full bg-brand/15 blur-3xl" />
              <PhoneMockup className="w-[280px] sm:w-[300px]" />
            </div>
          </Tilt3D>
        </Reveal>

        <div className="order-1 lg:order-2 [&_h2]:text-white [&_p]:text-white/70 [&_.label-caps]:text-nhf-green">
          <SectionHeader
            eyebrow="App do motorista"
            title="Na mão do motorista. Sem treinamento."
            accent="Sem treinamento."
            lead="Lista de entregas em ordem, próxima parada com endereço, canhoto com foto e assinatura, ocorrência com um toque. Fala a língua de quem dirige."
          />
          <Stagger className="mt-10 grid gap-5 sm:grid-cols-2">
            {POINTS.map((p) => (
              <StaggerItem key={p.title}>
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-nhf-green/40 bg-nhf-green/10 text-nhf-green">
                    <p.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-white">{p.title}</h3>
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-white/65">{p.text}</p>
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
