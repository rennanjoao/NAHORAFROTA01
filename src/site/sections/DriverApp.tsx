import { useRef } from "react";
import { Smartphone, Satellite, Camera, UserCheck, Mail, SquarePlus, LogIn, Navigation, CheckCircle2 } from "lucide-react";
import { useParallax } from "../motion/useParallax";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

const POINTS = [
  { icon: Smartphone, title: "Instala em um minuto", text: "Abre no navegador do celular e vira app na tela inicial. Android e iPhone, sem loja." },
  { icon: Satellite, title: "GPS do próprio celular", text: "Enquanto o romaneio está em rota, o celular alimenta o mapa do gestor: em tempo real no Premium, a cada 30 minutos no Standard." },
  { icon: Camera, title: "Canhoto com foto e assinatura", text: "Confirmação na porta do cliente, com hora e nota fiscal ligadas ao comprovante." },
  { icon: UserCheck, title: "Login próprio, só o romaneio dele", text: "Cada motorista vê a rota do dia. Nada de painel do gestor." },
];

const INSTALL = [
  { icon: Mail, text: "Recebe o acesso por e-mail" },
  { icon: SquarePlus, text: "Adiciona à tela inicial" },
  { icon: LogIn, text: "Entra e vê o romaneio do dia" },
];

export function DriverApp() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useParallax(stage, section);
  return (
    <section ref={section} id="motorista" className="scroll-mt-nav overflow-x-clip border-y border-foreground/10 bg-card py-24 lg:py-32" aria-labelledby="motorista-title">
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <Reveal className="order-2 flex justify-center lg:order-1">
          <div ref={stage} className="relative px-10 py-6" style={{ perspective: "1400px" }}>
            <div aria-hidden="true" className="absolute inset-0 -z-10 scale-110 rounded-full bg-brand/20 blur-3xl" />
            {/* celular inclinado, acompanha o mouse */}
            <div className="plx" style={{ ["--depth" as string]: "10px" }}>
              <div className="bob-slow" style={{ transformStyle: "preserve-3d" }}>
                <div style={{ transform: "rotateY(calc(14deg + var(--px, 0) * 10deg)) rotateX(calc(4deg - var(--py, 0) * 6deg))", transformStyle: "preserve-3d", transition: "transform 0.1s linear" }}>
                  <PhoneMockup className="w-[270px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.55)] sm:w-[290px]" />
                </div>
              </div>
            </div>
            {/* cartoes flutuando em profundidades diferentes */}
            <div aria-hidden="true" className="plx absolute -left-12 top-2 hidden sm:block" style={{ ["--depth" as string]: "30px" }}>
              <div className="bob flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-card px-3.5 py-2.5 shadow-[0_16px_36px_-14px_rgba(0,0,0,0.35)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="ping-ring absolute inset-0 rounded-full bg-brand" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                </span>
                <span className="text-sm font-semibold">GPS ativo</span>
              </div>
            </div>
            <div aria-hidden="true" className="plx absolute -right-24 top-[42%] hidden sm:block" style={{ ["--depth" as string]: "40px" }}>
              <div className="bob-slow bob-delay flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-card px-3.5 py-2.5 shadow-[0_16px_36px_-14px_rgba(0,0,0,0.35)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nhf-ink text-nhf-green"><Navigation className="h-4 w-4" /></span>
                <span>
                  <span className="block text-sm font-semibold">Próxima: 1,2 km</span>
                  <span className="block text-xs text-muted-foreground">Mercado Bom Preço</span>
                </span>
              </div>
            </div>
            <div aria-hidden="true" className="plx absolute -left-20 bottom-[22%] hidden sm:block" style={{ ["--depth" as string]: "24px" }}>
              <div className="bob flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-card px-3.5 py-2.5 shadow-[0_16px_36px_-14px_rgba(0,0,0,0.35)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-nhf-ink"><CheckCircle2 className="h-4 w-4" strokeWidth={2.5} /></span>
                <span>
                  <span className="block text-sm font-semibold">Foto e assinatura</span>
                  <span className="block text-xs text-muted-foreground">enviadas ao painel</span>
                </span>
              </div>
            </div>
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
