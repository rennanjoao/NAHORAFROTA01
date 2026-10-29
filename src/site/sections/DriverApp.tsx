import { Smartphone, Satellite, Camera, UserCheck, Mail, SquarePlus, LogIn } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

const POINTS = [
  { icon: Smartphone, title: "Instala em um minuto", text: "Abre no navegador do celular e vira app na tela inicial. Android e iPhone, sem loja." },
  { icon: Satellite, title: "Posição a cada 30 segundos", text: "Enquanto o romaneio está em rota, o GPS do celular alimenta o mapa do gestor." },
  { icon: Camera, title: "Canhoto com foto e assinatura", text: "Confirmação na porta do cliente, com hora e nota fiscal ligadas ao comprovante." },
  { icon: UserCheck, title: "Login próprio, só o romaneio dele", text: "Cada motorista vê a rota do dia. Nada de painel do gestor." },
];

const INSTALL = [
  { icon: Mail, text: "Recebe o acesso por e-mail" },
  { icon: SquarePlus, text: "Adiciona à tela inicial" },
  { icon: LogIn, text: "Entra e vê o romaneio do dia" },
];

export function DriverApp() {
  return (
    <section id="motorista" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="motorista-title">
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <Reveal className="order-2 flex justify-center lg:order-1">
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-0 -z-10 scale-110 rounded-full bg-brand/20 blur-3xl" />
            <div aria-hidden="true" className="absolute -left-10 top-16 hidden rounded-2xl border border-foreground/10 bg-card px-3.5 py-2.5 text-sm font-semibold shadow-lg sm:block">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand" />GPS ativo
            </div>
            <PhoneMockup className="w-[270px] drop-shadow-2xl sm:w-[290px]" />
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeader eyebrow="App do motorista" title="Na mão do motorista, sem treinamento." accent="sem treinamento." lead="Lista de entregas em ordem, próxima parada com endereço, canhoto com foto e assinatura, ocorrência com um toque." />
          <Stagger className="mt-10 grid gap-6 sm:grid-cols-2" gap={0.06}>
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
          <Reveal className="mt-10">
            <p className="text-sm font-semibold">Como o motorista começa</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {INSTALL.map((s, i) => (
                <li key={s.text} className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-card p-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nhf-ink font-data text-xs font-bold text-nhf-green dark:bg-white dark:text-nhf-ink">{i + 1}</span>
                  <span className="leading-snug">{s.text}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
