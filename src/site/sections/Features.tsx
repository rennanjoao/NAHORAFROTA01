import { MapPin, FileCode2, FileText, Route, Smartphone, Camera, AlertTriangle, Gauge, Wallet, FileDown, ShieldAlert, Users } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { Tilt } from "../motion/Tilt";

const ITEMS = [
  { icon: MapPin, title: "Mapa ao vivo", text: "Posição de cada motorista pelo GPS do celular." },
  { icon: FileCode2, title: "Importação de XML", text: "Notas da NF-e entram sem digitar." },
  { icon: FileText, title: "Romaneio digital", text: "Monte, imprima ou mande para o celular." },
  { icon: Route, title: "Rota otimizada", text: "A ordem das paradas em um clique." },
  { icon: Smartphone, title: "App do motorista", text: "Instala pelo navegador. Android e iPhone." },
  { icon: Camera, title: "Canhoto digital", text: "Foto, assinatura e nome de quem recebeu." },
  { icon: AlertTriangle, title: "Ocorrências", text: "Registradas no app, com foto e hora." },
  { icon: Gauge, title: "SLA medido", text: "Por entrega, motorista, região e semana." },
  { icon: Wallet, title: "Acerto financeiro", text: "Frete, adiantamento e desconto por romaneio." },
  { icon: FileDown, title: "Relatórios em PDF", text: "Custos, eficiência e ocorrências do período." },
  { icon: ShieldAlert, title: "Áreas de risco", text: "Onde mais acontecem roubos de carga." },
  { icon: Users, title: "Perfis de acesso", text: "Admin, gestor, despachante e motorista." },
];

export function Features() {
  return (
    <section id="recursos" className="scroll-mt-nav border-y border-foreground/10 bg-card py-20 lg:py-28" aria-labelledby="recursos-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="Recursos" title="Tudo o que vem no painel." accent="no painel." lead="Do primeiro romaneio ao fechamento do mês. Alguns recursos dependem do plano: veja a tabela completa em Planos." />
        <Stagger className="mt-12 lg:mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" gap={0.03}>
          {ITEMS.map((i) => (
            <StaggerItem key={i.title}>
              <Tilt max={4} className="group flex h-full gap-3 rounded-2xl border border-foreground/10 bg-background p-4 hover:border-brand/50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-nhf-ink">
                  <i.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-heading text-[0.95rem] font-semibold">{i.title}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{i.text}</p>
                </div>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
