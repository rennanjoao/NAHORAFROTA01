import { useRef, useState, useEffect } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { MapPin, FileText, Camera, Wallet, Gauge, BarChart3, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { Spotlight } from "../motion/Spotlight";
import { MapPanel, ManifestPanel, ProofPanel, SettlementPanel } from "../components/mockups/Panels";

const CHAPTERS = [
  {
    id: "mapa",
    icon: MapPin,
    eyebrow: "Mapa ao vivo",
    title: "Cada placa, um ponto no mapa.",
    text: "A posição vem do celular do motorista, a cada 30 segundos, sem rastreador. Em rota, parado ou atrasado: a cor diz na hora.",
    bullets: ["Sem rastreador: o GPS do celular basta", "Parado há mais de 10 min vira alerta", "Filtro por motorista, região e status"],
    Panel: MapPanel,
    label: "Mapa ao vivo com veículos em rota, filtros e detalhe do motorista selecionado",
  },
  {
    id: "romaneio",
    icon: FileText,
    eyebrow: "Romaneio e entregas",
    title: "Importe o XML, monte o romaneio, despache.",
    text: "Notas em lote direto da NF-e, ordem das paradas otimizada e romaneio impresso ou no celular, em minutos.",
    bullets: ["XML da NF-e em lote, sem digitar", "Ordem das paradas otimizada em um clique", "Frete e tipo de frota definidos no despacho"],
    Panel: ManifestPanel,
    label: "Montagem de romaneio com notas importadas do XML, ordem otimizada e botão de despachar",
  },
  {
    id: "canhoto",
    icon: Camera,
    eyebrow: "Canhoto digital",
    title: "Prova de entrega com hora, foto e assinatura.",
    text: "O motorista confirma na porta do cliente. O comprovante entra no painel na mesma hora, ligado à nota.",
    bullets: ["Foto com hora e posição", "Assinatura e nome de quem recebeu", "Ligado à NF: acha em segundos"],
    Panel: ProofPanel,
    label: "Comprovante de entrega com foto, assinatura, recebedor e SLA cumprido",
  },
  {
    id: "acerto",
    icon: Wallet,
    eyebrow: "Acerto financeiro",
    title: "Frete, adiantamento, desconto. Acerto fechado.",
    text: "Cada romaneio de agregado gera o acerto sozinho. Histórico por motorista e chave Pix na tela para pagar.",
    bullets: ["Acerto por romaneio, automático", "Adiantamentos e descontos lançados", "Histórico por motorista e por semana"],
    Panel: SettlementPanel,
    label: "Acerto financeiro do motorista com frete, adiantamento, pedágio, total a pagar e chave Pix",
  },
];

const MORE = [
  { icon: Gauge, title: "SLA não se promete. Se mede.", text: "Diário e semanal, por motorista, por região e por entrega. Quem atrasa aparece. Quem cumpre também." },
  { icon: BarChart3, title: "Relatórios que fecham a reunião.", text: "Lucratividade por rota, eficiência por região, top ofensores. Exporte em PDF para a segunda-feira." },
  { icon: Users, title: "Cada um vê o que precisa.", text: "Administrador, gestor de frota, despachante e visualizador. Motorista só vê o romaneio dele." },
];

function Chapter({ c, index, onActive }: { c: (typeof CHAPTERS)[number]; index: number; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.55 });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);
  return (
    <div ref={ref} className="flex min-h-[60vh] flex-col justify-center py-10 lg:min-h-[78vh]">
      <p className="label-caps flex items-center gap-3 text-brand">
        <span className="font-data text-muted-foreground">0{index + 1}</span>
        <c.icon aria-hidden="true" className="h-4 w-4" />
        {c.eyebrow}
      </p>
      <h3 className="display-md mt-5 text-[clamp(1.8rem,3.4vw,2.8rem)]">{c.title}</h3>
      <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">{c.text}</p>
      <ul className="mt-6 space-y-2.5">
        {c.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/85">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
            {b}
          </li>
        ))}
      </ul>
      {/* no celular a tela aparece junto do texto */}
      <div className="mt-8 lg:hidden" role="img" aria-label={c.label}>
        <div aria-hidden="true">
          <c.Panel />
        </div>
      </div>
    </div>
  );
}

export function Product() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const Active = CHAPTERS[active].Panel;
  return (
    <section id="produto" className="scroll-mt-nav relative border-t hairline py-24 lg:py-36" aria-labelledby="produto-title">
      <div aria-hidden="true" className="orb right-[-200px] top-40 h-[600px] w-[600px] bg-brand/[0.07]" />
      <div className="container">
        <SectionHeader
          index="02"
          size="xl"
          eyebrow="O produto"
          title="O pátio inteiro numa tela."
          accent="numa tela."
          lead="Sete módulos que falam a língua do pátio: romaneio, rota, canhoto, SLA, acerto. Sem traduzir para inglês de software."
        />

        <div className="mt-10 grid gap-12 lg:mt-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            {CHAPTERS.map((c, i) => (
              <Chapter key={c.id} c={c} index={i} onActive={setActive} />
            ))}
          </div>

          {/* palco fixo */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="relative" role="img" aria-label={CHAPTERS[active].label}>
                <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[32px] bg-brand/10 blur-3xl" />
                <div aria-hidden="true" className="relative min-h-[460px]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={CHAPTERS[active].id}
                      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -14, scale: 0.985, filter: "blur(6px)" }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Active />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <ol aria-hidden="true" className="mt-5 flex items-center gap-2">
                {CHAPTERS.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className={cn("h-1 rounded-full transition-all duration-500", i === active ? "w-10 bg-brand" : "w-4 bg-foreground/15")} />
                  </li>
                ))}
                <li className="ml-auto font-data text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {CHAPTERS[active].eyebrow}
                </li>
              </ol>
            </div>
          </div>
        </div>

        <Stagger className="mt-16 grid gap-4 md:grid-cols-3 lg:mt-24" gap={0.08}>
          {MORE.map((m) => (
            <StaggerItem key={m.title}>
              <Spotlight as="article" className="spot-border h-full rounded-lg border hairline bg-card/60 p-6 transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                  <m.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-heading text-xl font-bold leading-tight tracking-tight">{m.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{m.text}</p>
              </Spotlight>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
